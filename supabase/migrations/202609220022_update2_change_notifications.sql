begin;
create or replace function public.u2_notify_session(p_session uuid,p_group uuid,p_title text) returns void
language plpgsql security definer set search_path=public as $$
declare s public.event_sessions%rowtype;e public.events%rowtype;recipient record;source_id uuid;notice_id uuid:=gen_random_uuid();
begin
 select * into s from public.event_sessions where id=p_session;
 select * into e from public.events where id=s.event_id;
 if e.id is null or not e.is_published or e.moderation_status<>'approved' or e.cancelled_at is not null then return;end if;
 source_id:=case when s.source_session_id is not null and not exists(select 1 from public.competition_qualifications q where q.session_id=s.id and q.confirmed_at is not null) then s.source_session_id else s.id end;
 for recipient in select distinct case when r.team_id is null then 'player' else 'team' end target_type,coalesce(r.team_id,r.participant_user_id) target_id
 from public.event_registrations r where r.session_id=source_id and r.status='confirmed'
 and (source_id<>s.id or p_group is null or r.group_id=p_group) and coalesce(r.team_id,r.participant_user_id) is not null loop
 -- Never put passwords or room codes in a notification: the linked page checks access.
 perform public.u2_notify_target(recipient.target_type,recipient.target_id,'session-change:'||notice_id||':'||recipient.target_id,p_title,e.title,'/tournaments/'||e.id||'?sessionId='||s.id);
 end loop;
end $$;
create or replace function public.u2_change_notice() returns trigger language plpgsql security definer set search_path=public as $$
declare session_id_value uuid;
begin
 if tg_table_name='event_groups' then
 if row(new.room_id,new.room_password,new.room_note) is distinct from row(old.room_id,old.room_password,old.room_note) then perform public.u2_notify_session(new.session_id,new.id,'Обновлена комната группы');end if;
 elsif tg_table_name='event_sessions' then
 if row(new.start_time,new.end_time,new.registration_open_time,new.registration_close_time,new.source_session_id,new.qualification) is distinct from row(old.start_time,old.end_time,old.registration_open_time,old.registration_close_time,old.source_session_id,old.qualification) then perform public.u2_notify_session(new.id,null,'Изменены условия сессии');end if;
 elsif tg_table_name='events' then
 if row(new.type,new.cost,new.rules_text,new.competition_rules,new.min_players,new.max_teams,new.allow_individual_registration) is distinct from row(old.type,old.cost,old.rules_text,old.competition_rules,old.min_players,old.max_teams,old.allow_individual_registration) then
 for session_id_value in select id from public.event_sessions where event_id=new.id and coalesce(end_time,start_time)>now() loop perform public.u2_notify_session(session_id_value,null,'Изменены условия мероприятия');end loop;end if;
 elsif tg_table_name='organizer_applications' and new.status is distinct from old.status then
 perform public.u2_notify_target('player',new.user_id,'organizer-status:'||gen_random_uuid(),'Рассмотрен статус организатора',case new.status when 'approved' then 'Золотой статус одобрен' when 'rejected' then 'Заявка отклонена' when 'suspended' then 'Золотой статус приостановлен' when 'revoked' then 'Золотой статус отозван' else 'Заявка ожидает рассмотрения' end,'/organizer');
 end if;
 return new;
end $$;
create trigger u2_room_notice after update of room_id,room_password,room_note on public.event_groups for each row execute function public.u2_change_notice();
create trigger u2_session_notice after update on public.event_sessions for each row execute function public.u2_change_notice();
create trigger u2_event_notice after update on public.events for each row execute function public.u2_change_notice();
create trigger u2_organizer_notice after update of status on public.organizer_applications for each row execute function public.u2_change_notice();

-- Existing manual site bans must apply the same future participation/freeze rules.
create or replace function public.u2_legacy_ban_effects() returns trigger language plpgsql security definer set search_path=public as $$
declare registration record;previous_cleanup text:=current_setting('omcite.sanction_cleanup',true);
begin
 if not new.is_active or tg_op='UPDATE' and old.is_active and row(old.target_type,old.target_id) is not distinct from row(new.target_type,new.target_id) then return new;end if;
 perform set_config('omcite.sanction_cleanup',new.target_type||':'||new.target_id,true);
 update public.event_registrations r set status='cancelled',cancelled_at=now(),cancelled_by=new.created_by,cancellation_reason='Участник отстранён'
 from public.event_sessions s where s.id=r.session_id and s.start_time>now() and r.status in('confirmed','waiting')
 and (new.target_type='player' and r.participant_user_id=new.target_id or new.target_type='team' and r.team_id=new.target_id)
 and not exists(select 1 from public.competition_publications p where p.session_id=s.id and p.first_published_at is not null);
 if new.target_type='player' then
 for registration in select r.id,r.team_id,r.event_id from public.event_registrations r join public.event_sessions s on s.id=r.session_id
 where s.start_time>now() and r.status in('confirmed','waiting') and r.team_id is not null and r.roster_json ? new.target_id::text
 and not exists(select 1 from public.competition_publications p where p.session_id=s.id and p.first_published_at is not null) loop
 update public.event_registrations set roster_json=roster_json-new.target_id::text where id=registration.id;
 perform public.u2_notify_target('team',registration.team_id,'ban-replace:'||new.id||':'||registration.id,'Требуется замена игрока','Игрок отстранён от будущего мероприятия. Обновите состав.','/tournaments/'||registration.event_id);
 end loop;
 update public.events e set frozen_at=coalesce(e.frozen_at,now()) where e.organizer_user_id=new.target_id and e.cancelled_at is null
 and exists(select 1 from public.event_sessions s where s.event_id=e.id and coalesce(s.end_time,s.start_time)>now());
 end if;
 perform set_config('omcite.sanction_cleanup',coalesce(previous_cleanup,''),true);
 return new;
end $$;
create trigger u2_legacy_ban_effects after insert or update on public.bans for each row execute function public.u2_legacy_ban_effects();
revoke all on function public.u2_notify_session(uuid,uuid,text),public.u2_change_notice(),public.u2_legacy_ban_effects() from public,anon,authenticated;
commit;
