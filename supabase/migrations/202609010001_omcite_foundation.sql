-- OMCITE Arena foundation migration
-- Additive and idempotent: existing production rows are preserved.

begin;

create extension if not exists pgcrypto;

-- Existing entities: add the fields needed by the new application without
-- changing or removing current columns.
alter table if exists public.profiles
  add column if not exists game_id text,
  add column if not exists bio text,
  add column if not exists phone text,
  add column if not exists locale text default 'ru',
  add column if not exists updated_at timestamptz default now();

alter table if exists public.teams
  add column if not exists social_links jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.events
  add column if not exists payment_url text,
  add column if not exists comments_enabled boolean not null default true,
  add column if not exists default_reminder_minutes integer[] not null default array[60],
  add column if not exists updated_at timestamptz default now();

alter table if exists public.event_sessions
  add column if not exists max_teams integer,
  add column if not exists registration_close_time timestamptz,
  add column if not exists reminder_minutes integer[] not null default array[60],
  add column if not exists status text not null default 'scheduled',
  add column if not exists updated_at timestamptz default now();

alter table if exists public.event_registrations
  add column if not exists session_id uuid references public.event_sessions(id) on delete cascade,
  add column if not exists roster_json jsonb not null default '[]'::jsonb,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists promoted_at timestamptz,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.player_stats
  add column if not exists session_id uuid references public.event_sessions(id) on delete set null,
  add column if not exists screenshot_url text,
  add column if not exists corrected_by uuid references auth.users(id) on delete set null,
  add column if not exists correction_note text,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.activity_log
  add column if not exists activity_type text,
  add column if not exists description text;

update public.activity_log
set activity_type = coalesce(activity_type, action),
    description = coalesce(description, details)
where activity_type is null or description is null;

alter table if exists public.warnings
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table if exists public.bans
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table if exists public.contacts
  add column if not exists profile_id uuid references auth.users(id) on delete set null,
  add column if not exists phone text,
  add column if not exists sort_order integer not null default 100,
  add column if not exists is_public boolean not null default true;

-- Backfill data that already exists in Auth metadata.
update public.profiles as profile
set game_id = nullif(users.raw_user_meta_data ->> 'game_id', '')
from auth.users as users
where profile.id = users.id
  and profile.game_id is null;

update public.event_sessions as session
set max_teams = event.max_teams
from public.events as event
where session.event_id = event.id
  and session.max_teams is null;

-- Core community workflow.
create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  message text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Preserve requests created by the legacy application. The old table is kept
-- untouched so the migration can be rolled back without losing production data.
do $$
begin
  if to_regclass('public.join_requests') is not null then
    execute $copy$
      insert into public.team_join_requests (id, team_id, user_id, status, created_at)
      select
        id,
        team_id,
        user_id,
        case status
          when 'approved' then 'accepted'
          when 'declined' then 'rejected'
          else status
        end,
        created_at
      from public.join_requests
      where status in ('pending', 'approved', 'accepted', 'declined', 'rejected', 'cancelled')
      on conflict (id) do nothing
    $copy$;
  end if;
end;
$$;

create table if not exists public.player_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_team_id uuid references public.teams(id) on delete set null,
  to_team_id uuid references public.teams(id) on delete set null,
  transfer_type text not null default 'membership',
  initiated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null,
  image_url text,
  is_published boolean not null default false,
  published_at timestamptz,
  author_id uuid references auth.users(id) on delete set null,
  comments_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  news_id uuid references public.news_posts(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  is_edited boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_single_target check (
    (event_id is not null and news_id is null) or
    (event_id is null and news_id is not null)
  )
);

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  reported_by uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 2 and 500),
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (comment_id, reported_by)
);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  image_url text not null,
  link_url text,
  placement text not null default 'home' check (placement in ('home', 'teams', 'tournaments', 'sidebar')),
  locale text not null default 'all',
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'web',
  locale text not null default 'ru',
  user_agent text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  event_published boolean not null default true,
  registration_open boolean not null default true,
  event_reminder boolean not null default true,
  team_updates boolean not null default true,
  moderation_updates boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  session_id uuid references public.event_sessions(id) on delete cascade,
  notification_type text not null,
  reminder_minutes integer,
  sent_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.excel_import_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete restrict,
  file_name text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed', 'rolled_back')),
  total_rows integer not null default 0,
  successful_rows integer not null default 0,
  failed_rows integer not null default 0,
  errors jsonb not null default '[]'::jsonb,
  imported_at timestamptz not null default now(),
  rolled_back_at timestamptz,
  rolled_back_by uuid references auth.users(id) on delete set null
);

