begin;
create or replace function public.register_team_for_session(
  p_session_id uuid,
  p_team_id uuid,
  p_roster uuid[]
)
returns table(registration_id uuid, registration_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.event_sessions%rowtype;
  event_row public.events%rowtype;
  capacity integer;
  confirmed_count integer;
  next_status text;
  created_id uuid;
  minimum_players integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.can_manage_team(p_team_id, auth.uid()) then raise exception 'Insufficient team permissions'; end if;

  select * into session_row
  from public.event_sessions
  where id = p_session_id
  for update;
  if not found then raise exception 'Session not found'; end if;

  select * into event_row from public.events where id = session_row.event_id;
  if not coalesce(event_row.is_published,false) or event_row.publish_at>now() then
    raise exception 'Event is not published';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id and verified = true) then
    raise exception 'Team is not verified';
  end if;
  if session_row.registration_open_time is not null and now() < session_row.registration_open_time then
    raise exception 'Registration is not open yet';
  end if;
  if now() >= coalesce(session_row.registration_close_time, session_row.start_time) then
    raise exception 'Registration is closed';
  end if;

  if cardinality(p_roster)<>(select count(distinct player_id) from unnest(p_roster) player_id) then raise exception 'Проверьте состав: игроки не должны повторяться';end if;
  minimum_players := coalesce(event_row.min_players, 4);
  if coalesce(array_length(p_roster, 1), 0) < minimum_players then
    raise exception 'Not enough players in roster';
  end if;
  if exists (
    select 1 from unnest(p_roster) player_id
    where not exists (
      select 1 from public.team_members
      where team_id = p_team_id and user_id = player_id
    )
  ) then
    raise exception 'Roster contains a player outside this team';
  end if;
  if exists (
    select 1 from public.bans
    where is_active = true
      and ((target_type = 'team' and target_id = p_team_id)
        or (target_type = 'player' and target_id = any(p_roster)))
  ) then
    raise exception 'Team or roster player is banned';
  end if;
  if exists (
    select 1
    from public.event_registrations existing_registration
    where existing_registration.session_id = p_session_id
      and existing_registration.status in ('confirmed', 'waiting')
      and exists (
        select 1 from unnest(p_roster) player_id
        where existing_registration.roster_json ? player_id::text
      )
  ) then
    raise exception 'A roster player is already registered for this session';
  end if;
  if exists (
    select 1
    from public.event_registrations existing_registration
    join public.event_sessions existing_session on existing_session.id = existing_registration.session_id
    where existing_registration.status in ('confirmed', 'waiting')
      and existing_session.id <> p_session_id
      and tstzrange(
        existing_session.start_time,
        coalesce(existing_session.end_time, existing_session.start_time + interval '4 hours'),
        '[)'
      ) && tstzrange(
        session_row.start_time,
        coalesce(session_row.end_time, session_row.start_time + interval '4 hours'),
        '[)'
      )
      and exists (
        select 1 from unnest(p_roster) player_id
        where existing_registration.roster_json ? player_id::text
      )
  ) then
    raise exception 'A roster player is already registered for an overlapping session';
  end if;

  capacity := coalesce(session_row.max_teams, event_row.max_teams, 0);
  select count(*) into confirmed_count
  from public.event_registrations
  where session_id = p_session_id and status = 'confirmed';
  next_status := case when capacity > 0 and confirmed_count >= capacity then 'waiting' else 'confirmed' end;

  insert into public.event_registrations (
    event_id,
    session_id,
    team_id,
    participant_user_id,
    status,
    registered_by,
    roster,
    roster_json
  ) values (
    session_row.event_id,
    p_session_id,
    p_team_id,
    null,
    next_status,
    auth.uid(),
    to_jsonb(p_roster),
    to_jsonb(p_roster)
  ) returning id,status into created_id,next_status;

  insert into public.notifications (user_id, type, title, body, link)
  select
    membership.user_id,
    'registration',
    case when next_status = 'confirmed' then 'Команда участвует' else 'Команда в листе ожидания' end,
    format('Команда записана на «%s» (%s)', event_row.title, to_char(session_row.start_time, 'DD.MM.YYYY HH24:MI')),
    format('/tournaments/%s', session_row.event_id)
  from public.team_members membership
  where membership.team_id = p_team_id;

  insert into public.activity_log (user_id, team_id, event_id, action, details, activity_type, description)
  values (
    auth.uid(),
    p_team_id,
    session_row.event_id,
    'registration',
    format('Команда записалась на «%s»', event_row.title),
    'registration',
    format('Команда записалась на «%s»', event_row.title)
  );

  return query select created_id, next_status;
end;
$$;

