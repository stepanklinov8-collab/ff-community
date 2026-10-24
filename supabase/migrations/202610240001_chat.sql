begin;

-- Common membership is implicit: every confirmed account with a profile.
-- Existing administrative inbox messages are deliberately left untouched.
create table public.chat_rooms (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('common','support')),
 owner_id uuid unique references auth.users(id) on delete cascade,
 last_position bigint not null default 0,
 updated_at timestamptz not null default now(),
 check((kind='common' and owner_id is null) or (kind='support' and owner_id is not null))
);
create unique index chat_one_common on public.chat_rooms(kind) where kind='common';
create index chat_rooms_updated on public.chat_rooms(updated_at desc,id);
insert into public.chat_rooms(id,kind) values('00000000-0000-4000-8000-00000000c001','common');

create table public.chat_messages (
 id uuid primary key,
 room_id uuid not null references public.chat_rooms(id) on delete cascade,
 position bigint not null,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(body)<=4000),
 reply_to_id uuid references public.chat_messages(id) on delete set null,
 created_at timestamptz not null default now(),
 edited_at timestamptz,
 edited_by uuid references auth.users(id) on delete set null,
 deleted_at timestamptz,
 pinned_at timestamptz,
 version integer not null default 1,
 notify_mode text not null default 'none' check(notify_mode in ('none','admins','all','user')),
 notify_user_id uuid references auth.users(id) on delete set null,
 unique(room_id,position),
 check(deleted_at is not null or char_length(btrim(body)) between 1 and 4000)
);
create index chat_messages_sender on public.chat_messages(author_id,created_at desc);
create index chat_messages_pins on public.chat_messages(room_id,pinned_at desc) where pinned_at is not null;
create table public.chat_reads (
 user_id uuid not null references auth.users(id) on delete cascade,
 room_id uuid not null references public.chat_rooms(id) on delete cascade,
 position bigint not null default 0,
 primary key(user_id,room_id)
);
create table public.chat_mutes (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.chat_rooms(id) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 ends_at timestamptz,
 reason text not null default '' check(char_length(reason)<=500),
 created_by uuid not null references auth.users(id) on delete cascade
);
create unique index chat_one_mute on public.chat_mutes(room_id,user_id) nulls not distinct;
create index chat_mutes_expiry on public.chat_mutes(ends_at) where ends_at is not null;
create table public.chat_actions (
 id bigint generated always as identity primary key,
 message_id uuid not null references public.chat_messages(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('edit','delete','pin','unpin')),
 created_at timestamptz not null default now()
);

create function public.chat_account(p_actor uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from auth.users u join public.profiles p on p.id=u.id
 where u.id=p_actor and u.email_confirmed_at is not null)
 and not exists(select 1 from public.bans b where b.target_type='player' and b.target_id=p_actor and b.is_active)
