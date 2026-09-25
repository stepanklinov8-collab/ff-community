begin;
alter table public.comments add column session_id uuid references public.event_sessions(id);
alter table public.event_groups add column room_note text not null default '';
-- Preserve existing room values in the first group; access is checked per group by the API.
update public.event_groups g set room_id=coalesce(to_jsonb(s)->>'room_code',to_jsonb(s)->>'room_id'),room_password=s.room_password,room_note=coalesce(to_jsonb(s)->>'room_note','')
from public.event_sessions s where g.session_id=s.id and g.public_number=1;
create or replace function public.u2_comment_deadline(p_event uuid,p_session uuid default null) returns timestamptz
language sql stable security definer set search_path=public as $$
 select case when e.comments_enabled and e.cancelled_at is null and e.frozen_at is null and e.moderation_status='approved' then
 coalesce((select max(case when s.comments_closed then '-infinity'::timestamptz
 when p.first_published_at is not null then coalesce(p.corrected_at,p.first_published_at)+interval '24 hours'
 else coalesce(s.end_time,s.start_time)+interval '48 hours' end)
 from public.event_sessions s left join public.competition_publications p on p.session_id=s.id
 where s.event_id=e.id and s.status<>'cancelled' and (p_session is null or s.id=p_session)),e.archive_end_time+interval '48 hours')
 else '-infinity'::timestamptz end from public.events e where e.id=p_event;
$$;
create or replace function public.u2_comment_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare organizer uuid;
begin
 if tg_op='UPDATE' then
 if new.author_id<>old.author_id or to_jsonb(new)->>'event_id' is distinct from to_jsonb(old)->>'event_id'
 or to_jsonb(new)->>'session_id' is distinct from to_jsonb(old)->>'session_id'
 or to_jsonb(new)->>'clan_war_id' is distinct from to_jsonb(old)->>'clan_war_id' then raise exception 'Нельзя изменить автора или обсуждение комментария';end if;
 if new.is_deleted then return new;end if;end if;
 if public.u2_is_restricted('player',new.author_id,'public_comments') then raise exception 'Публикация комментариев временно ограничена';end if;
 if tg_table_name='comments' and to_jsonb(new)->>'event_id' is not null then
 select organizer_user_id into organizer from public.events where id=(to_jsonb(new)->>'event_id')::uuid;
 if to_jsonb(new)->>'session_id' is not null and not exists(select 1 from public.event_sessions where id=(to_jsonb(new)->>'session_id')::uuid and event_id=(to_jsonb(new)->>'event_id')::uuid) then raise exception 'Чужая сессия комментария';end if;
 if public.u2_is_restricted('player',new.author_id,'event_comments',organizer,(to_jsonb(new)->>'event_id')::uuid) then raise exception 'Комментарии мероприятий временно ограничены';end if;
 if coalesce(public.u2_comment_deadline((to_jsonb(new)->>'event_id')::uuid,(to_jsonb(new)->>'session_id')::uuid),'-infinity')<=now() then raise exception 'Обсуждение этой сессии закрыто';end if;
 elsif tg_table_name='clan_war_comments' then
 if public.u2_is_restricted('player',new.author_id,'event_comments') then raise exception 'Комментарии мероприятий временно ограничены';end if;
 end if;
 return new;
end $$;
create trigger u2_comment_guard before insert or update on public.comments for each row execute function public.u2_comment_guard();
create trigger u2_clan_comment_guard before insert or update on public.clan_war_comments for each row execute function public.u2_comment_guard();
create or replace function public.u2_session_action(p_actor uuid,p_session uuid,p_action text,p_input jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare role text;
begin
 role:=public.u2_editor_role(p_actor,p_session,false);
 if p_action='description' then
 if length(coalesce(p_input->>'description',''))>10000 then raise exception 'Описание слишком длинное';end if;
 update public.event_sessions set description=p_input->>'description' where id=p_session;
 elsif p_action='comments' then
 if role='responsible' then raise exception 'Обсуждение закрывает организатор или администратор';end if;
 update public.event_sessions set comments_closed=(p_input->>'closed')::boolean where id=p_session;
 elsif p_action='room' then
 update public.event_groups set room_id=nullif(p_input->>'code',''),room_password=nullif(p_input->>'password',''),room_note=coalesce(p_input->>'note','')
 where id=(p_input->>'groupId')::uuid and session_id=p_session;
 if not found then raise exception 'Группа не найдена';end if;
 else raise exception 'Неизвестное действие';end if;
 insert into public.competition_action_log(actor_id,scope_id,action) values(p_actor,p_session,p_action);
end $$;
revoke all on function public.u2_comment_deadline(uuid,uuid),public.u2_comment_guard(),public.u2_session_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.u2_comment_deadline(uuid,uuid),public.u2_comment_guard(),public.u2_session_action(uuid,uuid,text,jsonb) to service_role;
commit;