create or replace function public.register_player_for_session(
  p_session_id uuid
)
returns table(registration_id uuid, registration_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row public.event_sessions%rowtype;
  event_row public.events%rowtype;
  capacity integer;
  confirmed_count integer;
  next_status text;
  created_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into session_row
  from public.event_sessions
  where id = p_session_id
  for update;
  if not found then raise exception 'Session not found'; end if;

  select * into event_row from public.events where id = session_row.event_id;
  if not coalesce(event_row.is_published,false) or event_row.publish_at>now() then
    raise exception 'Event is not published';
  end if;
  if session_row.registration_open_time is not null and now() < session_row.registration_open_time then
    raise exception 'Registration is not open yet';
  end if;
  if now() >= coalesce(session_row.registration_close_time, session_row.start_time) then
    raise exception 'Registration is closed';
  end if;
  if exists (
    select 1 from public.bans
    where target_type = 'player' and target_id = auth.uid() and is_active = true
  ) then
    raise exception 'Player is banned';
  end if;
  if exists (
    select 1
    from public.event_registrations existing_registration
    where existing_registration.session_id = p_session_id
      and existing_registration.status in ('confirmed', 'waiting')
      and existing_registration.roster_json ? auth.uid()::text
  ) then
    raise exception 'Player is already registered for this session';
  end if;
  if exists (
    select 1
    from public.event_registrations existing_registration
    join public.event_sessions existing_session on existing_session.id = existing_registration.session_id
    where existing_registration.status in ('confirmed', 'waiting')
      and existing_session.id <> p_session_id
      and tstzrange(
        existing_session.start_time,
        coalesce(existing_session.end_time, existing_session.start_time + interval '4 hours'),
        '[)'
      ) && tstzrange(
        session_row.start_time,
        coalesce(session_row.end_time, session_row.start_time + interval '4 hours'),
        '[)'
      )
      and existing_registration.roster_json ? auth.uid()::text
  ) then
    raise exception 'Player is already registered for an overlapping session';
  end if;

  capacity := coalesce(session_row.max_teams, event_row.max_teams, 0);
  select count(*) into confirmed_count
  from public.event_registrations
  where session_id = p_session_id and status = 'confirmed';
  next_status := case when capacity > 0 and confirmed_count >= capacity then 'waiting' else 'confirmed' end;

  insert into public.event_registrations (
    event_id,
    session_id,
    team_id,
    participant_user_id,
    status,
    registered_by,
    roster,
    roster_json
  ) values (
    session_row.event_id,
    p_session_id,
    null,
    auth.uid(),
    next_status,
    auth.uid(),
    jsonb_build_array(auth.uid()),
    jsonb_build_array(auth.uid())
  ) returning id,status into created_id,next_status;

  insert into public.notifications (user_id, type, title, body, link)
  values (
    auth.uid(),
    'registration',
    case when next_status = 'confirmed' then 'Участие подтверждено' else 'Вы в листе ожидания' end,
    format('Вы записались на «%s» (%s)', event_row.title, to_char(session_row.start_time, 'DD.MM.YYYY HH24:MI')),
    format('/tournaments/%s', session_row.event_id)
  );

  insert into public.activity_log (user_id, team_id, event_id, action, details, activity_type, description)
  values (
    auth.uid(),
    null,
    session_row.event_id,
    'registration',
    format('Игрок записался на «%s»', event_row.title),
    'registration',
    format('Игрок записался на «%s»', event_row.title)
  );

  return query select created_id, next_status;
end;
$$;

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
  promoted public.event_registrations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

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

  if registration_row.status = 'confirmed' and registration_row.session_id is not null then
    select r.* into promoted
    from public.event_registrations r join public.events e on e.id=r.event_id
    where r.session_id = registration_row.session_id and r.status = 'waiting'
      and e.frozen_at is null and e.cancelled_at is null and e.moderation_status='approved'
      and not public.u2_is_restricted(case when r.team_id is null then 'player' else 'team' end,coalesce(r.team_id,r.participant_user_id),'events',e.organizer_user_id,e.id)
      and not exists(select 1 from jsonb_array_elements_text(coalesce(r.roster_json,'[]')) player where public.u2_is_restricted('player',player::uuid,'events',e.organizer_user_id,e.id))
    order by r.created_at,r.id
    for update of r skip locked
    limit 1;

    if promoted.id is not null then
      update public.event_registrations
      set status = 'confirmed',group_id=null, promoted_at = now(), updated_at = now()
      where id = promoted.id returning * into promoted;
      if promoted.status<>'confirmed' then return null;end if;

      if promoted.participant_user_id is not null then
        insert into public.notifications (user_id, type, title, body, link)
        values (
          promoted.participant_user_id,
          'registration',
          'Вы переведены в основной список',
          'Освободилось место — вы больше не находитесь в листе ожидания',
          format('/tournaments/%s', promoted.event_id)
        );
      else
        insert into public.notifications (user_id, type, title, body, link)
        select
          membership.user_id,
          'registration',
          'Команда переведена в основной состав',
          'Освободилось место — команда больше не находится в листе ожидания',
          format('/tournaments/%s', promoted.event_id)
        from public.team_members membership
        where membership.team_id = promoted.team_id;
      end if;
    end if;
  end if;

  return promoted.id;
end;
$$;

revoke all on function public.register_team_for_session(uuid,uuid,uuid[]),public.register_player_for_session(uuid),public.cancel_session_registration(uuid,text) from public,anon;
grant execute on function public.register_team_for_session(uuid,uuid,uuid[]),public.register_player_for_session(uuid),public.cancel_session_registration(uuid,text) to authenticated,service_role;
commit;
