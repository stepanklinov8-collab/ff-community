-- Reliable leadership transfers and recoverable organization dissolution.

begin;

alter table public.teams
  add column if not exists dissolved_at timestamptz,
  add column if not exists dissolved_by uuid references auth.users(id) on delete set null;

create index if not exists teams_active_verified_idx
  on public.teams(verified, created_at desc)
  where dissolved_at is null;

create table if not exists public.leadership_transfers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint leadership_transfer_different_users check (from_user_id <> to_user_id)
);

-- The live project may contain the earlier manually-created version of this table.
alter table public.leadership_transfers
  add column if not exists responded_at timestamptz;

alter table public.leadership_transfers
  drop constraint if exists leadership_transfers_status_check;
alter table public.leadership_transfers
  add constraint leadership_transfers_status_check
  check (status in ('pending', 'accepted', 'rejected', 'cancelled'));

-- Legacy UI allowed several pending requests for the same organization.
-- Keep the newest request and close stale duplicates before enforcing uniqueness.
with ranked_pending as (
  select
    transfer.id,
    row_number() over (
      partition by transfer.team_id
      order by transfer.created_at desc, transfer.id desc
    ) as pending_rank
  from public.leadership_transfers transfer
  where transfer.status = 'pending'
)
update public.leadership_transfers transfer
set status = 'cancelled', responded_at = now()
from ranked_pending ranked
where transfer.id = ranked.id and ranked.pending_rank > 1;

create unique index if not exists leadership_transfers_one_pending_per_team
  on public.leadership_transfers(team_id)
  where status = 'pending';

create index if not exists leadership_transfers_recipient_idx
  on public.leadership_transfers(to_user_id, status, created_at desc);

alter table public.leadership_transfers enable row level security;

drop policy if exists "leadership transfers visible to participants" on public.leadership_transfers;
create policy "leadership transfers visible to participants" on public.leadership_transfers
for select using (from_user_id = auth.uid() or to_user_id = auth.uid() or public.is_app_admin());

