begin;
create or replace function public.u5_reserve_eligible(p_registration uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from event_registrations r join event_sessions s on s.id=r.session_id
 join events e on e.id=s.event_id where r.id=p_registration
 and not public.u2_is_restricted(case when r.team_id is null then 'player' else 'team' end,coalesce(r.team_id,r.participant_user_id),'events',e.organizer_user_id,e.id)
 and not exists(select 1 from jsonb_array_elements_text(coalesce(r.roster_json,'[]')) player where public.u2_is_restricted('player',player::uuid,'events',e.organizer_user_id,e.id))
 and (r.team_id is null or (exists(select 1 from teams t where t.id=r.team_id and t.verified and t.dissolved_at is null)
   and jsonb_array_length(r.roster_json)>=coalesce(e.min_players,4)
   and not exists(select 1 from jsonb_array_elements_text(r.roster_json) player where not exists(select 1 from team_members tm where tm.team_id=r.team_id and tm.user_id=player::uuid))))
 and not exists(select 1 from bans ban where ban.is_active and ((ban.target_type='team' and ban.target_id=r.team_id)
   or (ban.target_type='player' and (ban.target_id=r.participant_user_id or r.roster_json ? ban.target_id::text)))))
$$;
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
 if tg_op='UPDATE' and old.status='waiting' and new.status='confirmed' and new.roster_json is not distinct from old.roster_json and current_setting('omcite.waitlist_promoting',true)=s.id::text then is_manager:=true;end if;
 if exists(select 1 from public.competition_publications where session_id=s.id and first_published_at is not null)
 and (tg_op in('INSERT','DELETE') or new.status is distinct from old.status or new.roster_json is distinct from old.roster_json or new.group_id is distinct from old.group_id or new.session_id is distinct from old.session_id or new.team_id is distinct from old.team_id or new.participant_user_id is distinct from old.participant_user_id)
 and current_setting('omcite.results_registration_session',true) is distinct from s.id::text then raise exception 'Изменение опубликованной заявки выполняется через исправление результатов'; end if;
 if not is_manager and tg_op<>'INSERT' and not(tg_op='UPDATE' and old.status='cancelled' and new.status in('confirmed','waiting')) and now()>=s.start_time-interval '10 minutes' then raise exception 'Состав уже закрыт. Обратитесь к организатору';end if;
 if tg_op='UPDATE' and new.session_id is distinct from old.session_id then raise exception 'Нельзя переносить заявку в другую сессию; создайте отдельную заявку';end if;
 if tg_op<>'DELETE' and new.status in('confirmed','waiting') then
 if e.cancelled_at is not null or e.frozen_at is not null or e.moderation_status<>'approved' then raise exception 'Мероприятие недоступно для регистрации'; end if;
 if e.type='solo' and new.team_id is not null then raise exception 'В соло нужна личная заявка';end if;
 if not is_manager and (tg_op='INSERT' or old.status='cancelled') then
 if now()<s.registration_open_time then raise exception 'Регистрация ещё не открыта';end if;
 if now()>=coalesce(s.registration_close_time,s.start_time) then raise exception 'Регистрация закрыта';end if;end if;
 if new.event_id<>s.event_id then raise exception 'Сессия другого мероприятия'; end if;
 if (tg_op='INSERT' or old.status='cancelled') and now()>=coalesce(s.end_time,s.start_time) then raise exception 'Сессия находится в архиве'; end if;
 if not is_manager and tg_op<>'INSERT' and not(tg_op='UPDATE' and old.status='cancelled' and new.status in('confirmed','waiting')) and now()>=s.start_time-interval '10 minutes' then raise exception 'Состав уже закрыт. Обратитесь к организатору'; end if;
 if new.participant_user_id is not null and not e.allow_individual_registration and e.type<>'solo' then raise exception 'Индивидуальная регистрация отключена'; end if;
 if public.u2_is_restricted(case when new.team_id is null then 'player' else 'team' end,coalesce(new.team_id,new.participant_user_id),'events',e.organizer_user_id,e.id) then raise exception 'Организатор ограничил ваше участие'; end if;
 for user_id_value in select value::uuid from jsonb_array_elements_text(coalesce(new.roster_json,'[]')) loop
 if public.u2_is_restricted('player',user_id_value,'events',e.organizer_user_id,e.id) then raise exception 'Игрок состава отстранён от мероприятия'; end if;end loop;
 if tg_op='UPDATE' and old.status='waiting' and new.status='confirmed' and not public.u5_reserve_eligible(old.id) then raise exception 'Проверьте состав и ограничения заявки перед переводом из резерва';end if;
 if tg_op='UPDATE' and old.status='waiting' and new.status='confirmed'
 and now()>=s.start_time-make_interval(mins=>coalesce(e.roster_lock_minutes,10))
 and current_setting('omcite.waitlist_promoting',true) is distinct from s.id::text then
 raise exception 'Перевод из резерва закрыт: состав заблокирован';end if;
 if new.status='confirmed' and (select count(*) from public.event_registrations where session_id=s.id and status='confirmed' and id<>new.id)>=least(1024,coalesce(s.max_teams,e.max_teams,1024)) then
 new.status:='waiting';new.group_id:=null;end if;
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
create or replace function public.cancel_session_registration(
  p_registration_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  registration_row public.event_registrations%rowtype;
  locked_session uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select session_id into locked_session from public.event_registrations where id=p_registration_id;
  perform 1 from public.event_sessions where id=locked_session for update;
  perform set_config('omcite.last_promoted_id','',true);

  select * into registration_row
  from public.event_registrations
  where id = p_registration_id
  for update;
  if not found then raise exception 'Registration not found'; end if;
  if registration_row.participant_user_id is not null then
    if registration_row.participant_user_id <> auth.uid() then
      raise exception 'Insufficient registration permissions';
    end if;
  elsif not public.can_manage_team(registration_row.team_id, auth.uid()) then
    raise exception 'Insufficient team permissions';
  end if;

  update public.event_registrations
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancellation_reason = p_reason,
      updated_at = now()
  where id = p_registration_id;

  if registration_row.participant_user_id is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      registration_row.participant_user_id,
      'cancellation',
      'Участие отменено',
      'Ваша личная регистрация на выбранное время отменена',
      format('/tournaments/%s', registration_row.event_id)
    );
  else
    insert into public.notifications (user_id, type, title, body, link)
    select
      membership.user_id,
      'cancellation',
      'Участие отменено',
      'Регистрация команды на выбранное время отменена',
      format('/tournaments/%s', registration_row.event_id)
    from public.team_members membership
    where membership.team_id = registration_row.team_id;
  end if;

  return nullif(current_setting('omcite.last_promoted_id',true),'')::uuid;
