begin;
create or replace function public.u2_reject_event(p_actor uuid,p_event uuid,p_revision integer,p_reason text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype;
begin
 if not public.is_full_admin(p_actor) then raise exception 'Требуются права администратора';end if;
 select * into e from public.events where id=p_event for update;
 if e.id is null then raise exception 'Мероприятие не найдено';end if;
 if e.configuration_revision<>p_revision then raise exception 'Конфликт версии мероприятия';end if;
 if e.moderation_status<>'pending' and e.pending_changes is null then raise exception 'Нет изменений на рассмотрении';end if;
 if length(trim(coalesce(p_reason,'')))=0 then raise exception 'Укажите причину отклонения';end if;
 update public.events set pending_changes=null,moderation_status=case when moderation_status='pending' then 'rejected' else moderation_status end,
 is_published=case when moderation_status='pending' then false else is_published end,configuration_revision=configuration_revision+1 where id=p_event;
 perform public.u2_notify_target('player',e.organizer_user_id,'event-rejected:'||e.id||':'||p_revision,'Предложение мероприятия отклонено',p_reason,'/tournaments/'||e.id||'/edit');
 insert into public.competition_action_log(actor_id,scope_id,action,revision,metadata) values(p_actor,p_event,'event_reject',p_revision+1,jsonb_build_object('reason',p_reason));
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.u2_reject_event(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.u2_reject_event(uuid,uuid,integer,text) to service_role;
commit;
