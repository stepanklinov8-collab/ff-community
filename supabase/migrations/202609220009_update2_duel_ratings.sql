begin;
alter table public.competition_duels add column rating_enabled boolean not null default true;
alter table public.competition_ratings add column series integer not null default 0;
alter table public.competition_duels add column opponent_a_before numeric, add column opponent_b_before numeric;
create index competition_duels_replay_order on public.competition_duels(mode,completed_at,id);

-- A correction replays the complete independent mode in chronological order.
-- Numeric values remain unrounded until their public display projection.
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
 values('team',item.key::uuid,p_mode,(item.value->>'rating')::numeric,round((item.value->>'rating')::numeric,1),(item.value->>'wins')::integer,(item.value->>'games')::integer,(item.value->>'kills')::integer,(item.value->>'series')::integer);
 end loop;
 for item in select * from jsonb_each(players_state) loop
 v:=item.value;n:=(v->>'series')::integer;quality:=least(1,(v->>'quality')::numeric/n);
 score:=1+99*(0.45*quality+0.35*case when (v->>'kills')::numeric+(v->>'deaths')::numeric=0 then 0.5 else (v->>'kills')::numeric/((v->>'kills')::numeric+(v->>'deaths')::numeric) end+
 0.2*(v->>'assists')::numeric/((v->>'assists')::numeric+2*n));confidence:=least(1,n::numeric/5);rating:=greatest(1,least(100,50*(1-confidence)+score*confidence));
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills,deaths,assists,series)
 values('player',item.key::uuid,p_mode,rating,round(rating,1),(v->>'wins')::integer,(v->>'games')::integer,(v->>'kills')::integer,(v->>'deaths')::integer,(v->>'assists')::integer,n);
 end loop;
end $$;

-- Both standalone KV and round events use the same trusted publication shape.
create or replace function public.u2_sync_duels(p_published jsonb,p_completed timestamptz,p_event uuid default null,p_session uuid default null,p_war uuid default null)
returns void language plpgsql security definer set search_path=public as $$
declare group_key uuid; a_id uuid;b_id uuid; a_wins integer;b_wins integer;a_rounds integer;b_rounds integer;actual_games integer;
 a_kills integer;b_kills integer;technical boolean; winner text; players jsonb; data_value jsonb; mode_value text:=p_published->'rules'->>'mode';
begin
 if mode_value not in('kv','bo') then
 delete from public.competition_duels where session_id=p_session;
 perform public.u2_rebuild_duel_ratings('bo');perform public.u2_rebuild_duel_ratings('kv');return;end if;
 for group_key in select distinct (x->>'groupId')::uuid from jsonb_array_elements(p_published->'rows') x loop
 select min((x->>'teamId')::text)::uuid,max((x->>'teamId')::text)::uuid into a_id,b_id from jsonb_array_elements(p_published->'rows') x where (x->>'groupId')::uuid=group_key;
 if a_id is null or a_id=b_id then raise exception 'В серии нужны две команды';end if;
 select count(*) filter(where (x->>'teamId')::uuid=a_id and x->>'place'='1' and x->>'rounds' is not null),count(*) filter(where (x->>'teamId')::uuid=b_id and x->>'place'='1' and x->>'rounds' is not null),
 coalesce(sum((x->>'rounds')::integer) filter(where (x->>'teamId')::uuid=a_id),0),coalesce(sum((x->>'rounds')::integer) filter(where (x->>'teamId')::uuid=b_id),0),
 count(*) filter(where (x->>'teamId')::uuid=a_id and x->>'rounds' is not null),
 coalesce(sum((x->>'kills')::integer) filter(where (x->>'teamId')::uuid=a_id and x->>'rounds' is not null),0),coalesce(sum((x->>'kills')::integer) filter(where (x->>'teamId')::uuid=b_id and x->>'rounds' is not null),0),
 bool_or(x->>'played'='false' and x->>'reason'='no_show') into a_wins,b_wins,a_rounds,b_rounds,actual_games,a_kills,b_kills,technical
 from jsonb_array_elements(p_published->'rows') x where (x->>'groupId')::uuid=group_key;
 if technical then
 select case when (x->>'teamId')::uuid=a_id then 'b' else 'a' end into winner from jsonb_array_elements(p_published->'rows') x where (x->>'groupId')::uuid=group_key and x->>'played'='false' and x->>'reason'='no_show' limit 1;
 else winner:=case when a_wins>b_wins then 'a' else 'b' end;end if;
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') into players from(
 select (p->>'userId')::uuid "userId",(r->>'teamId')::uuid "teamId",sum((p->>'kills')::integer)::integer kills,sum((p->>'deaths')::integer)::integer deaths,sum((p->>'assists')::integer)::integer assists,count(*)::integer games
 from jsonb_array_elements(p_published->'rows') r cross join lateral jsonb_array_elements(r->'players') p
 where (r->>'groupId')::uuid=group_key and r->>'rounds' is not null and r->>'played'='true' and p->>'played'='true' and p->>'userId' is not null
 group by p->>'userId',r->>'teamId') q;
 data_value:=jsonb_build_object('aWins',a_wins,'bWins',b_wins,'aRounds',a_rounds,'bRounds',b_rounds,'playedGames',actual_games,'aKills',a_kills,'bKills',b_kills,'technical',technical,'winner',winner,'players',players);
 insert into public.competition_duels(id,mode,event_id,session_id,clan_war_id,completed_at,team_a_id,team_b_id,data,rating_enabled)
 values(group_key,mode_value,p_event,p_session,p_war,p_completed,a_id,b_id,data_value,coalesce((p_published->'rules'->>'ratingEnabled')::boolean,true))
 on conflict(id) do update set mode=excluded.mode,rating_enabled=excluded.rating_enabled,data=excluded.data,team_a_id=excluded.team_a_id,team_b_id=excluded.team_b_id;
 end loop;
 if p_session is not null then delete from public.competition_duels where session_id=p_session and id not in(select (x->>'groupId')::uuid from jsonb_array_elements(p_published->'rows') x);end if;
 perform public.u2_rebuild_duel_ratings('bo');perform public.u2_rebuild_duel_ratings('kv');
end $$;

create or replace function public.u2_publication_duels() returns trigger
language plpgsql security definer set search_path=public as $$
declare s public.event_sessions%rowtype;
begin
 if new.published is distinct from old.published and new.published is not null then
 select * into s from public.event_sessions where id=new.session_id;
 perform public.u2_sync_duels(new.published,coalesce(new.first_published_at,now()),s.event_id,s.id,null);
 end if;return new;
end $$;
create trigger u2_publication_duels after update on public.competition_publications for each row execute function public.u2_publication_duels();

revoke all on function public.u2_rebuild_duel_ratings(text),public.u2_sync_duels(jsonb,timestamptz,uuid,uuid,uuid),public.u2_publication_duels(),public.settle_betting_market(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.u2_rebuild_duel_ratings(text),public.u2_sync_duels(jsonb,timestamptz,uuid,uuid,uuid),public.settle_betting_market(uuid,text,uuid) to service_role;
commit;
