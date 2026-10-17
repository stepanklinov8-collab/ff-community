begin;

-- Supersede forecasts made from an unsupported strength adjustment in early
-- staging copies. Production has no pre-update game forecasts to preserve.
truncate public.competition_game_forecasts;
alter table public.competition_game_forecasts
 add column if not exists predicted_place integer check(predicted_place>0),
 add column if not exists place_probability numeric check(place_probability between 0 and 1),
 add column if not exists sample_size integer check(sample_size>=1),
 add column if not exists place_probabilities jsonb;

-- A forecast is an empirical distribution of this team's published results
-- on this map. Historical places are rescaled to the registered field size;
-- samples from a closer field size carry more weight. No history means no
-- forecast and thus D=0. Snapshots stop changing once a session begins.
create or replace function public.u4_snapshot_game_forecasts() returns integer
language plpgsql security definer set search_path=public as $$
declare updated_count integer;
begin
 with upcoming as (
  select g.id game_id,g.map_name,g.group_id,s.id session_id,s.start_time
  from public.event_games g join public.event_sessions s on s.id=g.session_id
  join public.events e on e.id=s.event_id
  left join public.competition_publications cp on cp.session_id=s.id
  where s.start_time>now() and s.start_time<now()+interval '48 hours'
    and g.status='scheduled' and s.status<>'cancelled' and e.type in('training','tournament')
    and cp.first_published_at is null
 ), participants as (
  select distinct u.game_id,u.map_name,u.start_time,r.team_id
  from upcoming u join public.event_registrations r on r.session_id=u.session_id
    and r.group_id=u.group_id and r.status='confirmed' and r.team_id is not null
 ), fields as (
  select p.*,count(*) over(partition by game_id)::integer field_size from participants p
 ), historic_fields as (
  select game_id,count(*)::integer field_size from public.competition_team_facts
  where played and mode in('training','tournament') group by game_id
 ), samples as (
  select p.game_id,p.team_id,p.map_name,p.field_size,
    (1+round((tf.place-1)::numeric/(hf.field_size-1)*(p.field_size-1)))::integer predicted_place,
    1::numeric/(1+abs(p.field_size-hf.field_size)) sample_weight
  from fields p join public.competition_team_facts tf on tf.team_id=p.team_id and tf.played
    and tf.mode in('training','tournament')
  join historic_fields hf on hf.game_id=tf.game_id and hf.field_size>=2
  join public.event_games historical_game on historical_game.id=tf.game_id and historical_game.map_name=p.map_name
  join public.event_sessions historical_session on historical_session.id=tf.session_id
  join public.competition_publications cp on cp.session_id=tf.session_id
    and cp.first_published_at is not null and cp.first_published_at<p.start_time
  where p.field_size>=2 and tf.place between 1 and hf.field_size
    and historical_session.start_time<p.start_time
 ), place_counts as (
  select game_id,team_id,map_name,field_size,predicted_place,
    sum(sample_weight) weighted_count,count(*)::integer raw_count
  from samples group by game_id,team_id,map_name,field_size,predicted_place
 ), probabilities as (
  select *,weighted_count/sum(weighted_count) over(partition by game_id,team_id) probability,
    sum(raw_count) over(partition by game_id,team_id)::integer sample_size,
    sum(predicted_place*weighted_count) over(partition by game_id,team_id)/
      sum(weighted_count) over(partition by game_id,team_id) mean_place
  from place_counts
 ), selected as (
  select distinct on(game_id,team_id) game_id,team_id,map_name,field_size,predicted_place,
    probability,sample_size
  from probabilities
  order by game_id,team_id,probability desc,abs(predicted_place-mean_place),predicted_place
 ), distributions as (
  select game_id,team_id,jsonb_object_agg(predicted_place::text,probability) distribution
  from probabilities group by game_id,team_id
 ), inserted as (
  insert into public.competition_game_forecasts
    (game_id,team_id,map_name,strength,expected_place,predicted_place,place_probability,sample_size,place_probabilities,captured_at)
  select s.game_id,s.team_id,s.map_name,greatest(1,coalesce(t.main_rating,1)),
    (s.field_size-s.predicted_place)::numeric/(s.field_size-1),s.predicted_place,
    s.probability,s.sample_size,d.distribution,now()
  from selected s join distributions d using(game_id,team_id)
  join public.teams t on t.id=s.team_id
  on conflict(game_id,team_id) do update set map_name=excluded.map_name,
    strength=excluded.strength,expected_place=excluded.expected_place,
    predicted_place=excluded.predicted_place,place_probability=excluded.place_probability,
    sample_size=excluded.sample_size,place_probabilities=excluded.place_probabilities,
    captured_at=excluded.captured_at
  returning 1
 ) select count(*) into updated_count from inserted;
 return updated_count;
end $$;

