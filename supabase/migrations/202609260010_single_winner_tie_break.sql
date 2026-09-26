begin;

-- Equal displayed places remain valid (for example solo kills: 1, 1, 3),
-- but only the first published place-1 row is the session winner.
create or replace function public.u2_session_winner(p_session uuid,p_team_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select public.u2_session_has_single_group(p_session) and exists(
  select 1
  from public.competition_publications cp
  cross join lateral (
   select items.standing
   from jsonb_array_elements(coalesce(cp.published->'standings','[]'::jsonb)) with ordinality as items(standing,position)
   where items.standing->>'place'='1'
   order by items.position
   limit 1
  ) winner
  where cp.session_id=p_session
    and cp.first_published_at is not null
    and (
      (p_team_id is not null and winner.standing->>'teamId'=p_team_id::text)
      or (p_user_id is not null and winner.standing->>'userId'=p_user_id::text)
    )
 )
$$;
revoke all on function public.u2_session_winner(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.u2_session_winner(uuid,uuid,uuid) to service_role;

do $$ declare player_id uuid; team_id uuid;
begin
 for player_id in select id from public.profiles loop
  perform public.recalculate_player_rating(player_id);
 end loop;
 for team_id in select id from public.teams loop
  perform public.recalculate_organization_results(team_id);
 end loop;
end $$;

commit;