$$;
create function public.chat_access(p_actor uuid,p_room uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.chat_account(p_actor) and exists(select 1 from public.chat_rooms r where r.id=p_room
 and (r.kind='common' or r.owner_id=p_actor or public.is_full_admin(p_actor)))
$$;
create function public.chat_can_write(p_actor uuid,p_room uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.chat_access(p_actor,p_room) and (
 public.is_full_admin(p_actor) or (
 not exists(select 1 from public.chat_mutes m where m.room_id=p_room and (m.user_id is null or m.user_id=p_actor) and (m.ends_at is null or m.ends_at>now()))
 and not exists(select 1 from public.chat_rooms r where r.id=p_room and r.kind='common' and public.u2_is_restricted('player',p_actor,'chat'))))
$$;

-- A hint contains no message, nickname, recipient list, unread count or body.
-- Database/API authorization is rechecked on every subsequent read, including
-- for an administrator whose role was revoked while a socket remained open.
create function public.chat_signal(p_room uuid) returns void
language plpgsql security definer set search_path=public as $$
declare owner_user uuid;
begin
 if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
  execute 'select realtime.send($1,$2,$3,true)' using '{}'::jsonb,'changed','chat:room:'||p_room;
  select owner_id into owner_user from public.chat_rooms where id=p_room;
  if owner_user is not null then
   execute 'select realtime.send($1,$2,$3,true)' using '{}'::jsonb,'changed','chat:user:'||owner_user;
   execute 'select realtime.send($1,$2,$3,true)' using '{}'::jsonb,'changed','chat:admins';
  end if;
 end if;
exception when others then
 -- A failed optional hint must not roll back an accepted message. Clients
 -- also reconcile via the authorized API after focus/reconnect and periodically.
 raise warning 'Chat hint unavailable (%)', SQLSTATE;
end $$;

create function public.chat_message_json(p_message uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select jsonb_build_object('id',m.id,'roomId',m.room_id,'position',m.position,'body',m.body,
 'createdAt',m.created_at,'editedAt',m.edited_at,'deleted',m.deleted_at is not null,'pinned',m.pinned_at is not null,
 'version',m.version,'author',jsonb_build_object('id',m.author_id,'nickname',coalesce(p.nickname,'Удалённый пользователь'),'avatar',to_jsonb(p)->>'avatar_url'),
 'reply',case when q.id is null then null else jsonb_build_object('id',q.id,'nickname',qp.nickname,'body',left(q.body,200),'deleted',q.deleted_at is not null) end)
 from public.chat_messages m left join public.profiles p on p.id=m.author_id
 left join public.chat_messages q on q.id=m.reply_to_id left join public.profiles qp on qp.id=q.author_id where m.id=p_message
$$;

create function public.chat_query(p_actor uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare room uuid:=(p_input->>'roomId')::uuid; items jsonb; pins jsonb; mutes jsonb;
 is_admin boolean:=coalesce(public.is_full_admin(p_actor),false); rows_found integer; last_read bigint;
 before_position bigint:=(p_input->>'before')::bigint; after_position bigint:=(p_input->>'after')::bigint;
 cursor_time timestamptz:=(p_input->>'cursorTime')::timestamptz; cursor_id uuid:=(p_input->>'cursorId')::uuid;
 next_cursor jsonb; unread bigint;
begin
 if not public.chat_account(p_actor) then raise exception 'CHAT_AUTH' using errcode='42501';end if;
 delete from public.chat_mutes where ends_at<=now();
 if room is null then
  select count(*) into unread from public.chat_rooms r where (r.kind='common' or r.owner_id=p_actor or is_admin)
   and exists(select 1 from public.chat_messages m where m.room_id=r.id and m.author_id<>p_actor and m.deleted_at is null
   and m.position>coalesce((select position from public.chat_reads where user_id=p_actor and room_id=r.id),0));
  if p_input->>'summary'='true' then return jsonb_build_object('unreadRooms',unread);end if;
  with selected as (
   select r.* from public.chat_rooms r where (r.kind='common' or r.owner_id=p_actor or is_admin)
   and (cursor_time is null or r.kind='support' and (r.updated_at,r.id)<(cursor_time,cursor_id))
   order by (r.kind='common') desc,r.updated_at desc,r.id desc limit 51
  ) select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'kind',s.kind,'ownerId',s.owner_id,
    'nickname',p.nickname,'avatar',to_jsonb(p)->>'avatar_url','updatedAt',s.updated_at,
    'unread',exists(select 1 from public.chat_messages m where m.room_id=s.id and m.author_id<>p_actor and m.deleted_at is null
      and m.position>coalesce((select position from public.chat_reads where user_id=p_actor and room_id=s.id),0)))
    order by (s.kind='common') desc,s.updated_at desc,s.id desc),'[]') into items from selected s left join public.profiles p on p.id=s.owner_id;
  rows_found:=jsonb_array_length(items);
  if rows_found>50 then items:=items-50;next_cursor:=jsonb_build_object('time',items->49->>'updatedAt','id',items->49->>'id');end if;
  return jsonb_build_object('userId',p_actor,'isAdmin',is_admin,'rooms',items,'nextCursor',next_cursor,'unreadRooms',unread);
 end if;
 if not public.chat_access(p_actor,room) then raise exception 'CHAT_FORBIDDEN' using errcode='42501';end if;
 if p_input ? 'search' then
  if not is_admin then raise exception 'CHAT_ADMIN' using errcode='42501';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'nickname',nickname)),'[]') into items from (
   select p.id,p.nickname from public.profiles p where public.chat_access(p.id,room)
   and position(lower(p_input->>'search') in lower(coalesce(p.nickname,'')))>0 order by p.nickname,p.id limit 20
  ) people;
  return jsonb_build_object('people',items);
 end if;
 if before_position is not null and after_position is not null then raise exception 'CHAT_INPUT';end if;
 with selected as (
  select id,position from public.chat_messages where room_id=room
   and (before_position is null or position<before_position) and (after_position is null or position>after_position)
  order by case when after_position is not null then position end asc,position desc limit 50
 ) select coalesce(jsonb_agg(public.chat_message_json(id) order by position),'[]') into items from selected;
 select coalesce(jsonb_agg(public.chat_message_json(id) order by pinned_at desc),'[]') into pins from public.chat_messages where room_id=room and pinned_at is not null and deleted_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'userId',m.user_id,'nickname',p.nickname,'endsAt',m.ends_at,'reason',m.reason)),'[]')
 into mutes from public.chat_mutes m left join public.profiles p on p.id=m.user_id where m.room_id=room and (is_admin or m.user_id is null or m.user_id=p_actor);
 select position into last_read from public.chat_reads where room_id=room and user_id=p_actor;
 return jsonb_build_object('messages',items,'pins',pins,'mutes',mutes,'canWrite',public.chat_can_write(p_actor,room),'lastRead',coalesce(last_read,0),
  'hasOlder',exists(select 1 from public.chat_messages where room_id=room and position<coalesce((items->0->>'position')::bigint,0)),
  'hasNewer',exists(select 1 from public.chat_messages where room_id=room and position>coalesce((items->-1->>'position')::bigint,0)));
