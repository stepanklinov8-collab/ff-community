begin;

-- A personal rating does not exist until ten fully documented games. Keep
-- unranked profiles distinct from a legitimate score of zero.
alter table public.profiles alter column main_rating drop not null;
alter table public.profiles alter column main_rating drop default;
alter table public.profiles drop constraint if exists profiles_main_rating_range;
alter table public.profiles add constraint profiles_main_rating_range check(main_rating between 0 and 999);
alter table public.competition_ratings drop constraint if exists competition_ratings_exact_rating_check;
alter table public.competition_ratings add constraint competition_ratings_exact_rating_check check(exact_rating between 0 and 999);

create table public.competition_game_forecasts (
 game_id uuid not null references public.event_games(id) on delete cascade,
 team_id uuid not null references public.teams(id) on delete cascade,
 map_name text not null,
 strength numeric not null check(strength>0),
 expected_place numeric not null check(expected_place between 0 and 1),
 captured_at timestamptz not null default now(),
 primary key(game_id,team_id)
);
create index competition_game_forecasts_team_idx on public.competition_game_forecasts(team_id,game_id);
alter table public.competition_game_forecasts enable row level security;
revoke all on public.competition_game_forecasts from public,anon,authenticated;
grant all on public.competition_game_forecasts to service_role;

-- The map-and-field-size forecast is installed by 202610170003. Keep the
-- callable entry point while this migration is applied to an existing copy.
create or replace function public.u4_snapshot_game_forecasts() returns integer
language plpgsql security definer set search_path=public as $$
begin
 return 0;
end $$;

create or replace function public.u4_complete_rating_session(p_session uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce((select p.published is not null and exists(
   select 1 from jsonb_array_elements(coalesce(p.published->'rows','[]'::jsonb)) r
   where r->>'teamId' is not null and r->>'played'='true'
 ) and not exists(
   select 1 from jsonb_array_elements(coalesce(p.published->'rows','[]'::jsonb)) r
   where r->>'teamId' is not null and r->>'played'='true' and (
    r->>'detail'='team' or jsonb_typeof(r->'players') is distinct from 'array'
    or jsonb_array_length(case when jsonb_typeof(r->'players')='array' then r->'players' else '[]'::jsonb end)=0
    or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(r->'players')='array' then r->'players' else '[]'::jsonb end) player
      where player->>'played'='true' and (player->>'kills' is null or player->>'kills' !~ '^[0-9]+$'))
    or (select coalesce(sum(case when player->>'kills' ~ '^[0-9]+$' then (player->>'kills')::integer else 0 end),0) from jsonb_array_elements(case when jsonb_typeof(r->'players')='array' then r->'players' else '[]'::jsonb end) player
      where player->>'played'='true') is distinct from (r->>'kills')::integer
   )
 ) from public.competition_publications p where p.session_id=p_session and p.first_published_at is not null),false)
$$;

create or replace function public.u4_placement_bonus(p_user_id uuid) returns numeric
language sql stable security definer set search_path=public as $$
 select coalesce(sum(case when e.type='training' or not public.u2_session_has_single_group(s.id)
    or s.stage in('qualification','semifinal')
    or e.final_session_id is not null and s.id<>e.final_session_id
   then case (standing->>'place')::integer when 1 then .10 when 2 then .05 when 3 then .03 else 0 end
   else case (standing->>'place')::integer when 1 then .30 when 2 then .20 when 3 then .10 else 0 end end),0)
 from public.competition_publications cp
 join public.event_sessions s on s.id=cp.session_id
 join public.events e on e.id=s.event_id
 cross join lateral jsonb_array_elements(coalesce(cp.published->'standings','[]'::jsonb)) standing
 where cp.first_published_at is not null and s.status<>'cancelled'
   and e.type in('training','tournament') and coalesce((e.competition_rules->>'ratingEnabled')::boolean,true)
   and public.u4_complete_rating_session(s.id)
   and standing->>'teamId' is not null and (standing->>'gamesPlayed')::integer>0
   and (standing->>'place')::integer between 1 and 3
   and exists(select 1 from public.competition_player_facts f where f.session_id=s.id
     and f.team_id=(standing->>'teamId')::uuid and f.user_id=p_user_id)
$$;

