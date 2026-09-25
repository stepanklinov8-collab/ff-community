begin;
create table public.competition_event_transfers(
 id uuid primary key default gen_random_uuid(),event_id uuid not null references public.events(id),
 from_user_id uuid references auth.users(id),to_user_id uuid not null references auth.users(id),
 actor_id uuid not null references auth.users(id),reason text not null,created_at timestamptz not null default now()
);
alter table public.competition_event_transfers enable row level security;
revoke all on public.competition_event_transfers from public,anon,authenticated;
grant all on public.competition_event_transfers to service_role;

create or replace function public.u2_cancel_event(p_actor uuid,p_event uuid,p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype;m record;recipient record;
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 select * into e from public.events where id=p_event for update;
 if e.id is null then raise exception 'Мероприятие не найдено';end if;
 if e.cancelled_at is not null then return;end if;
 update public.events set cancelled_at=now(),configuration_revision=configuration_revision+1 where id=e.id;
 -- Completed publications and their historical lineups remain intact.
 update public.event_registrations r set status='cancelled',cancelled_at=now(),cancelled_by=p_actor,cancellation_reason=p_reason
 where r.event_id=e.id and r.status in('confirmed','waiting')
 and not exists(select 1 from public.competition_publications p where p.session_id=r.session_id and p.first_published_at is not null);
 update public.event_sessions s set status='cancelled' where s.event_id=e.id
 and not exists(select 1 from public.competition_publications p where p.session_id=s.id and p.first_published_at is not null);
 for m in select b.id from public.betting_markets b where b.event_id=e.id order by b.id loop
 perform public.settle_betting_market(m.id,'void',p_actor);end loop;
 for recipient in select distinct case when team_id is null then 'player' else 'team' end target_type,coalesce(team_id,participant_user_id) target_id
 from public.event_registrations where event_id=e.id and coalesce(team_id,participant_user_id) is not null loop
 perform public.u2_notify_target(recipient.target_type,recipient.target_id,'event-cancel:'||e.id||':'||recipient.target_id,'Мероприятие отменено',e.title||'. '||p_reason,'/tournaments/'||e.id);end loop;
 perform public.u2_notify_target('player',e.organizer_user_id,'event-cancel-owner:'||e.id,'Мероприятие отменено',p_reason,'/tournaments/'||e.id);
 insert into public.competition_action_log(actor_id,scope_id,action,metadata) values(p_actor,e.id,'event_cancel',jsonb_build_object('reason',p_reason));
end $$;

create or replace function public.u2_event_lifecycle(p_actor uuid,p_event uuid,p_revision integer,p_action text,p_target uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype;is_admin boolean:=public.is_full_admin(p_actor);new_name text;
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 select * into e from public.events where id=p_event for update;
 if e.id is null then raise exception 'Мероприятие не найдено';end if;
 if not is_admin and e.organizer_user_id is distinct from p_actor then raise exception 'Недостаточно прав';end if;
 if e.configuration_revision<>p_revision then raise exception 'Конфликт версии мероприятия';end if;
 if e.cancelled_at is not null then raise exception 'Мероприятие уже отменено';end if;
 if e.frozen_at is not null and not is_admin then raise exception 'Требуются права администратора для замороженного мероприятия';end if;
 if nullif(trim(p_reason),'') is null then raise exception 'Укажите причину';end if;
 if p_action='transfer' then
 select nickname into new_name from public.profiles where id=p_target;
 if new_name is null then raise exception 'Новый организатор не найден';end if;
 if public.u2_is_restricted('player',p_target,'events') then raise exception 'Организатор временно отстранён';end if;
 if p_target=e.organizer_user_id and e.frozen_at is null then raise exception 'Этот организатор уже назначен';end if;
 if p_actor is distinct from e.organizer_user_id and not public.is_owner(p_actor)
 and exists(select 1 from public.competition_event_transfers where event_id=e.id and from_user_id=p_target) then
 raise exception 'Обратную передачу подтверждает текущий организатор либо суперадминистратор';end if;
 insert into public.competition_event_transfers(event_id,from_user_id,to_user_id,actor_id,reason) values(e.id,e.organizer_user_id,p_target,p_actor,p_reason);
 update public.events set organizer_user_id=p_target,organizer=new_name,frozen_at=null,pending_changes=null,configuration_revision=configuration_revision+1 where id=e.id;
 perform public.u2_notify_target('player',p_target,'event-transfer:'||e.id||':'||(p_revision+1),'Вам передано мероприятие',e.title,'/tournaments/'||e.id||'/edit');
 perform public.u2_notify_target('player',e.organizer_user_id,'event-transfer-from:'||e.id||':'||(p_revision+1),'Организатор мероприятия изменён',e.title||' · '||new_name,'/tournaments/'||e.id);
 insert into public.competition_action_log(actor_id,scope_id,action,metadata) values(p_actor,e.id,'event_transfer',jsonb_build_object('to',p_target,'reason',p_reason));
 elsif p_action='cancel' then
 if not is_admin and exists(select 1 from public.event_sessions where event_id=e.id and start_time<=now()) then raise exception 'Начавшееся мероприятие отменяет администрация';end if;
 perform public.u2_cancel_event(p_actor,e.id,p_reason);
 else raise exception 'Неизвестное действие';end if;
 return jsonb_build_object('success',true,'revision',(select configuration_revision from public.events where id=e.id));
end $$;

create or replace function public.u2_expire_moderation() returns void
language plpgsql security definer set search_path=public as $$
declare target record;e record;
begin
 for target in select distinct target_type,target_id from public.warnings where update2 and activated_at is not null loop
 perform public.u2_recalculate_reputation(target.target_type,target.target_id);end loop;
 for target in select * from public.warnings where update2 and used_in_sanction is null and cancelled_at is null and expires_at<=now() loop
 perform public.u2_notify_target(target.target_type,target.target_id,'warning-expire:'||target.id,'Срок предупреждения истёк','Репутация пересчитана.',case when target.target_type='player' then '/profile/' else '/teams/' end||target.target_id);end loop;
 for target in select * from public.competition_sanctions where lifted_at is null and ends_at<=now() loop
 perform public.u2_notify_target(target.target_type,target.target_id,'sanction-expire:'||target.id,'Срок отстранения истёк','Доступ восстановлен в пределах остальных действующих ограничений.',case when target.target_type='player' then '/profile/' else '/teams/' end||target.target_id);end loop;
 for e in select * from public.events ev where frozen_at is not null and cancelled_at is null
 and not exists(select 1 from public.event_sessions s where s.event_id=ev.id and s.start_time<=ev.frozen_at)
 and exists(select 1 from public.event_sessions s where s.event_id=ev.id and s.start_time<=now()) for update loop
 perform public.u2_cancel_event(null,e.id,'До начала не назначен новый организатор');end loop;
end $$;
revoke all on function public.u2_cancel_event(uuid,uuid,text),public.u2_event_lifecycle(uuid,uuid,integer,text,uuid,text),public.u2_expire_moderation() from public,anon,authenticated;
grant execute on function public.u2_event_lifecycle(uuid,uuid,integer,text,uuid,text),public.u2_expire_moderation() to service_role;
commit;
