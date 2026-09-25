begin;
-- Historical aggregates remain aggregates: unknown individual games, places and KDA stay NULL.
create view public.competition_public_history as
select 'player'::text target_type,f.user_id target_id,f.game_id::text||':'||f.user_id::text id,f.mode,e.id event_id,s.id session_id,null::uuid clan_war_id,e.title,s.start_time occurred_at,
 f.nickname name_snapshot,f.kills,1::integer games,f.place,(f.place=1)::integer wins,f.deaths,f.assists,'current'::text source
from public.competition_player_facts f join public.event_sessions s on s.id=f.session_id join public.events e on e.id=s.event_id
union all
select 'player',p.user_id,p.id::text,coalesce(e.type,'tournament'),p.event_id,p.session_id,null::uuid,coalesce(p.event_title,e.title),coalesce(s.start_time,p.created_at),null::text,p.kills,p.matches_played,null::integer,null::integer,null::integer,null::integer,case when p.session_id is null and exists(select 1 from public.competition_publications cp join public.event_sessions cs on cs.id=cp.session_id where cp.first_published_at is not null and cs.event_id=p.event_id) then 'legacy_unassigned' else 'legacy' end
from public.player_stats p left join public.events e on e.id=p.event_id left join public.event_sessions s on s.id=p.session_id
where p.status='approved' and not exists(select 1 from public.competition_publications cp join public.event_sessions cs on cs.id=cp.session_id where cp.first_published_at is not null and cs.event_id=p.event_id and p.session_id=cs.id)
union all
select 'team',f.team_id,f.game_id::text||':'||f.team_id::text,f.mode,e.id,s.id,null::uuid,e.title,s.start_time,r.name_snapshot,f.kills,1,f.place,(f.place=1)::integer,null::integer,null::integer,'current'
from public.competition_team_facts f join public.event_sessions s on s.id=f.session_id join public.events e on e.id=s.event_id join public.event_registrations r on r.id=f.registration_id
where f.played and (f.mode not in('bo','kv') or exists(select 1 from jsonb_array_elements((select published from public.competition_publications where session_id=s.id)->'rows') row where (row->>'gameId')::uuid=f.game_id and (row->>'teamId')::uuid=f.team_id and row->>'rounds' is not null))
union all
select 'team',h.organization_id,h.id::text,h.mode,h.event_id,h.session_id,h.clan_war_id,h.event_title,h.occurred_at,h.organization_name,h.kills,null::integer,h.place,case when h.place is not null then (h.place=1)::integer end,null::integer,null::integer,'legacy'
from public.organization_participation_history h where h.result_status='completed'
and not exists(select 1 from public.competition_publications p where p.session_id=h.session_id and p.first_published_at is not null)
and not exists(select 1 from public.clan_wars w where w.id=h.clan_war_id and w.result_first_published_at is not null)
union all
select 'player',(p->>'userId')::uuid,d.id::text||':'||(p->>'userId'),d.mode,null::uuid,null::uuid,d.clan_war_id,w.title,d.completed_at,
 (select x->>'nickname' from jsonb_array_elements(w.result_published->'rows') r cross join lateral jsonb_array_elements(r->'players') x where x->>'userId'=p->>'userId' limit 1),
 (p->>'kills')::integer,(p->>'games')::integer,case when ((p->>'teamId')::uuid=d.team_a_id)=(d.data->>'winner'='a') then 1 else 2 end,
 (((p->>'teamId')::uuid=d.team_a_id)=(d.data->>'winner'='a'))::integer,(p->>'deaths')::integer,(p->>'assists')::integer,'current'
from public.competition_duels d join public.clan_wars w on w.id=d.clan_war_id cross join lateral jsonb_array_elements(d.data->'players') p
union all
select 'team',t.id,d.id::text||':'||t.id::text,d.mode,null::uuid,null::uuid,d.clan_war_id,w.title,d.completed_at,
 coalesce((select r->>'name' from jsonb_array_elements(w.result_published->'standings') r where (r->>'teamId')::uuid=t.id limit 1),t.name),
 case when t.id=d.team_a_id then (d.data->>'aKills')::integer else (d.data->>'bKills')::integer end,(d.data->>'playedGames')::integer,
 case when (t.id=d.team_a_id)=(d.data->>'winner'='a') then 1 else 2 end,((t.id=d.team_a_id)=(d.data->>'winner'='a'))::integer,null::integer,null::integer,'current'
