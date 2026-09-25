-- Update 2. Apply only as part of an explicitly approved deployment.
-- Additive schema. No production rows or historical sporting details are invented.
begin;

create sequence if not exists public.competition_event_numbers;
alter table public.events
 add column if not exists public_number bigint default nextval('public.competition_event_numbers'),
 add column if not exists competition_rules jsonb not null default '{"criterion":"points","placePoints":[12,9,8,7,6,5,4,3,2,1],"killPoints":1,"bonuses":{},"nominations":["points"],"ratingEnabled":true,"winsRequired":1}',
 add column if not exists final_session_id uuid,
 add column if not exists moderation_status text not null default 'approved' check(moderation_status in('pending','approved','rejected')),
 add column if not exists pending_changes jsonb,
 add column if not exists frozen_at timestamptz,
 add column if not exists cancelled_at timestamptz;
create unique index if not exists events_public_number_unique on public.events(public_number);
alter table public.event_sessions
 add column if not exists public_number integer,
 add column if not exists configuration_revision integer not null default 0,
 add column if not exists stage text not null default 'ordinary' check(stage in('ordinary','qualification','semifinal','final')),
 add column if not exists source_session_id uuid references public.event_sessions(id),
 add column if not exists qualification jsonb not null default '{}',
 add column if not exists description text not null default '',
 add column if not exists group_capacity integer not null default 12 check(group_capacity between 2 and 60),
 add column if not exists comments_closed boolean not null default false;
create table public.competition_id_counters(parent_key text primary key, last_number integer not null);
create or replace function public.next_competition_number(p_parent text) returns integer
language sql security definer set search_path=public as $$
 insert into public.competition_id_counters values(p_parent,1)
 on conflict(parent_key) do update set last_number=competition_id_counters.last_number+1 returning last_number
$$;
with numbered as(select id,row_number() over(partition by event_id order by start_time,id)::integer n from public.event_sessions)
update public.event_sessions s set public_number=n.n from numbered n where n.id=s.id and s.public_number is null;
insert into public.competition_id_counters select 'session:'||event_id,max(public_number) from public.event_sessions group by event_id;
create unique index event_sessions_public_number_unique on public.event_sessions(event_id,public_number);

create table public.event_groups(
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.event_sessions(id) on delete cascade,
 public_number integer not null, display_order integer not null, name text not null default '',
 capacity integer not null check(capacity between 2 and 60), room_id text, room_password text,is_active boolean not null default true,
 unique(session_id,public_number), unique(id,session_id)
);
alter table public.event_games
 add column if not exists group_id uuid references public.event_groups(id),
 add column if not exists public_number integer,
 add column if not exists replayed boolean not null default false;
alter table public.event_registrations
 add column if not exists group_id uuid references public.event_groups(id),
 add column if not exists roster_snapshot jsonb,
 add column if not exists name_snapshot text,
 add column if not exists qualification_source_id uuid references public.event_registrations(id),
 add column if not exists carried_points numeric not null default 0;
-- Legacy games stay together; over-capacity legacy groups must be reviewed, not silently repartitioned.
insert into public.event_groups(session_id,public_number,display_order,capacity)
select s.id,1,1,case when e.type='solo' then 60 else 15 end from public.event_sessions s join public.events e on e.id=s.event_id;
insert into public.competition_id_counters select 'group:'||id,1 from public.event_sessions;
update public.event_games g set group_id=q.id,public_number=g.game_number from public.event_groups q where q.session_id=g.session_id;
update public.event_registrations r set group_id=q.id from public.event_groups q where q.session_id=r.session_id;
insert into public.competition_id_counters select 'game:'||group_id,max(public_number) from public.event_games where group_id is not null group by group_id;
alter table public.event_games drop constraint if exists event_games_session_id_game_number_key;
alter table public.event_games drop constraint if exists event_games_game_number_check;
alter table public.event_games add constraint event_games_positive_order check(game_number>0);
create unique index event_games_group_order on public.event_games(group_id,game_number);
create unique index event_games_persistent_number on public.event_games(group_id,public_number);