alter table public.teams alter column main_rating drop not null;
alter table public.teams alter column main_rating drop default;
alter table public.teams drop constraint if exists teams_main_rating_range;
alter table public.teams add constraint teams_main_rating_range check(main_rating between 1 and 999);

-- Five hundred forty-nine points at most reflect the current best four
-- players; session performance can contribute 349.65. Achievement and
-- reputation each contribute up to 49.95. Streak awards retain their +5 cap.
create or replace function public.recalculate_organization_rating(p_team_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare players numeric:=0;performance numeric:=0;achievements numeric:=0;rep numeric:=50;
 rating numeric;wins_count integer;n integer;kills_count integer;
begin
 select coalesce(avg(value),0) into players from (
  select r.exact_rating value from public.team_members tm
  join public.competition_ratings r on r.target_type='player' and r.target_id=tm.user_id and r.mode='main'
  where tm.team_id=p_team_id order by r.exact_rating desc limit 4
 ) best;
 with standings as (
  select cp.session_id,s.start_time,e.id event_id,e.type event_type,
    (standing->>'teamId')::uuid team_id,
    coalesce(standing->>'groupId','ungrouped') group_key,
    (standing->>'place')::integer place,(standing->>'gamesPlayed')::integer games_played,
    coalesce(rs.hidden_coefficient,case when e.type='training' then .2 else 1 end)::numeric event_weight
  from public.competition_publications cp
  join public.event_sessions s on s.id=cp.session_id
  join public.events e on e.id=s.event_id
  left join public.rating_event_settings rs on rs.event_id=e.id
  cross join lateral jsonb_array_elements(coalesce(cp.published->'standings','[]'::jsonb)) standing
  where cp.first_published_at is not null and s.status<>'cancelled'
    and e.type in('training','tournament')
    and coalesce((e.competition_rules->>'ratingEnabled')::boolean,true)
    and standing->>'teamId' is not null and (standing->>'gamesPlayed')::integer>0
 ), fields as (
  select session_id,group_key,count(*)::integer field_size
  from standings group by session_id,group_key
 ), team_sessions as (
  select st.*,f.field_size,
    (f.field_size-st.place)::numeric/(f.field_size-1) actual_place,
    (select avg(coalesce(fc.expected_place,(f.field_size-st.place)::numeric/(f.field_size-1)))
      from public.competition_team_facts tf
      left join public.competition_game_forecasts fc on fc.game_id=tf.game_id and fc.team_id=tf.team_id
      where tf.session_id=st.session_id and tf.team_id=p_team_id and tf.played) forecast_place
  from standings st join fields f using(session_id,group_key)
  where st.team_id=p_team_id and st.session_id in (select session_id from public.competition_team_facts
    where team_id=p_team_id and played and mode in('training','tournament'))
    and f.field_size>=2
 ), scores as (
  select session_id,event_weight,actual_place*
    (1+greatest(-1,least(1,actual_place-coalesce(forecast_place,actual_place))))/2 session_score
  from team_sessions
 ) select coalesce(sum(event_weight*session_score)/nullif(sum(event_weight),0),0)
   into performance from scores;
 select coalesce(achievements_score,1),coalesce(reputation_score,50)
   into achievements,rep from public.teams where id=p_team_id;
 select count(distinct session_id) filter(where played and public.u2_session_winner(session_id,team_id,null)),
   count(*) filter(where played),coalesce(sum(kills),0) into wins_count,n,kills_count
 from public.competition_team_facts where team_id=p_team_id and mode in('tournament','training');
 if coalesce(n,0)=0 then
  delete from public.competition_ratings where target_type='team' and target_id=p_team_id and mode='main';
  update public.teams set main_rating=null where id=p_team_id;
  return null;
 end if;
 rating:=greatest(1,least(999,.55*players+.35*999*performance
   +.05*999*greatest(0,least(100,achievements))/100
   +.05*999*greatest(0,least(100,rep))/100
   +public.u3_award_bonus('team',p_team_id)));
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills)
 values('team',p_team_id,'main',rating,round(rating,2),wins_count,n,kills_count)
 on conflict(target_type,target_id,mode) do update set exact_rating=excluded.exact_rating,
  display_rating=excluded.display_rating,wins=excluded.wins,games=excluded.games,
  kills=excluded.kills,updated_at=now();
 update public.teams set main_rating=round(rating,2) where id=p_team_id;
 return rating;
end $$;

do $$ declare team_id_value uuid;begin
 for team_id_value in select id from public.teams loop
  perform public.recalculate_organization_rating(team_id_value);
 end loop;
end $$;

-- Both players and organizations enter the main table only after qualifying
-- activity. An absent rating must not sort ahead of earned numeric ratings.
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
   and (p_mode<>'main' or r.exact_rating is not null)
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