end $$;

create function public.chat_mutate(p_actor uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare action text:=p_input->>'action'; room uuid:=(p_input->>'roomId')::uuid;
 room_row public.chat_rooms%rowtype; msg public.chat_messages%rowtype;
 message_id uuid:=(p_input->>'id')::uuid; is_admin boolean:=coalesce(public.is_full_admin(p_actor),false);
 v_body text:=btrim(p_input->>'body'); reply uuid:=(p_input->>'replyTo')::uuid;
 notice text:=coalesce(p_input->>'notify','none'); recipient uuid:=(p_input->>'notifyUserId')::uuid;
 target uuid:=(p_input->>'userId')::uuid; end_time timestamptz;
 muted_id uuid; new_position bigint; read_position bigint;
begin
 if not public.chat_account(p_actor) then raise exception 'CHAT_AUTH' using errcode='42501';end if;
 if action='open_support' then
  insert into public.chat_rooms(kind,owner_id) values('support',p_actor) on conflict(owner_id) do update set owner_id=excluded.owner_id returning id into room;
  return jsonb_build_object('roomId',room);
 end if;
 if not public.chat_access(p_actor,room) then raise exception 'CHAT_FORBIDDEN' using errcode='42501';end if;
 select * into room_row from public.chat_rooms where id=room;
 if action='read' then
  read_position:=(p_input->>'position')::bigint;
  if read_position is null or read_position<0 or read_position>room_row.last_position then raise exception 'CHAT_INPUT';end if;
  insert into public.chat_reads(user_id,room_id,position) values(p_actor,room,read_position)
   on conflict(user_id,room_id) do update set position=greatest(chat_reads.position,excluded.position);
  return jsonb_build_object('ok',true);
 end if;
 -- Serialize a sender across rooms for reliable throttling and retry safety.
 perform pg_advisory_xact_lock(hashtextextended('chat:'||p_actor::text,0));
 if action='send' then
  select * into msg from public.chat_messages where id=message_id;
  if found then
   if msg.author_id<>p_actor or msg.room_id<>room then raise exception 'CHAT_FORBIDDEN' using errcode='42501';end if;
   return jsonb_build_object('id',msg.id,'position',msg.position,'duplicate',true);
  end if;
  if not public.chat_can_write(p_actor,room) then raise exception 'CHAT_MUTED' using errcode='42501';end if;
  if message_id is null or v_body is null or char_length(v_body) not between 1 and 4000 or notice not in ('none','admins','all','user') then raise exception 'CHAT_INPUT';end if;
  if exists(select 1 from public.chat_messages where author_id=p_actor and created_at>now()-interval '1 second') then raise exception 'CHAT_RATE_LIMIT';end if;
  if reply is not null and not exists(select 1 from public.chat_messages where id=reply and room_id=room and deleted_at is null) then raise exception 'CHAT_REPLY';end if;
  if notice in ('all','user') and not is_admin then raise exception 'CHAT_FORBIDDEN' using errcode='42501';end if;
  if notice='all' and room_row.kind<>'common' then raise exception 'CHAT_INPUT';end if;
  if notice='user' and (recipient is null or not public.chat_access(recipient,room)) then raise exception 'CHAT_RECIPIENT';end if;
  if notice<>'none' and exists(select 1 from public.chat_messages where author_id=p_actor and notify_mode<>'none' and created_at>now()-interval '30 seconds') then raise exception 'CHAT_NOTIFY_LIMIT';end if;
  update public.chat_rooms set last_position=last_position+1,updated_at=now() where id=room returning last_position into new_position;
  insert into public.chat_messages(id,room_id,position,author_id,body,reply_to_id,notify_mode,notify_user_id)
   values(message_id,room,new_position,p_actor,v_body,reply,notice,case when notice='user' then recipient end);
  if notice<>'none' then
   insert into public.notifications(user_id,type,title,body,link)
   select u.id,'message','Сообщение в чате OMCITE','Вам адресовано сообщение. Откройте чат.', '/chat?room='||room
   from auth.users u join public.profiles p on p.id=u.id where u.id<>p_actor and u.email_confirmed_at is not null
    and (notice='all' or notice='admins' and public.is_full_admin(u.id) or notice='user' and u.id=recipient)
    and public.chat_access(u.id,room);
  end if;
  perform public.chat_signal(room);
  return jsonb_build_object('id',message_id,'position',new_position);
 end if;
 if not is_admin then raise exception 'CHAT_ADMIN' using errcode='42501';end if;
 delete from public.chat_mutes where ends_at<=now();
 if action='mute' then
  if p_input->>'durationMinutes' is not null then
   if (p_input->>'durationMinutes')::integer not between 30 and 5256000 then raise exception 'CHAT_MUTE_TIME';end if;
   end_time:=now()+make_interval(mins=>(p_input->>'durationMinutes')::integer);
  end if;
  if target is null and room_row.kind<>'common' then raise exception 'CHAT_INPUT';end if;
  if target is not null and (not public.chat_access(target,room) or public.is_full_admin(target)) then raise exception 'CHAT_RECIPIENT';end if;
  if end_time is not null and end_time<now()+interval '30 minutes' then raise exception 'CHAT_MUTE_TIME';end if;
  insert into public.chat_mutes(room_id,user_id,ends_at,reason,created_by) values(room,target,end_time,coalesce(p_input->>'reason',''),p_actor)
  on conflict(room_id,user_id) do update set ends_at=excluded.ends_at,reason=excluded.reason,created_by=excluded.created_by returning id into muted_id;
  insert into public.notifications(user_id,type,title,body,link)
   select p.id,'message','Отправка сообщений ограничена',case when end_time is null then 'Мут без срока окончания.' else 'Мут до '||to_char(end_time at time zone 'Europe/Moscow','DD.MM.YYYY HH24:MI')||' МСК.' end
    ||case when coalesce(p_input->>'reason','')='' then '' else ' Причина: '||(p_input->>'reason') end,'/chat?room='||room
   from public.profiles p where (target is null or p.id=target) and not public.is_full_admin(p.id) and public.chat_access(p.id,room);
  perform public.chat_signal(room);return jsonb_build_object('id',muted_id);
 elsif action='unmute' then
  delete from public.chat_mutes where id=(p_input->>'muteId')::uuid and room_id=room;
  perform public.chat_signal(room);return jsonb_build_object('ok',true);
 elsif action not in ('edit','delete','pin','unpin') then raise exception 'CHAT_INPUT';end if;
 select * into msg from public.chat_messages where id=message_id and room_id=room for update;
 if not found then raise exception 'CHAT_MESSAGE';end if;
 if msg.version is distinct from (p_input->>'version')::integer then raise exception 'CHAT_CONFLICT';end if;
 if msg.deleted_at is not null then raise exception 'CHAT_DELETED';end if;
 if action='edit' and (v_body is null or char_length(v_body) not between 1 and 4000) then raise exception 'CHAT_INPUT';end if;
 -- Lock the room to enforce the pin limit even across multiple administrators.
 perform 1 from public.chat_rooms where id=room for update;
 if action='pin' and msg.pinned_at is null and (select count(*) from public.chat_messages where room_id=room and pinned_at is not null)>=5 then raise exception 'CHAT_PIN_LIMIT';end if;
 update public.chat_messages set
  body=case when action='delete' then '' when action='edit' then v_body else chat_messages.body end,
  edited_at=case when action='edit' then now() else edited_at end,
  edited_by=p_actor,deleted_at=case when action='delete' then now() else deleted_at end,
  pinned_at=case when action in ('delete','unpin') then null when action='pin' then now() else pinned_at end,version=version+1 where id=message_id;
 insert into public.chat_actions(message_id,actor_id,action) values(message_id,p_actor,action);
 perform public.chat_signal(room);return jsonb_build_object('ok',true);
end $$;

-- No direct table access: all business operations pass through validated APIs.
do $$declare item text; f record;begin
 foreach item in array array['chat_rooms','chat_messages','chat_reads','chat_mutes','chat_actions'] loop
  execute format('alter table public.%I enable row level security',item);
  execute format('revoke all on public.%I from anon, authenticated',item);
  execute format('grant all on public.%I to service_role',item);
 end loop;
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'chat_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end $$;

-- Socket authorization only; no business data is broadcast to these topics.
create function public.chat_realtime_access(p_topic text) returns boolean
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.chat_account(auth.uid()) then return false;end if;
 if p_topic='chat:admins' then return public.is_full_admin(auth.uid());end if;
 if p_topic='chat:user:'||auth.uid() then return true;end if;
 if p_topic like 'chat:room:%' then
  return public.chat_access(auth.uid(),substring(p_topic from 11)::uuid);
 end if;
 return false;
exception when invalid_text_representation then return false;
end $$;
revoke all on function public.chat_realtime_access(text) from public,anon;
grant execute on function public.chat_realtime_access(text) to authenticated,service_role;
do $$begin
 if to_regclass('realtime.messages') is not null then
  execute 'create policy chat_receive_hints on realtime.messages for select to authenticated using (extension=''broadcast'' and public.chat_realtime_access(realtime.topic()))';
 end if;
end $$;
commit;
