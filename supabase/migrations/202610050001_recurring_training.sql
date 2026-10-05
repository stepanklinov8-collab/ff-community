begin;
alter table public.events
 add column if not exists training_schedule jsonb,
 add column if not exists training_generated_through date;
alter table public.event_sessions add column if not exists training_rotation_position integer
 check (training_rotation_position>=0 and training_rotation_position<=1000000);
create unique index event_sessions_training_rotation on public.event_sessions(event_id,training_rotation_position)
 where training_rotation_position is not null;
alter table public.events add constraint events_training_schedule_valid check (
 training_schedule is null or coalesce((jsonb_typeof(training_schedule)='object'
 and training_schedule->>'enabled'='true' and training_schedule->>'startsOn' ~ '^\d{4}-\d{2}-\d{2}$'
 and (training_schedule->>'startsOn')::date is not null),false)
);

-- Keep schedule changes in the same revision, permission checks and moderation
-- transaction as the existing editor. Sporting rules/results are unchanged.
do $$
declare definition text; marker text;
begin
 definition:=pg_get_functiondef('public.u2_event_requires_review(uuid,uuid,jsonb)'::regprocedure);
 marker:='significant:=e.type is distinct from p_config->>''type''';
 if position(marker in definition)=0 then raise exception 'Unsupported event review definition';end if;
 definition:=replace(definition,marker,'significant:=e.training_schedule is distinct from nullif(p_config->''trainingSchedule'',''null''::jsonb) or e.type is distinct from p_config->>''type''');
 execute definition;
 definition:=pg_get_functiondef('public.u2_event_configuration(uuid,uuid,integer,jsonb,boolean,jsonb)'::regprocedure);
 marker:='requires_review:=public.u2_event_requires_review(p_actor,p_event,p_config);';
 if position(marker in definition)=0 then raise exception 'Unsupported event configuration validation';end if;
 definition:=replace(definition,marker,$patch$
 if nullif(p_config->'trainingSchedule','null'::jsonb) is not null then
   if p_config->>'type'<>'training' or p_config->'trainingSchedule'->>'enabled' is distinct from 'true'
   or p_config->'trainingSchedule'->>'startsOn' is null then raise exception 'Неверный шаблон тренировок';end if;
   perform (p_config->'trainingSchedule'->>'startsOn')::date;
   if not exists(select 1 from jsonb_array_elements(p_config->'sessions') s where s->>'stage'='ordinary') then
     raise exception 'Для шаблона нужна обычная сессия';end if;
 end if;
 requires_review:=public.u2_event_requires_review(p_actor,p_event,p_config);
 $patch$);
 marker:='for session in select value from jsonb_array_elements(p_config->''sessions'') loop';
 if position(marker in definition)=0 then raise exception 'Unsupported event configuration sessions';end if;
 definition:=replace(definition,marker,$patch$
 update public.events set
 training_generated_through=case when training_schedule is distinct from nullif(p_config->'trainingSchedule','null'::jsonb) then null else training_generated_through end,
 training_schedule=nullif(p_config->'trainingSchedule','null'::jsonb)
 where id=event_id_value;
 for session in select value from jsonb_array_elements(p_config->'sessions') loop
 $patch$);
 marker:='group_order:=0;';
 if position(marker in definition)=0 then raise exception 'Unsupported rotation persistence definition';end if;
 definition:=replace(definition,marker,$patch$
 if session->>'trainingRotationPosition' is not null then
   if exists(select 1 from public.event_sessions where id=session_id_value and training_rotation_position is not null
     and training_rotation_position<>(session->>'trainingRotationPosition')::integer) then raise exception 'Нельзя менять позицию сессии в цикле карт';end if;
   update public.event_sessions set training_rotation_position=(session->>'trainingRotationPosition')::integer where id=session_id_value;
 end if;
 group_order:=0;
 $patch$);
 execute definition;
 -- Initial sign-up observes registration_close_time; the ten-minute lock still
 -- protects changes/cancellations of existing rosters.
 definition:=pg_get_functiondef('public.u2_registration_guard()'::regprocedure);
 marker:='if not is_manager and now()>=s.start_time-interval ''10 minutes'' then';
 if position(marker in definition)=0 then raise exception 'Unsupported roster lock definition';end if;
 definition:=replace(definition,marker,'if not is_manager and tg_op<>''INSERT'' and not(tg_op=''UPDATE'' and old.status=''cancelled'' and new.status in(''confirmed'',''waiting'')) and now()>=s.start_time-interval ''10 minutes'' then');
 marker:='if new.event_id<>s.event_id then';
 if position(marker in definition)=0 then raise exception 'Unsupported registration window definition';end if;
 definition:=replace(definition,marker,$patch$
 if not is_manager and (tg_op='INSERT' or old.status='cancelled') then
   if now()<s.registration_open_time then raise exception 'Регистрация ещё не открыта';end if;
   if now()>=coalesce(s.registration_close_time,s.start_time) then raise exception 'Регистрация закрыта';end if;
 end if;
 if new.event_id<>s.event_id then
 $patch$);
 execute definition;
