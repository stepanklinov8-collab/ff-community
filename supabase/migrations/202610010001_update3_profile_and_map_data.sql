begin;

alter table public.profiles
  add column if not exists player_roles text[] not null default '{}',
  add column if not exists contact_social_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='profiles_player_roles_allowed') then
    alter table public.profiles add constraint profiles_player_roles_allowed
      check (player_roles <@ array['sniper','rifleman','entry','grenadier','machine_gunner','healer']::text[]);
  end if;
end;
$$;

alter table public.competition_team_facts
  add column if not exists landing_location text;

create or replace function public.u3_fill_team_landing_location()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  select row->>'landingLocation' into new.landing_location
  from public.competition_publications publication,
       jsonb_array_elements(coalesce(publication.published->'rows','[]'::jsonb)) row
  where publication.session_id = new.session_id
    and (row->>'gameId')::uuid = new.game_id
    and (row->>'teamId')::uuid = new.team_id
  limit 1;
  return new;
end;
$$;

drop trigger if exists u3_fill_team_landing_location_trigger on public.competition_team_facts;
create trigger u3_fill_team_landing_location_trigger
before insert or update on public.competition_team_facts
for each row execute function public.u3_fill_team_landing_location();

commit;
