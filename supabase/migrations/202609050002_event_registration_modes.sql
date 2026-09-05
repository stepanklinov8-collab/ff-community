begin;

alter table public.events
  add column if not exists allow_individual_registration boolean not null default false;

comment on column public.events.allow_individual_registration is
  'Allows an authenticated player to register without a team or guild. Solo events always allow it.';

-- Solo events are individual by definition. Keep the currently discussed training
-- open to individual players and preserve any events that already accepted one.
update public.events event_row
set allow_individual_registration = true
where event_row.type = 'solo'
   or event_row.id = 'c324f0b5-3518-4a3a-be3b-bff957d4d84c'::uuid
   or exists (
     select 1
     from public.event_registrations registration
     where registration.event_id = event_row.id
       and registration.participant_user_id is not null
       and registration.status in ('confirmed', 'waiting')
   );

create or replace function public.enforce_event_registration_mode()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  event_type text;
  individual_allowed boolean;
begin
  select event_row.type, event_row.allow_individual_registration
  into event_type, individual_allowed
  from public.events event_row
  where event_row.id = new.event_id;

  if not found then
    raise exception 'Event not found';
  end if;

  if new.participant_user_id is not null
     and event_type <> 'solo'
     and not coalesce(individual_allowed, false) then
    raise exception 'Individual registration is disabled for this event';
  end if;

  if new.team_id is not null and event_type = 'solo' then
    raise exception 'Team or guild registration is disabled for solo events';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_event_registration_mode_trigger
  on public.event_registrations;
create trigger enforce_event_registration_mode_trigger
before insert or update of event_id, team_id, participant_user_id
on public.event_registrations
for each row execute function public.enforce_event_registration_mode();

commit;
