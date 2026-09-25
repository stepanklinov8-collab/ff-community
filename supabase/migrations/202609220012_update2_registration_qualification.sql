begin;
create table public.competition_qualifications(
 session_id uuid primary key references public.event_sessions(id),source_revision integer not null,
 suggested jsonb not null default '[]',selected_ids uuid[] not null default '{}',confirmed_by uuid references auth.users(id),confirmed_at timestamptz,
 needs_review boolean not null default true,updated_at timestamptz not null default now());
alter table public.competition_qualifications enable row level security;
revoke all on public.competition_qualifications from public,anon,authenticated;
grant all on public.competition_qualifications to service_role;

create or replace function public.u2_refresh_qualifications(p_source uuid) returns void language plpgsql security definer set search_path=public as $$
declare pub public.competition_publications%rowtype;s public.event_sessions%rowtype;e public.events%rowtype;chosen jsonb;
begin
 select * into pub from public.competition_publications where session_id=p_source;
 if pub.published is null then return;end if;
 for s in select * from public.event_sessions where source_session_id=p_source and status<>'cancelled' loop
 select * into e from public.events where id=s.event_id;
 with ranked as(select x,ordinality,row_number() over(order by ordinality) overall_rank,row_number() over(partition by x->>'groupId' order by ordinality) group_rank
 from jsonb_array_elements(pub.published->'standings') with ordinality as items(x,ordinality) where (x->>'gamesPlayed')::integer>0 or pub.published->'rules'->>'mode' in('bo','kv') and x->>'place'='1')
 select coalesce(jsonb_agg(x order by ordinality),'[]') into chosen from ranked
 where case when s.qualification->>'mode'='group' then group_rank else overall_rank end<=coalesce((s.qualification->>'count')::integer,1);
 insert into public.competition_qualifications(session_id,source_revision,suggested) values(s.id,pub.revision,chosen)
 on conflict(session_id) do update set source_revision=excluded.source_revision,suggested=excluded.suggested,
 needs_review=competition_qualifications.needs_review or competition_qualifications.source_revision<>excluded.source_revision or competition_qualifications.suggested is distinct from excluded.suggested,updated_at=now();
 perform public.u2_notify_target('player',e.organizer_user_id,'qualification-review:'||s.id||':'||pub.revision,'Квалификация пересчитана',
 case when s.start_time<=now() then 'Следующий этап уже начался. Его состав и результаты сохранены; проверьте расхождения.' else 'Проверьте список прошедших и подтвердите перенос в следующий этап.' end,'/tournaments/'||e.id||'/participants?sessionId='||s.id);
 end loop;
end $$;
create or replace function public.u2_qualification_after_publication() returns trigger language plpgsql security definer set search_path=public as $$
begin if new.published is not null and new.published is distinct from old.published then perform public.u2_refresh_qualifications(new.session_id);end if;return new;end $$;
create trigger u2_qualification_after_publication after update on public.competition_publications for each row execute function public.u2_qualification_after_publication();