create table if not exists public.stats_change_logs (
  id uuid primary key default gen_random_uuid(),
  import_id uuid references public.excel_import_logs(id) on delete set null,
  player_stat_id uuid references public.player_stats(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  session_id uuid references public.event_sessions(id) on delete set null,
  changed_by uuid not null references auth.users(id) on delete restrict,
  change_type text not null check (change_type in ('insert', 'update', 'approve', 'reject', 'rollback')),
  before_values jsonb,
  after_values jsonb,
  note text,
  created_at timestamptz not null default now(),
  rolled_back_at timestamptz
);

-- The legacy event_results table stores one winner and a free-form score.
-- Keep it untouched and introduce normalized per-team results alongside it.
create table if not exists public.event_team_results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  score integer not null default 0,
  is_winner boolean not null default false,
  mvp_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, team_id)
);

insert into public.event_team_results (event_id, team_id, score, is_winner, mvp_user_id, created_at)
select
  legacy.event_id,
  legacy.winner_team_id,
  case when trim(coalesce(legacy.score, '')) ~ '^-?[0-9]+$' then legacy.score::integer else 0 end,
  true,
  legacy.mvp_user_id,
  coalesce(legacy.created_at, now())
from public.event_results legacy
where legacy.winner_team_id is not null
on conflict (event_id, team_id) do nothing;

-- Server-side uploads still use Storage-level limits as defense in depth.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stats-screenshots',
  'stats-screenshots',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Safe indexes. Partial indexes avoid conflicts with legacy event-level rows.
create unique index if not exists team_members_team_user_unique
  on public.team_members(team_id, user_id);
create unique index if not exists profiles_game_id_unique
  on public.profiles(game_id)
  where game_id is not null and game_id <> '';
create unique index if not exists event_registrations_session_team_unique
  on public.event_registrations(session_id, team_id)
  where session_id is not null and status <> 'cancelled';
create unique index if not exists team_invitations_pending_unique
  on public.team_invitations(team_id, user_id)
  where status = 'pending';
create unique index if not exists team_join_requests_pending_unique
  on public.team_join_requests(team_id, user_id)
  where status = 'pending';
create index if not exists comments_event_created_idx on public.comments(event_id, created_at desc);
create index if not exists comments_news_created_idx on public.comments(news_id, created_at desc);
create index if not exists transfers_user_created_idx on public.player_transfers(user_id, created_at desc);
create index if not exists stats_change_user_created_idx on public.stats_change_logs(user_id, created_at desc);
create unique index if not exists push_delivery_dedupe_idx
  on public.push_delivery_logs(
    coalesce(event_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(session_id, '00000000-0000-0000-0000-000000000000'::uuid),
    notification_type,
    coalesce(reminder_minutes, -1)
  );

-- Do not broadcast all historical events when the scheduler is enabled for
-- the first time. Only events published after this migration need a push.
insert into public.push_delivery_logs (event_id, notification_type, sent_count)
select event.id, 'event_published', 0
from public.events event
where event.is_published = true
  and coalesce(event.publish_at, event.created_at) < now() - interval '5 minutes'
on conflict do nothing;

-- Shared authorization helpers used by RLS and database functions.
create or replace function public.is_app_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = check_user_id
      and role in ('moderator', 'superadmin')
  );
$$;

create or replace function public.is_superadmin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = check_user_id and role = 'superadmin'
  );
$$;

