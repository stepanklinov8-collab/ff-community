-- Separate organization ownership from the roster leader role. This migration
-- only backfills the current leader as owner; it does not alter membership.
begin;

alter table public.teams
  add column if not exists owner_user_id uuid references auth.users(id) on delete restrict;

update public.teams
set owner_user_id = leader_id
where owner_user_id is null
  and leader_id is not null;

create index if not exists teams_owner_user_active_idx
  on public.teams(owner_user_id, name)
  where dissolved_at is null;

create or replace function public.set_initial_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Creation starts with the creator as both leader and owner. Ownership is
  -- changed later only by a dedicated atomic sale/transfer RPC.
  new.owner_user_id := new.leader_id;
  return new;
end;
$$;

drop trigger if exists set_initial_organization_owner_trigger on public.teams;
create trigger set_initial_organization_owner_trigger
before insert on public.teams
for each row execute function public.set_initial_organization_owner();

create or replace function public.prevent_direct_organization_owner_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id
     and current_setting('omcite.allow_organization_owner_transfer', true) is distinct from 'on' then
    raise exception 'Изменить владельца можно только завершённой сделкой';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_direct_organization_owner_change_trigger on public.teams;
create trigger prevent_direct_organization_owner_change_trigger
before update of owner_user_id on public.teams
for each row execute function public.prevent_direct_organization_owner_change();

