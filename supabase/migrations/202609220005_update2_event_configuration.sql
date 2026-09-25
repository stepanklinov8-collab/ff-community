begin;
alter table public.event_sessions alter constraint event_sessions_source_session_id_fkey deferrable initially deferred;
alter table public.events add column if not exists configuration_revision integer not null default 0,add column if not exists rules_text text not null default '';
create or replace function public.u2_number_session() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.public_number is null then new.public_number:=public.next_competition_number('session:'||new.event_id);end if;
 return new;
end $$;
create trigger u2_number_session before insert on public.event_sessions for each row execute function public.u2_number_session();
create or replace function public.u2_registration_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare s public.event_sessions%rowtype;e public.events%rowtype;group_value uuid;user_id_value uuid;is_manager boolean;
 cleanup text:=current_setting('omcite.sanction_cleanup',true);cleanup_target text;
begin
 select * into s from public.event_sessions where id=coalesce(new.session_id,old.session_id) for update;
 if s.id is null then return case when tg_op='DELETE' then old else new end; end if;
 select * into e from public.events where id=s.event_id;
 -- A sanction may only remove its target from an unpublished future registration.
 -- This remains possible during the roster lock or while the event is frozen.
 if tg_op='UPDATE' and coalesce(cleanup,'')<>'' and s.start_time>now()
 and not exists(select 1 from public.competition_publications where session_id=s.id and first_published_at is not null)
 and row(new.event_id,new.session_id,new.team_id,new.participant_user_id,new.group_id) is not distinct from row(old.event_id,old.session_id,old.team_id,old.participant_user_id,old.group_id) then
 cleanup_target:=split_part(cleanup,':',2);
 if old.status in('confirmed','waiting') and (
 (new.status='cancelled' and new.roster_json is not distinct from old.roster_json and cleanup=case when old.team_id is null then 'player:'||old.participant_user_id else 'team:'||old.team_id end)
 or (split_part(cleanup,':',1)='player' and new.status=old.status and old.team_id is not null and old.roster_json ? cleanup_target and new.roster_json=old.roster_json-cleanup_target)) then
 if new.roster_json is distinct from old.roster_json then
 new.roster_snapshot:=(select coalesce(jsonb_agg(player),'[]') from jsonb_array_elements(coalesce(old.roster_snapshot,'[]')) player where player->>'id'<>cleanup_target);
 end if;
 update public.event_sessions set configuration_revision=configuration_revision+1 where id=s.id;
 return new;
 end if;end if;
 is_manager:=auth.uid() is null or coalesce(public.is_full_admin(auth.uid()) or e.organizer_user_id=auth.uid() or s.responsible_user_id=auth.uid(),false);
 if exists(select 1 from public.competition_publications where session_id=s.id and first_published_at is not null)
 and (tg_op in('INSERT','DELETE') or new.status is distinct from old.status or new.roster_json is distinct from old.roster_json or new.group_id is distinct from old.group_id or new.session_id is distinct from old.session_id or new.team_id is distinct from old.team_id or new.participant_user_id is distinct from old.participant_user_id)
 and current_setting('omcite.results_registration_session',true) is distinct from s.id::text then raise exception 'Изменение опубликованной заявки выполняется через исправление результатов'; end if;
 if not is_manager and now()>=s.start_time-interval '10 minutes' then raise exception 'Состав уже закрыт. Обратитесь к организатору';end if;
 if tg_op='UPDATE' and new.session_id is distinct from old.session_id then raise exception 'Нельзя переносить заявку в другую сессию; создайте отдельную заявку';end if;
 if tg_op<>'DELETE' and new.status in('confirmed','waiting') then
 if e.cancelled_at is not null or e.frozen_at is not null or e.moderation_status<>'approved' then raise exception 'Мероприятие недоступно для регистрации'; end if;
 if e.type='solo' and new.team_id is not null then raise exception 'В соло нужна личная заявка';end if;
 if new.event_id<>s.event_id then raise exception 'Сессия другого мероприятия'; end if;
 if (tg_op='INSERT' or old.status='cancelled') and now()>=coalesce(s.end_time,s.start_time) then raise exception 'Сессия находится в архиве'; end if;
 if not is_manager and now()>=s.start_time-interval '10 minutes' then raise exception 'Состав уже закрыт. Обратитесь к организатору'; end if;
 if new.participant_user_id is not null and not e.allow_individual_registration and e.type<>'solo' then raise exception 'Индивидуальная регистрация отключена'; end if;
 if public.u2_is_restricted(case when new.team_id is null then 'player' else 'team' end,coalesce(new.team_id,new.participant_user_id),'events',e.organizer_user_id,e.id) then raise exception 'Организатор ограничил ваше участие'; end if;
 for user_id_value in select value::uuid from jsonb_array_elements_text(coalesce(new.roster_json,'[]')) loop
 if public.u2_is_restricted('player',user_id_value,'events',e.organizer_user_id,e.id) then raise exception 'Игрок состава отстранён от мероприятия'; end if;end loop;
 if (select count(*) from public.event_registrations where session_id=s.id and status in('confirmed','waiting') and id<>new.id)>=least(1024,coalesce(s.max_teams,e.max_teams,1024)) then raise exception 'Достигнут лимит участников'; end if;
 if new.group_id is null and new.status='confirmed' then
 select g.id into group_value from public.event_groups g where g.session_id=s.id and g.is_active
 and (select count(*) from public.event_registrations r where r.group_id=g.id and r.status='confirmed' and r.id<>new.id)<g.capacity order by g.display_order limit 1;
 new.group_id:=group_value;
 if group_value is null then new.status:='waiting';end if;
 end if;
 if new.group_id is not null then
 if not exists(select 1 from public.event_groups g where g.id=new.group_id and g.session_id=s.id and g.is_active) then raise exception 'Группа другой сессии или закрыта';end if;
 if (tg_op='INSERT' or new.group_id is distinct from old.group_id or new.status is distinct from old.status) and new.status='confirmed' and current_setting('omcite.distribution_session',true) is distinct from s.id::text and
 (select count(*) from public.event_registrations r where r.group_id=new.group_id and r.status='confirmed' and r.id<>new.id)>=(select capacity from public.event_groups where id=new.group_id) then raise exception 'Группа заполнена'; end if;
 end if;
 if (tg_op='INSERT' or new.roster_json is distinct from old.roster_json) and current_setting('omcite.qualification_session',true) is distinct from s.id::text then
 new.roster_snapshot:=(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'gameId',p.game_id)),'[]') from public.profiles p where p.id=new.participant_user_id or new.roster_json @> jsonb_build_array(p.id::text));
 new.name_snapshot:=case when new.team_id is null then (select nickname from public.profiles where id=new.participant_user_id) else (select name from public.teams where id=new.team_id) end;
 end if;
 end if;
 update public.event_sessions set configuration_revision=configuration_revision+1 where id=s.id;
 return case when tg_op='DELETE' then old else new end;