create or replace function public.can_manage_team(check_team_id uuid, check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_app_admin(check_user_id) or exists (
    select 1 from public.team_members
    where team_id = check_team_id
      and user_id = check_user_id
      and role_in_team in ('leader', 'senior_deputy', 'deputy')
  );
$$;

-- Create a team or guild together with its leader membership in one
-- transaction. This prevents orphaned organizations and enforces the
-- "one team plus one guild" rule even for concurrent requests.
create or replace function public.create_organization(
  p_name text,
  p_description text default null,
  p_type text default 'team',
  p_social_link text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  organization_id uuid;
  normalized_name text := trim(p_name);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_type not in ('team', 'guild') then raise exception 'Unsupported organization type'; end if;
  if char_length(normalized_name) < 2 or char_length(normalized_name) > 60 then
    raise exception 'Organization name must contain between 2 and 60 characters';
  end if;
  if exists (select 1 from public.bans where target_type = 'player' and target_id = auth.uid() and is_active) then
    raise exception 'Player is banned';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_type, 0));
  if exists (
    select 1
    from public.team_members membership
    join public.teams organization on organization.id = membership.team_id
    where membership.user_id = auth.uid() and organization.type = p_type
  ) then
    raise exception 'You already belong to an organization of this type';
  end if;

  insert into public.teams (name, description, type, social_link, leader_id, verified)
  values (
    normalized_name,
    nullif(trim(p_description), ''),
    p_type,
    nullif(trim(p_social_link), ''),
    auth.uid(),
    false
  )
  returning id into organization_id;

  insert into public.team_members (team_id, user_id, role_in_team, position)
  values (organization_id, auth.uid(), 'leader', 'main');

  insert into public.activity_log (user_id, team_id, action, details, activity_type, description)
  values (
    auth.uid(),
    organization_id,
    'team_created',
    format('Создана %s «%s»', case when p_type = 'guild' then 'гильдия' else 'команда' end, normalized_name),
    'team_created',
    format('Создана %s «%s»', case when p_type = 'guild' then 'гильдия' else 'команда' end, normalized_name)
  );

  insert into public.notifications (user_id, type, title, body, link)
  select
    role.user_id,
    'team_verification',
    'Новая организация на проверке',
    format('%s «%s» ожидает верификации', case when p_type = 'guild' then 'Гильдия' else 'Команда' end, normalized_name),
    '/admin'
  from public.user_roles role
  where role.role in ('moderator', 'superadmin');

  return organization_id;
end;
$$;

revoke all on function public.create_organization(text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text) to authenticated;

-- Enforce one team plus one guild, organization limits, and leadership limits
-- for all new membership changes while preserving legacy rows.
create or replace function public.enforce_team_membership_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organization_type text;
  current_count integer;
  role_count integer;
  max_members integer;
  max_role integer;
begin
  select type into organization_type from public.teams where id = new.team_id;
  if organization_type is null then
    raise exception 'Organization does not exist';
  end if;

  if exists (
    select 1
    from public.team_members membership
    join public.teams team on team.id = membership.team_id
    where membership.user_id = new.user_id
      and team.type = organization_type
      and membership.team_id <> new.team_id
  ) then
    raise exception 'A player can belong to only one organization of this type';
  end if;

  max_members := case when organization_type = 'guild' then 60 else 12 end;
  select count(*) into current_count
  from public.team_members
  where team_id = new.team_id
    and (tg_op = 'INSERT' or user_id <> old.user_id);

  if tg_op = 'INSERT' and current_count >= max_members then
    raise exception 'Organization member limit reached';
  end if;

  max_role := case
    when new.role_in_team = 'leader' then 1
    when new.role_in_team = 'senior_deputy' then 1
    when new.role_in_team = 'deputy' then 2
    else null
  end;

  if max_role is not null then
    select count(*) into role_count
    from public.team_members
    where team_id = new.team_id
      and role_in_team = new.role_in_team
      and (tg_op = 'INSERT' or user_id <> old.user_id);
    if role_count >= max_role then
      raise exception 'Leadership role limit reached';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_team_membership_rules_trigger on public.team_members;
create trigger enforce_team_membership_rules_trigger
before insert or update of team_id, user_id, role_in_team on public.team_members
for each row execute function public.enforce_team_membership_rules();

