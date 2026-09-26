begin;

-- Correct existing history rows so a winning team/player has one victory per single-group session.
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




do $$ declare player_id uuid;
begin
 for player_id in select id from public.profiles loop
  perform public.recalculate_player_rating(player_id);
 end loop;
end $$;

commit;
