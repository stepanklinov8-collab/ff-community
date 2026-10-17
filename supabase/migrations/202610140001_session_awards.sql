begin;

-- Existing publications keep their original statistics, including after corrections.
alter table public.competition_publications add column if not exists awards_enabled boolean not null default false;
create or replace function public.u3_mark_award_publication() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.first_published_at is not null then
   perform pg_advisory_xact_lock(310140001);
 end if;
 if tg_op='UPDATE' and old.first_published_at is not null then
   new.awards_enabled:=old.awards_enabled;
 else
   new.awards_enabled:=new.first_published_at is not null and coalesce((new.published->'rules'->>'mvpEnabled')::boolean,false);
 end if;
 return new;
end $$;
create trigger u3_mark_award_publication_trigger before insert or update on public.competition_publications
for each row execute function public.u3_mark_award_publication();

create table public.competition_award_entries (
 session_id uuid not null references public.event_sessions(id) on delete cascade,
 target_type text not null check(target_type in ('player','team')),
 target_id uuid not null,
 outcome integer not null check(outcome between 0 and 2), -- 0 breaks, 1 preserves, 2 advances and earns
 primary key(session_id,target_type,target_id)
);
create index competition_award_entries_target_idx on public.competition_award_entries(target_type,target_id,session_id);
alter table public.competition_award_entries enable row level security;
revoke all on public.competition_award_entries from public,anon,authenticated;
grant all on public.competition_award_entries to service_role;

create or replace function public.u3_awards_for_target(p_type text,p_target uuid)
returns table(session_id uuid,mode text,occurred_at timestamptz,outcome integer,streak bigint,bonus numeric)
language sql stable security definer set search_path=public as $$
 with entries as (
  select a.session_id,cp.published->'rules'->>'mode' mode,s.start_time occurred_at,a.outcome,
    least(5,greatest(.01,coalesce(rs.hidden_coefficient,case when cp.published->'rules'->>'mode'='training' then .2 else 1 end))) weight
  from public.competition_award_entries a
  join public.competition_publications cp on cp.session_id=a.session_id
  join public.event_sessions s on s.id=a.session_id
  join public.events e on e.id=s.event_id
  left join public.rating_event_settings rs on rs.event_id=e.id
  where a.target_type=p_type and a.target_id=p_target and cp.awards_enabled and cp.first_published_at is not null
    and s.status<>'cancelled' and coalesce((e.competition_rules->>'ratingEnabled')::boolean,true)
 ), segments as (
  select *,sum(case when outcome=0 then 1 else 0 end) over(partition by mode order by occurred_at,session_id) segment from entries
 ), streaks as (
  select *,sum(case when outcome=2 then 1 else 0 end) over(partition by mode,segment order by occurred_at,session_id) streak from segments
 )
 select session_id,mode,occurred_at,outcome,streak,
   case when outcome=2 then .5*weight*least(3,1+.25*(streak-1)) else 0 end bonus
 from streaks order by occurred_at,session_id
$$;
create or replace function public.u3_award_bonus(p_type text,p_target uuid) returns numeric
language sql stable security definer set search_path=public as $$
 select least(5,coalesce(sum(bonus),0)) from public.u3_awards_for_target(p_type,p_target)