create table public.competition_publications(
 session_id uuid primary key references public.event_sessions(id) on delete cascade,
 revision integer not null default 0, draft jsonb, published jsonb,
 first_published_at timestamptz, corrected_at timestamptz,
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now()
);
create table public.competition_operations(
 request_id uuid primary key, actor_id uuid not null references auth.users(id),
 scope_id uuid not null, request_hash text not null, response jsonb not null, created_at timestamptz not null default now()
);
create table public.competition_action_log(
 id bigint generated always as identity primary key, actor_id uuid references auth.users(id),
 scope_id uuid not null, action text not null, revision integer, created_at timestamptz not null default now()
);
create table public.competition_player_facts(
 session_id uuid not null references public.event_sessions(id) on delete cascade,
 game_id uuid not null references public.event_games(id), registration_id uuid not null,
 user_id uuid not null references public.profiles(id), team_id uuid references public.teams(id),
 mode text not null, nickname text not null, kills integer not null check(kills>=0),
 deaths integer, assists integer, place integer, field_size integer not null,
 primary key(game_id,user_id)
);
create index competition_player_facts_user on public.competition_player_facts(user_id,mode);
create table public.competition_team_facts(
 session_id uuid not null references public.event_sessions(id) on delete cascade,
 game_id uuid not null references public.event_games(id), registration_id uuid not null,
 team_id uuid not null references public.teams(id), mode text not null,
 played boolean not null, place integer, kills integer not null, points numeric not null,
 primary key(game_id,team_id)
);
create table public.competition_solo_contributions(
 session_id uuid not null references public.event_sessions(id) on delete cascade,
 user_id uuid not null references public.profiles(id), nomination text not null,
 place integer not null, participants integer not null, primary key(session_id,user_id,nomination)
);
create table public.competition_ratings(
 target_type text not null check(target_type in('player','team')), target_id uuid not null,
 mode text not null check(mode in('main','solo','bo','kv')), exact_rating numeric not null check(exact_rating between 1 and 100),
 display_rating numeric(4,1) not null, wins integer not null default 0, games integer not null default 0,
 kills integer not null default 0, deaths integer not null default 0, assists integer not null default 0,
 updated_at timestamptz not null default now(), primary key(target_type,target_id,mode)
);
create table public.competition_notification_outbox(
 id uuid primary key default gen_random_uuid(), dedupe_key text not null unique,
 user_id uuid not null references auth.users(id), title text not null, body text not null, link text,
 created_at timestamptz not null default now(), delivered_at timestamptz
);
create table public.competition_evidence(
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.event_sessions(id),
 game_id uuid not null references public.event_games(id), storage_path text not null unique,
 original_name text not null, mime_type text not null, uploaded_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.organizer_applications(
 user_id uuid primary key references auth.users(id), status text not null default 'pending' check(status in('pending','approved','rejected','suspended','revoked')),
 message text not null default '', reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.competition_sanctions(
 id uuid primary key default gen_random_uuid(), target_type text not null check(target_type in('player','team')),
 target_id uuid not null, organizer_id uuid references auth.users(id), scopes text[] not null,
 reason text not null, starts_at timestamptz not null default now(), ends_at timestamptz,
 lifted_at timestamptz, lifted_by uuid references auth.users(id), created_by uuid references auth.users(id),
 final_by_owner boolean not null default false
);
alter table public.warnings
 add column if not exists clan_war_id uuid references public.clan_wars(id),
 add column if not exists clan_war_game_id uuid,
 add column if not exists category text not null default 'event' check(category in('event','chat')),
 add column if not exists penalty integer not null default 0 check(penalty between 0 and 99),
 add column if not exists session_id uuid references public.event_sessions(id),
 add column if not exists game_id uuid references public.event_games(id),
 add column if not exists organizer_id uuid references auth.users(id),
 add column if not exists source text not null default 'manual' check(source in('manual','no_show')),
 add column if not exists activated_at timestamptz,
 add column if not exists cancelled_at timestamptz,
 add column if not exists cancelled_by uuid references auth.users(id),
 add column if not exists cancellation_reason text,
 add column if not exists used_in_sanction uuid references public.competition_sanctions(id),
 add column if not exists final_by_owner boolean not null default false,
 add column if not exists update2 boolean not null default false;
create unique index warnings_one_no_show on public.warnings(session_id,target_id) where source='no_show' and update2;
create unique index warnings_one_war_no_show on public.warnings(clan_war_id,target_id) where source='no_show' and update2;
create index warnings_target_update2 on public.warnings(target_type,target_id,activated_at) where update2;
alter table public.profiles add column if not exists reputation_base numeric not null default 50;
alter table public.teams add column if not exists reputation_base numeric not null default 50;
update public.profiles set reputation_base=reputation_score;
update public.teams set reputation_base=reputation_score;
create table public.organizer_blacklist(
 id uuid primary key default gen_random_uuid(), organizer_id uuid not null references auth.users(id),
 target_type text not null check(target_type in('player','team')), target_id uuid not null,
 event_id uuid references public.events(id), reason text, expires_at timestamptz,
 removed_at timestamptz, removed_by uuid references auth.users(id), final_by_owner boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.competition_appeals(
 id uuid primary key default gen_random_uuid(), source_type text not null check(source_type in('warning','blacklist','sanction')),
 source_id uuid not null, applicant_id uuid not null references auth.users(id), recipient_id uuid not null references auth.users(id),
 message text not null check(char_length(message) between 1 and 10000), evidence text[] not null default '{}',
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 answer text, decided_by uuid references auth.users(id), decided_at timestamptz, created_at timestamptz not null default now(),
 unique(source_type,source_id,applicant_id)
);
create table public.competition_duels(
 id uuid primary key, mode text not null check(mode in('bo','kv')),
 event_id uuid references public.events(id), session_id uuid references public.event_sessions(id),
 clan_war_id uuid references public.clan_wars(id), completed_at timestamptz not null,
 team_a_id uuid not null references public.teams(id), team_b_id uuid not null references public.teams(id),
 data jsonb not null, unique(clan_war_id)
);
alter table public.clan_wars
 add column if not exists game_count integer not null default 1,
 add column if not exists wins_required integer not null default 1,
 add column if not exists maps text[] not null default '{bermuda}',
 add column if not exists result_revision integer not null default 0,
 add column if not exists result_draft jsonb,
 add column if not exists result_published jsonb,
 add column if not exists result_approval_a integer,
 add column if not exists result_approval_b integer,
 add column if not exists result_disputed boolean not null default false,
 add column if not exists result_first_published_at timestamptz,
 add column if not exists result_corrected_at timestamptz;

-- Corrections may recover an already spent payout. Spending still checks balance >= stake.
alter table public.site_wallets drop constraint if exists site_wallets_balance_check;
alter table public.currency_ledger drop constraint if exists currency_ledger_balance_after_check;
alter table public.betting_markets add column if not exists subject_user_id uuid references public.profiles(id);
alter table public.betting_markets drop constraint if exists betting_markets_mode_check;
alter table public.betting_markets add constraint betting_markets_mode_check check(mode in('tournament','training','solo','bo','kv'));
-- Drop the legacy unnamed restriction that excluded per-game solo/round markets.
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.betting_markets'::regclass and contype='c'
 and pg_get_constraintdef(oid) like '%game_id IS NULL%' loop
 execute format('alter table public.betting_markets drop constraint %I',c.conname); end loop;
end $$;

-- New private tables are API-only. Public projections have separate explicit grants.
do $$ declare t text; begin
 foreach t in array array['competition_id_counters','event_groups','competition_publications','competition_operations','competition_action_log',
 'competition_player_facts','competition_team_facts','competition_solo_contributions','competition_ratings','competition_notification_outbox',
 'competition_evidence','organizer_applications','competition_sanctions','organizer_blacklist','competition_appeals','competition_duels'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
grant usage,select on sequence public.competition_action_log_id_seq,public.competition_event_numbers to service_role;
revoke all on function public.next_competition_number(text) from public,anon,authenticated;
grant execute on function public.next_competition_number(text) to service_role;
-- Only the owner may read event rating configuration; expose sanitized settings through API.
revoke select(competition_rules,pending_changes) on public.events from anon,authenticated;
-- Existing table-level grants take precedence over column revokes; use a column allowlist.
do $$ declare columns text; begin
 select string_agg(quote_ident(column_name),',') into columns from information_schema.columns
 where table_schema='public' and table_name='events' and column_name not in('competition_rules','pending_changes');
 revoke select on public.events from anon,authenticated;
 execute 'grant select('||columns||') on public.events to anon,authenticated';
end $$;
commit;
