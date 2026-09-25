-- Run on the staging copy first, and on production only during the approved release.
-- Idempotent projection rebuild. Does not publish results, settle bets or invent history.
begin;
select pg_advisory_xact_lock(hashtextextended('competition-publication',0));
do $$
declare target uuid;
begin
 for target in select id from public.profiles order by id loop
  perform public.u2_recalculate_reputation('player',target);
  perform public.u2_recalculate_solo(target);
 end loop;
 for target in select id from public.teams order by id loop
  perform public.u2_recalculate_reputation('team',target);
  perform public.recalculate_organization_results(target);
 end loop;
 perform public.u2_rebuild_duel_ratings('bo');
 perform public.u2_rebuild_duel_ratings('kv');
end $$;
commit;