end $$;
create trigger u2_registration_guard before insert or delete or update of session_id,status,roster_json,group_id,team_id,participant_user_id on public.event_registrations for each row execute function public.u2_registration_guard();

create or replace function public.u2_event_requires_review(p_actor uuid,p_event uuid,p_config jsonb) returns boolean
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype;significant boolean;
begin
 if public.is_full_admin(p_actor) or exists(select 1 from public.organizer_applications where user_id=p_actor and status='approved') then return false;end if;
 if p_event is null then return true;end if;
 select * into e from public.events where id=p_event;
 if e.organizer_user_id is distinct from p_actor then raise exception 'Недостаточно прав';end if;
 if e.moderation_status<>'approved' then return true;end if;
 significant:=e.type is distinct from p_config->>'type' or e.cost is distinct from (p_config->>'cost')::integer
 or e.min_players is distinct from (p_config->>'minPlayers')::integer or e.max_teams is distinct from (p_config->>'maxTeams')::integer
 or e.allow_individual_registration is distinct from (p_config->>'allowIndividualRegistration')::boolean
 or e.rules_text is distinct from p_config->>'rulesText' or e.competition_rules is distinct from p_config->'rules'
 or e.final_session_id is distinct from (p_config->>'finalSessionId')::uuid
 or (select count(*) from public.event_sessions where event_id=p_event and status<>'cancelled')<>jsonb_array_length(p_config->'sessions')
 or exists(select 1 from jsonb_array_elements(p_config->'sessions') s where not exists(select 1 from public.event_sessions old
 where old.id=(s->>'id')::uuid and old.event_id=p_event and old.status<>'cancelled' and old.start_time=(s->>'startTime')::timestamptz and old.end_time=(s->>'endTime')::timestamptz
 and old.registration_open_time is not distinct from (s->>'registrationOpenTime')::timestamptz and old.registration_close_time is not distinct from (s->>'registrationCloseTime')::timestamptz
 and old.max_teams=(s->>'maxTeams')::integer and old.stage=s->>'stage' and old.source_session_id is not distinct from (s->>'sourceSessionId')::uuid and old.qualification=s->'qualification'))
 or (select count(*) from public.event_groups g join public.event_sessions s on s.id=g.session_id where s.event_id=p_event and s.status<>'cancelled' and g.is_active)<>
 (select sum(jsonb_array_length(s->'groups')) from jsonb_array_elements(p_config->'sessions') s)
 or exists(select 1 from jsonb_array_elements(p_config->'sessions') s cross join lateral jsonb_array_elements(s->'groups') with ordinality groups(g,n)
 where not exists(select 1 from public.event_groups old where old.id=(g->>'id')::uuid and old.session_id=(s->>'id')::uuid and old.is_active and old.capacity=(g->>'capacity')::integer and old.display_order=n))
 or (select count(*) from public.event_games where event_id=p_event and status<>'cancelled')<>(select sum(jsonb_array_length(g->'games')) from jsonb_array_elements(p_config->'sessions') s cross join lateral jsonb_array_elements(s->'groups') g)
 or exists(select 1 from jsonb_array_elements(p_config->'sessions') s cross join lateral jsonb_array_elements(s->'groups') g cross join lateral jsonb_array_elements(g->'games') with ordinality games(game,n)
 where not exists(select 1 from public.event_games old where old.id=(game->>'id')::uuid and old.group_id=(g->>'id')::uuid and old.status<>'cancelled' and old.map_name=game->>'map' and old.game_number=n));
 return significant;
