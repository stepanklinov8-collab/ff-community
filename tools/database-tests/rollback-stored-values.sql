-- Manual rollback for 202611110002. No sporting or wallet data is removed.
-- Read-time price calculation is restored; use only on an installed migration.
begin;
do $$declare table_name text;begin
 foreach table_name in array array['profiles','teams','team_members','competition_ratings','competition_publications',
  'competition_player_facts','competition_team_facts','player_stats','organization_participation_history',
  'competition_award_entries','competition_game_forecasts','rating_event_settings','events','event_sessions','event_games','economy_settings'] loop
  execute format('drop trigger stored_economy_source on public.%I',table_name);
 end loop;
end $$;
drop trigger stored_economy_values_flush on public.economy_value_refresh_queue;
drop function public.u8_flush_economy_values(),public.u8_economy_source_changed();
drop function public.u8_queue_economy_values(boolean,boolean,uuid[],uuid[]),public.u8_refresh_economy_values(boolean,boolean,uuid[],uuid[]);
drop function public.u5_player_value_exact(uuid),public.u5_organization_value_exact(uuid);
alter function public.u8_calculate_player_value(uuid) rename to u5_player_value_exact;
alter function public.u8_calculate_organization_value(uuid) rename to u5_organization_value_exact;
grant execute on function public.u5_player_value_exact(uuid),public.u5_organization_value_exact(uuid) to service_role;
drop table public.economy_value_refresh_queue,public.economy_value_cache;
notify pgrst,'reload schema';
commit;
