begin;

-- Add value sorting to the already deployed combined team/guild leaderboard.
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
), team_session_wins as (
 select target_id,count(distinct coalesce(session_id::text,id))::integer wins
 from history where p_target_type='team' and wins=1 group by target_id
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
 select pt.target_id,public.competition_cost(pt.kills,pt.deaths,pt.games,pt.wins,p.main_rating,p.reputation_score) cost
 from player_totals pt join public.profiles p on p.id=pt.target_id
), organization_costs as (
 select tm.team_id target_id,coalesce(sum(pv.cost),0)::integer cost
 from public.team_members tm left join player_values pv on pv.target_id=tm.user_id group by tm.team_id
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
     else case when p_mode='main' then public.competition_cost(coalesce(t.kills,r.kills,0),coalesce(t.deaths,r.deaths),coalesce(t.games,r.games,0),coalesce(t.wins,r.wins,0),e.fallback_rating,e.fallback_reputation) else 0 end end cost,
   case when p_mode in('bo','kv') then coalesce(d.wins,r.wins,0) else coalesce(t.wins,r.wins,0) end wins,
   coalesce(t.games,r.games,0) games,coalesce(t.kills,r.kills,0) kills,coalesce(d.series,r.series,0) series,
   coalesce(t.deaths,r.deaths) deaths,coalesce(t.assists,r.assists,0) assists
 from entities e left join public.competition_ratings r on r.target_id=e.id and r.target_type=p_target_type and r.mode=p_mode
 left join totals t on t.target_id=e.id left join organization_costs oc on oc.target_id=e.id
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
revoke all on function public.u2_leaderboard(text,text,text,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.u2_leaderboard(text,text,text,integer,integer,text,text) to service_role;

commit;