end $$;

create index events_training_schedule_due on public.events(training_generated_through)
 where training_schedule is not null;

create or replace function public.u3_extend_training_schedules(p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype; template public.event_sessions%rowtype; grp public.event_groups%rowtype;
 local_today date:=(p_now at time zone 'Europe/Moscow')::date;
 through_day date:=date_trunc('week',p_now at time zone 'Europe/Moscow')::date+13;
 next_day date; session_start timestamptz; new_session uuid; new_group uuid;
 added integer:=0; event_added integer; processed integer:=0;
 rotation_position integer; map_cycle text[]:=array['bermuda','nexterra','solara','purgatory','kalahari'];
begin
 -- Same lock/order as editor transactions. Concurrent retries cannot duplicate sessions.
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 for e in select * from public.events
 where type='training' and training_schedule->>'enabled'='true'
 and moderation_status='approved' and is_published and cancelled_at is null and frozen_at is null and pending_changes is null
 and (training_schedule->>'startsOn')::date<=through_day
 and (training_generated_through is null or training_generated_through<through_day)
 order by id limit 50 for update skip locked loop
   select * into template from public.event_sessions s where s.event_id=e.id and s.status<>'cancelled' and s.stage='ordinary'
   and exists(select 1 from public.event_groups g where g.session_id=s.id and g.is_active
     and exists(select 1 from public.event_games game where game.group_id=g.id and game.status<>'cancelled'))
   order by s.start_time desc,s.id limit 1;
   if template.id is null then continue;end if;
   event_added:=0;
   select coalesce(max(training_rotation_position)+1,0) into rotation_position from public.event_sessions where event_id=e.id;
   for next_day in select generate_series(greatest(local_today,(e.training_schedule->>'startsOn')::date)::timestamp,through_day::timestamp,interval '1 day')::date loop
     if extract(isodow from next_day) not in(1,2,4,7) then continue;end if;
     session_start:=(next_day+time '19:00') at time zone 'Europe/Moscow';
     if session_start<=p_now then continue;end if;
     -- Edited times and deliberately cancelled sessions still reserve their date.
     if exists(select 1 from public.event_sessions s where s.event_id=e.id
       and s.start_time >= (next_day::timestamp at time zone 'Europe/Moscow')
       and s.start_time < ((next_day+1)::timestamp at time zone 'Europe/Moscow')) then continue;end if;
     new_session:=gen_random_uuid();
     insert into public.event_sessions(id,event_id,start_time,end_time,registration_open_time,registration_close_time,max_teams,responsible_user_id,description,stage,qualification,reminder_minutes,training_rotation_position)
     values(new_session,e.id,session_start,(next_day+time '20:00') at time zone 'Europe/Moscow',
       (next_day+time '10:00') at time zone 'Europe/Moscow',(next_day+time '18:59') at time zone 'Europe/Moscow',
       template.max_teams,template.responsible_user_id,template.description,'ordinary',
       '{"mode":"general","count":1,"transfer":"none","value":0}'::jsonb,template.reminder_minutes,rotation_position);
     for grp in select * from public.event_groups where session_id=template.id and is_active order by display_order loop
       new_group:=gen_random_uuid();
       insert into public.event_groups(id,session_id,public_number,display_order,name,capacity,room_id,room_password,room_note)
       values(new_group,new_session,public.next_competition_number('group:'||new_session),grp.display_order,grp.name,grp.capacity,'','','');
       insert into public.event_games(id,event_id,session_id,group_id,public_number,game_number,map_name)
       select gen_random_uuid(),e.id,new_session,new_group,public.next_competition_number('game:'||new_group),n+1,map_cycle[(rotation_position%5*3+n)%5+1]
       from generate_series(0,2) n;
     end loop;
     event_added:=event_added+1;
     rotation_position:=rotation_position+1;
   end loop;
   update public.events set training_generated_through=through_day,
     configuration_revision=configuration_revision+case when event_added>0 then 1 else 0 end where id=e.id;
   if event_added>0 then
     insert into public.competition_action_log(actor_id,scope_id,action,revision,metadata)
     values(null,e.id,'training_schedule_extend',e.configuration_revision+1,jsonb_build_object('sessions',event_added,'through',through_day));
   end if;
   added:=added+event_added;processed:=processed+1;
 end loop;
 return jsonb_build_object('success',true,'events',processed,'sessions',added,'through',through_day);
end $$;
revoke all on function public.u3_extend_training_schedules(timestamptz) from public,anon,authenticated;
grant execute on function public.u3_extend_training_schedules(timestamptz) to service_role;
commit;