-- Public schedule view never exposes room credentials.
create or replace view public.event_sessions_public
with (security_invoker = true)
as
select
  id,
  event_id,
  start_time,
  end_time,
  registration_open_time,
  registration_close_time,
  max_teams,
  status,
  reminder_minutes,
  responsible_user_id
from public.event_sessions;

grant select on public.event_sessions_public to anon, authenticated;

-- Concurrency-safe session registration. A row lock prevents capacity races.
create or replace function public.register_team_for_session(
  p_session_id uuid,
  p_team_id uuid,
  p_roster uuid[]
)
returns table(registration_id uuid, registration_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.event_sessions%rowtype;
  event_row public.events%rowtype;
  capacity integer;
  confirmed_count integer;
  next_status text;
  created_id uuid;
  minimum_players integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_manage_team(p_team_id, auth.uid()) then raise exception 'Insufficient team permissions'; end if;

  select * into session_row from public.event_sessions where id = p_session_id for update;
  if not found then raise exception 'Session not found'; end if;
  select * into event_row from public.events where id = session_row.event_id;

  if not exists (select 1 from public.teams where id = p_team_id and verified = true) then
    raise exception 'Team is not verified';
  end if;
  if session_row.registration_open_time is not null and now() < session_row.registration_open_time then
    raise exception 'Registration is not open yet';
  end if;
  if session_row.registration_close_time is not null and now() >= session_row.registration_close_time then
    raise exception 'Registration is closed';
  end if;

  minimum_players := coalesce(event_row.min_players, 4);
  if coalesce(array_length(p_roster, 1), 0) < minimum_players then
    raise exception 'Not enough players in roster';
  end if;
  if exists (
    select 1 from unnest(p_roster) player_id
    where not exists (
      select 1 from public.team_members
      where team_id = p_team_id and user_id = player_id
    )
  ) then
    raise exception 'Roster contains a player outside this team';
  end if;
  if exists (
    select 1 from public.bans
    where is_active = true
      and ((target_type = 'team' and target_id = p_team_id)
        or (target_type = 'player' and target_id = any(p_roster)))
  ) then
    raise exception 'Team or roster player is banned';
  end if;

  if exists (
    select 1
    from public.event_registrations existing_registration
    join public.event_sessions existing_session on existing_session.id = existing_registration.session_id
    where existing_registration.status in ('confirmed', 'waiting')
      and existing_session.id <> p_session_id
      and tstzrange(
        existing_session.start_time,
        coalesce(existing_session.end_time, existing_session.start_time + interval '4 hours'),
        '[)'
      ) && tstzrange(
        session_row.start_time,
        coalesce(session_row.end_time, session_row.start_time + interval '4 hours'),
        '[)'
      )
      and exists (
        select 1 from unnest(p_roster) player_id
        where existing_registration.roster_json ? player_id::text
      )
  ) then
    raise exception 'A roster player is already registered for an overlapping session';
  end if;

  capacity := coalesce(session_row.max_teams, event_row.max_teams, 0);
  select count(*) into confirmed_count
  from public.event_registrations
  where session_id = p_session_id and status = 'confirmed';
  next_status := case when capacity > 0 and confirmed_count >= capacity then 'waiting' else 'confirmed' end;

  insert into public.event_registrations (
    event_id, session_id, team_id, status, registered_by, roster, roster_json
  ) values (
    session_row.event_id, p_session_id, p_team_id, next_status, auth.uid(),
    to_jsonb(p_roster), to_jsonb(p_roster)
  ) returning id into created_id;

  insert into public.notifications (user_id, type, title, body, link)
  select
    membership.user_id,
    'registration',
    case when next_status = 'confirmed' then 'Команда участвует' else 'Команда в листе замены' end,
    format('Команда записана на «%s» (%s)', event_row.title, to_char(session_row.start_time, 'DD.MM.YYYY HH24:MI')),
    format('/tournaments/%s', session_row.event_id)
  from public.team_members membership
  where membership.team_id = p_team_id;

  insert into public.activity_log (user_id, team_id, event_id, action, details, activity_type, description)
  values (
    auth.uid(),
    p_team_id,
    session_row.event_id,
    'registration',
    format('Команда записалась на «%s»', event_row.title),
    'registration',
    format('Команда записалась на «%s»', event_row.title)
  );

  return query select created_id, next_status;
end;
$$;

create or replace function public.cancel_session_registration(
  p_registration_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  registration_row public.event_registrations%rowtype;
  promoted_id uuid;
begin
  select * into registration_row
  from public.event_registrations
  where id = p_registration_id
  for update;
  if not found then raise exception 'Registration not found'; end if;
  if not public.can_manage_team(registration_row.team_id, auth.uid()) then
    raise exception 'Insufficient team permissions';
  end if;

  update public.event_registrations
  set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
      cancellation_reason = p_reason, updated_at = now()
  where id = p_registration_id;

  insert into public.notifications (user_id, type, title, body, link)
  select
    membership.user_id,
    'cancellation',
    'Участие отменено',
    'Регистрация команды на выбранное время отменена',
    format('/tournaments/%s', registration_row.event_id)
  from public.team_members membership
  where membership.team_id = registration_row.team_id;

  if registration_row.status = 'confirmed' and registration_row.session_id is not null then
    select id into promoted_id
    from public.event_registrations
    where session_id = registration_row.session_id and status = 'waiting'
    order by created_at
    for update skip locked
    limit 1;

    if promoted_id is not null then
      update public.event_registrations
      set status = 'confirmed', promoted_at = now(), updated_at = now()
      where id = promoted_id;

      insert into public.notifications (user_id, type, title, body, link)
      select
        membership.user_id,
        'registration',
        'Команда переведена в основной состав',
        'Освободилось место — команда больше не находится в листе замены',
        format('/tournaments/%s', promoted.event_id)
      from public.event_registrations promoted
      join public.team_members membership on membership.team_id = promoted.team_id
      where promoted.id = promoted_id;
    end if;
  end if;

  return promoted_id;
end;
$$;

grant execute on function public.register_team_for_session(uuid, uuid, uuid[]) to authenticated;
grant execute on function public.cancel_session_registration(uuid, text) to authenticated;

-- Membership workflows are kept inside transactions. This prevents a player
-- from being removed from an old team if adding them to the new one fails.
create or replace function public.accept_organization_membership(
  p_user_id uuid,
  p_team_id uuid,
  p_initiated_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_type text;
  previous_team_id uuid;
  previous_role text;
  main_count integer;
  next_position text;
begin
  select type into target_type from public.teams where id = p_team_id for update;
  if target_type is null then raise exception 'Organization not found'; end if;

  select membership.team_id, membership.role_in_team
  into previous_team_id, previous_role
  from public.team_members membership
  join public.teams organization on organization.id = membership.team_id
  where membership.user_id = p_user_id
    and organization.type = target_type
    and membership.team_id <> p_team_id
  limit 1
  for update of membership;

  if previous_role = 'leader' then
    raise exception 'Transfer leadership before leaving the current organization';
  end if;

  if previous_team_id is not null then
    delete from public.team_members
    where team_id = previous_team_id and user_id = p_user_id;
  end if;

  select count(*) into main_count
  from public.team_members
  where team_id = p_team_id and position = 'main';
  next_position := case when main_count < 4 then 'main' else 'substitute' end;

  insert into public.team_members (team_id, user_id, role_in_team, position)
  values (p_team_id, p_user_id, 'main', next_position)
  on conflict (team_id, user_id) do nothing;

  if previous_team_id is distinct from p_team_id then
    insert into public.player_transfers (
      user_id, from_team_id, to_team_id, transfer_type, initiated_by
    ) values (
      p_user_id, previous_team_id, p_team_id, target_type, p_initiated_by
    );
  end if;
end;
$$;

revoke all on function public.accept_organization_membership(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.send_team_invitation(p_team_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_manage_team(p_team_id, auth.uid()) then raise exception 'Insufficient team permissions'; end if;
  if p_user_id = auth.uid() then raise exception 'You are already managing this organization'; end if;
  if exists (select 1 from public.bans where target_type = 'player' and target_id = p_user_id and is_active) then
    raise exception 'Player is banned';
  end if;

  insert into public.team_invitations (team_id, user_id, invited_by)
  values (p_team_id, p_user_id, auth.uid())
  returning id into invitation_id;

  insert into public.notifications (user_id, type, title, body, link)
  select p_user_id, 'team_invitation', 'Приглашение',
    format('Вас приглашают в «%s»', name), format('/teams/%s', id)
  from public.teams where id = p_team_id;

  return invitation_id;
end;
$$;

create or replace function public.create_team_join_request(p_team_id uuid, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  request_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.team_members where team_id = p_team_id and user_id = auth.uid()) then
    raise exception 'Already a member';
  end if;
  if exists (select 1 from public.bans where target_type = 'player' and target_id = auth.uid() and is_active) then
    raise exception 'Player is banned';
  end if;

  insert into public.team_join_requests (team_id, user_id, message)
  values (p_team_id, auth.uid(), nullif(trim(p_message), ''))
  returning id into request_id;

  insert into public.notifications (user_id, type, title, body, link)
  select membership.user_id, 'team_request', 'Новая заявка',
    'Игрок подал заявку на вступление', format('/teams/%s', p_team_id)
  from public.team_members membership
  where membership.team_id = p_team_id
    and membership.role_in_team in ('leader', 'senior_deputy', 'deputy');

  return request_id;
end;
$$;

create or replace function public.respond_team_invitation(p_invitation_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.team_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into invitation from public.team_invitations where id = p_invitation_id for update;
  if not found or invitation.user_id <> auth.uid() then raise exception 'Invitation not found'; end if;
  if invitation.status <> 'pending' then raise exception 'Invitation already processed'; end if;
  if invitation.expires_at <= now() then
    update public.team_invitations set status = 'expired', responded_at = now() where id = invitation.id;
    return 'expired';
  end if;

  if p_accept then
    perform public.accept_organization_membership(auth.uid(), invitation.team_id, auth.uid());
  end if;
  update public.team_invitations
  set status = case when p_accept then 'accepted' else 'rejected' end, responded_at = now()
  where id = invitation.id;
  return case when p_accept then 'accepted' else 'rejected' end;
end;
$$;

create or replace function public.review_team_join_request(p_request_id uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  join_request public.team_join_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into join_request from public.team_join_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if not public.can_manage_team(join_request.team_id, auth.uid()) then raise exception 'Insufficient team permissions'; end if;
  if join_request.status <> 'pending' then raise exception 'Request already processed'; end if;

  if p_accept then
    perform public.accept_organization_membership(join_request.user_id, join_request.team_id, auth.uid());
  end if;
  update public.team_join_requests
  set status = case when p_accept then 'accepted' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = join_request.id;

  insert into public.notifications (user_id, type, title, body, link)
  values (
    join_request.user_id,
    'team_request',
    case when p_accept then 'Заявка принята' else 'Заявка отклонена' end,
    case when p_accept then 'Вы добавлены в состав' else 'Руководство отклонило заявку' end,
    format('/teams/%s', join_request.team_id)
  );
  return case when p_accept then 'accepted' else 'rejected' end;
end;
$$;

grant execute on function public.send_team_invitation(uuid, uuid) to authenticated;
grant execute on function public.create_team_join_request(uuid, text) to authenticated;
grant execute on function public.respond_team_invitation(uuid, boolean) to authenticated;
grant execute on function public.review_team_join_request(uuid, boolean) to authenticated;

-- RLS for all newly introduced data.
alter table public.team_invitations enable row level security;
alter table public.team_join_requests enable row level security;
alter table public.player_transfers enable row level security;
alter table public.news_posts enable row level security;
alter table public.comments enable row level security;
alter table public.comment_reports enable row level security;
alter table public.banners enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_delivery_logs enable row level security;
alter table public.excel_import_logs enable row level security;
alter table public.stats_change_logs enable row level security;
alter table public.event_team_results enable row level security;

drop policy if exists "invitations visible to recipient and managers" on public.team_invitations;
create policy "invitations visible to recipient and managers" on public.team_invitations
for select using (user_id = auth.uid() or public.can_manage_team(team_id));
drop policy if exists "team managers create invitations" on public.team_invitations;
drop policy if exists "recipient or manager updates invitation" on public.team_invitations;

drop policy if exists "requests visible to requester and managers" on public.team_join_requests;
create policy "requests visible to requester and managers" on public.team_join_requests
for select using (user_id = auth.uid() or public.can_manage_team(team_id));
drop policy if exists "players create own requests" on public.team_join_requests;
drop policy if exists "requester or manager updates request" on public.team_join_requests;

drop policy if exists "transfers are public" on public.player_transfers;
create policy "transfers are public" on public.player_transfers for select using (true);

drop policy if exists "published news is public" on public.news_posts;
create policy "published news is public" on public.news_posts
for select using (is_published or public.is_app_admin());
drop policy if exists "admins manage news" on public.news_posts;
create policy "admins manage news" on public.news_posts
for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "visible comments are public" on public.comments;
create policy "visible comments are public" on public.comments for select using (not is_deleted or public.is_app_admin());
drop policy if exists "users create own comments" on public.comments;
create policy "users create own comments" on public.comments for insert with check (author_id = auth.uid());
drop policy if exists "authors update own comments" on public.comments;
create policy "authors update own comments" on public.comments
for update using (author_id = auth.uid() or public.is_app_admin());

drop policy if exists "users create reports" on public.comment_reports;
create policy "users create reports" on public.comment_reports for insert with check (reported_by = auth.uid());
drop policy if exists "admins review reports" on public.comment_reports;
create policy "admins review reports" on public.comment_reports
for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "active banners are public" on public.banners;
create policy "active banners are public" on public.banners
for select using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
drop policy if exists "admins manage banners" on public.banners;
create policy "admins manage banners" on public.banners
for all using (public.is_app_admin()) with check (public.is_app_admin());

drop policy if exists "users manage own push tokens" on public.push_subscriptions;
create policy "users manage own push tokens" on public.push_subscriptions
for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users manage notification preferences" on public.notification_preferences;
create policy "users manage notification preferences" on public.notification_preferences
for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "admins view push deliveries" on public.push_delivery_logs;
create policy "admins view push deliveries" on public.push_delivery_logs
for select using (public.is_app_admin());

drop policy if exists "admins view imports" on public.excel_import_logs;
create policy "admins view imports" on public.excel_import_logs for select using (public.is_app_admin());
drop policy if exists "admins view stats changes" on public.stats_change_logs;
create policy "admins view stats changes" on public.stats_change_logs for select using (public.is_app_admin());

drop policy if exists "event results are public" on public.event_team_results;
create policy "event results are public" on public.event_team_results for select using (true);
drop policy if exists "admins manage event results" on public.event_team_results;
create policy "admins manage event results" on public.event_team_results
for all using (public.is_app_admin()) with check (public.is_app_admin());

-- Assign the verified owner account now and whenever it is created later.
-- Email confirmation is required, so nobody can claim the role by entering the
-- address without controlling its mailbox.
create or replace function public.grant_omcite_owner_superadmin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) = 'stepanklinov8@gmail.com'
     and new.email_confirmed_at is not null then
    update public.user_roles
    set role = 'superadmin'
    where user_id = new.id;

    if not found then
      insert into public.user_roles (user_id, role)
      values (new.id, 'superadmin');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists grant_omcite_owner_on_signup on auth.users;
create trigger grant_omcite_owner_on_signup
after insert on auth.users
for each row execute function public.grant_omcite_owner_superadmin();

drop trigger if exists grant_omcite_owner_on_confirmation on auth.users;
create trigger grant_omcite_owner_on_confirmation
after update of email, email_confirmed_at on auth.users
for each row execute function public.grant_omcite_owner_superadmin();

update public.user_roles
set role = 'superadmin'
where user_id = (
  select id
  from auth.users
  where lower(email) = 'stepanklinov8@gmail.com'
    and email_confirmed_at is not null
  limit 1
);

insert into public.user_roles (user_id, role)
select id, 'superadmin'
from auth.users
where lower(email) = 'stepanklinov8@gmail.com'
  and email_confirmed_at is not null
  and not exists (
    select 1 from public.user_roles where user_id = auth.users.id
  );

commit;