-- Keep the existing value formula, but normalize sporting ratings on their
-- new 0..999 scale so performance above 100 still affects value.
create or replace function public.u2_cost_for_target(p_target_type text,p_target_id uuid,p_mode text default 'main')
returns numeric language sql stable security definer set search_path=public as $$
with player_rows as (
 select f.user_id target_id,f.session_id::text session_key,f.session_id,f.mode,
   greatest(0,f.kills)::numeric kills,greatest(0,coalesce(f.deaths,0))::numeric deaths,
   f.deaths is not null has_deaths,f.place,f.field_size,
   least(2,greatest(.1,coalesce(rs.hidden_coefficient,case when e.type='training' then .20 when e.type='solo' then .70 else 1 end)))::numeric event_weight,
   public.u2_session_winner(f.session_id,f.team_id,f.user_id)::integer session_win
 from public.competition_player_facts f
 join public.event_sessions s on s.id=f.session_id
 join public.events e on e.id=s.event_id
 left join public.rating_event_settings rs on rs.event_id=e.id
 where p_mode='main' and p_target_type='player' and f.user_id=p_target_id and f.mode in('tournament','training')
 union all
 select h.target_id,coalesce(h.session_id::text,'legacy:'||h.id::text),h.session_id,h.mode,
   greatest(0,coalesce(h.kills,0))::numeric,greatest(0,coalesce(h.kills,0))::numeric,false,null::integer,8::integer,
   least(2,greatest(.1,coalesce(rs.hidden_coefficient,case when e.type='training' then .20 else 1 end)))::numeric,0
 from public.competition_public_history h
 left join public.events e on e.id=h.event_id
 left join public.rating_event_settings rs on rs.event_id=h.event_id
 where p_mode='main' and p_target_type='player' and h.target_id=p_target_id
   and h.target_type='player' and h.source like 'legacy%' and h.source<>'legacy_unassigned'
   and h.mode in('tournament','training')
), session_scores as (
 select target_id,session_key,max(event_weight) event_weight,
   sum(kills) kills,sum(deaths) deaths,bool_or(has_deaths) has_deaths,
   sum(case when has_deaths then 1 else 0 end)::numeric deaths_rows,
   count(*)::numeric games,
   avg(case when place between 1 and field_size and field_size>=2 then (field_size-place)::numeric/(field_size-1) else .5 end) place_score,
   max(session_win)::numeric win_score,
   avg(least(1,sqrt(greatest(2,field_size)::numeric/8))) field_score
 from player_rows group by target_id,session_key
), utility as (
 select target_id,
   sum(event_weight)::numeric weighted_sessions,
   sum(event_weight*(
     .40*(.65*least(1,(case when has_deaths then kills/greatest(1,deaths) else kills/greatest(1,games) end)/2)+.35*least(1,(kills/greatest(1,games))/8))
     +.25*place_score+.20*win_score+.15*field_score
   ))/greatest(.0001,sum(event_weight)) performance
 from session_scores group by target_id
), profile_values as (
 select coalesce(p.main_rating,1)::numeric rating,coalesce(p.reputation_score,50)::numeric reputation
 from public.profiles p where p.id=p_target_id
), player_cost as (
 select greatest(0,round(1000*(
   .70*u.performance+.20*greatest(0,least(999,rating))/999+.10*greatest(0,least(100,reputation))/100
 )*(1-exp(-u.weighted_sessions/3.5))*(1+.25*ln(1+u.weighted_sessions))/100,2))::numeric cost
 from utility u cross join profile_values
 where p_target_type='player' and u.target_id=p_target_id
), organization_cost as (
 select greatest(0,round(
   (coalesce(m.member_cost,0)*(1.75+.60*q.quality+.20*least(1,coalesce(m.member_count,0)/4))
   +1500*(.50+q.quality)*(.60+.40*q.confidence)*(1+.20*ln(1+q.weighted_sessions)))/100,2
 ))::numeric cost
 from (
   select t.id target_id,
     greatest(0,least(999,coalesce(t.main_rating,0)))::numeric rating,
     greatest(0,least(100,coalesce(t.results_score,1)))::numeric results,
     greatest(0,least(100,coalesce(t.achievements_score,1)))::numeric achievements,
     greatest(0,least(100,coalesce(t.reputation_score,50)))::numeric reputation
   from public.teams t where t.id=p_target_id
 ) o
 left join (
   select tm.team_id,count(*)::numeric member_count,
     coalesce(sum(public.u2_cost_for_target('player',tm.user_id,'main')),0)::numeric member_cost,
     coalesce(avg(greatest(0,least(999,coalesce(p.main_rating,0)))/999),0)::numeric member_rating,
     coalesce(avg(greatest(0,least(100,p.reputation_score))/100),0)::numeric member_reputation
   from public.team_members tm join public.profiles p on p.id=tm.user_id
   where tm.team_id=p_target_id group by tm.team_id
 ) m on true
 left join (
   select h.target_id,
     sum(h.event_weight)::numeric weighted_sessions,
     sum(h.event_weight*h.session_win)/greatest(.0001,sum(h.event_weight))::numeric session_win_rate
   from (
     select h.target_id,coalesce(h.session_id::text,'legacy:'||h.id::text) session_key,
       max(least(2,greatest(.1,coalesce(rs.hidden_coefficient,case when e.type='training' then .20 when e.type='solo' then .70 else 1 end))))::numeric event_weight,
       max(greatest(0,coalesce(h.wins,0)))::numeric session_win
     from public.competition_public_history h
     left join public.events e on e.id=h.event_id
     left join public.rating_event_settings rs on rs.event_id=h.event_id
     where h.target_type='team' and h.target_id=p_target_id and h.source<>'legacy_unassigned'
       and h.mode in('tournament','training')
     group by h.target_id,coalesce(h.session_id::text,'legacy:'||h.id::text)
   ) h group by h.target_id
 ) s on s.target_id=o.target_id
 cross join lateral (
   select greatest(0,least(1,
     .25*o.rating/999+.15*o.results/100+.15*o.achievements/100+.15*o.reputation/100
     +.15*coalesce(m.member_rating,0)+.10*coalesce(m.member_reputation,0)
     +.10*coalesce(s.session_win_rate,0)
   ))::numeric quality,
   (1-exp(-coalesce(s.weighted_sessions,0)/4.5))::numeric confidence,
   coalesce(s.weighted_sessions,0)::numeric weighted_sessions
 ) q
 where p_mode='main' and p_target_type='team' and coalesce(s.weighted_sessions,0)>0
)
select case when p_target_type='team' then coalesce((select cost from organization_cost),0)
 else coalesce((select cost from player_cost),0) end;