create or replace function public.u2_registration_action(p_actor uuid,p_session uuid,p_revision integer,p_input jsonb,p_request uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.event_sessions%rowtype;e public.events%rowtype;role_value text;action_value text:=p_input->>'action';r public.event_registrations%rowtype;
 op public.competition_operations%rowtype;request_hash text:=md5(p_input::text||':'||p_revision);response jsonb;target_id uuid;roster_value uuid[];player_id uuid;
 group_value uuid;entry record;group_count jsonb:='{}';group_strength jsonb:='{}';strength numeric;source public.competition_publications%rowtype;
 chosen_ids uuid[];standing jsonb;bonus numeric;existing uuid;source_registration public.event_registrations%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 select * into op from public.competition_operations where request_id=p_request;
 if op.request_id is not null then if op.actor_id<>p_actor or op.scope_id<>p_session or op.request_hash<>request_hash then raise exception 'Ключ запроса уже использован';end if;return op.response;end if;
 select * into s from public.event_sessions where id=p_session for update;select * into e from public.events where id=s.event_id;
 role_value:=public.u2_editor_role(p_actor,p_session,false);
 if s.configuration_revision<>p_revision then raise exception 'Конфликт версии: список участников изменился';end if;
 if exists(select 1 from public.competition_publications where session_id=p_session and first_published_at is not null) then raise exception 'Изменение опубликованной заявки выполняется через исправление результатов';end if;
 if s.start_time<=now() and not coalesce((p_input->>'confirmStarted')::boolean,false) then raise exception 'Подтвердите изменение состава начавшегося этапа';end if;
 if action_value='remove' then
 select * into r from public.event_registrations where id=(p_input->>'id')::uuid and session_id=p_session for update;
 if r.id is null then raise exception 'Заявка не найдена';end if;
 update public.event_registrations set status='cancelled',cancelled_at=now(),cancelled_by=p_actor,cancellation_reason=coalesce(nullif(p_input->>'reason',''),'Исключение из сессии') where id=r.id;
 elsif action_value in('add','edit') then
 if action_value='edit' then select * into r from public.event_registrations where id=(p_input->>'id')::uuid and session_id=p_session for update;
 if r.id is null then raise exception 'Заявка не найдена';end if;end if;
 target_id:=case when action_value='edit' then coalesce(r.team_id,r.participant_user_id) else (p_input->>'targetId')::uuid end;
 roster_value:=array(select jsonb_array_elements_text(coalesce(p_input->'roster','[]'))::uuid);
 if cardinality(roster_value)<>(select count(distinct x) from unnest(roster_value) x) then raise exception 'Повтор игрока состава';end if;
 if coalesce(r.team_id,(case when p_input->>'targetType'='team' then target_id end)) is not null then
 if cardinality(roster_value)<e.min_players then raise exception 'Недостаточно игроков в составе';end if;
 if exists(select 1 from unnest(roster_value) p(id) where not exists(select 1 from public.team_members tm where tm.team_id=target_id and tm.user_id=p.id)) then raise exception 'Игрок отсутствует в организации';end if;
 else roster_value:=array[target_id];end if;
 if action_value='add' then
 insert into public.event_registrations(event_id,session_id,team_id,participant_user_id,roster_json,group_id,status)
 values(e.id,p_session,case when p_input->>'targetType'='team' then target_id end,case when p_input->>'targetType'='player' then target_id end,to_jsonb(roster_value),(p_input->>'groupId')::uuid,coalesce(p_input->>'status','confirmed')) returning * into r;
 else update public.event_registrations set roster_json=to_jsonb(roster_value),group_id=(p_input->>'groupId')::uuid,status=coalesce(p_input->>'status',status),cancelled_at=null,cancelled_by=null,cancellation_reason=null where id=r.id returning * into r;end if;
 -- Snapshot the concrete application; later membership or nickname changes do not rewrite it.
 update public.event_registrations set roster_snapshot=(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nickname',p.nickname,'gameId',p.game_id)),'[]') from public.profiles p where p.id=any(roster_value)),
 name_snapshot=case when r.team_id is null then (select nickname from public.profiles where id=target_id) else (select name from public.teams where id=target_id) end where id=r.id;
 elsif action_value='distribute' then
 if role_value='responsible' then raise exception 'Распределение подтверждает организатор';end if;
 if p_input->>'mode' not in('random','balanced') then raise exception 'Выберите способ распределения';end if;
 if (select count(*) from public.event_registrations where session_id=p_session and status='confirmed')>(select sum(capacity) from public.event_groups where session_id=p_session and is_active) then raise exception 'Недостаточно мест в группах';end if;
 perform set_config('omcite.distribution_session',p_session::text,true);
 for entry in select reg.id,coalesce((select avg(p.main_rating) from public.profiles p where p.id=reg.participant_user_id or reg.roster_json @> jsonb_build_array(p.id::text)),1) strength
 from public.event_registrations reg where reg.session_id=p_session and reg.status='confirmed'
 order by case when p_input->>'mode'='random' then random() else 0 end,
 case when p_input->>'mode'='balanced' then coalesce((select avg(p.main_rating) from public.profiles p where p.id=reg.participant_user_id or reg.roster_json @> jsonb_build_array(p.id::text)),1) else 0 end desc,reg.id loop
 select g.id into group_value from public.event_groups g where g.session_id=p_session and g.is_active and coalesce((group_count->>g.id::text)::integer,0)<g.capacity
 order by coalesce((group_count->>g.id::text)::integer,0),coalesce((group_strength->>g.id::text)::numeric,0),g.display_order limit 1;
 if group_value is null then raise exception 'Недостаточно мест в группах';end if;
 update public.event_registrations set group_id=group_value where id=entry.id;
 group_count:=jsonb_set(group_count,array[group_value::text],to_jsonb(coalesce((group_count->>group_value::text)::integer,0)+1));
 group_strength:=jsonb_set(group_strength,array[group_value::text],to_jsonb(coalesce((group_strength->>group_value::text)::numeric,0)+entry.strength));
 end loop;perform set_config('omcite.distribution_session','',true);
 elsif action_value='qualify' then
 perform set_config('omcite.qualification_session',p_session::text,true);
 if role_value='responsible' then raise exception 'Прошедших подтверждает организатор';end if;
 if s.start_time<=now() then raise exception 'Следующий этап уже начался: автоматический перенос отключён. Используйте отдельные действия управления заявками';end if;
 select * into source from public.competition_publications where session_id=s.source_session_id;
 if source.published is null then raise exception 'Сначала опубликуйте результаты квалификации';end if;
 if source.revision<>(p_input->>'sourceRevision')::integer then raise exception 'Конфликт версии квалификации: обновите список';end if;
 chosen_ids:=array(select distinct jsonb_array_elements_text(p_input->'selectedIds')::uuid);
 if exists(select 1 from unnest(chosen_ids) chosen(id) where not exists(select 1 from jsonb_array_elements(source.published->'standings') x where (x->>'registrationId')::uuid=chosen.id)) then raise exception 'Проверьте список прошедших';end if;
 update public.event_registrations set status='cancelled',cancelled_at=now(),cancelled_by=p_actor,cancellation_reason='Пересмотр прошедших квалификацию' where session_id=p_session and qualification_source_id is not null and not(qualification_source_id=any(chosen_ids)) and status<>'cancelled';
 for target_id in select unnest(chosen_ids) loop
 select * into source_registration from public.event_registrations where id=target_id;
 select x into standing from jsonb_array_elements(source.published->'standings') x where (x->>'registrationId')::uuid=target_id;
 bonus:=case s.qualification->>'transfer' when 'all' then (standing->>'points')::numeric when 'percent' then round((standing->>'points')::numeric*coalesce((s.qualification->>'value')::numeric,0)/100) when 'bonus' then coalesce((s.qualification->>'value')::numeric,0) else 0 end;
 select id into existing from public.event_registrations where session_id=p_session and (team_id=source_registration.team_id or participant_user_id=source_registration.participant_user_id) limit 1;
 if existing is null then
 insert into public.event_registrations(event_id,session_id,team_id,participant_user_id,roster_json,roster_snapshot,name_snapshot,qualification_source_id,carried_points,status)
 values(e.id,p_session,source_registration.team_id,source_registration.participant_user_id,source_registration.roster_json,source_registration.roster_snapshot,source_registration.name_snapshot,target_id,bonus,'confirmed');
 else update public.event_registrations set status='confirmed',qualification_source_id=target_id,carried_points=bonus,cancelled_at=null,cancelled_by=null,cancellation_reason=null where id=existing;end if;
 end loop;
 perform set_config('omcite.qualification_session','',true);
 perform public.u2_refresh_qualifications(s.source_session_id);
 update public.competition_qualifications set selected_ids=chosen_ids,source_revision=source.revision,confirmed_by=p_actor,confirmed_at=now(),needs_review=false where session_id=p_session;
 else raise exception 'Неизвестное действие управления заявками';end if;
 insert into public.competition_action_log(actor_id,scope_id,action) values(p_actor,p_session,'registration_'||action_value);
 response:=jsonb_build_object('success',true,'revision',(select configuration_revision from public.event_sessions where id=p_session));
 insert into public.competition_operations(request_id,actor_id,scope_id,request_hash,response) values(p_request,p_actor,p_session,request_hash,response);
 return response;
end $$;
revoke all on function public.u2_registration_action(uuid,uuid,integer,jsonb,uuid),public.u2_refresh_qualifications(uuid),public.u2_qualification_after_publication() from public,anon,authenticated;
grant execute on function public.u2_registration_action(uuid,uuid,integer,jsonb,uuid),public.u2_refresh_qualifications(uuid) to service_role;
commit;
