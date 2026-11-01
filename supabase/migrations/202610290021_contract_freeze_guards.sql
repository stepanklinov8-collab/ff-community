-- Capture the contractual roster/game setup before any privileged edit made
-- after a session starts. The snapshot, not the later editable rows, is used
-- for participation and payment calculations.
begin;
create function public.contract_freeze_before_roster_change() returns trigger
language plpgsql security definer set search_path=public as $$
declare session_value uuid;starts timestamptz;session_status text;cancelled timestamptz;
begin
 if tg_op='DELETE' then session_value:=old.session_id;else session_value:=new.session_id;end if;
 select s.start_time,s.status,e.cancelled_at into starts,session_status,cancelled
 from public.event_sessions s join public.events e on e.id=s.event_id where s.id=session_value;
 if starts is not null and starts<=clock_timestamp() and session_status<>'cancelled' and cancelled is null
   and not exists(select 1 from public.contract_session_frames where session_id=session_value) then
   perform public.contract_session_freeze(session_value);
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;

create trigger contract_roster_freeze_before_write
 before insert or update or delete on public.event_registrations
 for each row execute function public.contract_freeze_before_roster_change();
create trigger contract_game_freeze_before_write
 before insert or update or delete on public.event_games
 for each row execute function public.contract_freeze_before_roster_change();
create trigger contract_group_freeze_before_write
 before insert or update or delete on public.event_groups
 for each row execute function public.contract_freeze_before_roster_change();

revoke all on function public.contract_freeze_before_roster_change() from public,anon,authenticated,service_role;
commit;