end;
$$;


create or replace function public.u5_fill_reserve(p_session uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare s event_sessions%rowtype;e events%rowtype;r event_registrations%rowtype;first_id uuid;capacity integer;free_count integer;
 previous_setting text:=coalesce(current_setting('omcite.waitlist_promoting',true),'');
begin
 select * into s from event_sessions where id=p_session for update;
 select * into e from events where id=s.event_id;
 if s.id is null or s.status='cancelled' or e.cancelled_at is not null or e.frozen_at is not null
   or e.moderation_status<>'approved' or now()>=coalesce(s.registration_close_time,s.start_time)
   or now()>=s.start_time or exists(select 1 from competition_publications where session_id=s.id and first_published_at is not null) then return null;end if;
 capacity:=least(1024,coalesce(s.max_teams,e.max_teams,1024),coalesce((select sum(g.capacity)::integer from event_groups g where g.session_id=s.id and g.is_active),0));
 select capacity-count(*) into free_count from event_registrations where session_id=s.id and status='confirmed';
 if free_count<=0 then return null;end if;
 perform set_config('omcite.waitlist_promoting',s.id::text,true);
 for r in select reg.* from event_registrations reg where reg.session_id=s.id and reg.status='waiting'
 and public.u5_reserve_eligible(reg.id)
 order by reg.created_at,reg.id for update of reg loop
  exit when free_count<=0;
  update event_registrations set status='confirmed',group_id=null,promoted_at=now(),updated_at=now() where id=r.id returning * into r;
  if r.status='confirmed' then
   first_id:=coalesce(first_id,r.id);free_count:=free_count-1;
   perform public.u2_notify_target(case when r.team_id is null then 'player' else 'team' end,coalesce(r.team_id,r.participant_user_id),
     'reserve-promotion:'||r.id||':'||r.promoted_at,'Место в основном составе',
     'Заявка переведена из резерва в основной состав сессии.','/tournaments/'||e.id);
  end if;
 end loop;
 perform set_config('omcite.waitlist_promoting',previous_setting,true);
 return first_id;
end $$;
create or replace function public.u5_reserve_after_registration() returns trigger
language plpgsql security definer set search_path=public as $$
declare promoted uuid;
begin
 if tg_op='DELETE' or (old.status='confirmed' and new.status<>'confirmed') then
  promoted:=public.u5_fill_reserve(old.session_id);
  perform set_config('omcite.last_promoted_id',coalesce(promoted::text,''),true);
 end if;
 return null;
end $$;
create trigger u5_reserve_after_registration after update of status or delete on public.event_registrations
 for each row execute function public.u5_reserve_after_registration();
create or replace function public.u5_reserve_after_capacity() returns trigger
language plpgsql security definer set search_path=public as $$begin
 if tg_table_name='event_sessions' then perform public.u5_fill_reserve(new.id);
 else perform public.u5_fill_reserve(new.session_id);end if;return null;
end $$;
create trigger u5_reserve_session_capacity after update of max_teams on public.event_sessions for each row execute function public.u5_reserve_after_capacity();
create trigger u5_reserve_group_capacity after update of capacity,is_active on public.event_groups for each row execute function public.u5_reserve_after_capacity();

-- Dedicated manager action, with the same version/idempotency machinery as other registration edits.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.u2_registration_action(uuid,uuid,integer,jsonb,uuid)'::regprocedure);
 if strpos(definition,' if action_value=''remove'' then')=0 then raise exception 'Unexpected registration action function';end if;
 definition:=replace(definition,' if action_value=''remove'' then',$patch$
 if action_value='promote' then
  if role_value='responsible' then raise exception 'Перевод подтверждает организатор или администратор';end if;
  if now()>=s.start_time-make_interval(mins=>coalesce(e.roster_lock_minutes,10)) then raise exception 'Перевод из резерва закрыт: состав заблокирован';end if;
  select * into r from public.event_registrations where id=(p_input->>'id')::uuid and session_id=s.id for update;
  if r.id is null or r.status<>'waiting' then raise exception 'Заявка уже не находится в резерве';end if;
  if (select count(*) from public.event_registrations where session_id=s.id and status='confirmed')>=least(1024,coalesce(s.max_teams,e.max_teams,1024)) then raise exception 'В основном составе нет свободного места';end if;
  update public.event_registrations set status='confirmed',group_id=null,promoted_at=now(),updated_at=now() where id=r.id returning * into r;
  if r.status<>'confirmed' then raise exception 'Нет свободного места в группах';end if;
  perform public.u2_notify_target(case when r.team_id is null then 'player' else 'team' end,coalesce(r.team_id,r.participant_user_id),
    'reserve-promotion:'||r.id||':'||r.promoted_at,'Место в основном составе','Организатор перевёл заявку из резерва.','/tournaments/'||e.id);
 elsif action_value='remove' then$patch$);
 -- Generic edit must not bypass the dedicated manager-only promotion permission.
 definition:=replace(definition,' if r.id is null then raise exception ''Заявка не найдена'';end if;end if;',
 $patch$ if r.id is null then raise exception 'Заявка не найдена';end if;if r.status='waiting' and p_input->>'status'='confirmed' and role_value='responsible' then raise exception 'Перевод подтверждает организатор или администратор';end if;end if;$patch$);
 execute definition;
end $$;
revoke all on function public.u5_reserve_eligible(uuid),public.u5_fill_reserve(uuid),public.u5_reserve_after_registration(),public.u5_reserve_after_capacity() from public,anon,authenticated;
grant execute on function public.u5_fill_reserve(uuid) to service_role;
commit;
