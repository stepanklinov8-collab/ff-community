begin;
create or replace function public.u2_is_restricted(p_type text,p_target uuid,p_scope text,p_organizer uuid default null,p_event uuid default null)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.bans b where b.target_type=p_type and b.target_id=p_target and b.is_active)
 or exists(select 1 from public.competition_sanctions s where s.target_type=p_type and s.target_id=p_target
 and s.lifted_at is null and (s.ends_at is null or s.ends_at>now()) and p_scope=any(s.scopes)
 and (s.organizer_id is null or s.organizer_id=p_organizer))
 or (p_scope='events' and exists(select 1 from public.organizer_blacklist b where b.target_type=p_type and b.target_id=p_target
 and b.organizer_id=p_organizer and (b.event_id is null or b.event_id=p_event) and b.removed_at is null and (b.expires_at is null or b.expires_at>now())))
$$;

-- A no-show has one persistent identity, including after cancellation.
create or replace function public.u2_normalize_warning_ids(p_draft jsonb,p_session uuid,p_war uuid default null)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_set(p_draft,'{warnings}',coalesce((select jsonb_agg(case when item->>'source'='no_show' and existing.id is not null
 then item||jsonb_build_object('id',existing.id) else item end order by ordinal)
 from jsonb_array_elements(coalesce(p_draft->'warnings','[]')) with ordinality items(item,ordinal)
 left join public.warnings existing on existing.update2 and existing.source='no_show' and existing.target_type=item->>'targetType'
 and existing.target_id=(item->>'targetId')::uuid and existing.session_id is not distinct from p_session and existing.clan_war_id is not distinct from p_war),'[]'))
$$;

create or replace function public.u2_apply_sanction(p_type text,p_target uuid,p_organizer uuid,p_scopes text[],p_reason text,p_actor uuid,p_warnings uuid[] default '{}',p_end timestamptz default now()+interval '30 days')
returns uuid language plpgsql security definer set search_path=public as $$
declare sanction_id uuid; item record; previous_cleanup text:=current_setting('omcite.sanction_cleanup',true);
begin
 if p_type='player' and public.is_owner(p_target) then raise exception 'Аккаунт владельца защищён'; end if;
 insert into public.competition_sanctions(target_type,target_id,organizer_id,scopes,reason,ends_at,created_by)
 values(p_type,p_target,p_organizer,p_scopes,p_reason,p_end,p_actor) returning id into sanction_id;
 update public.warnings set used_in_sanction=sanction_id where id=any(p_warnings) and used_in_sanction is null;
 if 'events'=any(p_scopes) then
 perform set_config('omcite.sanction_cleanup',p_type||':'||p_target,true);
 -- Preserve historical rosters. Only future registrations are modified.
 update public.event_registrations r set status='cancelled',cancelled_at=now(),cancelled_by=p_actor,cancellation_reason=p_reason
 from public.event_sessions s,public.events e where r.session_id=s.id and s.event_id=e.id and s.start_time>now()
 and not exists(select 1 from public.competition_publications p where p.session_id=s.id and p.first_published_at is not null)
 and (p_organizer is null or e.organizer_user_id=p_organizer) and r.status in('confirmed','waiting')
 and (case when p_type='team' then r.team_id=p_target else r.participant_user_id=p_target end);
 if p_type='player' then
 for item in select r.id,r.roster_json,r.team_id,e.id event_id from public.event_registrations r
 join public.event_sessions s on s.id=r.session_id join public.events e on e.id=s.event_id
 where s.start_time>now() and not exists(select 1 from public.competition_publications p where p.session_id=s.id and p.first_published_at is not null)
 and (p_organizer is null or e.organizer_user_id=p_organizer)
 and r.status in('confirmed','waiting') and r.team_id is not null and r.roster_json ? p_target::text loop
 update public.event_registrations set roster_json=roster_json-p_target::text,roster_snapshot=null where id=item.id;
 perform public.u2_notify_target('team',item.team_id,'replace:'||sanction_id||':'||item.id,'Требуется замена игрока','Игрок отстранён от будущего мероприятия. Обновите состав.','/tournaments/'||item.event_id);
 end loop;
 if p_organizer is null then update public.events set frozen_at=now() where organizer_user_id=p_target and cancelled_at is null
 and exists(select 1 from public.event_sessions s where s.event_id=events.id and coalesce(s.end_time,s.start_time)>now()); end if;
 end if;
 end if;
 perform set_config('omcite.sanction_cleanup',coalesce(previous_cleanup,''),true);
 perform public.u2_notify_target(p_type,p_target,'sanction:'||sanction_id,'Назначено отстранение',p_reason||case when p_end is null then ' · бессрочно' else ' · до '||to_char(p_end at time zone 'Europe/Moscow','DD.MM.YYYY HH24:MI')||' МСК' end,case when p_type='player' then '/profile/' else '/teams/' end||p_target);
 perform public.u2_recalculate_reputation(p_type,p_target);
 return sanction_id;
