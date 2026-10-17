begin;
create or replace function public.u4_placement_bonus(p_user_id uuid) returns numeric
language sql stable security definer set search_path=public as $$
 with eligible as (
  select s.id session_id,case when e.type='training' or not public.u2_session_has_single_group(s.id)
    or s.stage in('qualification','semifinal')
    or e.final_session_id is not null and s.id<>e.final_session_id
   then case (standing->>'place')::integer when 1 then .10 when 2 then .05 when 3 then .03 else 0 end
   else case (standing->>'place')::integer when 1 then .30 when 2 then .20 when 3 then .10 else 0 end end bonus
  from public.competition_publications cp
  join public.event_sessions s on s.id=cp.session_id
  join public.events e on e.id=s.event_id
  cross join lateral jsonb_array_elements(coalesce(cp.published->'standings','[]'::jsonb)) standing
  where cp.first_published_at is not null and s.status<>'cancelled'
    and e.type in('training','tournament') and coalesce((e.competition_rules->>'ratingEnabled')::boolean,true)
    and public.u4_complete_rating_session(s.id)
    and standing->>'teamId' is not null and (standing->>'gamesPlayed')::integer>0
    and (standing->>'place')::integer between 1 and 3
    and exists(select 1 from public.competition_player_facts f where f.session_id=s.id
      and f.team_id=(standing->>'teamId')::uuid and f.user_id=p_user_id)
 ), once_per_session as (
  select session_id,max(bonus) bonus from eligible group by session_id
 ) select coalesce(sum(bonus),0) from once_per_session
$$;
commit;
