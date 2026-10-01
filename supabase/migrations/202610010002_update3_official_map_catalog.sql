begin;

alter table public.event_games drop constraint if exists event_games_map_name_check;
alter table public.event_games add constraint event_games_map_name_check check(map_name in('bermuda','bermuda_remastered','nexterra','alpine','solara','purgatory','kalahari'));

-- Earlier releases kept the same allowlist inside two security-definer RPCs.
-- Rebuild their existing definitions with the expanded official map catalog so
-- direct API calls and the event editor enforce the same set of values.
do $$
declare definition text;
begin
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='u2_war_games_init' limit 1;
  if definition is not null then
    definition:=replace(definition, 'array[''bermuda'',''nexterra'',''solara'',''purgatory'',''kalahari'']::text[]', 'array[''bermuda'',''bermuda_remastered'',''nexterra'',''alpine'',''solara'',''purgatory'',''kalahari'']::text[]');
    execute definition;
  end if;
  select pg_get_functiondef(p.oid) into definition
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='u2_war_configuration' limit 1;
  if definition is not null then
    definition:=replace(definition, 'array[''bermuda'',''nexterra'',''solara'',''purgatory'',''kalahari'']::text[]', 'array[''bermuda'',''bermuda_remastered'',''nexterra'',''alpine'',''solara'',''purgatory'',''kalahari'']::text[]');
    execute definition;
  end if;
end $$;

commit;