end $$;

create or replace function public.u2_check_warning_thresholds(p_type text,p_target uuid,p_actor uuid)
returns void language plpgsql security definer set search_path=public as $$
declare ids uuid[]; chat_ids uuid[]; local_ids uuid[]; v_organizer uuid; scopes text[];
begin
 perform pg_advisory_xact_lock(hashtextextended('moderation:'||p_type||':'||p_target,0));
 select array_agg(id order by activated_at,id),array_agg(id order by activated_at,id) filter(where category='chat') into ids,chat_ids
 from public.warnings where update2 and target_type=p_type and target_id=p_target and activated_at is not null
 and cancelled_at is null and used_in_sanction is null and (expires_at is null or expires_at>now());
 if coalesce(cardinality(ids),0)>=5 then
 -- A single current batch triggers one period covering the union of scopes.
 scopes:=case when coalesce(cardinality(chat_ids),0)>0 then array['events','event_comments','public_comments','chat'] else array['events','event_comments'] end;
 perform public.u2_apply_sanction(p_type,p_target,null,scopes,'Пять активных предупреждений',p_actor,ids);
 return;
 end if;
 if coalesce(cardinality(chat_ids),0)>=3 then
 perform public.u2_apply_sanction(p_type,p_target,null,array['public_comments','chat'],'Три предупреждения чата',p_actor,chat_ids); end if;
 for v_organizer in select organizer_id from public.warnings where update2 and target_type=p_type and target_id=p_target
 and category='event' and organizer_id is not null and activated_at is not null and cancelled_at is null
 and used_in_sanction is null and (expires_at is null or expires_at>now()) group by organizer_id having count(*)>=3 loop
 select array_agg(id order by activated_at,id) into local_ids from public.warnings where update2 and target_type=p_type and target_id=p_target
 and organizer_id=v_organizer and category='event' and activated_at is not null and cancelled_at is null and used_in_sanction is null and (expires_at is null or expires_at>now());
 perform public.u2_apply_sanction(p_type,p_target,v_organizer,array['events','event_comments'],'Три предупреждения организатора',p_actor,local_ids);
 end loop;
end $$;

