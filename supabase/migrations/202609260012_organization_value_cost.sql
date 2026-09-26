begin;

-- Player price has no artificial ceiling. Games and kills affect useful rates
-- inside a session, while history is added through a logarithmic premium.
create or replace function public.u2_cost_for_target(p_target_type text,p_target_id uuid,p_mode text default 'main')
returns integer language sql stable security definer set search_path=public as $$
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
   .70*u.performance+.20*greatest(0,least(100,rating))/100+.10*greatest(0,least(100,reputation))/100
 )*(1-exp(-u.weighted_sessions/3.5))*(1+.25*ln(1+u.weighted_sessions))))::integer cost
 from utility u cross join profile_values
 where p_target_type='player' and u.target_id=p_target_id
), organization_cost as (
 select greatest(0,round(
   coalesce(m.member_cost,0)*(1.75+.60*q.quality+.20*least(1,coalesce(m.member_count,0)/4))
   +1500*(.50+q.quality)*(.60+.40*q.confidence)*(1+.20*ln(1+q.weighted_sessions))
 ))::integer cost
 from (
   select t.id target_id,
     greatest(0,least(100,coalesce(t.main_rating,1)))::numeric rating,
     greatest(0,least(100,coalesce(t.results_score,1)))::numeric results,
     greatest(0,least(100,coalesce(t.achievements_score,1)))::numeric achievements,
     greatest(0,least(100,coalesce(t.reputation_score,50)))::numeric reputation
   from public.teams t where t.id=p_target_id
 ) o
 left join (
   select tm.team_id,count(*)::numeric member_count,
     coalesce(sum(public.u2_cost_for_target('player',tm.user_id,'main')),0)::numeric member_cost,
     coalesce(avg(greatest(0,least(100,p.main_rating))/100),0)::numeric member_rating,
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
     .25*o.rating/100+.15*o.results/100+.15*o.achievements/100+.15*o.reputation/100
     +.15*coalesce(m.member_rating,0)+.10*coalesce(m.member_reputation,0)
     +.10*coalesce(s.session_win_rate,0)
   ))::numeric quality,
   (1-exp(-coalesce(s.weighted_sessions,0)/4.5))::numeric confidence,
   coalesce(s.weighted_sessions,0)::numeric weighted_sessions
 ) q
 where p_mode='main' and p_target_type='team'
)
select case when p_target_type='team' then coalesce((select cost from organization_cost),0)
 else coalesce((select cost from player_cost),0) end;
$$;
revoke all on function public.u2_cost_for_target(text,uuid,text) from public,anon,authenticated;
grant execute on function public.u2_cost_for_target(text,uuid,text) to service_role;

create or replace function public.u2_leaderboard(p_mode text,p_target_type text,p_query text default '',p_limit integer default 50,p_offset integer default 0,p_sort text default 'rating',p_kind text default null)
returns jsonb language sql stable security definer set search_path=public as $$
with history as (
 select * from public.competition_public_history
 where target_type=p_target_type and source<>'legacy_unassigned'
   and case when p_mode='main' then mode in('tournament','training') else mode=p_mode end
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
 select r.target_id,r.kills,r.games,
   case when p_target_type='team' then coalesce(sw.wins,0) else r.wins end wins,
   r.deaths,r.assists
 from raw_totals r left join team_session_wins sw on sw.target_id=r.target_id
), player_totals as (
 select target_id,coalesce(sum(kills),0)::integer kills,coalesce(sum(games),0)::integer games,
   coalesce(sum(wins),0)::integer wins,sum(deaths) deaths
 from public.competition_public_history
 where target_type='player' and source<>'legacy_unassigned'
   and case when p_mode='main' then mode in('tournament','training') else mode=p_mode end
 group by target_id
), player_values as (
 select p.id target_id,public.u2_cost_for_target('player',p.id,'main') cost
 from public.profiles p where p_target_type='player'
), organization_costs as (
 select t.id target_id,public.u2_cost_for_target('team',t.id,'main') cost
 from public.teams t where p_target_type='team'
), entities as (
 select p.id,p.nickname name,to_jsonb(p)->>'avatar_url' avatar_url,'player'::text kind,p.main_rating fallback_rating,p.reputation_score fallback_reputation
 from public.profiles p where p_target_type='player'
 union all
 select t.id,t.name,to_jsonb(t)->>'avatar_url',t.type,t.main_rating,t.reputation_score
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
 where p_mode in('main','solo') or coalesce(d.series,r.series,0)>0
), ranked as (
 select *,rank() over(order by case p_sort when 'cost' then cost when 'kills' then kills when 'games' then games when 'ratio' then kills::numeric/greatest(1,games) else exact_rating end desc,
   case when p_sort='rating' then wins else 0 end desc,case when p_sort='rating' then games else 0 end desc) position
 from values_table
), page as (
 select *,case when p_target_type='team' then round(exact_rating,2) else round(exact_rating,1) end rating
 from ranked where name ilike '%'||left(p_query,100)||'%' order by position,id
 limit greatest(1,least(100,p_limit))+1 offset greatest(0,p_offset)
), visible as (select * from page order by position,id limit greatest(1,least(100,p_limit)))
select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(v)-'exact_rating' order by position,id) from visible v),'[]'),'hasMore',(select count(*) from page)>greatest(1,least(100,p_limit)))
$$;

commit;
