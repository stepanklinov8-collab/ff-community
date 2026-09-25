begin;

-- Team and guild ratings use the full 1.00–100.00 range with hundredths precision.
alter table public.competition_ratings
  alter column display_rating type numeric(5,2)
  using round(display_rating,2);

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
 select count(*) filter(where place=1 and played),count(*) filter(where played),coalesce(sum(kills),0) into wins_count,n,kills_count
 from public.competition_team_facts where team_id=p_team_id and mode in('tournament','training');
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills)
 values('team',p_team_id,'main',rating,round(rating,2),wins_count,n,kills_count)
 on conflict(target_type,target_id,mode) do update set exact_rating=excluded.exact_rating,display_rating=excluded.display_rating,
 wins=excluded.wins,games=excluded.games,kills=excluded.kills,updated_at=now();
 update public.teams set main_rating=round(rating,2) where id=p_team_id;
 return rating;
end $$;

-- Keep the independent BO/KV organization ratings at the same precision.
create or replace function public.u2_rebuild_duel_ratings(p_mode text) returns void
language plpgsql security definer set search_path=public as $$
declare teams_state jsonb:='{}'; players_state jsonb:='{}'; pairs jsonb:='{}'; d record; p record; item record;
 a jsonb; b jsonb; v jsonb; pair_key text; repeats integer; ra numeric; rb numeric; expected numeric; factor numeric; delta numeric;
 a_won boolean; n integer; quality numeric; score numeric; confidence numeric; rating numeric;
begin
 if p_mode not in('kv','bo') then raise exception 'Неверный режим рейтинга';end if;
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 for d in select * from public.competition_duels where mode=p_mode and rating_enabled order by completed_at,id loop
 a:=coalesce(teams_state->d.team_a_id::text,'{"rating":50,"series":0,"wins":0,"games":0,"kills":0}');
 b:=coalesce(teams_state->d.team_b_id::text,'{"rating":50,"series":0,"wins":0,"games":0,"kills":0}');
 ra:=(a->>'rating')::numeric;rb:=(b->>'rating')::numeric;a_won:=d.data->>'winner'='a';
 pair_key:=least(d.team_a_id,d.team_b_id)::text||':'||greatest(d.team_a_id,d.team_b_id)::text;
 repeats:=coalesce((pairs->>pair_key)::integer,0);
 expected:=1/(1+power(10::numeric,(rb-ra)/20));
 factor:=case when (d.data->>'technical')::boolean and (d.data->>'playedGames')::integer=0 then 1 else
 least(1.5,1+0.15*abs((d.data->>'aWins')::numeric-(d.data->>'bWins')::numeric)+
 0.35*abs((d.data->>'aRounds')::numeric-(d.data->>'bRounds')::numeric)/greatest(7,(d.data->>'playedGames')::numeric*7)) end;
 delta:=case when (a->>'series')::integer<5 or (b->>'series')::integer<5 then 8 else 4 end * factor * greatest(0.4,1/(1+0.25*repeats)) * (a_won::integer-expected);
 update public.competition_duels set opponent_a_before=ra,opponent_b_before=rb where id=d.id;
 teams_state:=jsonb_set(teams_state,array[d.team_a_id::text],jsonb_build_object('rating',greatest(1,least(100,ra+delta)),
  'series',(a->>'series')::integer+1,'wins',(a->>'wins')::integer+a_won::integer,'games',(a->>'games')::integer+(d.data->>'playedGames')::integer,'kills',(a->>'kills')::integer+(d.data->>'aKills')::integer));
 teams_state:=jsonb_set(teams_state,array[d.team_b_id::text],jsonb_build_object('rating',greatest(1,least(100,rb-delta)),
  'series',(b->>'series')::integer+1,'wins',(b->>'wins')::integer+(not a_won)::integer,'games',(b->>'games')::integer+(d.data->>'playedGames')::integer,'kills',(b->>'kills')::integer+(d.data->>'bKills')::integer));
 pairs:=jsonb_set(pairs,array[pair_key],to_jsonb(repeats+1));
 for p in select * from jsonb_to_recordset(d.data->'players') as x("userId" uuid,"teamId" uuid,kills integer,deaths integer,assists integer,games integer) loop
 v:=coalesce(players_state->p."userId"::text,'{"series":0,"quality":0,"wins":0,"games":0,"kills":0,"deaths":0,"assists":0}');
 quality:=case when (p."teamId"=d.team_a_id)=a_won then case when p."teamId"=d.team_a_id then rb else ra end/100 else 0 end;
 players_state:=jsonb_set(players_state,array[p."userId"::text],jsonb_build_object('series',(v->>'series')::integer+1,
  'quality',(v->>'quality')::numeric+quality,'wins',(v->>'wins')::integer+((p."teamId"=d.team_a_id)=a_won)::integer,
  'games',(v->>'games')::integer+p.games,'kills',(v->>'kills')::integer+p.kills,'deaths',(v->>'deaths')::integer+p.deaths,'assists',(v->>'assists')::integer+p.assists));
 end loop;
 end loop;
 delete from public.competition_ratings where mode=p_mode;
 for item in select * from jsonb_each(teams_state) loop
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills,series)
 values('team',item.key::uuid,p_mode,(item.value->>'rating')::numeric,round((item.value->>'rating')::numeric,2),(item.value->>'wins')::integer,(item.value->>'games')::integer,(item.value->>'kills')::integer,(item.value->>'series')::integer);
 end loop;
 for item in select * from jsonb_each(players_state) loop
 v:=item.value;n:=(v->>'series')::integer;quality:=least(1,(v->>'quality')::numeric/n);
 score:=1+99*(0.45*quality+0.35*case when (v->>'kills')::numeric+(v->>'deaths')::numeric=0 then 0.5 else (v->>'kills')::numeric/((v->>'kills')::numeric+(v->>'deaths')::numeric) end+
 0.2*(v->>'assists')::numeric/((v->>'assists')::numeric+2*n));confidence:=least(1,n::numeric/5);rating:=greatest(1,least(100,50*(1-confidence)+score*confidence));
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills,deaths,assists,series)
 values('player',item.key::uuid,p_mode,rating,round(rating,1),(v->>'wins')::integer,(v->>'games')::integer,(v->>'kills')::integer,(v->>'deaths')::integer,(v->>'assists')::integer,n);
 end loop;
end $$;

do $$ declare team_id uuid;
begin
 for team_id in select id from public.teams loop
  perform public.recalculate_organization_rating(team_id);
 end loop;
end $$;

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
page as(select *,case when p_target_type='team' then round(exact_rating,2) else round(exact_rating,1) end rating from ranked where name ilike '%'||left(p_query,100)||'%' order by position,id limit greatest(1,least(100,p_limit))+1 offset greatest(0,p_offset)),
visible as(select * from page order by position,id limit greatest(1,least(100,p_limit)))
select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(v)-'exact_rating' order by position,id) from visible v),'[]'),'hasMore',(select count(*) from page)>greatest(1,least(100,p_limit)))
$$;
revoke all on function public.u2_leaderboard(text,text,text,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.u2_leaderboard(text,text,text,integer,integer,text,text) to service_role;

commit;
