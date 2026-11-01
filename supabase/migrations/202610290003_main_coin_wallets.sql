begin;
-- site_wallets and currency_ledger remain the betting DEMO ledger. No demo
-- starting balance, stake refund or betting win can enter these accounts.
create table public.coin_accounts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid unique references public.profiles(id) on delete restrict,
 team_id uuid unique references public.teams(id) on delete restrict,
 balance bigint not null default 0,
 reserved bigint not null default 0 check(reserved>=0),
 updated_at timestamptz not null default now(),
 check((user_id is null)<>(team_id is null))
);
create table public.coin_admin_permissions(
 user_id uuid primary key references public.profiles(id) on delete cascade,
 granted_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create table public.coin_operations(
 id uuid primary key,
 actor_id uuid references public.profiles(id),
 action text not null, input jsonb not null default '{}',
 description text not null,
 reverses_id uuid unique references public.coin_operations(id),
 result jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.coin_entries(
 id bigint generated always as identity primary key,
 operation_id uuid not null references public.coin_operations(id),
 account_id uuid not null references public.coin_accounts(id),
 amount bigint not null, reserved_change bigint not null default 0,
 balance_after bigint not null, reserved_after bigint not null check(reserved_after>=0),
 created_at timestamptz not null default now(),
 unique(operation_id,account_id)
);
create index coin_entries_account_history on public.coin_entries(account_id,id desc);
create table public.coin_withdrawals(
 id uuid primary key references public.coin_operations(id),
 account_id uuid not null references public.coin_accounts(id),
 user_id uuid not null references public.profiles(id),
 amount bigint not null check(amount>0),
 status text not null default 'pending' check(status in('pending','paid','rejected','cancelled')),
 note text not null default '', admin_note text not null default '',
 resolved_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), resolved_at timestamptz
);

create function public.u6_coin_admin(p_actor uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.is_owner(p_actor) or (public.is_full_admin(p_actor) and exists(select 1 from coin_admin_permissions where user_id=p_actor))
$$;
create function public.u6_coin_account(p_kind text,p_owner uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if p_kind='player' then
   insert into coin_accounts(user_id) values(p_owner) on conflict(user_id) do nothing;
   select id into result from coin_accounts where user_id=p_owner;
 elsif p_kind='organization' then
   insert into coin_accounts(team_id) values(p_owner) on conflict(team_id) do nothing;
   select id into result from coin_accounts where team_id=p_owner;
 else raise exception 'Неверный тип кошелька';end if;
 return result;
end $$;
create function public.u6_coin_entry(p_operation uuid,p_account uuid,p_amount bigint,p_reserved bigint default 0) returns void
language plpgsql security definer set search_path=public as $$
declare a coin_accounts%rowtype;
begin
 update coin_accounts set balance=balance+p_amount,reserved=reserved+p_reserved,updated_at=now()
 where id=p_account returning * into strict a;
 insert into coin_entries(operation_id,account_id,amount,reserved_change,balance_after,reserved_after)
 values(p_operation,a.id,p_amount,p_reserved,a.balance,a.reserved);
end $$;

create function public.u6_coin_action(p_actor uuid,p_request uuid,p_action text,p_input jsonb) returns jsonb
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
   -- Reservations survive an administrative correction. A resulting shortfall
   -- is explicit debt; funding commitments are not silently freed.
   perform public.u6_coin_entry(p_request,a.id,amount);
 elsif p_action='transfer' then
   amount:=(p_input->>'amount')::bigint;
   if amount is null or amount<=0 or amount>1000000000000 then raise exception 'Проверьте сумму';end if;
   if (p_input->>'userId')::uuid=p_actor and p_input->>'teamId' is null then raise exception 'Нельзя переводить самому себе';end if;
   if p_input->>'teamId' is not null then
     if not exists(select 1 from team_members where team_id=(p_input->>'teamId')::uuid and user_id=p_actor and role_in_team='leader') then raise exception 'Переводы организации доступны её руководителю';end if;
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
     if not exists(select 1 from team_members where team_id=(p_input->>'teamId')::uuid and user_id=p_actor and role_in_team='leader') then raise exception 'Вывод организации доступен её руководителю';end if;
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

alter table coin_accounts enable row level security;
alter table coin_entries enable row level security;
alter table coin_operations enable row level security;
alter table coin_withdrawals enable row level security;
alter table coin_admin_permissions enable row level security;
-- Financial reads/writes go through authenticated server endpoints. No public
-- table grants; admin API applies explicit owner/member filters.
revoke all on coin_accounts,coin_entries,coin_operations,coin_withdrawals,coin_admin_permissions from anon,authenticated;
grant all on coin_accounts,coin_entries,coin_operations,coin_withdrawals,coin_admin_permissions to service_role;
revoke all on sequence coin_entries_id_seq from anon,authenticated;
grant usage,select on sequence coin_entries_id_seq to service_role;
do $$ declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'u6_coin_%' loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;
end $$;
grant execute on function u6_coin_action(uuid,uuid,text,jsonb),u6_coin_admin(uuid) to service_role;

-- The owner's explicitly requested grant predates the wallet split. Move only
-- that identified grant, not any demo starting funds/winnings. Both ledgers
-- remain auditable and retries cannot duplicate the real balance.
do $$
declare grant_row currency_ledger%rowtype;account_id uuid;demo_balance bigint;
begin
 select * into grant_row from currency_ledger where id='6b387a6c-b825-477d-a7b1-f8cf95d4efbb'
 and amount=1000000 and reference_type='creator_grant' and public.is_owner(user_id);
 if found and not exists(select 1 from coin_operations where id=grant_row.id) then
   account_id:=public.u6_coin_account('player',grant_row.user_id);
   insert into coin_operations(id,actor_id,action,input,description,result)
   values(grant_row.id,grant_row.user_id,'creator_grant','{}','Начисление создателю проекта — перенос на основной баланс',jsonb_build_object('success',true,'operationId',grant_row.id));
   update site_wallets set balance=balance-grant_row.amount,updated_at=now() where user_id=grant_row.user_id returning balance into strict demo_balance;
   insert into currency_ledger(user_id,amount,balance_after,operation_type,reference_type,reference_id,description)
   values(grant_row.user_id,-grant_row.amount,demo_balance,'correction','creator_grant_transfer',grant_row.id,'Начисление создателю перенесено на основной баланс');
   perform public.u6_coin_entry(grant_row.id,account_id,grant_row.amount);
 end if;
end $$;
commit;
