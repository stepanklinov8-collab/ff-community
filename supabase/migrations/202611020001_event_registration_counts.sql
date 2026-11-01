begin;
-- Aggregate counts without loading historical rosters or identities into the API.
create function public.u5_event_registration_counts(p_event uuid)
returns table(session_id uuid,registered bigint,waiting bigint,capacity integer)
language sql stable security definer set search_path=public as $$
 select s.id,count(r.id) filter(where r.status='confirmed'),count(r.id) filter(where r.status='waiting'),coalesce(s.max_teams,e.max_teams)
 from event_sessions s join events e on e.id=s.event_id
 left join event_registrations r on r.session_id=s.id and r.event_id=e.id and r.status in('confirmed','waiting')
 where s.event_id=p_event group by s.id,s.max_teams,e.max_teams;
$$;
revoke all on function public.u5_event_registration_counts(uuid) from public,anon,authenticated;
grant execute on function public.u5_event_registration_counts(uuid) to service_role;
commit;
