begin;

-- Keep independent BO/KV organization ratings at hundredths precision after the
-- first precision migration has already been applied.
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
revoke all on function public.u2_rebuild_duel_ratings(text) from public,anon,authenticated;
grant execute on function public.u2_rebuild_duel_ratings(text) to service_role;

commit;
