begin;
-- Leaving a main-rating mode must remove the old contribution immediately.
create or replace function public.refresh_organization_rating_from_history()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' then
  if old.organization_id is not null and old.mode in('tournament','training') then
   perform public.recalculate_organization_results(old.organization_id);
  end if;
 else
  if new.organization_id is not null and new.mode in('tournament','training') then
   perform public.recalculate_organization_results(new.organization_id);
  end if;
  if tg_op='UPDATE' and (old.organization_id is distinct from new.organization_id or old.mode is distinct from new.mode)
   and old.organization_id is not null and old.mode in('tournament','training') then
   perform public.recalculate_organization_results(old.organization_id);
  end if;
 end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function public.refresh_organization_rating_from_history() from public,anon,authenticated;
commit;