-- Managers of dissolved organizations must lose management access immediately.
create or replace function public.can_manage_team(check_team_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_app_admin(check_user_id) or exists (
    select 1
    from public.team_members membership
    join public.teams organization on organization.id = membership.team_id
    where membership.team_id = check_team_id
      and membership.user_id = check_user_id
      and membership.role_in_team in ('leader', 'senior_deputy', 'deputy')
      and organization.dissolved_at is null
  );
$$;

create or replace function public.request_team_leadership_transfer(
  p_team_id uuid,
  p_to_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  organization public.teams%rowtype;
  transfer_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into organization
  from public.teams
  where id = p_team_id
  for update;

  if not found or organization.dissolved_at is not null then
    raise exception 'Organization not found';
  end if;
  if organization.leader_id <> auth.uid() then
    raise exception 'Only the current leader can transfer leadership';
  end if;
  if p_to_user_id = auth.uid() then
    raise exception 'Choose another organization member';
  end if;
  if not exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = p_to_user_id
  ) then
    raise exception 'The new leader must be an organization member';
  end if;

  update public.leadership_transfers
  set status = 'cancelled', responded_at = now()
  where team_id = p_team_id and status = 'pending';

  insert into public.leadership_transfers (team_id, from_user_id, to_user_id)
  values (p_team_id, auth.uid(), p_to_user_id)
  returning id into transfer_id;

  insert into public.notifications (user_id, type, title, body, link)
  values (
    p_to_user_id,
    'leadership_transfer',
    'Вам предлагают лидерство',
    format('Лидер «%s» предлагает передать вам управление организацией', organization.name),
    format('/teams/%s', p_team_id)
  );

  return transfer_id;
end;
$$;

create or replace function public.respond_team_leadership_transfer(
  p_transfer_id uuid,
  p_accept boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  transfer public.leadership_transfers%rowtype;
  organization public.teams%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into transfer
  from public.leadership_transfers
  where id = p_transfer_id
  for update;

  if not found or transfer.status <> 'pending' then
    raise exception 'Leadership transfer is no longer active';
  end if;
  if transfer.to_user_id <> auth.uid() then
    raise exception 'Only the selected member can answer this request';
  end if;

  select * into organization
  from public.teams
  where id = transfer.team_id
  for update;

  if not found or organization.dissolved_at is not null then
    raise exception 'Organization not found';
  end if;
  if organization.leader_id <> transfer.from_user_id then
    raise exception 'The organization leader has changed';
  end if;

  if not p_accept then
    update public.leadership_transfers
    set status = 'rejected', responded_at = now()
    where id = transfer.id;

    insert into public.notifications (user_id, type, title, body, link)
    values (
      transfer.from_user_id,
      'leadership_transfer',
      'Передача лидерства отклонена',
      format('Участник отклонил предложение возглавить «%s»', organization.name),
      format('/teams/%s', organization.id)
    );
    return 'rejected';
  end if;

  if not exists (
    select 1 from public.team_members
    where team_id = organization.id and user_id = transfer.to_user_id
    for update
  ) then
    raise exception 'The selected member has left the organization';
  end if;

  -- Demote the old leader first so the one-leader trigger remains satisfied.
  update public.team_members
  set role_in_team = 'main'
  where team_id = organization.id and user_id = transfer.from_user_id;

  update public.team_members
  set role_in_team = 'leader'
  where team_id = organization.id and user_id = transfer.to_user_id;

  update public.teams
  set leader_id = transfer.to_user_id, updated_at = now()
  where id = organization.id;

  update public.leadership_transfers
  set status = 'accepted', responded_at = now()
  where id = transfer.id;

  update public.leadership_transfers
  set status = 'cancelled', responded_at = now()
  where team_id = organization.id and status = 'pending' and id <> transfer.id;

  insert into public.activity_log (user_id, team_id, action, details, activity_type, description)
  values (
    transfer.to_user_id,
    organization.id,
    'leadership_transferred',
    format('Передано лидерство в «%s»', organization.name),
    'leadership_transferred',
    format('У «%s» сменился лидер', organization.name)
  );

  insert into public.notifications (user_id, type, title, body, link)
  values
    (transfer.from_user_id, 'leadership_transfer', 'Лидерство передано', format('У «%s» новый лидер', organization.name), format('/teams/%s', organization.id)),
    (transfer.to_user_id, 'leadership_transfer', 'Вы стали лидером', format('Теперь вы управляете «%s»', organization.name), format('/teams/%s', organization.id));

  return 'accepted';
end;
$$;

create or replace function public.dissolve_organization(p_team_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  organization public.teams%rowtype;
  registration_id uuid;
  market_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into organization
  from public.teams
  where id = p_team_id
  for update;

  if not found then raise exception 'Organization not found'; end if;
  if organization.dissolved_at is not null then return organization.type; end if;
  if organization.leader_id <> auth.uid() and not public.is_superadmin(auth.uid()) then
    raise exception 'Only the leader can dissolve the organization';
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  select
    membership.user_id,
    'organization_dissolved',
    case when organization.type = 'guild' then 'Гильдия распущена' else 'Команда распущена' end,
    format('«%s» больше не участвует в работе платформы', organization.name),
    '/teams'
  from public.team_members membership
  where membership.team_id = organization.id;

  update public.leadership_transfers
  set status = 'cancelled', responded_at = now()
  where team_id = organization.id and status = 'pending';

  update public.team_invitations
  set status = 'cancelled', responded_at = now()
  where team_id = organization.id and status = 'pending';

  update public.team_join_requests
  set status = 'cancelled', reviewed_by = auth.uid(), reviewed_at = now()
  where team_id = organization.id and status = 'pending';

  -- Use the normal cancellation workflow so replacements move up from waiting lists.
  for registration_id in
    select registration.id from public.event_registrations registration
    where registration.team_id = organization.id and registration.status in ('confirmed', 'waiting')
    order by registration.created_at
  loop
    perform public.cancel_session_registration(registration_id, 'Организация распущена');
  end loop;

  update public.clan_war_responses
  set status = 'withdrawn', responded_at = now(), updated_at = now()
  where team_id = organization.id and status = 'pending';

  update public.clan_wars
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_reason = 'Организация распущена',
      updated_at = now()
  where status in ('open', 'pending', 'agreed')
    and (creator_team_id = organization.id or opponent_team_id = organization.id);

  -- A cancelled КВ cannot keep money locked in open bets.
  update public.betting_sources source
  set enabled = false, updated_at = now()
  where source.clan_war_id in (
    select war.id from public.clan_wars war
    where war.cancellation_reason = 'Организация распущена'
      and (war.creator_team_id = organization.id or war.opponent_team_id = organization.id)
  );

  delete from public.betting_quotes quote
  where quote.confirmed_at is null
    and quote.clan_war_id in (
      select war.id from public.clan_wars war
      where war.cancellation_reason = 'Организация распущена'
        and (war.creator_team_id = organization.id or war.opponent_team_id = organization.id)
    );

  for market_id in
    select market.id
    from public.betting_markets market
    join public.clan_wars war on war.id = market.clan_war_id
    where market.status in ('open', 'locked')
      and war.cancellation_reason = 'Организация распущена'
      and (war.creator_team_id = organization.id or war.opponent_team_id = organization.id)
  loop
    perform public.settle_betting_market(market_id, 'void', auth.uid());
  end loop;

  update public.teams
  set dissolved_at = now(), dissolved_by = auth.uid(), verified = false, updated_at = now()
  where id = organization.id;

  insert into public.activity_log (user_id, team_id, action, details, activity_type, description)
  values (
    auth.uid(),
    organization.id,
    'organization_dissolved',
    format('Распущена организация «%s»', organization.name),
    'organization_dissolved',
    format('%s «%s» распущена', case when organization.type = 'guild' then 'Гильдия' else 'Команда' end, organization.name)
  );

  -- Removing memberships immediately releases the one-team/one-guild slot.
  delete from public.team_members where team_id = organization.id;

  return organization.type;
end;
$$;

revoke all on function public.request_team_leadership_transfer(uuid, uuid) from public, anon;
revoke all on function public.respond_team_leadership_transfer(uuid, boolean) from public, anon;
revoke all on function public.dissolve_organization(uuid) from public, anon;
grant execute on function public.request_team_leadership_transfer(uuid, uuid) to authenticated;
grant execute on function public.respond_team_leadership_transfer(uuid, boolean) to authenticated;
grant execute on function public.dissolve_organization(uuid) to authenticated;

commit;
