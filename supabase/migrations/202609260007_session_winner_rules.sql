begin;

-- A session with several active groups is a qualification stage: it has no winner.
create or replace function public.u2_session_has_single_group(p_session uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select p_session is not null and (select count(*) from public.event_groups where session_id=p_session and is_active)=1
$$;
revoke all on function public.u2_session_has_single_group(uuid) from public,anon,authenticated;
grant execute on function public.u2_session_has_single_group(uuid) to service_role;

create or replace view public.competition_public_history as
select 'player'::text target_type,f.user_id target_id,f.game_id::text||':'||f.user_id::text id,f.mode,e.id event_id,s.id session_id,null::uuid clan_war_id,e.title,s.start_time occurred_at,
 f.nickname name_snapshot,f.kills,1::integer games,f.place,case when public.u2_session_has_single_group(f.session_id) and f.place=1 and f.win_order=1 then 1 else 0 end wins,f.deaths,f.assists,'current'::text source
from (select f.*,row_number() over(partition by f.user_id,f.session_id order by f.game_id) win_order from public.competition_player_facts f) f join public.event_sessions s on s.id=f.session_id join public.events e on e.id=s.event_id
union all
select 'player',p.user_id,p.id::text,coalesce(e.type,'tournament'),p.event_id,p.session_id,null::uuid,coalesce(p.event_title,e.title),coalesce(s.start_time,p.created_at),null::text,p.kills,p.matches_played,null::integer,null::integer,null::integer,null::integer,case when p.session_id is null and exists(select 1 from public.competition_publications cp join public.event_sessions cs on cs.id=cp.session_id where cp.first_published_at is not null and cs.event_id=p.event_id) then 'legacy_unassigned' else 'legacy' end
from public.player_stats p left join public.events e on e.id=p.event_id left join public.event_sessions s on s.id=p.session_id
where p.status='approved' and not exists(select 1 from public.competition_publications cp join public.event_sessions cs on cs.id=cp.session_id where cp.first_published_at is not null and cs.event_id=p.event_id and p.session_id=cs.id)
union all
select 'team',f.team_id,f.game_id::text||':'||f.team_id::text,f.mode,e.id,s.id,null::uuid,e.title,s.start_time,r.name_snapshot,f.kills,1,f.place,case when public.u2_session_has_single_group(f.session_id) and f.place=1 and f.win_order=1 then 1 else 0 end,null::integer,null::integer,'current'
from (select f.*,row_number() over(partition by f.team_id,f.session_id order by f.game_id) win_order from public.competition_team_facts f) f join public.event_sessions s on s.id=f.session_id join public.events e on e.id=s.event_id join public.event_registrations r on r.id=f.registration_id
where f.played and (f.mode not in('bo','kv') or exists(select 1 from jsonb_array_elements((select published from public.competition_publications where session_id=s.id)->'rows') row where (row->>'gameId')::uuid=f.game_id and (row->>'teamId')::uuid=f.team_id and row->>'rounds' is not null))
union all
select 'team',h.organization_id,h.id::text,h.mode,h.event_id,h.session_id,h.clan_war_id,h.event_title,h.occurred_at,h.organization_name,h.kills,null::integer,h.place,case when h.place is not null and public.u2_session_has_single_group(h.session_id) then (h.place=1)::integer else 0 end,null::integer,null::integer,'legacy'
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

create or replace function public.recalculate_player_rating(p_user_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare w numeric; k numeric; l numeric; v numeric; g numeric; r numeric; rep numeric; q numeric; n integer; wins_count integer; kills_count integer;
begin
 select coalesce(sum(x.weight),0),coalesce(sum(x.weight*x.kills),0),coalesce(sum(x.weight*(x.field_size-x.place)/(x.field_size-1)),0),
 coalesce(sum(x.weight*case when x.place=1 and public.u2_session_has_single_group(x.session_id) and x.win_order=1 then 1 else 0 end),0),count(*),count(distinct session_id) filter(where place=1 and public.u2_session_has_single_group(session_id)),coalesce(sum(kills),0)
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
 r:=greatest(1,least(100,g*(1+.03*q)));
 select count(*),count(*) filter(where place=1 and public.u2_session_has_single_group(session_id)),coalesce(sum(kills),0) into n,wins_count,kills_count from public.competition_player_facts where user_id=p_user_id and mode in('tournament','training');
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
 rating:=greatest(1,least(100,.98*(.60*players+.30*coalesce(results,1)+.10*coalesce(achievements,1))+.02*coalesce(rep,50)));
 select count(distinct session_id) filter(where place=1 and played and public.u2_session_has_single_group(session_id)),count(*) filter(where played),coalesce(sum(kills),0) into wins_count,n,kills_count
 from public.competition_team_facts where team_id=p_team_id and mode in('tournament','training');
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills)
 values('team',p_team_id,'main',rating,round(rating,2),wins_count,n,kills_count)
 on conflict(target_type,target_id,mode) do update set exact_rating=excluded.exact_rating,display_rating=excluded.display_rating,
 wins=excluded.wins,games=excluded.games,kills=excluded.kills,updated_at=now();
 update public.teams set main_rating=round(rating,2) where id=p_team_id;
 return rating;
end $$;

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


do $$ declare player_id uuid; team_id uuid;
begin
 for player_id in select id from public.profiles loop
  perform public.recalculate_player_rating(player_id);
 end loop;
 for team_id in select id from public.teams loop
  perform public.recalculate_organization_results(team_id);
 end loop;
end $$;

commit;
