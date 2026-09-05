-- Competitive profile, history, maps and virtual fixed-odds economy.
-- Additive: legacy data and tables stay intact.
begin;
create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists profile_level smallint not null default 1,
  add column if not exists reputation_score numeric(5,2) not null default 50,
  add column if not exists reputation_events_count integer not null default 0,
  add column if not exists main_rating numeric(5,2) not null default 1;
alter table public.teams
  add column if not exists main_rating numeric(5,2) not null default 1,
  add column if not exists results_score numeric(5,2) not null default 1,
  add column if not exists achievements_score numeric(5,2) not null default 1,
  add column if not exists reputation_score numeric(5,2) not null default 50;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='profiles_level_range') then
    alter table public.profiles add constraint profiles_level_range check(profile_level between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='profiles_reputation_range') then
    alter table public.profiles add constraint profiles_reputation_range check(reputation_score between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='profiles_main_rating_range') then
    alter table public.profiles add constraint profiles_main_rating_range check(main_rating between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='teams_main_rating_range') then
    alter table public.teams add constraint teams_main_rating_range check(main_rating between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='teams_results_score_range') then
    alter table public.teams add constraint teams_results_score_range check(results_score between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='teams_achievements_score_range') then
    alter table public.teams add constraint teams_achievements_score_range check(achievements_score between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='teams_reputation_score_range') then
    alter table public.teams add constraint teams_reputation_score_range check(reputation_score between 1 and 100);
  end if;
end $$;

update public.profiles set profile_level=1;
update public.profiles set profile_level=100 where id=(
  select id from auth.users where lower(email)='stepanklinov8@gmail.com'
  and email_confirmed_at is not null limit 1
);