$$;

-- An event coefficient change must also recalculate teams recorded directly
-- in normalized game facts, even when no legacy organization row exists.
create or replace function public.u2_rating_settings(p_actor uuid,p_event uuid,p_category text,p_coefficient numeric default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare coefficient numeric;previous public.rating_event_settings%rowtype;player_id uuid;team_id_value uuid;player_count integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 if not public.is_full_admin(p_actor) then raise exception 'Требуются права администратора';end if;
 if not exists(select 1 from public.events where id=p_event and type in('tournament','training','solo')) then raise exception 'Мероприятие не найдено или использует отдельный рейтинг';end if;
 if p_category not in('training','amateur','regional','official','season_final') then raise exception 'Проверьте категорию';end if;
 if p_coefficient is not null and (not public.is_owner(p_actor) or p_coefficient not between .01 and 5) then raise exception 'Числовой коэффициент задаёт только владелец';end if;
 select * into previous from public.rating_event_settings where event_id=p_event for update;
 coefficient:=coalesce(p_coefficient,case when previous.category=p_category then previous.hidden_coefficient end,
 case p_category when 'training' then .2 when 'amateur' then .7 when 'regional' then .85 when 'season_final' then 1.2 else 1 end);
 insert into public.rating_event_settings(event_id,category,hidden_coefficient,changed_by,updated_at) values(p_event,p_category,coefficient,p_actor,now())
 on conflict(event_id) do update set category=excluded.category,hidden_coefficient=excluded.hidden_coefficient,changed_by=excluded.changed_by,updated_at=excluded.updated_at;
 for player_id in select distinct f.user_id from public.competition_player_facts f join public.event_sessions s on s.id=f.session_id where s.event_id=p_event
 union select distinct c.user_id from public.competition_solo_contributions c join public.event_sessions s on s.id=c.session_id where s.event_id=p_event
 union select distinct user_id from public.player_stats where event_id=p_event and status='approved' loop
 perform public.recalculate_player_rating(player_id);perform public.u2_recalculate_solo(player_id);player_count:=player_count+1;
 for team_id_value in select team_id from public.team_members where user_id=player_id loop perform public.recalculate_organization_rating(team_id_value);end loop;
 end loop;
 for team_id_value in select distinct organization_id from public.organization_participation_history where event_id=p_event loop perform public.recalculate_organization_results(team_id_value);end loop;
 for team_id_value in select distinct tf.team_id from public.competition_team_facts tf
  join public.event_sessions s on s.id=tf.session_id where s.event_id=p_event
  and tf.played and tf.mode in('training','tournament') loop
  perform public.recalculate_organization_rating(team_id_value);
 end loop;
 insert into public.competition_action_log(actor_id,scope_id,action,metadata) values(p_actor,p_event,'rating_category',jsonb_build_object('category',p_category,'players',player_count));
 return jsonb_build_object('success',true,'players',player_count);
end $$;

commit;
