-- Allow a cancelled registration to be submitted again and let team leaders
-- update an active roster until the configured pre-session lock time.

begin;

-- The legacy event-level constraint also includes cancelled registrations and
-- prevents a team from submitting a fresh application after withdrawal.
alter table public.event_registrations
  drop constraint if exists event_registrations_event_id_team_id_key;

drop index if exists public.event_registrations_session_team_unique;
create unique index event_registrations_session_team_unique
  on public.event_registrations(session_id, team_id)
  where session_id is not null
    and team_id is not null
    and status <> 'cancelled';

drop index if exists public.event_registrations_session_player_unique;
create unique index event_registrations_session_player_unique
  on public.event_registrations(session_id, participant_user_id)
  where session_id is not null
    and participant_user_id is not null
    and status <> 'cancelled';

create or replace function public.update_team_registration_roster(
  p_registration_id uuid,
  p_roster uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  registration_row public.event_registrations%rowtype;
  session_row public.event_sessions%rowtype;
  event_row public.events%rowtype;
  minimum_players integer;
  roster_lock_minutes integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into registration_row
  from public.event_registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception 'Registration not found';
  end if;
  if registration_row.team_id is null or registration_row.participant_user_id is not null then
    raise exception 'Team registration required';
  end if;
  if registration_row.status not in ('confirmed', 'waiting') then
    raise exception 'Registration is not active';
  end if;
  if not public.can_manage_team(registration_row.team_id, auth.uid()) then
    raise exception 'Insufficient team permissions';
  end if;

  select * into session_row
  from public.event_sessions
  where id = registration_row.session_id
  for update;

  if not found then
    raise exception 'Session not found';
  end if;

  select * into event_row
  from public.events
  where id = registration_row.event_id;

  if not found then
    raise exception 'Event not found';
  end if;

  roster_lock_minutes := coalesce(event_row.roster_lock_minutes, 10);
  if now() >= session_row.start_time - make_interval(mins => roster_lock_minutes) then
    raise exception 'Roster is locked';
  end if;

  minimum_players := coalesce(event_row.min_players, 4);
  if coalesce(array_length(p_roster, 1), 0) < minimum_players then
    raise exception 'Not enough players in roster';
  end if;
  if coalesce(array_length(p_roster, 1), 0) <> (
    select count(distinct roster_player.player_id)
    from unnest(p_roster) as roster_player(player_id)
  ) then
    raise exception 'Roster contains duplicate players';
  end if;
  if exists (
    select 1
    from unnest(p_roster) as roster_player(player_id)
    where not exists (
      select 1
      from public.team_members membership
      where membership.team_id = registration_row.team_id
        and membership.user_id = roster_player.player_id
    )
  ) then
    raise exception 'Roster contains a player outside this team';
  end if;
  if exists (
    select 1
    from public.bans
    where is_active = true
      and (
        (target_type = 'team' and target_id = registration_row.team_id)
        or (target_type = 'player' and target_id = any(p_roster))
      )
  ) then
    raise exception 'Team or roster player is banned';
  end if;
  if exists (
    select 1
    from public.event_registrations existing_registration
    where existing_registration.id <> registration_row.id
      and existing_registration.session_id = registration_row.session_id
      and existing_registration.status in ('confirmed', 'waiting')
      and exists (
        select 1
        from unnest(p_roster) as roster_player(player_id)
        where existing_registration.roster_json ? roster_player.player_id::text
      )
  ) then
    raise exception 'A roster player is already registered for this session';
  end if;
  if exists (
    select 1
    from public.event_registrations existing_registration
    join public.event_sessions existing_session
      on existing_session.id = existing_registration.session_id
    where existing_registration.id <> registration_row.id
      and existing_registration.status in ('confirmed', 'waiting')
      and existing_session.id <> session_row.id
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
        select 1
        from unnest(p_roster) as roster_player(player_id)
        where existing_registration.roster_json ? roster_player.player_id::text
      )
  ) then
    raise exception 'A roster player is already registered for an overlapping session';
  end if;

  update public.event_registrations
  set roster = to_jsonb(p_roster),
      roster_json = to_jsonb(p_roster),
      updated_at = now()
  where id = registration_row.id;

  insert into public.activity_log (
    user_id,
    team_id,
    event_id,
    action,
    details,
    activity_type,
    description
  ) values (
    auth.uid(),
    registration_row.team_id,
    registration_row.event_id,
    'registration_roster_updated',
    format('Состав обновлён для «%s»', event_row.title),
    'registration',
    format('Команда обновила состав на «%s»', event_row.title)
  );

  return registration_row.id;
end;
$$;

revoke all on function public.update_team_registration_roster(uuid, uuid[]) from public, anon;
grant execute on function public.update_team_registration_roster(uuid, uuid[]) to authenticated;

commit;
