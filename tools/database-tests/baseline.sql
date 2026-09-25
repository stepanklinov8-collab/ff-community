-- Minimal documented pre-update schema for isolated migration/transaction tests.
-- No credentials or data from the production database are used.
create schema auth;
create role anon;
create role authenticated;
create role service_role bypassrls;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.profiles(id uuid primary key references auth.users(id),nickname text,game_id text,main_rating numeric default 1,reputation_score numeric default 50,reputation_events_count integer default 0);
create table public.user_roles(user_id uuid references auth.users(id),role text);
create function public.is_full_admin(p_user uuid) returns boolean language sql stable as $$select exists(select 1 from public.user_roles where user_id=p_user and role in('admin','superadmin'))$$;
create function public.is_owner(p_user uuid) returns boolean language sql stable as $$select exists(select 1 from public.user_roles where user_id=p_user and role='superadmin')$$;
create table public.teams(id uuid primary key,name text,type text default 'team',main_rating numeric default 1,results_score numeric default 1,achievements_score numeric default 1,reputation_score numeric default 50);
create table public.team_members(team_id uuid references public.teams(id),user_id uuid references public.profiles(id),role_in_team text default 'member',primary key(team_id,user_id));
create function public.can_manage_team(p_team uuid,p_user uuid) returns boolean language sql stable as $$select public.is_full_admin(p_user) or exists(select 1 from public.team_members where team_id=p_team and user_id=p_user and role_in_team in('leader','senior_deputy','deputy'))$$;
create table public.events(id uuid primary key default gen_random_uuid(),title text,type text,organizer_user_id uuid references auth.users(id),max_teams integer default 12,min_players integer default 4,cost integer default 0,
 description text,organizer text,stream_url text,payment_url text,image_url text,roster_lock_minutes integer default 10,publish_at timestamptz,is_published boolean default true,
 comments_enabled boolean default true,allow_individual_registration boolean default false,created_by uuid,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.event_sessions(id uuid primary key default gen_random_uuid(),event_id uuid references public.events(id),start_time timestamptz,end_time timestamptz,
 registration_open_time timestamptz,registration_close_time timestamptz,max_teams integer,responsible_user_id uuid,
 status text default 'scheduled',reminder_minutes integer[] default '{60}',room_id text,room_password text,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.event_registrations(id uuid primary key default gen_random_uuid(),event_id uuid references public.events(id),session_id uuid references public.event_sessions(id),team_id uuid references public.teams(id),participant_user_id uuid references public.profiles(id),
 roster_json jsonb default '[]',status text default 'confirmed',created_at timestamptz default now(),cancelled_at timestamptz,cancelled_by uuid,cancellation_reason text,updated_at timestamptz default now());
create table public.event_games(id uuid primary key default gen_random_uuid(),event_id uuid references public.events(id),session_id uuid references public.event_sessions(id),game_number integer,map_name text,status text default 'scheduled',updated_at timestamptz default now(),
 constraint event_games_session_id_game_number_key unique(session_id,game_number),constraint event_games_game_number_check check(game_number between 1 and 100));
create table public.warnings(id uuid primary key default gen_random_uuid(),target_type text,target_id uuid,level integer default 1,reason text,event_id uuid,expires_at timestamptz,created_by uuid,created_at timestamptz default now());
create table public.bans(id uuid primary key default gen_random_uuid(),target_type text,target_id uuid,reason text,is_active boolean default true,created_by uuid,created_at timestamptz default now());
create table public.clan_wars(id uuid primary key default gen_random_uuid(),creator_team_id uuid,opponent_team_id uuid,created_by uuid,title text,status text default 'scheduled',scheduled_at timestamptz,completed_at timestamptz);
create table public.clan_war_rosters(id uuid primary key default gen_random_uuid(),clan_war_id uuid references public.clan_wars(id),team_id uuid references public.teams(id),player_ids uuid[],submitted_by uuid,unique(clan_war_id,team_id));
create table public.rating_event_settings(event_id uuid primary key,hidden_coefficient numeric,category text);
create table public.player_stats(id uuid primary key default gen_random_uuid(),user_id uuid,event_id uuid,session_id uuid,event_title text,kills integer,matches_played integer,status text,created_at timestamptz default now());
create table public.reputation_reviews(id uuid primary key default gen_random_uuid(),target_user_id uuid,sentiment integer,reason text,status text default 'pending',reviewed_by uuid,reviewed_at timestamptz);
create table public.reputation_ledger(id uuid primary key default gen_random_uuid(),user_id uuid,delta numeric,reason text,source_type text,source_id uuid,changed_by uuid);
create table public.organization_participation_history(id uuid primary key default gen_random_uuid(),organization_id uuid,organization_name text,organization_type text,mode text,event_id uuid,session_id uuid,clan_war_id uuid,event_title text,occurred_at timestamptz,roster_snapshot jsonb,place integer,kills integer,points numeric,result_status text,recorded_by uuid,updated_at timestamptz default now());
create unique index organization_history_event_session_unique on public.organization_participation_history(organization_id,event_id,session_id) where event_id is not null and session_id is not null;
alter table public.organization_participation_history add column correction_note text;
create table public.organization_history_change_logs(id uuid primary key default gen_random_uuid(),history_id uuid,changed_by uuid,before_values jsonb,after_values jsonb,note text);
create table public.site_wallets(user_id uuid primary key references auth.users(id),balance bigint default 0 check(balance>=0),updated_at timestamptz default now());
create table public.currency_ledger(id uuid primary key default gen_random_uuid(),user_id uuid,amount bigint,balance_after bigint check(balance_after>=0),operation_type text,reference_type text,reference_id uuid,description text,created_at timestamptz default now());
create table public.betting_markets(id uuid primary key default gen_random_uuid(),event_id uuid,game_id uuid,clan_war_id uuid,subject_team_id uuid,market_type text,selection_value text,line numeric,odds numeric,mode text,
 status text default 'open',outcome text,settled_by uuid,settled_at timestamptz,updated_at timestamptz default now(),constraint betting_markets_mode_check check(mode in('tournament','training','bo','kv')));
create table public.site_bets(id uuid primary key default gen_random_uuid(),user_id uuid,market_id uuid,stake bigint,odds numeric,potential_payout bigint,payout bigint default 0,status text default 'open',settled_at timestamptz);
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid,type text,title text,body text,link text,created_at timestamptz default now());
create schema storage;
create table public.comments(id uuid primary key default gen_random_uuid(),author_id uuid,event_id uuid references public.events(id),news_id uuid,body text,is_deleted boolean default false);
create table public.clan_war_comments(id uuid primary key default gen_random_uuid(),author_id uuid,clan_war_id uuid references public.clan_wars(id),body text,is_deleted boolean default false);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
grant all on all tables in schema public to service_role;
grant select on public.events to anon,authenticated;

alter table public.clan_wars add column is_hidden boolean default false;
alter table public.betting_markets add column subject_team_name text,add column model_snapshot jsonb default '{}',add column locks_at timestamptz,add column created_at timestamptz default now();
alter table public.site_bets add column quote_id uuid,add column placed_at timestamptz default now();
create table public.economy_settings(singleton boolean primary key default true,minimum_stake bigint default 10,maximum_stake bigint default 200,maximum_odds numeric default 15);
insert into public.economy_settings(singleton) values(true);

alter table public.clan_wars add column cancelled_at timestamptz,add column cancelled_by uuid,add column cancellation_reason text;

alter table public.rating_event_settings add column changed_by uuid,add column updated_at timestamptz default now();

-- Original legacy result tables: retained by the additive update.
create table if not exists public.event_game_results(
 id uuid primary key default gen_random_uuid(),
 game_id uuid not null references public.event_games(id) on delete cascade,
 team_id uuid not null references public.teams(id) on delete restrict,
 team_name_snapshot text not null, roster_snapshot jsonb not null default '[]'::jsonb,
 place integer not null check(place>0), kills integer not null check(kills>=0),
 points numeric(10,2) not null default 0,
 status text not null default 'confirmed' check(status in('draft','confirmed','cancelled')),
 confirmed_by uuid references auth.users(id) on delete set null, confirmed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(game_id,team_id), unique(game_id,place)
);
create table if not exists public.round_match_results(
 id uuid primary key default gen_random_uuid(),
 event_id uuid references public.events(id) on delete cascade,
 clan_war_id uuid references public.clan_wars(id) on delete cascade,
 team_a_id uuid not null references public.teams(id) on delete restrict,
 team_b_id uuid not null references public.teams(id) on delete restrict,
 team_a_name_snapshot text not null, team_b_name_snapshot text not null,
 team_a_score smallint not null check(team_a_score between 0 and 7),
 team_b_score smallint not null check(team_b_score between 0 and 7),
 team_a_kills integer not null check(team_a_kills>=0),
 team_b_kills integer not null check(team_b_kills>=0),
 status text not null default 'confirmed' check(status in('draft','confirmed','cancelled')),
 confirmed_by uuid references auth.users(id) on delete set null, confirmed_at timestamptz,
 created_at timestamptz not null default now(),
 check((case when event_id is null then 0 else 1 end)+(case when clan_war_id is null then 0 else 1 end)=1),
 check(team_a_id<>team_b_id),
 check(status<>'confirmed' or ((team_a_score=7 and team_b_score between 0 and 6)
   or(team_b_score=7 and team_a_score between 0 and 6)))
);
create unique index if not exists round_match_results_clan_war_unique
 on public.round_match_results(clan_war_id) where clan_war_id is not null;
create unique index if not exists round_match_results_event_unique
 on public.round_match_results(event_id) where event_id is not null;

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

alter table public.clan_wars add column format integer default 4,add column challenge_kind text default 'direct',add column description text default '',add column rules text default '',add column updated_at timestamptz default now();
create table public.clan_war_responses(id uuid primary key default gen_random_uuid(),clan_war_id uuid references public.clan_wars(id),team_id uuid,status text default 'pending');

alter table public.teams add column verified boolean default true;
alter table public.event_registrations add column registered_by uuid,add column roster jsonb,add column promoted_at timestamptz;
create table public.activity_log(id uuid primary key default gen_random_uuid(),user_id uuid,team_id uuid,event_id uuid,action text,details text,activity_type text,description text);