from public.competition_duels d join public.clan_wars w on w.id=d.clan_war_id join public.teams t on t.id in(d.team_a_id,d.team_b_id);
revoke all on public.competition_public_history from public,anon,authenticated;
grant select on public.competition_public_history to service_role;

create view public.competition_duel_totals as
with entries as(
 select 'team'::text target_type,team_id target_id,d.mode,((team_id=d.team_a_id)=(d.data->>'winner'='a'))::integer won from public.competition_duels d cross join lateral unnest(array[d.team_a_id,d.team_b_id]) team_id
 union all
 select 'player',(p->>'userId')::uuid,d.mode,(((p->>'teamId')::uuid=d.team_a_id)=(d.data->>'winner'='a'))::integer from public.competition_duels d cross join lateral jsonb_array_elements(d.data->'players') p where (p->>'games')::integer>0
)
select target_type,target_id,mode,count(*)::integer series,coalesce(sum(won),0)::integer wins from entries group by target_type,target_id,mode;
revoke all on public.competition_duel_totals from public,anon,authenticated;
grant select on public.competition_duel_totals to service_role;

create or replace function public.u2_leaderboard(p_mode text,p_target_type text,p_query text default '',p_limit integer default 50,p_offset integer default 0,p_sort text default 'rating',p_kind text default null)
returns jsonb language sql stable security definer set search_path=public as $$
with totals as(select target_id,coalesce(sum(kills),0)::integer kills,coalesce(sum(games),0)::integer games,coalesce(sum(wins),0)::integer wins,coalesce(sum(deaths),0)::integer deaths,coalesce(sum(assists),0)::integer assists
 from public.competition_public_history where target_type=p_target_type and source<>'legacy_unassigned' and case when p_mode='main' then mode in('tournament','training') else mode=p_mode end group by target_id),
entities as(select p.id,p.nickname name,to_jsonb(p)->>'avatar_url' avatar_url,'player'::text kind,p.main_rating fallback_rating from public.profiles p where p_target_type='player'
 union all select t.id,t.name,to_jsonb(t)->>'avatar_url',t.type,t.main_rating from public.teams t where p_target_type='team' and to_jsonb(t)->>'dissolved_at' is null and coalesce((to_jsonb(t)->>'verified')::boolean,true) and (p_kind is null or t.type=p_kind)),
values_table as(select e.id,e.name,e.avatar_url,e.kind,coalesce(r.exact_rating,case when p_mode='main' then e.fallback_rating when p_mode in('bo','kv') then 50 else 1 end) exact_rating,
 case when p_mode in('bo','kv') then coalesce(d.wins,r.wins,0) else coalesce(t.wins,r.wins,0) end wins,coalesce(t.games,r.games,0) games,coalesce(t.kills,r.kills,0) kills,coalesce(d.series,r.series,0) series,
 coalesce(t.deaths,r.deaths,0) deaths,coalesce(t.assists,r.assists,0) assists
 from entities e left join public.competition_ratings r on r.target_id=e.id and r.target_type=p_target_type and r.mode=p_mode left join totals t on t.target_id=e.id left join public.competition_duel_totals d on d.target_type=p_target_type and d.target_id=e.id and d.mode=p_mode
 where p_mode in('main','solo') or coalesce(d.series,r.series,0)>0),
ranked as(select *,rank() over(order by case p_sort when 'kills' then kills when 'games' then games when 'ratio' then kills::numeric/greatest(1,games) else exact_rating end desc,
 case when p_sort='rating' then wins else 0 end desc,case when p_sort='rating' then games else 0 end desc) position from values_table),
page as(select *,round(exact_rating,1) rating from ranked where name ilike '%'||left(p_query,100)||'%' order by position,id limit greatest(1,least(100,p_limit))+1 offset greatest(0,p_offset)),
visible as(select * from page order by position,id limit greatest(1,least(100,p_limit)))
select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(v)-'exact_rating' order by position,id) from visible v),'[]'),'hasMore',(select count(*) from page)>greatest(1,least(100,p_limit)))
$$;
revoke all on function public.u2_leaderboard(text,text,text,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.u2_leaderboard(text,text,text,integer,integer,text,text) to service_role;
commit;
