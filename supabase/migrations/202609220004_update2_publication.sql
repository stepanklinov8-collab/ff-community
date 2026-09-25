begin;
create or replace function public.u2_save_results(
 p_actor uuid,p_session uuid,p_expected_revision integer,p_configuration_revision integer,
 p_request uuid,p_hash text,p_draft jsonb,p_published jsonb default null,p_approve_removal boolean default false,p_solo jsonb default '[]',p_removed uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.event_sessions%rowtype;e public.events%rowtype;pub public.competition_publications%rowtype;
 op public.competition_operations%rowtype; role text; new_revision integer; response jsonb; row jsonb; player jsonb; standing jsonb;
 r public.event_registrations%rowtype; warning jsonb; w record; target record; market record; outcome text; old_players uuid[]; old_teams uuid[]; v_target_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 select * into op from public.competition_operations where request_id=p_request;
 if op.request_id is not null then
 if op.actor_id<>p_actor or op.scope_id<>p_session or op.request_hash<>p_hash then raise exception 'Ключ запроса уже использован для других данных'; end if;
 return op.response; end if;
 select * into s from public.event_sessions where id=p_session for update;
 select * into e from public.events where id=s.event_id;
 role:=public.u2_editor_role(p_actor,p_session);
 p_draft:=public.u2_normalize_warning_ids(p_draft,p_session);
 if s.configuration_revision<>p_configuration_revision then raise exception 'Конфликт: состав или игры изменились, обновите страницу'; end if;
 insert into public.competition_publications(session_id) values(p_session) on conflict do nothing;
 select * into pub from public.competition_publications where session_id=p_session for update;
 if pub.revision<>p_expected_revision then raise exception 'Конфликт версии: другой редактор уже сохранил изменения'; end if;
 if pub.first_published_at is not null and p_published is null then raise exception 'Опубликованные результаты исправляются только целиком'; end if;
 if cardinality(p_removed)>0 then
 if role<>'admin' or not p_approve_removal or p_published is null then raise exception 'Удаление опубликованного участника требует подтверждения администратора';end if;
 if exists(select 1 from unnest(p_removed) removed(registration_id) where not exists(select 1 from public.event_registrations checked_registration where checked_registration.id=removed.registration_id and checked_registration.session_id=p_session and checked_registration.status='confirmed')) then raise exception 'Проверьте удаляемые заявки';end if;
 perform set_config('omcite.results_registration_session',p_session::text,true);
 update public.event_registrations set status='cancelled',cancelled_by=p_actor,cancelled_at=now(),cancellation_reason='Исправление результатов администратором' where id=any(p_removed);
 perform set_config('omcite.results_registration_session','',true);
 end if;
 if p_published is not null then
 if exists(select 1 from jsonb_array_elements(p_published->'rows') x where not exists(
 select 1 from public.event_registrations er join public.event_games g on g.id=(x->>'gameId')::uuid
 where er.id=(x->>'registrationId')::uuid and er.session_id=p_session and er.status='confirmed'
 and g.session_id=p_session and g.group_id=er.group_id and g.status<>'cancelled')) then raise exception 'Неверная регистрация или игра'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(pub.published->'standings','[]')) old
 where not exists(select 1 from jsonb_array_elements(p_published->'standings') new where new->>'registrationId'=old->>'registrationId'))
 and (role<>'admin' or not p_approve_removal) then raise exception 'Удаление опубликованного участника требует подтверждения администратора'; end if;
 if role='responsible' and (p_draft->'manualOrder') is distinct from (pub.draft->'manualOrder') and jsonb_array_length(coalesce(p_draft->'manualOrder','[]'))>0 then raise exception 'Порядок равных участников определяет организатор'; end if;
 end if;
 for row in select value from jsonb_array_elements(coalesce(p_draft->'snapshots','[]')) loop
 update public.event_registrations set roster_snapshot=row->'roster',name_snapshot=row->>'name'
 where id=(row->>'registrationId')::uuid and session_id=p_session and roster_snapshot is null;
 end loop;
 new_revision:=pub.revision+1;
 update public.competition_publications set draft=p_draft,published=coalesce(p_published,published),revision=new_revision,
 first_published_at=case when p_published is not null then coalesce(first_published_at,now()) else first_published_at end,
 corrected_at=case when p_published is not null and first_published_at is not null then now() else corrected_at end,
 updated_by=p_actor,updated_at=now() where session_id=p_session;
 if p_published is not null then
 select array_agg(distinct user_id) into old_players from public.competition_player_facts where session_id=p_session;
 select array_agg(distinct team_id) into old_teams from public.competition_team_facts where session_id=p_session;
 delete from public.competition_player_facts where session_id=p_session;
 delete from public.competition_team_facts where session_id=p_session;
 delete from public.competition_solo_contributions where session_id=p_session;
 for row in select value from jsonb_array_elements(p_published->'rows') loop
 if row->>'teamId' is not null then
 insert into public.competition_team_facts(session_id,game_id,registration_id,team_id,mode,played,place,kills,points)
 values(p_session,(row->>'gameId')::uuid,(row->>'registrationId')::uuid,(row->>'teamId')::uuid,p_published->'rules'->>'mode',
 (row->>'played')::boolean,(row->>'place')::integer,(row->>'kills')::integer,(row->>'points')::numeric);
 end if;
 for player in select value from jsonb_array_elements(row->'players') where (value->>'played')::boolean and value->>'userId' is not null loop
 insert into public.competition_player_facts(session_id,game_id,registration_id,user_id,team_id,mode,nickname,kills,deaths,assists,place,field_size)
 values(p_session,(row->>'gameId')::uuid,(row->>'registrationId')::uuid,(player->>'userId')::uuid,(row->>'teamId')::uuid,
 p_published->'rules'->>'mode',player->>'nickname',(player->>'kills')::integer,(player->>'deaths')::integer,(player->>'assists')::integer,(row->>'place')::integer,(row->>'fieldSize')::integer);
 end loop;
 end loop;
 for standing in select value from jsonb_array_elements(p_published->'standings') loop
 select * into r from public.event_registrations where id=(standing->>'registrationId')::uuid;
 if r.team_id is not null then
 insert into public.organization_participation_history(organization_id,organization_name,organization_type,mode,event_id,session_id,event_title,occurred_at,roster_snapshot,place,kills,points,result_status,recorded_by)
 select r.team_id,standing->>'name',t.type,p_published->'rules'->>'mode',e.id,s.id,e.title,s.start_time,coalesce(r.roster_snapshot,'[]'),
 case when (standing->>'gamesPlayed')::integer>0 then (standing->>'place')::integer else null end,
 (standing->>'kills')::integer,(standing->>'points')::numeric,case when (standing->>'gamesPlayed')::integer>0 then 'completed' else 'no_show' end,p_actor
 from public.teams t where t.id=r.team_id
 on conflict(organization_id,event_id,session_id) where event_id is not null and session_id is not null do update
 set organization_name=excluded.organization_name,mode=excluded.mode,roster_snapshot=excluded.roster_snapshot,place=excluded.place,kills=excluded.kills,
 points=excluded.points,result_status=excluded.result_status,updated_at=now(),recorded_by=p_actor;
 end if;
 end loop;
 update public.organization_participation_history h set result_status='cancelled',place=null,kills=0,points=0,updated_at=now()
 where h.session_id=p_session and not exists(select 1 from jsonb_array_elements(p_published->'standings') x where (x->>'teamId')::uuid=h.organization_id);
 insert into public.competition_solo_contributions(session_id,user_id,nomination,place,participants)
 select p_session,(x->>'userId')::uuid,x->>'nomination',(x->>'place')::integer,(x->>'participants')::integer from jsonb_array_elements(p_solo) x;
 -- A missing former warning is a cancellation, subject to exactly the same rights as an explicit action.
 for w in select * from public.warnings where update2 and session_id=p_session and cancelled_at is null loop
 if not exists(select 1 from jsonb_array_elements(p_draft->'warnings') x where (x->>'id')::uuid=w.id) then
 perform public.u2_cancel_warning(p_actor,w.id,'Исправление результатов'); end if;
 end loop;
 for warning in select value from jsonb_array_elements(p_draft->'warnings') loop
 perform public.u2_write_warning(p_actor,p_session,warning); end loop;
 for target in select distinct target_type,target_id from public.warnings where update2 and session_id=p_session loop
 perform public.u2_check_warning_thresholds(target.target_type,target.target_id,p_actor);
 perform public.u2_recalculate_reputation(target.target_type,target.target_id); end loop;
 for v_target_id in select user_id from public.competition_player_facts where session_id=p_session union select unnest(coalesce(old_players,'{}')) loop
 perform public.recalculate_player_rating(v_target_id); perform public.u2_recalculate_solo(v_target_id);
 for target in select team_id from public.team_members where user_id=v_target_id loop perform public.recalculate_organization_rating(target.team_id); end loop;
 end loop;
 for v_target_id in select team_id from public.competition_team_facts where session_id=p_session union select unnest(coalesce(old_teams,'{}')) loop
 perform public.recalculate_organization_results(v_target_id); end loop;
 update public.event_games set status='completed',updated_at=now() where session_id=p_session and status<>'cancelled'
 and id in(select (x->>'gameId')::uuid from jsonb_array_elements(p_published->'rows') x);
 -- Serialize settlement and keep every statement inside this transaction.
 for market in select m.* from public.betting_markets m join public.event_games g on g.id=m.game_id where g.session_id=p_session and m.status<>'draft' order by m.id loop
 select x into row from jsonb_array_elements(p_published->'rows') x where (x->>'gameId')::uuid=market.game_id
 and ((market.subject_team_id is not null and (x->>'teamId')::uuid=market.subject_team_id) or (market.subject_user_id is not null and (x->>'userId')::uuid=market.subject_user_id));
 outcome:=case when row is null or (not (row->>'played')::boolean and row->>'reason'='technical') then 'void'
 when market.market_type='exact_place' and p_published->'rules'->>'mode'='solo' and p_published->'rules'->>'criterion'='kills' then
 case when row->>'played'='true' and market.selection_value=(select (1+count(*))::text from jsonb_array_elements(p_published->'rows') other where other->>'gameId'=row->>'gameId' and other->>'played'='true' and (other->>'kills')::integer>(row->>'kills')::integer) then 'won' else 'lost' end
 when market.market_type='exact_place' and row->>'place'=market.selection_value then 'won'
 when market.market_type='kills_over' and (row->>'kills')::numeric>market.line then 'won'
 when market.market_type='kills_under' and (row->>'kills')::numeric<market.line then 'won'
 when market.market_type='win' and row->>'place'='1' then 'won'
 when market.market_type='loss' and (row->>'place'='2' or row->>'played'='false' and row->>'reason'='no_show') then 'won'
 when market.market_type='exact_score' and row->>'rounds' is null then 'void'
 when market.market_type='exact_score' and market.selection_value=(row->>'rounds')||':'||(select other->>'rounds' from jsonb_array_elements(p_published->'rows') other where other->>'gameId'=row->>'gameId' and other->>'registrationId'<>row->>'registrationId' limit 1) then 'won' else 'lost' end;
 perform public.settle_betting_market(market.id,outcome,p_actor);
 end loop;
 for r in select * from public.event_registrations where session_id=p_session and status='confirmed' loop
 perform public.u2_notify_target(case when r.team_id is null then 'player' else 'team' end,coalesce(r.team_id,r.participant_user_id),
 case when pub.first_published_at is null then 'published:'||p_session else 'corrected:'||p_session||':'||new_revision end,
 case when pub.first_published_at is null then 'Результаты опубликованы' else 'Результаты исправлены' end,e.title,'/tournaments/'||e.id||'/results');
 end loop;
 if exists(select 1 from public.event_sessions n where n.source_session_id=p_session and n.start_time<=now()) then
 perform public.u2_notify_target('player',e.organizer_user_id,'qualification-corrected:'||p_session||':'||new_revision,'Исправлена квалификация','Следующий этап уже начался. Его состав и результаты сохранены.','/tournaments/'||e.id); end if;
 end if;
 insert into public.competition_action_log(actor_id,scope_id,action,revision) values(p_actor,p_session,case when p_published is null then 'save_draft' when pub.first_published_at is null then 'publish' else 'correct' end,new_revision);
 response:=jsonb_build_object('success',true,'revision',new_revision,'published',p_published is not null,'configurationRevision',(select configuration_revision from public.event_sessions where id=p_session));
 insert into public.competition_operations(request_id,actor_id,scope_id,request_hash,response) values(p_request,p_actor,p_session,p_hash,response);
 return response;
end $$;
revoke all on function public.u2_save_results(uuid,uuid,integer,integer,uuid,text,jsonb,jsonb,boolean,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.u2_save_results(uuid,uuid,integer,integer,uuid,text,jsonb,jsonb,boolean,jsonb,uuid[]) to service_role;
commit;