end $$;

create or replace function public.u2_event_configuration(p_actor uuid,p_event uuid,p_expected integer,p_config jsonb,p_approve boolean default false,p_recalculations jsonb default '[]')
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype;event_id_value uuid:=coalesce(p_event,gen_random_uuid()); is_admin boolean:=public.is_full_admin(p_actor);
 requires_review boolean;session jsonb;grp jsonb;game jsonb;session_id_value uuid;group_id_value uuid;game_id_value uuid;recipient record;
 session_ids uuid[]:='{}';group_ids uuid[]:='{}';game_ids uuid[]:='{}';group_order integer;game_order integer;new_number integer;pub record;recalc jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 if p_event is not null then
 select * into e from public.events where id=p_event for update;
 if e.id is null then raise exception 'Мероприятие не найдено';end if;
 if not is_admin and e.organizer_user_id<>p_actor then raise exception 'Недостаточно прав';end if;
 if e.organizer_user_id is distinct from (p_config->>'organizerUserId')::uuid then raise exception 'Передача мероприятия выполняется отдельным действием';end if;
 if e.configuration_revision<>p_expected then raise exception 'Конфликт версии мероприятия';end if;
 if e.frozen_at is not null and not is_admin then raise exception 'Мероприятие временно заблокировано';end if;
 else
 if public.u2_is_restricted('player',p_actor,'events') then raise exception 'Создание мероприятий временно ограничено';end if;
 end if;
 if p_approve and not is_admin then raise exception 'Требуются права администратора';end if;
 requires_review:=public.u2_event_requires_review(p_actor,p_event,p_config);
 if requires_review and p_event is not null then
 update public.events set pending_changes=p_config,configuration_revision=configuration_revision+1 where id=p_event;
 for recipient in select distinct user_id from public.user_roles where role in('admin','superadmin') loop
 perform public.u2_notify_target('player',recipient.user_id,'event-review:'||p_event||':'||(e.configuration_revision+1),'Мероприятие ожидает проверки',p_config->>'title','/tournaments/'||p_event||'/edit');end loop;
 return jsonb_build_object('success',true,'eventId',p_event,'pending',true,'revision',e.configuration_revision+1);end if;
 if p_event is not null and e.competition_rules is distinct from p_config->'rules' then
 for pub in select p.session_id from public.competition_publications p join public.event_sessions s on s.id=p.session_id
 where s.event_id=p_event and p.first_published_at is not null loop
 perform public.u2_editor_role(p_actor,pub.session_id);
 if not exists(select 1 from jsonb_array_elements(p_recalculations) x where (x->>'sessionId')::uuid=pub.session_id) then raise exception 'Изменение правил требует полного перерасчёта опубликованных сессий';end if;
 end loop;end if;
 insert into public.events(id,title,type,cost,organizer,organizer_user_id,description,rules_text,stream_url,payment_url,image_url,max_teams,min_players,roster_lock_minutes,publish_at,is_published,comments_enabled,allow_individual_registration,created_by,competition_rules,moderation_status,final_session_id,configuration_revision)
 values(event_id_value,p_config->>'title',p_config->>'type',(p_config->>'cost')::integer,p_config->>'organizer',coalesce((p_config->>'organizerUserId')::uuid,p_actor),
 p_config->>'description',p_config->>'rulesText',nullif(p_config->>'streamUrl',''),nullif(p_config->>'paymentUrl',''),nullif(p_config->>'imageUrl',''),(p_config->>'maxTeams')::integer,(p_config->>'minPlayers')::integer,10,
 (p_config->>'publishAt')::timestamptz,not requires_review and coalesce((p_config->>'publishAt')::timestamptz<=now(),true),(p_config->>'commentsEnabled')::boolean,(p_config->>'allowIndividualRegistration')::boolean,p_actor,
 p_config->'rules',case when requires_review then 'pending' else 'approved' end,(p_config->>'finalSessionId')::uuid,coalesce(e.configuration_revision,0)+1)
 on conflict(id) do update set title=excluded.title,type=excluded.type,cost=excluded.cost,organizer=excluded.organizer,organizer_user_id=excluded.organizer_user_id,
 description=excluded.description,rules_text=excluded.rules_text,stream_url=excluded.stream_url,payment_url=excluded.payment_url,image_url=excluded.image_url,max_teams=excluded.max_teams,
 min_players=excluded.min_players,roster_lock_minutes=10,publish_at=excluded.publish_at,is_published=excluded.is_published,comments_enabled=excluded.comments_enabled,
 allow_individual_registration=excluded.allow_individual_registration,competition_rules=excluded.competition_rules,moderation_status=excluded.moderation_status,pending_changes=null,
 final_session_id=excluded.final_session_id,configuration_revision=excluded.configuration_revision,updated_at=now();
 for session in select value from jsonb_array_elements(p_config->'sessions') loop
 session_id_value:=(session->>'id')::uuid;session_ids:=array_append(session_ids,session_id_value);
 if exists(select 1 from public.event_sessions where id=session_id_value and event_id<>event_id_value) then raise exception 'ID чужой сессии';end if;
 insert into public.event_sessions(id,event_id,start_time,end_time,registration_open_time,registration_close_time,max_teams,responsible_user_id,description,stage,source_session_id,qualification,reminder_minutes)
 values(session_id_value,event_id_value,(session->>'startTime')::timestamptz,(session->>'endTime')::timestamptz,(session->>'registrationOpenTime')::timestamptz,(session->>'registrationCloseTime')::timestamptz,
 (session->>'maxTeams')::integer,(session->>'responsibleUserId')::uuid,session->>'description',session->>'stage',(session->>'sourceSessionId')::uuid,session->'qualification',array(select jsonb_array_elements_text(session->'reminderMinutes')::integer))
 on conflict(id) do update set start_time=excluded.start_time,end_time=excluded.end_time,registration_open_time=excluded.registration_open_time,registration_close_time=excluded.registration_close_time,
 max_teams=excluded.max_teams,responsible_user_id=excluded.responsible_user_id,description=excluded.description,stage=excluded.stage,source_session_id=excluded.source_session_id,qualification=excluded.qualification,
 reminder_minutes=excluded.reminder_minutes,configuration_revision=event_sessions.configuration_revision+1,updated_at=now();
 group_order:=0;
 for grp in select value from jsonb_array_elements(session->'groups') loop
 group_order:=group_order+1;group_id_value:=(grp->>'id')::uuid;group_ids:=array_append(group_ids,group_id_value);
 if exists(select 1 from public.event_groups where id=group_id_value and session_id<>session_id_value) then raise exception 'ID чужой группы';end if;
 select public_number into new_number from public.event_groups where id=group_id_value;
 if new_number is null then new_number:=public.next_competition_number('group:'||session_id_value);end if;
 if (select count(*) from public.event_registrations where group_id=group_id_value and status='confirmed')>(grp->>'capacity')::integer then raise exception 'Вместимость меньше числа зарегистрированных участников';end if;
 insert into public.event_groups(id,session_id,public_number,display_order,name,capacity,room_id,room_password,room_note) values(group_id_value,session_id_value,new_number,group_order,grp->>'name',(grp->>'capacity')::integer,coalesce(grp->>'roomId',''),coalesce(grp->>'roomPassword',''),coalesce(grp->>'roomNote',''))
 on conflict(id) do update set display_order=excluded.display_order,name=excluded.name,capacity=excluded.capacity,room_id=excluded.room_id,room_password=excluded.room_password,room_note=excluded.room_note,is_active=true;
 -- Temporarily move positive display positions to avoid unique-index collisions on reorder.
 update public.event_games set game_number=game_number+10000000 where group_id=group_id_value;
 game_order:=0;
 for game in select value from jsonb_array_elements(grp->'games') loop
 game_order:=game_order+1;game_id_value:=(game->>'id')::uuid;game_ids:=array_append(game_ids,game_id_value);
 if exists(select 1 from public.event_games where id=game_id_value and group_id<>group_id_value) then raise exception 'ID чужой игры';end if;
 select public_number into new_number from public.event_games where id=game_id_value;
 if new_number is null then new_number:=public.next_competition_number('game:'||group_id_value);end if;
 insert into public.event_games(id,event_id,session_id,group_id,public_number,game_number,map_name)
 values(game_id_value,event_id_value,session_id_value,group_id_value,new_number,game_order,game->>'map')
 on conflict(id) do update set game_number=excluded.game_number,map_name=excluded.map_name;
 end loop;
 end loop;
 end loop;
 if exists(select 1 from public.event_registrations where event_id=event_id_value and status in('confirmed','waiting') and (not(session_id=any(session_ids)) or (group_id is not null and not(group_id=any(group_ids))))) then
 raise exception 'Сначала перенесите существующие заявки из удаляемой сессии или группы';end if;
 if exists(select 1 from public.event_games g join public.competition_publications p on p.session_id=g.session_id where g.event_id=event_id_value and not(g.id=any(game_ids)) and p.first_published_at is not null)
 and (not p_approve or not is_admin or jsonb_array_length(p_recalculations)=0) then raise exception 'Удаление сыгранной игры требует подтверждения администратора и перерасчёта';end if;
 update public.event_games set status='cancelled' where event_id=event_id_value and not(id=any(game_ids));
 update public.event_sessions set status='cancelled' where event_id=event_id_value and not(id=any(session_ids));
 update public.event_groups g set is_active=(g.id=any(group_ids)) where g.session_id in(select id from public.event_sessions where event_id=event_id_value);
 for recalc in select value from jsonb_array_elements(p_recalculations) loop
 select * into pub from public.competition_publications where session_id=(recalc->>'sessionId')::uuid;
 perform public.u2_save_results(p_actor,pub.session_id,pub.revision,(select configuration_revision from public.event_sessions where id=pub.session_id),
 gen_random_uuid(),'configuration:'||event_id_value||':'||(coalesce(e.configuration_revision,0)+1),coalesce(recalc->'draft',pub.draft),recalc->'published',p_approve,coalesce(recalc->'solo','[]'));
 end loop;
 if requires_review then
 for recipient in select distinct user_id from public.user_roles where role in('admin','superadmin') loop
 perform public.u2_notify_target('player',recipient.user_id,'event-review:'||event_id_value||':1','Новое мероприятие ожидает проверки',p_config->>'title','/tournaments/'||event_id_value||'/edit');end loop;
 elsif p_approve then
 perform public.u2_notify_target('player',coalesce((p_config->>'organizerUserId')::uuid,p_actor),'event-approved:'||event_id_value||':'||(coalesce(e.configuration_revision,0)+1),'Мероприятие одобрено',p_config->>'title','/tournaments/'||event_id_value);
 end if;
 insert into public.competition_action_log(actor_id,scope_id,action,revision) values(p_actor,event_id_value,'event_configuration',coalesce(e.configuration_revision,0)+1);
 return jsonb_build_object('success',true,'eventId',event_id_value,'pending',requires_review,'revision',coalesce(e.configuration_revision,0)+1);
end $$;

create or replace function public.u2_organizer_action(p_actor uuid,p_input jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 if p_input->>'action'='apply' then
 if exists(select 1 from public.organizer_applications where user_id=p_actor and status in('pending','approved')) then raise exception 'Заявка уже подана или одобрена';end if;
 insert into public.organizer_applications(user_id,message) values(p_actor,coalesce(p_input->>'message','')) on conflict(user_id) do update set status='pending',message=excluded.message,reviewed_by=null,reviewed_at=null;
 else
 if not public.is_full_admin(p_actor) then raise exception 'Требуются права администратора';end if;
 update public.organizer_applications set status=p_input->>'status',reviewed_by=p_actor,reviewed_at=now() where user_id=(p_input->>'userId')::uuid;
 end if;
end $$;
do $$ declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'u2\_%' escape '\' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);execute format('grant execute on function %s to service_role',f.signature);end loop;
end $$;
commit;