create table if not exists public.organization_contract_access (
  team_id uuid not null references public.teams(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists organization_contract_access_user_idx
  on public.organization_contract_access(user_id, team_id);

create table if not exists public.organization_control_audit (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.teams(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in (
    'leader_changed',
    'leader_removed_from_roster',
    'contract_access_granted',
    'contract_access_revoked',
    'contract_access_revoked_member_removed'
  )),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists organization_control_audit_team_created_idx
  on public.organization_control_audit(team_id, created_at desc, id desc);

alter table public.organization_contract_access enable row level security;
alter table public.organization_control_audit enable row level security;

grant select on public.organization_contract_access, public.organization_control_audit to authenticated;
grant select, insert, update, delete on public.organization_contract_access, public.organization_control_audit to service_role;
grant usage, select on sequence public.organization_control_audit_id_seq to service_role;

create or replace function public.is_organization_owner(
  p_team_id uuid,
  p_actor uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_actor is not null and exists (
    select 1 from public.teams organization
    where organization.id = p_team_id
      and organization.owner_user_id = p_actor
      and organization.dissolved_at is null
  );
$$;

create or replace function public.can_manage_organization_contracts(
  p_team_id uuid,
  p_actor uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_actor is not null and exists (
    select 1
    from public.teams organization
    where organization.id = p_team_id
      and organization.dissolved_at is null
      and (
        organization.owner_user_id = p_actor
        or organization.leader_id = p_actor
        or exists (
          select 1 from public.organization_contract_access access
          join public.team_members membership
            on membership.team_id = access.team_id and membership.user_id = access.user_id
          where access.team_id = p_team_id and access.user_id = p_actor
        )
      )
  );
$$;

revoke all on function public.is_organization_owner(uuid, uuid) from public, anon;
revoke all on function public.can_manage_organization_contracts(uuid, uuid) from public, anon;
grant execute on function public.is_organization_owner(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_manage_organization_contracts(uuid, uuid) to authenticated, service_role;

create or replace function public.can_manage_team(check_team_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_app_admin(check_user_id)
    or public.is_organization_owner(check_team_id, check_user_id)
    or exists (
      select 1 from public.team_members
      where team_id = check_team_id
        and user_id = check_user_id
        and role_in_team in ('leader', 'senior_deputy', 'deputy')
    );
$$;

revoke all on function public.can_manage_team(uuid, uuid) from public, anon;
grant execute on function public.can_manage_team(uuid, uuid) to authenticated, service_role;

drop policy if exists "organization owner reads contract access" on public.organization_contract_access;
create policy "organization owner reads contract access" on public.organization_contract_access
for select to authenticated
using (public.is_organization_owner(team_id, auth.uid()));

drop policy if exists "organization owner reads control audit" on public.organization_control_audit;
create policy "organization owner reads control audit" on public.organization_control_audit
for select to authenticated
using (public.is_organization_owner(team_id, auth.uid()));

create or replace function public.organization_owner_set_leader(
  p_team_id uuid,
  p_new_leader_id uuid,
  p_remove_previous_member boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  organization public.teams%rowtype;
  old_leader_id uuid;
  new_nickname text;
  old_is_member boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_new_leader_id is null then raise exception 'Выберите нового руководителя'; end if;

  select * into organization
  from public.teams
  where id = p_team_id
  for update;
  if not found or organization.dissolved_at is not null then raise exception 'Организация не найдена'; end if;
  if organization.owner_user_id is distinct from auth.uid() then raise exception 'Только владелец может назначить руководителя'; end if;

  old_leader_id := organization.leader_id;
  if p_new_leader_id = old_leader_id then raise exception 'Выберите другого участника'; end if;
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_new_leader_id
    for update
  ) then raise exception 'Новый руководитель должен состоять в организации'; end if;

  select exists (
    select 1 from public.team_members where team_id = p_team_id and user_id = old_leader_id
  ) into old_is_member;

  if old_is_member then
    update public.team_members
    set role_in_team = 'main'
    where team_id = p_team_id and user_id = old_leader_id;
  end if;

  update public.team_members
  set role_in_team = 'leader'
  where team_id = p_team_id and user_id = p_new_leader_id;

  update public.teams
  set leader_id = p_new_leader_id, updated_at = now()
  where id = p_team_id;

  if p_remove_previous_member and old_is_member then
    delete from public.team_members
    where team_id = p_team_id and user_id = old_leader_id;
    insert into public.organization_control_audit(team_id, actor_user_id, target_user_id, action, details)
    values (p_team_id, auth.uid(), old_leader_id, 'leader_removed_from_roster', jsonb_build_object('newLeaderId', p_new_leader_id));
  end if;

  update public.leadership_transfers
  set status = 'cancelled', responded_at = now()
  where team_id = p_team_id and status = 'pending';

  insert into public.organization_control_audit(team_id, actor_user_id, target_user_id, action, details)
  values (p_team_id, auth.uid(), p_new_leader_id, 'leader_changed', jsonb_build_object(
    'previousLeaderId', old_leader_id,
    'previousLeaderKeptAsMember', not p_remove_previous_member or not old_is_member
  ));

  insert into public.activity_log(user_id, team_id, action, details, activity_type, description)
  values (auth.uid(), p_team_id, 'leadership_transferred',
    format('Владелец организации «%s» назначил нового руководителя', organization.name),
    'leadership_transferred', format('У «%s» сменился руководитель', organization.name));

  select nickname into new_nickname from public.profiles where id = p_new_leader_id;
  insert into public.notifications(user_id, type, title, body, link)
  values
    (old_leader_id, 'leadership_transfer', 'Полномочия руководителя изменены', format('В организации «%s» назначен новый руководитель', organization.name), format('/teams/%s', p_team_id)),
    (p_new_leader_id, 'leadership_transfer', 'Вы назначены руководителем', format('Владелец назначил вас руководителем организации «%s»', organization.name), format('/teams/%s', p_team_id));

  return jsonb_build_object('teamId', p_team_id, 'oldLeaderId', old_leader_id,
    'newLeaderId', p_new_leader_id, 'previousLeaderRemoved', p_remove_previous_member and old_is_member,
    'newLeaderNickname', new_nickname);
end;
$$;

create or replace function public.organization_owner_set_contract_access(
  p_team_id uuid,
  p_user_id uuid,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  organization public.teams%rowtype;
  changed boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into organization from public.teams where id = p_team_id for update;
  if not found or organization.dissolved_at is not null then raise exception 'Организация не найдена'; end if;
  if organization.owner_user_id is distinct from auth.uid() then raise exception 'Только владелец может выдавать доступ'; end if;
  if p_user_id is null or p_user_id = organization.owner_user_id then raise exception 'Укажите участника'; end if;

  if p_enabled then
    if not exists(select 1 from public.team_members where team_id = p_team_id and user_id = p_user_id) then
      raise exception 'Доступ к контрактам можно выдать только участнику организации';
    end if;
    if p_user_id = organization.leader_id then raise exception 'Руководитель уже имеет доступ к контрактам'; end if;
    insert into public.organization_contract_access(team_id, user_id, granted_by)
    values (p_team_id, p_user_id, auth.uid())
    on conflict (team_id, user_id) do nothing;
    changed := found;
    if changed then
      insert into public.organization_control_audit(team_id, actor_user_id, target_user_id, action)
      values (p_team_id, auth.uid(), p_user_id, 'contract_access_granted');
    end if;
  else
    delete from public.organization_contract_access where team_id = p_team_id and user_id = p_user_id;
    changed := found;
    if changed then
      insert into public.organization_control_audit(team_id, actor_user_id, target_user_id, action)
      values (p_team_id, auth.uid(), p_user_id, 'contract_access_revoked');
    end if;
  end if;
  return changed;
end;
$$;

create or replace function public.revoke_contract_access_on_member_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_count integer;
begin
  delete from public.organization_contract_access
  where team_id = old.team_id and user_id = old.user_id;
  get diagnostics removed_count = row_count;
  if removed_count > 0 then
    insert into public.organization_control_audit(team_id, actor_user_id, target_user_id, action)
    values (old.team_id, auth.uid(), old.user_id, 'contract_access_revoked_member_removed');
  end if;
  return old;
end;
$$;

drop trigger if exists revoke_contract_access_on_member_removal_trigger on public.team_members;
create trigger revoke_contract_access_on_member_removal_trigger
after delete on public.team_members
for each row execute function public.revoke_contract_access_on_member_removal();

revoke all on function public.organization_owner_set_leader(uuid, uuid, boolean) from public, anon;
revoke all on function public.organization_owner_set_contract_access(uuid, uuid, boolean) from public, anon;
grant execute on function public.organization_owner_set_leader(uuid, uuid, boolean) to authenticated;
grant execute on function public.organization_owner_set_contract_access(uuid, uuid, boolean) to authenticated;

-- Organization funds remain spendable by exactly the current leader or owner.
-- Deputies and contract delegates do not gain financial authority.
create or replace function public.u6_coin_action(p_actor uuid,p_request uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare old coin_operations%rowtype;a coin_accounts%rowtype;b uuid;amount bigint;reason text;
 w coin_withdrawals%rowtype;entry record;v_result jsonb;owner_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_actor is null or not exists(select 1 from profiles where id=p_actor) then raise exception 'Требуется вход';end if;
 select * into old from coin_operations where id=p_request;
 if found then
   if old.actor_id is distinct from p_actor or old.action<>p_action or old.input<>p_input then raise exception 'Конфликт ключа операции';end if;
   return old.result;
 end if;
 reason:=left(trim(coalesce(p_input->>'reason','')),1000);
 if p_action in('adjust','reset','reverse','withdraw_paid','withdraw_reject') then
   if not public.u6_coin_admin(p_actor) then raise exception 'Нет прав на управление балансами';end if;
   if reason='' then raise exception 'Укажите причину или подтверждение выплаты';end if;
 end if;
 insert into coin_operations(id,actor_id,action,input,description) values(p_request,p_actor,p_action,p_input,reason);
 if p_action='permission' then
   if not public.is_owner(p_actor) then raise exception 'Требуются права суперадминистратора';end if;
   owner_id:=(p_input->>'userId')::uuid;
   if (p_input->>'enabled')::boolean then
     if not public.is_full_admin(owner_id) then raise exception 'Выберите администратора';end if;
     insert into coin_admin_permissions(user_id,granted_by) values(owner_id,p_actor) on conflict(user_id) do nothing;
   else delete from coin_admin_permissions where user_id=owner_id;end if;
 elsif p_action in('adjust','reset') then
   b:=public.u6_coin_account(p_input->>'kind',(p_input->>'ownerId')::uuid); select * into strict a from coin_accounts where id=b for update;
   amount:=case when p_action='reset' then -a.balance else (p_input->>'amount')::bigint end;
   if amount is null or abs(amount::numeric)>1000000000000 then raise exception 'Проверьте сумму';end if;
   perform public.u6_coin_entry(p_request,a.id,amount);
 elsif p_action='transfer' then
   amount:=(p_input->>'amount')::bigint;
   if amount is null or amount<=0 or amount>1000000000000 then raise exception 'Проверьте сумму';end if;
   if (p_input->>'userId')::uuid=p_actor and p_input->>'teamId' is null then raise exception 'Нельзя переводить самому себе';end if;
   if p_input->>'teamId' is not null then
     if not exists(select 1 from teams organization where organization.id=(p_input->>'teamId')::uuid and organization.dissolved_at is null and (organization.leader_id=p_actor or organization.owner_user_id=p_actor
       or exists(select 1 from team_members membership where membership.team_id=organization.id and membership.user_id=p_actor and membership.role_in_team='leader'))) then raise exception 'Распоряжаться балансом организации может её владелец или руководитель';end if;
     b:=public.u6_coin_account('organization',(p_input->>'teamId')::uuid); select * into strict a from coin_accounts where id=b for update;
   else b:=public.u6_coin_account('player',p_actor); select * into strict a from coin_accounts where id=b for update;end if;
   if a.balance-a.reserved<amount then raise exception 'Недостаточно доступных монет';end if;
   b:=public.u6_coin_account('player',(p_input->>'userId')::uuid);
   perform public.u6_coin_entry(p_request,a.id,-amount);
   perform public.u6_coin_entry(p_request,b,amount);
   reason:='Перевод игроку';
 elsif p_action='withdraw_request' then
   amount:=(p_input->>'amount')::bigint;
   if amount is null or amount<=0 or amount>1000000000000 then raise exception 'Проверьте сумму';end if;
   if nullif(trim(p_input->>'note'),'') is null then raise exception 'Укажите реквизиты для перевода';end if;
   if p_input->>'teamId' is not null then
     if not exists(select 1 from teams organization where organization.id=(p_input->>'teamId')::uuid and organization.dissolved_at is null and (organization.leader_id=p_actor or organization.owner_user_id=p_actor
       or exists(select 1 from team_members membership where membership.team_id=organization.id and membership.user_id=p_actor and membership.role_in_team='leader'))) then raise exception 'Запросить выплату с баланса организации может её владелец или руководитель';end if;
     b:=public.u6_coin_account('organization',(p_input->>'teamId')::uuid); select * into strict a from coin_accounts where id=b for update;
   else b:=public.u6_coin_account('player',p_actor); select * into strict a from coin_accounts where id=b for update;end if;
   if a.balance-a.reserved<amount then raise exception 'Недостаточно доступных монет';end if;
   perform public.u6_coin_entry(p_request,a.id,0,amount);
   insert into coin_withdrawals(id,account_id,user_id,amount,note)
   values(p_request,a.id,p_actor,amount,left(coalesce(p_input->>'note',''),2000));
   reason:='Резерв по заявке на вывод';
 elsif p_action in('withdraw_paid','withdraw_reject','withdraw_cancel') then
   select * into w from coin_withdrawals where id=(p_input->>'withdrawalId')::uuid for update;
   if not found then raise exception 'Заявка не найдена';end if;
   if w.status<>'pending' then raise exception 'Заявка уже обработана';end if;
   if p_action='withdraw_cancel' and w.user_id<>p_actor then raise exception 'Нет прав';end if;
   perform public.u6_coin_entry(p_request,w.account_id,case when p_action='withdraw_paid' then -w.amount else 0 end,-w.amount);
   update coin_withdrawals set status=case p_action when 'withdraw_paid' then 'paid' when 'withdraw_reject' then 'rejected' else 'cancelled' end,
     resolved_by=p_actor,resolved_at=now(),admin_note=reason where id=w.id;
 elsif p_action='reverse' then
   select * into old from coin_operations where id=(p_input->>'operationId')::uuid;
   if not found then raise exception 'Операция не найдена';end if;
   if old.action not in('transfer','adjust','reset','creator_grant') then raise exception 'Для этой операции требуется отмена заявки или исправление результатов';end if;
   if exists(select 1 from coin_operations where reverses_id=old.id) then raise exception 'Операция уже отменена';end if;
   update coin_operations set reverses_id=old.id where id=p_request;
   for entry in select * from coin_entries where operation_id=old.id order by account_id loop
     perform public.u6_coin_entry(p_request,entry.account_id,-entry.amount);
   end loop;
 else raise exception 'Неизвестная операция';end if;
 update coin_operations set description=case when reason='' then p_action else reason end where id=p_request;
 v_result:=jsonb_build_object('success',true,'operationId',p_request);
 update coin_operations op set result=v_result where op.id=p_request;
 return v_result;
end $$;

revoke all on function public.u6_coin_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.u6_coin_action(uuid,uuid,text,jsonb) to service_role;

commit;
