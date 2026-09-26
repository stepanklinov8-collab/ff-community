begin;

-- Keep organization ratings and session status synchronized with every
-- published/corrected competition publication. The publication RPC writes
-- facts and history in the same transaction, so a deferred trigger performs
-- the final reconciliation after all those rows are visible.
create or replace function public.u2_recalculate_session_organization_ratings(p_session uuid)
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  organization_id_value uuid;
  recalculated integer:=0;
begin
  if not exists(
    select 1 from public.competition_publications
    where session_id=p_session and first_published_at is not null
  ) then
    return 0;
  end if;

  for organization_id_value in
    select distinct organization_id
    from (
      select team_id as organization_id
      from public.competition_team_facts
      where session_id=p_session and team_id is not null
      union
      select team_id
      from public.event_registrations
      where session_id=p_session and team_id is not null
      union
      select organization_id
      from public.organization_participation_history
      where session_id=p_session and organization_id is not null
    ) organizations
  loop
    perform public.recalculate_organization_results(organization_id_value);
    recalculated:=recalculated+1;
  end loop;

  update public.event_sessions
  set status='completed',updated_at=now()
  where id=p_session and status<>'cancelled';

  return recalculated;
end
$$;
revoke all on function public.u2_recalculate_session_organization_ratings(uuid) from public,anon,authenticated;
grant execute on function public.u2_recalculate_session_organization_ratings(uuid) to service_role;

create or replace function public.u2_deferred_publication_rating_reconciliation()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.first_published_at is not null then
    perform public.u2_recalculate_session_organization_ratings(new.session_id);
  end if;
  return new;
end
$$;
revoke all on function public.u2_deferred_publication_rating_reconciliation() from public,anon,authenticated;
grant execute on function public.u2_deferred_publication_rating_reconciliation() to service_role;

drop trigger if exists u2_deferred_publication_rating_reconciliation_trigger on public.competition_publications;
create constraint trigger u2_deferred_publication_rating_reconciliation_trigger
after insert or update of first_published_at,published on public.competition_publications
deferrable initially deferred
for each row execute function public.u2_deferred_publication_rating_reconciliation();

-- Repair publications created before this reconciliation was introduced.
do $$
declare
  session_id_value uuid;
begin
  for session_id_value in
    select session_id from public.competition_publications where first_published_at is not null
  loop
    perform public.u2_recalculate_session_organization_ratings(session_id_value);
  end loop;
end
$$;

commit;
