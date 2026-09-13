-- Stability release: reliable identities, registration diagnostics, immediate
-- organization leadership transfer and indexes for public event pages.
begin;

-- Recoverable snapshots of the tables touched by this release. The schema is
-- not exposed through the public API and can be removed after the release has
-- been verified in production.
create schema if not exists backup_stability_20260913;
revoke all on schema backup_stability_20260913 from public, anon, authenticated;
create table if not exists backup_stability_20260913.profiles as select * from public.profiles;
create table if not exists backup_stability_20260913.teams as select * from public.teams;
create table if not exists backup_stability_20260913.team_members as select * from public.team_members;
create table if not exists backup_stability_20260913.leadership_transfers as select * from public.leadership_transfers;

create table if not exists public.registration_attempt_logs (
  id bigint generated always as identity primary key,
  outcome text not null check (outcome in ('success', 'error')),
  error_code text not null,
  email_domain text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_identity_conflicts (
  conflict_kind text not null check (conflict_kind in ('nickname', 'game_id')),
  conflict_value text not null,
  user_ids uuid[] not null,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (conflict_kind, conflict_value)
);

create table if not exists public.admin_action_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.profile_identity_conflicts (conflict_kind, conflict_value, user_ids)
select 'nickname', nickname, array_agg(id order by id)
from public.profiles
where nickname is not null and btrim(nickname) <> ''
group by nickname
having count(*) > 1
on conflict (conflict_kind, conflict_value) do update
set user_ids = excluded.user_ids, detected_at = now(), resolved_at = null;

insert into public.profile_identity_conflicts (conflict_kind, conflict_value, user_ids)
select 'game_id', game_id, array_agg(id order by id)
from public.profiles
where game_id is not null and btrim(game_id) <> ''
group by game_id
having count(*) > 1
on conflict (conflict_kind, conflict_value) do update
set user_ids = excluded.user_ids, detected_at = now(), resolved_at = null;

create index if not exists profiles_nickname_lookup_idx on public.profiles(nickname);
create index if not exists events_public_schedule_idx
  on public.events(is_published, publish_at, created_at desc);
create index if not exists event_sessions_event_start_idx
  on public.event_sessions(event_id, start_time);
create index if not exists event_registrations_session_status_idx
  on public.event_registrations(session_id, status);

create or replace function public.enforce_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.nickname := btrim(coalesce(new.nickname, ''));
  if new.nickname = '' or char_length(new.nickname) > 20 then
    raise exception 'INVALID_NICKNAME';
  end if;

  if new.game_id is not null then
    new.game_id := nullif(btrim(new.game_id), '');
    if new.game_id is not null and new.game_id !~ '^[0-9]+$' then
      raise exception 'INVALID_GAME_ID';
    end if;
  end if;

  if (tg_op = 'INSERT' or new.nickname is distinct from old.nickname) and exists (
    select 1 from public.profiles existing
    where existing.nickname = new.nickname and existing.id <> new.id
  ) then
    raise exception 'NICKNAME_ALREADY_USED';
  end if;

  if new.game_id is not null
    and (tg_op = 'INSERT' or new.game_id is distinct from old.game_id)
    and exists (
      select 1 from public.profiles existing
      where existing.game_id = new.game_id and existing.id <> new.id
    ) then
    raise exception 'GAME_ID_ALREADY_USED';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_profile_identity_trigger on public.profiles;
create trigger enforce_profile_identity_trigger
before insert or update of nickname, game_id on public.profiles
for each row execute function public.enforce_profile_identity();

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_nickname text := btrim(coalesce(new.raw_user_meta_data ->> 'nickname', ''));
  normalized_game_id text := btrim(coalesce(new.raw_user_meta_data ->> 'game_id', ''));
begin
  if normalized_nickname = '' or char_length(normalized_nickname) > 20 then
    raise exception 'INVALID_NICKNAME';
  end if;
  if normalized_game_id = '' or normalized_game_id !~ '^[0-9]+$' then
    raise exception 'INVALID_GAME_ID';
  end if;
  if exists (select 1 from public.profiles where nickname = normalized_nickname) then
    raise exception 'NICKNAME_ALREADY_USED';
  end if;
  if exists (select 1 from public.profiles where game_id = normalized_game_id) then
    raise exception 'GAME_ID_ALREADY_USED';
  end if;

  insert into public.profiles (id, nickname, game_id, avatar_url)
  values (
    new.id,
    normalized_nickname,
    normalized_game_id,
    nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), '')
  );
  return new;
end;
$$;

create or replace function public.transfer_team_leadership(
  p_team_id uuid,
  p_to_user_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  organization public.teams%rowtype;
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
    for update
  ) then
    raise exception 'The new leader must be an organization member';
  end if;

  update public.team_members
  set role_in_team = 'main'
  where team_id = p_team_id and user_id = auth.uid();

  update public.team_members
  set role_in_team = 'leader'
  where team_id = p_team_id and user_id = p_to_user_id;

  update public.teams
  set leader_id = p_to_user_id, updated_at = now()
  where id = p_team_id;

  update public.leadership_transfers
  set status = 'cancelled', responded_at = now()
  where team_id = p_team_id and status = 'pending';

  insert into public.activity_log (user_id, team_id, action, details, activity_type, description)
  values (
    p_to_user_id,
    p_team_id,
    'leadership_transferred',
    format('Передано лидерство в «%s»', organization.name),
    'leadership_transferred',
    format('У «%s» сменился лидер', organization.name)
  );

  insert into public.notifications (user_id, type, title, body, link)
  values
    (auth.uid(), 'leadership_transfer', 'Лидерство передано', format('У «%s» новый лидер', organization.name), format('/teams/%s', p_team_id)),
    (p_to_user_id, 'leadership_transfer', 'Вы стали лидером', format('Теперь вы управляете «%s»', organization.name), format('/teams/%s', p_team_id));

  return 'transferred';
end;
$$;

revoke all on function public.transfer_team_leadership(uuid, uuid) from public, anon;
grant execute on function public.transfer_team_leadership(uuid, uuid) to authenticated;

alter table public.registration_attempt_logs enable row level security;
alter table public.profile_identity_conflicts enable row level security;
alter table public.admin_action_logs enable row level security;

drop policy if exists "superadmin reads registration logs" on public.registration_attempt_logs;
create policy "superadmin reads registration logs" on public.registration_attempt_logs
for select using (public.is_owner());

drop policy if exists "superadmin reads identity conflicts" on public.profile_identity_conflicts;
create policy "superadmin reads identity conflicts" on public.profile_identity_conflicts
for select using (public.is_owner());

drop policy if exists "superadmin reads admin actions" on public.admin_action_logs;
create policy "superadmin reads admin actions" on public.admin_action_logs
for select using (public.is_owner());

grant select on public.registration_attempt_logs, public.profile_identity_conflicts, public.admin_action_logs to authenticated;
grant all on public.registration_attempt_logs, public.profile_identity_conflicts, public.admin_action_logs to service_role;
grant usage, select on sequence public.registration_attempt_logs_id_seq, public.admin_action_logs_id_seq to service_role;

commit;