create or replace function public.u2_write_warning(p_actor uuid,p_session uuid,p_warning jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare old public.warnings%rowtype; warning_id uuid:=(p_warning->>'id')::uuid; role text; event_id_value uuid; v_organizer uuid; target uuid:=(p_warning->>'targetId')::uuid; kind text:=p_warning->>'targetType';
begin
 if p_session is not null then
 role:=public.u2_editor_role(p_actor,p_session);
 select e.id,e.organizer_user_id into event_id_value,v_organizer from public.event_sessions s join public.events e on e.id=s.event_id where s.id=p_session;
 if not exists(select 1 from public.event_registrations r where r.session_id=p_session and
 (kind='team' and r.team_id=target or kind='player' and (r.participant_user_id=target or r.roster_json @> jsonb_build_array(target::text)
 or exists(select 1 from jsonb_array_elements(coalesce(r.roster_snapshot,'[]')) p where p->>'id'=target::text)))) then raise exception 'Получатель не относится к сессии';end if;
 elsif p_warning->>'clanWarId' is not null then
 role:=public.u2_war_role(p_actor,(p_warning->>'clanWarId')::uuid);
 select created_by into v_organizer from public.clan_wars where id=(p_warning->>'clanWarId')::uuid;
 if not exists(select 1 from public.clan_war_rosters r where r.clan_war_id=(p_warning->>'clanWarId')::uuid and
 (kind='team' and r.team_id=target or kind='player' and (target=any(r.player_ids) or exists(select 1 from jsonb_array_elements(coalesce(r.roster_snapshot,'[]')) p where p->>'id'=target::text)))) then raise exception 'Получатель не относится к КВ';end if;
 else if not public.is_full_admin(p_actor) and not (p_warning->>'category'='chat' and exists(select 1 from public.user_roles ur where ur.user_id=p_actor and ur.role='moderator')) then raise exception 'Требуются права администратора'; end if; role:='admin'; end if;
 if p_warning->>'gameId' is not null and not (case when p_warning->>'clanWarId' is not null then exists(select 1 from public.clan_war_games where id=(p_warning->>'gameId')::uuid and clan_war_id=(p_warning->>'clanWarId')::uuid)
 else exists(select 1 from public.event_games where id=(p_warning->>'gameId')::uuid and session_id=p_session) end) then raise exception 'Чужая игра предупреждения';end if;
 if kind not in('player','team') or coalesce((p_warning->>'penalty')::integer,0) not between 1 and 99 or length(trim(coalesce(p_warning->>'reason','')))=0
 or p_warning->>'duration' not in('week','permanent') then raise exception 'Проверьте предупреждение'; end if;
 if kind='player' and public.is_owner(target) then raise exception 'Аккаунт владельца защищён'; end if;
 if p_warning->>'source'='no_show' and kind<>'team' then raise exception 'Неявка относится к команде'; end if;
 select * into old from public.warnings where id=warning_id for update;
 if old.id is not null and (old.session_id is distinct from p_session or old.clan_war_id is distinct from (p_warning->>'clanWarId')::uuid or old.target_id<>target or old.target_type<>kind) then raise exception 'Нельзя изменить получателя существующего предупреждения'; end if;
 if old.final_by_owner and not public.is_owner(p_actor) then raise exception 'Решение владельца окончательно для этой записи'; end if;
 if old.id is not null and role='responsible' and old.created_by<>p_actor then raise exception 'Ответственный изменяет только собственные предупреждения'; end if;
 if old.id is not null and old.cancelled_at is not null then
 if old.reason=p_warning->>'reason' and old.penalty=(p_warning->>'penalty')::integer then return warning_id;end if;
 raise exception 'Используйте отдельное действие для отменённого предупреждения'; end if;
 insert into public.warnings(id,target_type,target_id,level,reason,event_id,session_id,game_id,clan_war_id,clan_war_game_id,created_by,category,penalty,organizer_id,source,activated_at,expires_at,update2)
 values(warning_id,kind,target,1,p_warning->>'reason',event_id_value,p_session,case when p_warning->>'clanWarId' is null then (p_warning->>'gameId')::uuid end,(p_warning->>'clanWarId')::uuid,case when p_warning->>'clanWarId' is not null then (p_warning->>'gameId')::uuid end,p_actor,
 case when p_session is not null or p_warning->>'clanWarId' is not null then 'event' else coalesce(p_warning->>'category','event') end,(p_warning->>'penalty')::integer,v_organizer,coalesce(p_warning->>'source','manual'),now(),
 case when p_warning->>'duration'='week' then now()+interval '7 days' else null end,true)
 on conflict(id) do update set reason=excluded.reason,penalty=excluded.penalty,game_id=excluded.game_id,clan_war_game_id=excluded.clan_war_game_id,
 expires_at=case when p_warning->>'duration'='week' then warnings.activated_at+interval '7 days' else null end;
 if old.id is null then perform public.u2_notify_target(kind,target,'warning:'||warning_id,'Новое предупреждение',p_warning->>'reason',case when kind='player' then '/profile/' else '/teams/' end||target); end if;
 return warning_id;
end $$;

create or replace function public.u2_cancel_warning(p_actor uuid,p_warning uuid,p_reason text default null)
returns void language plpgsql security definer set search_path=public as $$
declare w public.warnings%rowtype; role text;
begin
 select * into w from public.warnings where id=p_warning for update;
 if w.id is null then raise exception 'Предупреждение не найдено'; end if;
 if public.is_full_admin(p_actor) or (w.category='chat' and w.created_by=p_actor and exists(select 1 from public.user_roles ur where ur.user_id=p_actor and ur.role='moderator')) then role:='admin'; elsif w.clan_war_id is not null then role:=public.u2_war_role(p_actor,w.clan_war_id);else role:=public.u2_editor_role(p_actor,w.session_id); end if;
 if role='responsible' and w.created_by<>p_actor then raise exception 'Можно отменить только собственное предупреждение'; end if;
 if w.final_by_owner and not public.is_owner(p_actor) then raise exception 'Решение владельца защищено'; end if;
 if w.cancelled_at is not null then return; end if;
 update public.warnings set cancelled_at=now(),cancelled_by=p_actor,cancellation_reason=p_reason,final_by_owner=public.is_owner(p_actor) where id=p_warning;
 perform public.u2_recalculate_reputation(w.target_type,w.target_id);
 perform public.u2_notify_target(w.target_type,w.target_id,'warning-cancel:'||w.id,'Предупреждение отменено','Предупреждение отменено. Репутация пересчитана.',case when w.target_type='player' then '/profile/' else '/teams/' end||w.target_id);
 -- Deliberately do not lift an already assigned sanction.
end $$;

create or replace function public.u2_lift_sanction(p_actor uuid,p_sanction uuid)
returns void language plpgsql security definer set search_path=public as $$
declare s public.competition_sanctions%rowtype;
begin
 select * into s from public.competition_sanctions where id=p_sanction for update;
 if s.id is null then raise exception 'Отстранение не найдено'; end if;
 if not public.is_full_admin(p_actor) and s.organizer_id is distinct from p_actor then raise exception 'Недостаточно прав'; end if;
 if s.final_by_owner and not public.is_owner(p_actor) then raise exception 'Решение владельца защищено'; end if;
 if s.lifted_at is not null then return; end if;
 update public.competition_sanctions set lifted_at=now(),lifted_by=p_actor,final_by_owner=public.is_owner(p_actor) where id=p_sanction;
 perform public.u2_recalculate_reputation(s.target_type,s.target_id);
 perform public.u2_notify_target(s.target_type,s.target_id,'sanction-lift:'||s.id,'Отстранение снято','Доступ восстановлен, репутация пересчитана.',case when s.target_type='player' then '/profile/' else '/teams/' end||s.target_id);
end $$;

create or replace function public.u2_moderation_action(p_actor uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare action text:=p_input->>'action'; object_id uuid; item record; w public.warnings%rowtype; a public.competition_appeals%rowtype;
 target_kind text; target uuid; v_organizer uuid; source_kind text; v_source uuid; recipient uuid; permitted boolean;
begin
 if p_actor is null then raise exception 'Необходима авторизация'; end if;
 if action='issue_warning' then
 object_id:=public.u2_write_warning(p_actor,(p_input->>'sessionId')::uuid,p_input->'warning');
 select * into w from public.warnings where id=object_id;
 perform public.u2_check_warning_thresholds(w.target_type,w.target_id,p_actor);
 perform public.u2_recalculate_reputation(w.target_type,w.target_id);
 elsif action='cancel_warning' then perform public.u2_cancel_warning(p_actor,(p_input->>'id')::uuid,p_input->>'reason');
 elsif action='lift_sanction' then perform public.u2_lift_sanction(p_actor,(p_input->>'id')::uuid);
 elsif action='sanction' then
 if not public.is_full_admin(p_actor) then raise exception 'Требуются права администратора'; end if;
 object_id:=public.u2_apply_sanction(p_input->>'targetType',(p_input->>'targetId')::uuid,null,array(select jsonb_array_elements_text(p_input->'scopes')),p_input->>'reason',p_actor,'{}',(p_input->>'endsAt')::timestamptz);
 elsif action='blacklist_add' then
 v_organizer:=coalesce((p_input->>'organizerId')::uuid,p_actor);
 if not public.is_full_admin(p_actor) and (v_organizer<>p_actor or not exists(select 1 from public.events where organizer_user_id=p_actor)) then raise exception 'Недостаточно прав организатора'; end if;
 if p_input->>'eventId' is not null and not exists(select 1 from public.events where id=(p_input->>'eventId')::uuid and organizer_user_id=v_organizer) then raise exception 'Чужое мероприятие'; end if;
 insert into public.organizer_blacklist(organizer_id,target_type,target_id,event_id,reason,expires_at)
 values(v_organizer,p_input->>'targetType',(p_input->>'targetId')::uuid,(p_input->>'eventId')::uuid,nullif(p_input->>'reason',''),(p_input->>'expiresAt')::timestamptz) returning id into object_id;
 elsif action='blacklist_remove' then
 select * into item from public.organizer_blacklist where id=(p_input->>'id')::uuid for update;
 if item.id is null or (not public.is_full_admin(p_actor) and item.organizer_id<>p_actor) then raise exception 'Недостаточно прав'; end if;
 if item.final_by_owner and not public.is_owner(p_actor) then raise exception 'Решение владельца защищено'; end if;
 update public.organizer_blacklist set removed_at=now(),removed_by=p_actor,final_by_owner=public.is_owner(p_actor) where id=item.id;
 insert into public.competition_action_log(actor_id,scope_id,action) values(p_actor,item.id,'blacklist_remove');
 elsif action='appeal' then
 source_kind:=p_input->>'sourceType';v_source:=(p_input->>'sourceId')::uuid;recipient:=(p_input->>'recipientId')::uuid;
 if source_kind='warning' then select target_type,target_id,organizer_id into target_kind,target,v_organizer from public.warnings where id=v_source;
 elsif source_kind='blacklist' then select target_type,target_id,organizer_id into target_kind,target,v_organizer from public.organizer_blacklist where id=v_source;
 elsif source_kind='sanction' then select target_type,target_id,organizer_id into target_kind,target,v_organizer from public.competition_sanctions where id=v_source;
 else raise exception 'Этот вид ограничения нельзя обжаловать'; end if;
 permitted:=case when target_kind='player' then target=p_actor when target_kind='team' then public.can_manage_team(target,p_actor) else false end;
 if not coalesce(permitted,false) then raise exception 'Нельзя обжаловать чужое решение'; end if;
 if not public.is_full_admin(recipient) and recipient is distinct from v_organizer then raise exception 'Выберите организатора или администратора'; end if;
 -- Serialize by source, so different organization representatives cannot bypass the single appeal rule.
 perform pg_advisory_xact_lock(hashtextextended('appeal:'||source_kind||':'||v_source,0));
 if exists(select 1 from public.competition_appeals where source_type=source_kind and source_id=v_source) then raise exception 'Это решение уже обжаловано'; end if;
 insert into public.competition_appeals(source_type,source_id,applicant_id,recipient_id,message,evidence)
 values(source_kind,v_source,p_actor,recipient,p_input->>'message',array(select jsonb_array_elements_text(coalesce(p_input->'evidence','[]')))) returning id into object_id;
 perform public.u2_notify_target('player',recipient,'appeal:'||object_id,'Новое обжалование','Вам направлено обращение.','/appeals');
 elsif action='decide_appeal' then
 select * into a from public.competition_appeals where id=(p_input->>'id')::uuid for update;
 if a.id is null or (a.recipient_id<>p_actor and not public.is_full_admin(p_actor)) then raise exception 'Нет доступа к обращению'; end if;
 if a.status<>'pending' then raise exception 'Обращение уже рассмотрено'; end if;
 if coalesce(p_input->>'answer','')='' then raise exception 'Укажите ответ заявителю'; end if;
 if (p_input->>'approve')::boolean then
 if a.source_type='warning' and coalesce((p_input->>'cancelWarning')::boolean,false) then perform public.u2_cancel_warning(p_actor,a.source_id,p_input->>'answer'); end if;
 if a.source_type='blacklist' then perform public.u2_moderation_action(p_actor,jsonb_build_object('action','blacklist_remove','id',a.source_id)); end if;
 if coalesce((p_input->>'liftSanction')::boolean,false) then
 if a.source_type='sanction' then perform public.u2_lift_sanction(p_actor,a.source_id);
 elsif a.source_type='warning' then select * into w from public.warnings where id=a.source_id;
 if w.used_in_sanction is not null then perform public.u2_lift_sanction(p_actor,w.used_in_sanction); end if; end if;
 end if;
 end if;
 update public.competition_appeals set status=case when (p_input->>'approve')::boolean then 'approved' else 'rejected' end,
 answer=p_input->>'answer',decided_by=p_actor,decided_at=now() where id=a.id;
 perform public.u2_notify_target('player',a.applicant_id,'appeal-answer:'||a.id,'Обжалование рассмотрено','Ответ доступен в вашем обращении.','/appeals');
 else raise exception 'Неизвестное действие'; end if;
 return jsonb_build_object('success',true,'id',object_id);
end $$;

create or replace function public.u2_expire_moderation() returns void
language plpgsql security definer set search_path=public as $$
declare target record; e record; m record;
begin
 for target in select distinct target_type,target_id from public.warnings where update2 and activated_at is not null loop
 perform public.u2_recalculate_reputation(target.target_type,target.target_id); end loop;
 for target in select * from public.warnings where update2 and used_in_sanction is null and cancelled_at is null and expires_at<=now() loop
 perform public.u2_notify_target(target.target_type,target.target_id,'warning-expire:'||target.id,'Срок предупреждения истёк','Репутация пересчитана.',case when target.target_type='player' then '/profile/' else '/teams/' end||target.target_id); end loop;
 for e in select * from public.events ev where frozen_at is not null and cancelled_at is null
 and not exists(select 1 from public.event_sessions s where s.event_id=ev.id and s.start_time<=ev.frozen_at)
 and exists(select 1 from public.event_sessions s where s.event_id=ev.id and s.start_time<=now()) for update loop
 update public.events set cancelled_at=now() where id=e.id;
 for m in select id from public.betting_markets where event_id=e.id order by id loop perform public.settle_betting_market(m.id,'void',e.organizer_user_id); end loop;
 end loop;
end $$;
do $$ declare f record; begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'u2\_%' escape '\' loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature); end loop;
end $$;
commit;
