begin;
create or replace function public.recalculate_organization_results(p_team_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare weighted_score numeric:=0; total_weight numeric:=0; confidence numeric:=0;
 result_value numeric:=1;
begin
 select coalesce(sum(greatest(1,least(100,100-(h.place-1)*9+least(coalesce(h.kills,0),30)*.5))
    *coalesce(res.hidden_coefficient,case when h.mode='training' then .20 else 1 end)),0),
  coalesce(sum(coalesce(res.hidden_coefficient,case when h.mode='training' then .20 else 1 end)),0)
 into weighted_score,total_weight
 from public.organization_participation_history h
 left join public.rating_event_settings res on res.event_id=h.event_id
 left join public.events e on e.id=h.event_id
 where h.organization_id=p_team_id and h.mode in('tournament','training')
  and h.result_status='completed' and h.place is not null and coalesce((e.competition_rules->>'ratingEnabled')::boolean,true);
 if total_weight>0 then
  confidence:=least(1,total_weight/5);
  result_value:=greatest(1,least(100,1+((weighted_score/total_weight)-1)*confidence));
 end if;
 update public.teams set results_score=round(result_value,2) where id=p_team_id;
 perform public.recalculate_organization_rating(p_team_id);
 return round(result_value,2);
end $$;
-- Compare the full personal rating even when its one-decimal display stays unchanged.
create or replace function public.u2_exact_player_rating_changed() returns trigger language plpgsql security definer set search_path=public as $$
declare team_id_value uuid;
begin
 if new.target_type='player' and new.mode='main' then
 if tg_op='INSERT' or new.exact_rating is distinct from old.exact_rating then
 for team_id_value in select team_id from public.team_members where user_id=new.target_id loop perform public.recalculate_organization_rating(team_id_value);end loop;end if;end if;
 return new;
end $$;
create trigger u2_exact_player_rating_changed after insert or update of exact_rating on public.competition_ratings for each row execute function public.u2_exact_player_rating_changed();
-- All site bets must use an expiring concrete-game quote with the same current checks.
create or replace function public.place_site_bet_for(p_user_id uuid,p_market_id uuid,p_stake bigint) returns uuid
language plpgsql security definer set search_path=public as $$
begin raise exception 'Используйте подтверждение актуальной котировки конкретной игры';end $$;
revoke all on function public.u2_exact_player_rating_changed(),public.place_site_bet_for(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.place_site_bet_for(uuid,uuid,bigint) to service_role;
commit;