create or replace function public.is_owner(check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,auth as $$
 select exists(select 1 from auth.users where id=check_user_id
   and lower(email)='stepanklinov8@gmail.com' and email_confirmed_at is not null)
$$;

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check(role in ('moderator','admin','superadmin'));

update public.user_roles set role='admin'
where role='superadmin' and not public.is_owner(user_id);
update public.user_roles set role='superadmin' where public.is_owner(user_id);
insert into public.user_roles(user_id,role)
select id,'superadmin' from auth.users
where lower(email)='stepanklinov8@gmail.com' and email_confirmed_at is not null
and not exists(select 1 from public.user_roles where user_id=auth.users.id);

create or replace function public.is_app_admin(check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.user_roles where user_id=check_user_id
   and role in ('moderator','admin','superadmin'))
$$;
create or replace function public.is_full_admin(check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.user_roles where user_id=check_user_id
   and role in ('admin','superadmin'))
$$;

create table if not exists public.role_change_logs(
 id uuid primary key default gen_random_uuid(),
 target_user_id uuid not null references auth.users(id) on delete restrict,
 changed_by uuid not null references auth.users(id) on delete restrict,
 role text not null check(role in ('moderator','admin')),
 action text not null check(action in ('add','remove')),
 created_at timestamptz not null default now()
);

create or replace function public.protect_omcite_owner()
returns trigger language plpgsql security definer set search_path=public as $$
declare target_id uuid:=coalesce(new.user_id,old.user_id);
begin
 if public.is_owner(target_id) then
   if tg_op='DELETE' or new.role<>'superadmin' then raise exception 'Owner role is protected'; end if;
 elsif tg_op<>'DELETE' and new.role='superadmin' then
   raise exception 'Only the protected owner may be superadmin';
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists protect_omcite_owner_trigger on public.user_roles;
create trigger protect_omcite_owner_trigger before insert or update or delete on public.user_roles
for each row execute function public.protect_omcite_owner();

create or replace function public.protect_profile_level()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if public.is_owner(coalesce(new.id,old.id)) then
   if tg_op='DELETE' then raise exception 'Owner profile is protected'; end if;
   new.profile_level:=100;
 else new.profile_level:=greatest(1,least(99,coalesce(new.profile_level,1)));
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists protect_profile_level_trigger on public.profiles;
create trigger protect_profile_level_trigger before update or delete on public.profiles
for each row execute function public.protect_profile_level();

create table if not exists public.rating_event_settings(
 event_id uuid primary key references public.events(id) on delete cascade,
 category text not null check(category in ('training','amateur','regional','official','season_final')),
 hidden_coefficient numeric(6,4) not null check(hidden_coefficient>0 and hidden_coefficient<=5),
 changed_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);

create or replace function public.recalculate_player_rating(p_user_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare weighted_kills numeric:=0; weighted_matches numeric:=0; performance numeric:=1;
 confidence numeric:=0; calculated numeric:=1;
begin
 select coalesce(sum(greatest(ps.kills,0)*coalesce(res.hidden_coefficient,
    case when e.type='training' then .20 when e.type='solo' then .70 else 1 end)),0),
  coalesce(sum(greatest(ps.matches_played,0)*coalesce(res.hidden_coefficient,
    case when e.type='training' then .20 when e.type='solo' then .70 else 1 end)),0)
 into weighted_kills,weighted_matches
 from public.player_stats ps join public.events e on e.id=ps.event_id
 left join public.rating_event_settings res on res.event_id=e.id
 where ps.user_id=p_user_id and ps.status='approved'
  and e.type in('tournament','training','solo');
 if weighted_matches>0 then
  performance:=least(100,1+(weighted_kills/weighted_matches)*12);
  confidence:=least(1,weighted_matches/12);
  calculated:=greatest(1,least(100,1+(performance-1)*confidence));
 end if;
 update public.profiles set main_rating=round(calculated,2) where id=p_user_id;
 return round(calculated,2);
end $$;

create or replace function public.refresh_player_rating_from_stats()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' then
  perform public.recalculate_player_rating(old.user_id);
 else
  perform public.recalculate_player_rating(new.user_id);
  if tg_op='UPDATE' and old.user_id<>new.user_id then
   perform public.recalculate_player_rating(old.user_id);
  end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists refresh_player_rating_trigger on public.player_stats;
create trigger refresh_player_rating_trigger after insert or update or delete on public.player_stats
for each row execute function public.refresh_player_rating_from_stats();

do $$ declare player_id uuid;
begin
 for player_id in select distinct user_id from public.player_stats loop
  perform public.recalculate_player_rating(player_id);
 end loop;
end $$;

create or replace function public.recalculate_organization_rating(p_team_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare players_score numeric:=1; result_score numeric:=1; achievement_score numeric:=1; calculated numeric;
begin
 select coalesce(avg(main_rating),1) into players_score from(
  select p.main_rating from public.team_members tm join public.profiles p on p.id=tm.user_id
  where tm.team_id=p_team_id order by p.main_rating desc limit 4
 ) best_four;
 select results_score,achievements_score into result_score,achievement_score
 from public.teams where id=p_team_id;
 calculated:=greatest(1,least(100,players_score*.60+coalesce(result_score,1)*.30+coalesce(achievement_score,1)*.10));
 update public.teams set main_rating=calculated where id=p_team_id;
 return round(calculated,2);
end $$;
revoke all on function public.recalculate_organization_rating(uuid) from public,anon,authenticated;
grant execute on function public.recalculate_organization_rating(uuid) to service_role;

create or replace function public.refresh_organization_rating_from_player()
returns trigger language plpgsql security definer set search_path=public as $$
declare organization_id uuid;
begin
 if old.main_rating is distinct from new.main_rating then
  for organization_id in select team_id from public.team_members where user_id=new.id loop
   perform public.recalculate_organization_rating(organization_id);
  end loop;
 end if;
 return new;
end $$;
drop trigger if exists refresh_organization_rating_from_player_trigger on public.profiles;
create trigger refresh_organization_rating_from_player_trigger after update of main_rating on public.profiles
for each row execute function public.refresh_organization_rating_from_player();

do $$ declare organization_id uuid;
begin
 for organization_id in select id from public.teams loop
  perform public.recalculate_organization_rating(organization_id);
 end loop;
end $$;
revoke all on function public.recalculate_player_rating(uuid) from public,anon,authenticated;
grant execute on function public.recalculate_player_rating(uuid) to service_role;

create table if not exists public.reputation_reviews(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete restrict,
 reviewer_id uuid not null references auth.users(id) on delete restrict,
 target_user_id uuid not null references auth.users(id) on delete restrict,
 sentiment smallint not null check(sentiment in(-1,1)),
 reason text,
 status text not null default 'pending' check(status in('pending','approved','rejected')),
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(event_id,reviewer_id,target_user_id),
 check(reviewer_id<>target_user_id),
 check(sentiment=1 or char_length(trim(coalesce(reason,''))) between 3 and 500)
);
create table if not exists public.reputation_ledger(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 delta numeric(5,2) not null check(delta<>0),
 reason text not null,
 source_type text not null check(source_type in('review','attendance','moderation','correction')),
 source_id uuid, changed_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);

create table if not exists public.organization_participation_history(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.teams(id) on delete set null,
 organization_name text not null,
 organization_type text not null check(organization_type in('team','guild')),
 mode text not null check(mode in('tournament','training','bo','kv')),
 event_id uuid references public.events(id) on delete set null,
 clan_war_id uuid references public.clan_wars(id) on delete set null,
 session_id uuid references public.event_sessions(id) on delete set null,
 event_title text not null, season text, occurred_at timestamptz not null,
 roster_snapshot jsonb not null default '[]'::jsonb,
 place integer check(place is null or place>0),
 kills integer check(kills is null or kills>=0),
 points numeric(10,2), score text,
 result_status text not null default 'completed'
  check(result_status in('completed','cancelled','technical_loss','no_show')),
 correction_note text, recorded_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(event_id is not null or clan_war_id is not null)
);
create table if not exists public.organization_history_change_logs(
 id uuid primary key default gen_random_uuid(),
 history_id uuid not null references public.organization_participation_history(id) on delete restrict,
 changed_by uuid not null references auth.users(id) on delete restrict,
 before_values jsonb, after_values jsonb, note text not null,
 created_at timestamptz not null default now()
);

create or replace function public.recalculate_organization_results(p_team_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare weighted_score numeric:=0; total_weight numeric:=0; confidence numeric:=0;
 result_value numeric:=1;
begin
 select coalesce(sum(greatest(1,least(100,100-(h.place-1)*9+least(coalesce(h.kills,0),30)*.5))
    *coalesce(res.hidden_coefficient,case when h.mode='training' then .20 else 1 end)),0),
  coalesce(sum(coalesce(res.hidden_coefficient,case when h.mode='training' then .20 else 1 end)),0)
 into weighted_score,total_weight
 from public.organization_participation_history h
 left join public.rating_event_settings res on res.event_id=h.event_id
 where h.organization_id=p_team_id and h.mode in('tournament','training')
  and h.result_status='completed' and h.place is not null;
 if total_weight>0 then
  confidence:=least(1,total_weight/5);
  result_value:=greatest(1,least(100,1+((weighted_score/total_weight)-1)*confidence));
 end if;
 update public.teams set results_score=round(result_value,2) where id=p_team_id;
 perform public.recalculate_organization_rating(p_team_id);
 return round(result_value,2);
end $$;
revoke all on function public.recalculate_organization_results(uuid) from public,anon,authenticated;
grant execute on function public.recalculate_organization_results(uuid) to service_role;

create or replace function public.refresh_organization_rating_from_history()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' then
  if old.organization_id is not null and old.mode in('tournament','training') then
   perform public.recalculate_organization_results(old.organization_id);
  end if;
 else
  if new.organization_id is not null and new.mode in('tournament','training') then
   perform public.recalculate_organization_results(new.organization_id);
  end if;
  if tg_op='UPDATE' and old.organization_id is distinct from new.organization_id
     and old.organization_id is not null and old.mode in('tournament','training') then
   perform public.recalculate_organization_results(old.organization_id);
  end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists refresh_organization_rating_trigger on public.organization_participation_history;
create trigger refresh_organization_rating_trigger after insert or update or delete on public.organization_participation_history
for each row execute function public.refresh_organization_rating_from_history();
create index if not exists organization_history_org_idx
 on public.organization_participation_history(organization_id,occurred_at desc);
create unique index if not exists organization_history_clan_war_unique
 on public.organization_participation_history(organization_id,clan_war_id) where clan_war_id is not null;
create unique index if not exists organization_history_event_session_unique
 on public.organization_participation_history(organization_id,event_id,session_id)
 where event_id is not null and session_id is not null;

create table if not exists public.event_games(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id) on delete cascade,
 session_id uuid not null references public.event_sessions(id) on delete cascade,
 game_number integer not null check(game_number between 1 and 100),
 map_name text not null check(map_name in('bermuda','nexterra','solara','purgatory','kalahari')),
 status text not null default 'scheduled' check(status in('scheduled','completed','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(session_id,game_number)
);
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

create table if not exists public.economy_settings(
 singleton boolean primary key default true check(singleton),
 currency_name text not null default 'Монеты Арены',
 starting_balance bigint not null default 1000 check(starting_balance between 0 and 1000000),
 minimum_stake bigint not null default 10 check(minimum_stake>0),
 maximum_stake bigint not null default 200 check(maximum_stake>=minimum_stake),
 maximum_odds numeric(8,2) not null default 15 check(maximum_odds between 1.01 and 100),
 changed_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
insert into public.economy_settings(singleton) values(true) on conflict do nothing;
create table if not exists public.site_wallets(
 user_id uuid primary key references auth.users(id) on delete restrict,
 balance bigint not null default 0 check(balance>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.currency_ledger(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 amount bigint not null check(amount<>0), balance_after bigint not null check(balance_after>=0),
 operation_type text not null check(operation_type in('opening','stake','payout','refund','correction')),
 reference_type text, reference_id uuid, description text not null,
 created_at timestamptz not null default now()
);

create or replace function public.create_wallet_for_profile()
returns trigger language plpgsql security definer set search_path=public as $$
declare opening bigint;
begin
 select starting_balance into opening from public.economy_settings where singleton;
 insert into public.site_wallets(user_id,balance) values(new.id,coalesce(opening,1000)) on conflict do nothing;
 if found then insert into public.currency_ledger(user_id,amount,balance_after,operation_type,description)
 values(new.id,coalesce(opening,1000),coalesce(opening,1000),'opening','Стартовый баланс'); end if;
 return new;
end $$;
drop trigger if exists create_wallet_for_profile_trigger on public.profiles;
create trigger create_wallet_for_profile_trigger after insert on public.profiles
for each row execute function public.create_wallet_for_profile();

do $$
declare opening bigint;
begin
 select starting_balance into opening from public.economy_settings where singleton;
 insert into public.site_wallets(user_id,balance) select id,opening from public.profiles on conflict do nothing;
 insert into public.currency_ledger(user_id,amount,balance_after,operation_type,description)
 select w.user_id,w.balance,w.balance,'opening','Стартовый баланс' from public.site_wallets w
 where not exists(select 1 from public.currency_ledger l where l.user_id=w.user_id);
end $$;

create table if not exists public.betting_markets(
 id uuid primary key default gen_random_uuid(),
 event_id uuid references public.events(id) on delete cascade,
 game_id uuid references public.event_games(id) on delete cascade,
 clan_war_id uuid references public.clan_wars(id) on delete cascade,
 subject_team_id uuid references public.teams(id) on delete restrict,
 subject_team_name text,
 mode text not null check(mode in('tournament','training','bo','kv')),
 market_type text not null check(market_type in('kills_over','kills_under','exact_place','win','loss','exact_score')),
 selection_value text not null, line numeric(8,2),
 odds numeric(8,2) not null check(odds between 1.01 and 100),
 model_snapshot jsonb not null default '{}'::jsonb,
 locks_at timestamptz not null,
 status text not null default 'open' check(status in('draft','open','locked','settled','void')),
 outcome text check(outcome in('won','lost','void')),
 created_by uuid references auth.users(id) on delete set null,
 settled_by uuid references auth.users(id) on delete set null, settled_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(event_id is not null or clan_war_id is not null),
 check(game_id is null or mode in('tournament','training')),
 check(clan_war_id is null or mode='kv')
);
create table if not exists public.site_bets(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 market_id uuid not null references public.betting_markets(id) on delete restrict,
 stake bigint not null check(stake>0), odds numeric(8,2) not null check(odds>=1.01),
 potential_payout bigint not null check(potential_payout>=stake),
 status text not null default 'open' check(status in('open','won','lost','refunded')),
 payout bigint not null default 0 check(payout>=0),
 placed_at timestamptz not null default now(), settled_at timestamptz,
 unique(user_id,market_id)
);
create index if not exists betting_markets_event_idx on public.betting_markets(event_id,status,locks_at);
create index if not exists betting_markets_war_idx on public.betting_markets(clan_war_id,status,locks_at);
create index if not exists site_bets_user_idx on public.site_bets(user_id,placed_at desc);
create index if not exists currency_ledger_user_idx on public.currency_ledger(user_id,created_at desc);

create or replace function public.place_site_bet_for(p_user_id uuid,p_market_id uuid,p_stake bigint)
returns uuid language plpgsql security definer set search_path=public as $$
declare m public.betting_markets%rowtype; s public.economy_settings%rowtype;
 wallet_balance bigint; bet_id uuid; payout bigint; own_team boolean:=false;
begin
 select * into m from public.betting_markets where id=p_market_id for update;
 if m.id is null or m.status<>'open' or now()>=m.locks_at then raise exception 'Market is closed'; end if;
 select * into s from public.economy_settings where singleton;
 if p_stake<s.minimum_stake or p_stake>s.maximum_stake then raise exception 'Stake is outside allowed limits'; end if;
 if m.subject_team_id is not null then
  select exists(
   select 1 from public.team_members tm where tm.team_id=m.subject_team_id and tm.user_id=p_user_id
   union all select 1 from public.event_registrations er where er.event_id=m.event_id
    and er.team_id=m.subject_team_id
    and (er.participant_user_id=p_user_id or er.roster_json ? p_user_id::text)
   union all select 1 from public.clan_war_rosters r where r.clan_war_id=m.clan_war_id
    and r.team_id=m.subject_team_id and p_user_id=any(r.player_ids)
  ) into own_team;
 end if;
 if own_team then raise exception 'You cannot bet on your own organization'; end if;
 select balance into wallet_balance from public.site_wallets where user_id=p_user_id for update;
 if wallet_balance is null or wallet_balance<p_stake then raise exception 'Insufficient balance'; end if;
 payout:=floor(p_stake*least(m.odds,s.maximum_odds));
 insert into public.site_bets(user_id,market_id,stake,odds,potential_payout)
 values(p_user_id,p_market_id,p_stake,m.odds,payout) returning id into bet_id;
 update public.site_wallets set balance=balance-p_stake,updated_at=now()
 where user_id=p_user_id returning balance into wallet_balance;
 insert into public.currency_ledger(user_id,amount,balance_after,operation_type,reference_type,reference_id,description)
 values(p_user_id,-p_stake,wallet_balance,'stake','bet',bet_id,'Ставка принята');
 return bet_id;
end $$;

create or replace function public.settle_betting_market(p_market_id uuid,p_outcome text,p_actor uuid)
returns void language plpgsql security definer set search_path=public as $$
declare m public.betting_markets%rowtype; b public.site_bets%rowtype; new_balance bigint;
begin
 if p_outcome not in('won','lost','void') then raise exception 'Unsupported outcome'; end if;
 select * into m from public.betting_markets where id=p_market_id for update;
 if m.id is null or m.status in('settled','void') then raise exception 'Market already closed'; end if;
 update public.betting_markets set status=case when p_outcome='void' then 'void' else 'settled' end,
 outcome=p_outcome,settled_by=p_actor,settled_at=now(),updated_at=now() where id=p_market_id;
 for b in select * from public.site_bets where market_id=p_market_id and status='open' for update loop
  if p_outcome='won' then
   update public.site_wallets set balance=balance+b.potential_payout,updated_at=now()
    where user_id=b.user_id returning balance into new_balance;
   update public.site_bets set status='won',payout=b.potential_payout,settled_at=now() where id=b.id;
   insert into public.currency_ledger(user_id,amount,balance_after,operation_type,reference_type,reference_id,description)
    values(b.user_id,b.potential_payout,new_balance,'payout','bet',b.id,'Выигрыш по ставке');
  elsif p_outcome='void' then
   update public.site_wallets set balance=balance+b.stake,updated_at=now()
    where user_id=b.user_id returning balance into new_balance;
   update public.site_bets set status='refunded',payout=b.stake,settled_at=now() where id=b.id;
   insert into public.currency_ledger(user_id,amount,balance_after,operation_type,reference_type,reference_id,description)
    values(b.user_id,b.stake,new_balance,'refund','bet',b.id,'Возврат ставки');
  else update public.site_bets set status='lost',payout=0,settled_at=now() where id=b.id;
  end if;
 end loop;
end $$;
revoke all on function public.place_site_bet_for(uuid,uuid,bigint) from public,anon,authenticated;
revoke all on function public.settle_betting_market(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.place_site_bet_for(uuid,uuid,bigint) to service_role;
grant execute on function public.settle_betting_market(uuid,text,uuid) to service_role;

alter table public.role_change_logs enable row level security;
alter table public.rating_event_settings enable row level security;
alter table public.reputation_reviews enable row level security;
alter table public.reputation_ledger enable row level security;
alter table public.organization_participation_history enable row level security;
alter table public.organization_history_change_logs enable row level security;
alter table public.event_games enable row level security;
alter table public.event_game_results enable row level security;
alter table public.round_match_results enable row level security;
alter table public.economy_settings enable row level security;
alter table public.site_wallets enable row level security;
alter table public.currency_ledger enable row level security;
alter table public.betting_markets enable row level security;
alter table public.site_bets enable row level security;

create policy "owner views role audit" on public.role_change_logs for select using(public.is_owner());
create policy "owner sees rating settings" on public.rating_event_settings for select using(public.is_owner());
create policy "owner manages rating settings" on public.rating_event_settings for all
 using(public.is_owner()) with check(public.is_owner());
create policy "reviews visible to parties and moderators" on public.reputation_reviews for select
 using(reviewer_id=auth.uid() or target_user_id=auth.uid() or public.is_app_admin());
create policy "users view own reputation ledger" on public.reputation_ledger for select
 using(user_id=auth.uid() or public.is_app_admin());
create policy "organization history is public" on public.organization_participation_history for select using(true);
create policy "history audit visible to admins" on public.organization_history_change_logs for select using(public.is_app_admin());
create policy "event games are public" on public.event_games for select using(true);
create policy "confirmed game results are public" on public.event_game_results for select
 using(status='confirmed' or public.is_app_admin());
create policy "confirmed round results are public" on public.round_match_results for select
 using(status='confirmed' or public.is_app_admin());
create policy "owner views economy settings" on public.economy_settings for select using(public.is_owner());
create policy "users view own wallet" on public.site_wallets for select using(user_id=auth.uid());
create policy "users view own ledger" on public.currency_ledger for select using(user_id=auth.uid());
create policy "markets are public" on public.betting_markets for select using(status<>'draft' or public.is_app_admin());
create policy "users view own bets" on public.site_bets for select using(user_id=auth.uid() or public.is_app_admin());

grant select on public.organization_participation_history,public.event_games,public.event_game_results,
 public.round_match_results,public.betting_markets to anon,authenticated;
grant select on public.reputation_reviews,public.reputation_ledger,public.site_wallets,
 public.currency_ledger,public.site_bets,public.role_change_logs,public.organization_history_change_logs,
 public.economy_settings,public.rating_event_settings to authenticated;
commit;
