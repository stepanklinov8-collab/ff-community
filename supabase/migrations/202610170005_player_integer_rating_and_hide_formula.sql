begin;

-- Keep exact values for internal calculations and expose an integer rating.
-- Recalculate the full history so stored display values use the new precision.
create or replace function public.recalculate_player_rating(p_user_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare game_count integer;wins_count integer;kills_count integer;personal_kills numeric;
 weighted_mean numeric;bonus numeric;rating numeric;
begin
 with complete as (
  select distinct f.session_id from public.competition_player_facts f
  where f.user_id=p_user_id and public.u4_complete_rating_session(f.session_id)
 ), field as (
  select f.game_id,count(*)::integer n,sum(f.kills)::numeric all_kills
  from public.competition_team_facts f join complete c on c.session_id=f.session_id
  where f.played group by f.game_id
 ), games as (
  select f.session_id,f.game_id,f.team_id,f.kills::numeric personal,tf.kills::numeric team_kills,
    field.all_kills,field.n,tf.place,
    coalesce(rs.hidden_coefficient,case when f.mode='training' then 1 when f.mode='tournament' then 1.2 else 1 end)::numeric coefficient,
    greatest(-1,least(1,(field.n-tf.place)::numeric/(field.n-1)-coalesce(fc.expected_place,(field.n-tf.place)::numeric/(field.n-1)))) d
  from public.competition_player_facts f join complete c on c.session_id=f.session_id
  join public.competition_team_facts tf on tf.game_id=f.game_id and tf.team_id=f.team_id and tf.played
  join field on field.game_id=f.game_id and field.n>=2
  join public.event_sessions s on s.id=f.session_id join public.events e on e.id=s.event_id
  left join public.rating_event_settings rs on rs.event_id=e.id
  left join public.competition_game_forecasts fc on fc.game_id=f.game_id and fc.team_id=f.team_id
  where f.user_id=p_user_id and f.mode in('training','tournament')
    and tf.place between 1 and field.n and coalesce((e.competition_rules->>'ratingEnabled')::boolean,true)
 ), shares as (
  select coefficient,personal,session_id,team_id,d,
    coalesce(personal/nullif(all_kills,0),0) global_share,
    case when personal=0 and team_kills=0 then .25 else coalesce(personal/nullif(team_kills,0),0) end team_share,
    (case when place=1 then n+1 else n+1-place end)::numeric z
  from games
 ), scored as (
  select coefficient,personal,session_id,team_id,
    (global_share+team_share)+(global_share+team_share)*z*(1+d) a
  from shares
 ), grouped as (
  select coefficient,avg(coalesce(a,0)) average_a from scored group by coefficient
 )
 select (select count(*) from scored),(select coalesce(sum(personal),0) from scored),
    (select coalesce(sum(coefficient*average_a)/nullif(count(*),0),0) from grouped)
 into game_count,personal_kills,weighted_mean;

 select count(distinct f.session_id) filter(where public.u2_session_winner(f.session_id,f.team_id,f.user_id)),
   coalesce(sum(f.kills),0) into wins_count,kills_count
 from public.competition_player_facts f
 where f.user_id=p_user_id and f.mode in('training','tournament')
   and public.u4_complete_rating_session(f.session_id);

 if game_count<10 then
  delete from public.competition_ratings where target_type='player' and target_id=p_user_id and mode='main';
  update public.profiles set main_rating=null where id=p_user_id;
  return null;
 end if;
 bonus:=least(499,public.u4_placement_bonus(p_user_id)+public.u3_award_bonus('player',p_user_id));
 rating:=greatest(0,least(999,(personal_kills/game_count)*weighted_mean+bonus));
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills)
 values('player',p_user_id,'main',rating,round(rating),wins_count,game_count,kills_count)
 on conflict(target_type,target_id,mode) do update set exact_rating=excluded.exact_rating,
 display_rating=excluded.display_rating,wins=excluded.wins,games=excluded.games,kills=excluded.kills,updated_at=now();
 update public.profiles set main_rating=round(rating) where id=p_user_id;
 return rating;
end $$;

do $$ declare player_id uuid; begin
 for player_id in select id from public.profiles loop
  perform public.recalculate_player_rating(player_id);
 end loop;
end $$;

commit;