create or replace function public.u4_player_main_statistics(p_user_id uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 with complete as (
  select distinct f.session_id from public.competition_player_facts f
  where f.user_id=p_user_id and public.u4_complete_rating_session(f.session_id)
 ), field as (
  select game_id,count(*) n from public.competition_team_facts where played group by game_id
 ), valid as (
  select f.* from public.competition_player_facts f
  join complete c on c.session_id=f.session_id
  join public.competition_team_facts tf on tf.game_id=f.game_id and tf.team_id=f.team_id and tf.played
  join field on field.game_id=f.game_id and field.n>=2 and tf.place between 1 and field.n
  join public.event_sessions s on s.id=f.session_id join public.events e on e.id=s.event_id
  where f.user_id=p_user_id and f.mode in('training','tournament')
    and coalesce((e.competition_rules->>'ratingEnabled')::boolean,true)
 ) select jsonb_build_object(
  'sessionIds',coalesce((select jsonb_agg(distinct session_id) from valid),'[]'::jsonb),
  'games',(select count(*) from valid),
  'kills',(select coalesce(sum(kills),0) from valid),
  'wins',(select count(distinct session_id) from valid where public.u2_session_winner(session_id,team_id,user_id)),
  'deaths',(select sum(deaths) from valid),
  'assists',(select sum(assists) from valid))
$$;

create or replace function public.recalculate_player_rating(p_user_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare game_count integer;wins_count integer;kills_count integer;personal_kills numeric;
 weighted_mean numeric;bonus numeric;rating numeric;
begin
 with complete as (
  select distinct f.session_id from public.competition_player_facts f
  where f.user_id=p_user_id and public.u4_complete_rating_session(f.session_id)
 ), field as (
  select f.game_id,count(*)::integer n,sum(f.kills)::numeric all_kills
  from public.competition_team_facts f join complete c on c.session_id=f.session_id
  where f.played group by f.game_id
 ), games as (
  select f.session_id,f.game_id,f.team_id,f.kills::numeric personal,tf.kills::numeric team_kills,
    field.all_kills,field.n,tf.place,
    coalesce(rs.hidden_coefficient,case when f.mode='training' then .20 else 1 end)::numeric coefficient,
    greatest(-1,least(1,(field.n-tf.place)::numeric/(field.n-1)-coalesce(fc.expected_place,(field.n-tf.place)::numeric/(field.n-1)))) d
  from public.competition_player_facts f join complete c on c.session_id=f.session_id
  join public.competition_team_facts tf on tf.game_id=f.game_id and tf.team_id=f.team_id and tf.played
  join field on field.game_id=f.game_id and field.n>=2
  join public.event_sessions s on s.id=f.session_id join public.events e on e.id=s.event_id
  left join public.rating_event_settings rs on rs.event_id=e.id
  left join public.competition_game_forecasts fc on fc.game_id=f.game_id and fc.team_id=f.team_id
  where f.user_id=p_user_id and f.mode in('training','tournament')
    and tf.place between 1 and field.n and coalesce((e.competition_rules->>'ratingEnabled')::boolean,true)
 ), scored as (
  select coefficient,personal,session_id,team_id,
    coalesce(personal/nullif(all_kills,0),0)
      +case when personal=0 and team_kills=0 then .25 else coalesce(personal/nullif(team_kills,0),0) end
      +(case when personal=0 and team_kills=0 then .25 else coalesce(personal/nullif(team_kills,0),0) end) *
      (case when place=1 then n+1 else n+1-place end) * (1+d) a
  from games
 ), grouped as (
  select coefficient,avg(coalesce(a,0)) average_a from scored group by coefficient
 )
 select (select count(*) from scored),(select coalesce(sum(personal),0) from scored),
    (select coalesce(sum(coefficient*average_a)/nullif(count(*),0),0) from grouped)
 into game_count,personal_kills,weighted_mean;

 select count(distinct f.session_id) filter(where public.u2_session_winner(f.session_id,f.team_id,f.user_id)),
   coalesce(sum(f.kills),0) into wins_count,kills_count
 from public.competition_player_facts f
 where f.user_id=p_user_id and f.mode in('training','tournament')
   and public.u4_complete_rating_session(f.session_id);

 if game_count<10 then
  delete from public.competition_ratings where target_type='player' and target_id=p_user_id and mode='main';
  update public.profiles set main_rating=null where id=p_user_id;
  return null;
 end if;
 bonus:=least(499,public.u4_placement_bonus(p_user_id)+public.u3_award_bonus('player',p_user_id));
 rating:=greatest(0,least(999,(personal_kills/game_count)*weighted_mean+bonus));
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills)
 values('player',p_user_id,'main',rating,round(rating,1),wins_count,game_count,kills_count)
 on conflict(target_type,target_id,mode) do update set exact_rating=excluded.exact_rating,
 display_rating=excluded.display_rating,wins=excluded.wins,games=excluded.games,kills=excluded.kills,updated_at=now();
 update public.profiles set main_rating=round(rating,1) where id=p_user_id;
 return rating;
end $$;

-- The main player table contains only players who have reached ten eligible
-- games. Other modes and organization tables retain their existing behavior.
create or replace function public.u2_leaderboard(p_mode text,p_target_type text,p_query text default '',p_limit integer default 50,p_offset integer default 0,p_sort text default 'rating',p_kind text default null)
returns jsonb language sql stable security definer set search_path=public as $$
 with history as (
 select * from public.competition_public_history where target_type=p_target_type and source<>'legacy_unassigned'
   and case when p_mode='main' then mode in('tournament','training') else mode=p_mode end
   and (p_target_type<>'player' or p_mode<>'main' or session_id is not null and public.u4_complete_rating_session(session_id))
), raw_totals as (
 select target_id,coalesce(sum(kills),0)::integer kills,coalesce(sum(games),0)::integer games,
   coalesce(sum(wins),0)::integer wins,sum(deaths) deaths,coalesce(sum(assists),0)::integer assists
 from history group by target_id
), eligible_team_winners as (
 select target_id,session_id,row_number() over(partition by session_id order by id) winner_number
 from history where p_target_type='team' and wins=1 and public.u2_session_has_single_group(session_id)
), team_session_wins as (
 select target_id,count(*)::integer wins from eligible_team_winners where winner_number=1 group by target_id
), totals as (
 select r.target_id,r.kills,r.games,case when p_target_type='team' then coalesce(sw.wins,0) else r.wins end wins,
   r.deaths,r.assists from raw_totals r left join team_session_wins sw on sw.target_id=r.target_id
), player_values as (
 select p.id target_id,public.u2_cost_for_target('player',p.id,'main') cost
 from public.profiles p where p_target_type='player'
), organization_costs as (
 select t.id target_id,public.u2_cost_for_target('team',t.id,'main') cost
 from public.teams t where p_target_type='team'
), entities as (
 select p.id,p.nickname name,to_jsonb(p)->>'avatar_url' avatar_url,'player'::text kind,p.main_rating fallback_rating
 from public.profiles p where p_target_type='player'
 union all
 select t.id,t.name,to_jsonb(t)->>'avatar_url',t.type,t.main_rating
 from public.teams t where p_target_type='team' and to_jsonb(t)->>'dissolved_at' is null
   and coalesce((to_jsonb(t)->>'verified')::boolean,true) and (p_kind is null or t.type=p_kind)
), values_table as (
 select e.id,e.name,e.avatar_url,e.kind,
   coalesce(r.exact_rating,case when p_mode='main' then e.fallback_rating when p_mode in('bo','kv') then 50 else 1 end) exact_rating,
   case when p_target_type='team' then case when p_mode='main' then coalesce(oc.cost,0) else 0 end
     else case when p_mode='main' then coalesce(pv.cost,0) else 0 end end cost,
   case when p_mode in('bo','kv') then coalesce(d.wins,r.wins,0) else coalesce(t.wins,r.wins,0) end wins,
   coalesce(t.games,r.games,0) games,coalesce(t.kills,r.kills,0) kills,coalesce(d.series,r.series,0) series,
   coalesce(t.deaths,r.deaths) deaths,coalesce(t.assists,r.assists,0) assists
 from entities e left join public.competition_ratings r on r.target_id=e.id and r.target_type=p_target_type and r.mode=p_mode
 left join totals t on t.target_id=e.id left join player_values pv on pv.target_id=e.id
 left join organization_costs oc on oc.target_id=e.id
 left join public.competition_duel_totals d on d.target_type=p_target_type and d.target_id=e.id and d.mode=p_mode
 where (p_mode in('main','solo') or coalesce(d.series,r.series,0)>0)
   and (p_mode<>'main' or p_target_type<>'player' or r.exact_rating is not null)
), ranked as (
 select *,rank() over(order by case p_sort when 'cost' then cost when 'kills' then kills when 'games' then games when 'ratio' then kills::numeric/greatest(1,games) else exact_rating end desc,
   case when p_sort='rating' then wins else 0 end desc,case when p_sort='rating' then games else 0 end desc) position
 from values_table
), page as (
 select *,case when p_target_type='team' then round(exact_rating,2) else round(exact_rating,1) end rating
 from ranked where name ilike '%'||left(p_query,100)||'%' order by position,id
 limit greatest(1,least(100,p_limit))+1 offset greatest(0,p_offset)
), visible as (select * from page order by position,id limit greatest(1,least(100,p_limit)))
select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(v)-'exact_rating' order by position,id) from visible v),'[]'),
 'hasMore',(select count(*) from page)>greatest(1,least(100,p_limit)))
$$;

-- Every change of rating weight already calls recalculate_player_rating.
-- The new formula therefore regroups the full history under current weights.
do $$ declare player_id uuid; team_id_value uuid; begin
 for player_id in select id from public.profiles loop
  perform public.recalculate_player_rating(player_id);
 end loop;
 for team_id_value in select id from public.teams loop
  perform public.recalculate_organization_rating(team_id_value);
 end loop;
end $$;

revoke all on function public.u4_snapshot_game_forecasts(),public.u4_complete_rating_session(uuid),
 public.u4_placement_bonus(uuid),public.u4_player_main_statistics(uuid) from public,anon,authenticated;
grant execute on function public.u4_snapshot_game_forecasts() to service_role;
grant execute on function public.u4_complete_rating_session(uuid),public.u4_placement_bonus(uuid),
 public.u4_player_main_statistics(uuid) to service_role;

commit;