$$;
create or replace function public.u3_award_summary(p_type text,p_target uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 with awards as (select * from public.u3_awards_for_target(p_type,p_target)),latest as (
   select distinct on(mode) mode,streak from awards order by mode,occurred_at desc,session_id desc
 )
 select jsonb_build_object('count',(select count(*) from awards where outcome=2),
  'ratingBonus',least(5,coalesce((select sum(bonus) from awards),0)),
  'trainingStreak',coalesce((select streak from latest where mode='training'),0),
  'tournamentStreak',coalesce((select streak from latest where mode='tournament'),0))
$$;

create or replace function public.u3_sync_session_awards(p_session uuid,p_previous jsonb default null) returns void
language plpgsql security definer set search_path=public as $$
declare cp public.competition_publications; old_players uuid[]; old_teams uuid[]; entity uuid; organization uuid;
begin
 -- Serialize final award reconciliation, so concurrent publications cannot lose a rating update.
 perform pg_advisory_xact_lock(310140001);
 select * into cp from public.competition_publications where session_id=p_session;
 select array_agg(target_id) into old_players from public.competition_award_entries where session_id=p_session and target_type='player';
 select array_agg(target_id) into old_teams from public.competition_award_entries where session_id=p_session and target_type='team';
 delete from public.competition_award_entries where session_id=p_session;
 if cp.awards_enabled and cp.first_published_at is not null and cp.published->'rules'->>'mode' in('training','tournament') then
  insert into public.competition_award_entries(session_id,target_type,target_id,outcome)
   select p_session,'player',f.user_id,case when cp.published->'mvps' ? f.user_id::text then 2 else 0 end
   from public.competition_player_facts f where f.session_id=p_session group by f.user_id;
  if public.u2_session_has_single_group(p_session) then
   insert into public.competition_award_entries(session_id,target_type,target_id,outcome)
    select p_session,'team',(s->>'teamId')::uuid,case when (s->>'place')::int<=2 then 2 when (s->>'place')::int=3 then 1 else 0 end
    from jsonb_array_elements(cp.published->'standings') s
    where s->>'teamId' is not null and (s->>'gamesPlayed')::int>0;
  end if;
 end if;
 -- Recomputing from all entries also corrects every later streak for these targets.
 for entity in select target_id from public.competition_award_entries where session_id=p_session and target_type='player'
   union select unnest(coalesce(old_players,'{}'))
   union select (p->>'userId')::uuid from jsonb_array_elements(coalesce(p_previous->'rows','[]')) r
     cross join lateral jsonb_array_elements(r->'players') p where p->>'userId' is not null
 loop
  perform public.recalculate_player_rating(entity);
  -- A change below the profile's one-decimal rounding still changes the best four exact ratings.
  for organization in select team_id from public.team_members where user_id=entity loop
   perform public.recalculate_organization_rating(organization);
  end loop;
 end loop;
 for entity in select target_id from public.competition_award_entries where session_id=p_session and target_type='team'
   union select unnest(coalesce(old_teams,'{}'))
   union select (s->>'teamId')::uuid from jsonb_array_elements(coalesce(p_previous->'standings','[]')) s where s->>'teamId' is not null
 loop
  perform public.recalculate_organization_rating(entity);
 end loop;
end $$;
create or replace function public.u3_publication_awards_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 perform public.u3_sync_session_awards(coalesce(new.session_id,old.session_id),case when tg_op<>'INSERT' then old.published else null end);
 return null;
end $$;
create constraint trigger u3_publication_awards_trigger after insert or update of published,first_published_at or delete on public.competition_publications
 deferrable initially deferred for each row execute function public.u3_publication_awards_trigger();
create or replace function public.u3_session_awards_trigger() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if old.start_time is distinct from new.start_time or (old.status='cancelled') is distinct from (new.status='cancelled') then
  perform public.u3_sync_session_awards(new.id);
 end if;
 return null;
end $$;
create constraint trigger u3_session_awards_trigger after update of start_time,status on public.event_sessions
 deferrable initially deferred for each row execute function public.u3_session_awards_trigger();

create or replace function public.recalculate_player_rating(p_user_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare w numeric; k numeric; l numeric; v numeric; g numeric; r numeric; rep numeric; q numeric; n integer; wins_count integer; kills_count integer;
begin
 select coalesce(sum(x.weight),0),coalesce(sum(x.weight*x.kills),0),coalesce(sum(x.weight*(x.field_size-x.place)/(x.field_size-1)),0),
 coalesce(sum(x.weight*case when public.u2_session_winner(x.session_id,x.team_id,x.user_id) and x.win_order=1 then 1 else 0 end),0),count(*),count(distinct x.session_id) filter(where public.u2_session_winner(x.session_id,x.team_id,x.user_id)),coalesce(sum(x.kills),0)
 into w,k,l,v,n,wins_count,kills_count from (
 select f.*,row_number() over(partition by f.user_id,f.session_id order by f.game_id) win_order,coalesce(rs.hidden_coefficient,case when f.mode='training' then .20 else 1 end) weight
 from public.competition_player_facts f join public.event_sessions s on s.id=f.session_id join public.events e on e.id=s.event_id
 left join public.rating_event_settings rs on rs.event_id=s.event_id
 where f.user_id=p_user_id and f.mode in('tournament','training') and f.field_size>=2 and f.place between 1 and f.field_size and coalesce((e.competition_rules->>'ratingEnabled')::boolean,true)
 ) x;
 select reputation_score into rep from public.profiles where id=p_user_id;
 if w>0 then g:=greatest(1,least(100,1+99*least(1,w/12)*(.50*least(1,k/w/8.25)+.35*l/w+.15*v/w)));
 else select coalesce(legacy_game_rating,1) into g from public.profiles where id=p_user_id; end if;
 q:=case when rep<=50 then (rep-50)/49 else (rep-50)/50 end;
 r:=greatest(1,least(100,g*(1+.03*q)+public.u3_award_bonus('player',p_user_id)));
 select count(*),count(distinct session_id) filter(where public.u2_session_winner(session_id,team_id,user_id)),coalesce(sum(kills),0) into n,wins_count,kills_count from public.competition_player_facts where user_id=p_user_id and mode in('tournament','training');
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills)
 values('player',p_user_id,'main',r,round(r,1),wins_count,n,kills_count)
 on conflict(target_type,target_id,mode) do update set exact_rating=excluded.exact_rating,display_rating=excluded.display_rating,
 wins=excluded.wins,games=excluded.games,kills=excluded.kills,updated_at=now();
 update public.profiles set main_rating=round(r,1) where id=p_user_id;
 return r;
end $$;

create or replace function public.recalculate_organization_rating(p_team_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare players numeric; results numeric; achievements numeric; rep numeric; rating numeric; wins_count integer; n integer; kills_count integer;
begin
 select coalesce(avg(value),1) into players from (
 select coalesce(r.exact_rating,p.main_rating) value from public.team_members tm join public.profiles p on p.id=tm.user_id
 left join public.competition_ratings r on r.target_type='player' and r.target_id=p.id and r.mode='main'
 where tm.team_id=p_team_id order by value desc limit 4) best;
 select results_score,achievements_score,reputation_score into results,achievements,rep from public.teams where id=p_team_id;
 rating:=greatest(1,least(100,.98*(.60*players+.30*coalesce(results,1)+.10*coalesce(achievements,1))+.02*coalesce(rep,50)+public.u3_award_bonus('team',p_team_id)));
 select count(distinct session_id) filter(where played and public.u2_session_winner(session_id,team_id,null)),count(*) filter(where played),coalesce(sum(kills),0) into wins_count,n,kills_count
 from public.competition_team_facts where team_id=p_team_id and mode in('tournament','training');
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills)
 values('team',p_team_id,'main',rating,round(rating,2),wins_count,n,kills_count)
 on conflict(target_type,target_id,mode) do update set exact_rating=excluded.exact_rating,display_rating=excluded.display_rating,
 wins=excluded.wins,games=excluded.games,kills=excluded.kills,updated_at=now();
 update public.teams set main_rating=round(rating,2) where id=p_team_id;
 return rating;
end $$;

revoke all on function public.u3_mark_award_publication() from public,anon,authenticated;
grant execute on function public.u3_mark_award_publication() to service_role;

revoke all on function public.u3_awards_for_target(text,uuid) from public,anon,authenticated;
grant execute on function public.u3_awards_for_target(text,uuid) to service_role;

revoke all on function public.u3_award_bonus(text,uuid) from public,anon,authenticated;
grant execute on function public.u3_award_bonus(text,uuid) to service_role;

revoke all on function public.u3_award_summary(text,uuid) from public,anon,authenticated;
grant execute on function public.u3_award_summary(text,uuid) to service_role;

revoke all on function public.u3_sync_session_awards(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.u3_sync_session_awards(uuid,jsonb) to service_role;

revoke all on function public.u3_publication_awards_trigger() from public,anon,authenticated;
grant execute on function public.u3_publication_awards_trigger() to service_role;

revoke all on function public.u3_session_awards_trigger() from public,anon,authenticated;
grant execute on function public.u3_session_awards_trigger() to service_role;

commit;
