begin;

alter table public.teams alter column main_rating set default 0;

alter table public.teams drop constraint if exists teams_main_rating_range;
alter table public.teams add constraint teams_main_rating_range check(main_rating between 0 and 999);

create or replace function public.u4_legacy_cost_for_target(p_target_type text,p_target_id uuid,p_mode text default 'main')
returns numeric language sql stable security definer set search_path=public as $$
with player_rows as (
 select f.user_id target_id,f.session_id::text session_key,f.session_id,f.mode,
   greatest(0,f.kills)::numeric kills,greatest(0,coalesce(f.deaths,0))::numeric deaths,
   f.deaths is not null has_deaths,f.place,f.field_size,
   least(2,greatest(.1,coalesce(rs.hidden_coefficient,case when e.type='training' then .20 when e.type='solo' then .70 else 1 end)))::numeric event_weight,
   public.u2_session_winner(f.session_id,f.team_id,f.user_id)::integer session_win
 from public.competition_player_facts f
 join public.event_sessions s on s.id=f.session_id
 join public.events e on e.id=s.event_id
 left join public.rating_event_settings rs on rs.event_id=e.id
 where p_mode='main' and p_target_type='player' and f.user_id=p_target_id and f.mode in('tournament','training')
 union all
 select h.target_id,coalesce(h.session_id::text,'legacy:'||h.id::text),h.session_id,h.mode,
   greatest(0,coalesce(h.kills,0))::numeric,greatest(0,coalesce(h.kills,0))::numeric,false,null::integer,8::integer,
   least(2,greatest(.1,coalesce(rs.hidden_coefficient,case when e.type='training' then .20 else 1 end)))::numeric,0
 from public.competition_public_history h
 left join public.events e on e.id=h.event_id
 left join public.rating_event_settings rs on rs.event_id=h.event_id
 where p_mode='main' and p_target_type='player' and h.target_id=p_target_id
   and h.target_type='player' and h.source like 'legacy%' and h.source<>'legacy_unassigned'
   and h.mode in('tournament','training')
), session_scores as (
 select target_id,session_key,max(event_weight) event_weight,
   sum(kills) kills,sum(deaths) deaths,bool_or(has_deaths) has_deaths,
   sum(case when has_deaths then 1 else 0 end)::numeric deaths_rows,
   count(*)::numeric games,
   avg(case when place between 1 and field_size and field_size>=2 then (field_size-place)::numeric/(field_size-1) else .5 end) place_score,
   max(session_win)::numeric win_score,
   avg(least(1,sqrt(greatest(2,field_size)::numeric/8))) field_score
 from player_rows group by target_id,session_key
), utility as (
 select target_id,
   sum(event_weight)::numeric weighted_sessions,
   sum(event_weight*(
     .40*(.65*least(1,(case when has_deaths then kills/greatest(1,deaths) else kills/greatest(1,games) end)/2)+.35*least(1,(kills/greatest(1,games))/8))
     +.25*place_score+.20*win_score+.15*field_score
   ))/greatest(.0001,sum(event_weight)) performance
 from session_scores group by target_id
), profile_values as (
 select coalesce(p.main_rating,1)::numeric rating,coalesce(p.reputation_score,50)::numeric reputation
 from public.profiles p where p.id=p_target_id
), player_cost as (
 select greatest(0,round(1000*(
   .70*u.performance+.20*greatest(0,least(999,rating))/999+.10*greatest(0,least(100,reputation))/100
 )*(1-exp(-u.weighted_sessions/3.5))*(1+.25*ln(1+u.weighted_sessions))/100,2))::numeric cost
 from utility u cross join profile_values
 where p_target_type='player' and u.target_id=p_target_id
), organization_cost as (
 select greatest(0,round(
   (coalesce(m.member_cost,0)*(1.75+.60*q.quality+.20*least(1,coalesce(m.member_count,0)/4))
   +1500*(.50+q.quality)*(.60+.40*q.confidence)*(1+.20*ln(1+q.weighted_sessions)))/100,2
 ))::numeric cost
 from (
   select t.id target_id,
     greatest(0,least(999,coalesce(t.main_rating,0)))::numeric rating,
     greatest(0,least(100,coalesce(t.results_score,1)))::numeric results,
     greatest(0,least(100,coalesce(t.achievements_score,1)))::numeric achievements,
     greatest(0,least(100,coalesce(t.reputation_score,50)))::numeric reputation
   from public.teams t where t.id=p_target_id
 ) o
 left join (
   select tm.team_id,count(*)::numeric member_count,
     coalesce(sum(public.u4_legacy_cost_for_target('player',tm.user_id,'main')),0)::numeric member_cost,
     coalesce(avg(greatest(0,least(999,coalesce(p.main_rating,0)))/999),0)::numeric member_rating,
     coalesce(avg(greatest(0,least(100,p.reputation_score))/100),0)::numeric member_reputation
   from public.team_members tm join public.profiles p on p.id=tm.user_id
   where tm.team_id=p_target_id group by tm.team_id
 ) m on true
 left join (
   select h.target_id,
     sum(h.event_weight)::numeric weighted_sessions,
     sum(h.event_weight*h.session_win)/greatest(.0001,sum(h.event_weight))::numeric session_win_rate
   from (
     select h.target_id,coalesce(h.session_id::text,'legacy:'||h.id::text) session_key,
       max(least(2,greatest(.1,coalesce(rs.hidden_coefficient,case when e.type='training' then .20 when e.type='solo' then .70 else 1 end))))::numeric event_weight,
       max(greatest(0,coalesce(h.wins,0)))::numeric session_win
     from public.competition_public_history h
     left join public.events e on e.id=h.event_id
     left join public.rating_event_settings rs on rs.event_id=h.event_id
     where h.target_type='team' and h.target_id=p_target_id and h.source<>'legacy_unassigned'
       and h.mode in('tournament','training')
     group by h.target_id,coalesce(h.session_id::text,'legacy:'||h.id::text)
   ) h group by h.target_id
 ) s on s.target_id=o.target_id
 cross join lateral (
   select greatest(0,least(1,
     .25*o.rating/999+.15*o.results/100+.15*o.achievements/100+.15*o.reputation/100
     +.15*coalesce(m.member_rating,0)+.10*coalesce(m.member_reputation,0)
     +.10*coalesce(s.session_win_rate,0)
   ))::numeric quality,
   (1-exp(-coalesce(s.weighted_sessions,0)/4.5))::numeric confidence,
   coalesce(s.weighted_sessions,0)::numeric weighted_sessions
 ) q
 where p_mode='main' and p_target_type='team' and coalesce(s.weighted_sessions,0)>0
)
select case when p_target_type='team' then coalesce((select cost from organization_cost),0)
 else coalesce((select cost from player_cost),0) end;
$$;

-- An event coefficient change must also recalculate teams recorded directly
-- in normalized game facts, even when no legacy organization row exists.

-- A rating-derived price is evaluated at full precision; only the public total is rounded.
create or replace function public.u5_utility_price(p_value numeric,p_max numeric default 93737550)
returns numeric language sql immutable set search_path=public as $$
 select p_max * ((1/(1+exp(-.04*(least(500,greatest(0,p_value))-302.0118626182226))))
 -(1/(1+exp(-.04*(0-302.0118626182226))))) /
 ((1/(1+exp(-.04*(500-302.0118626182226))))-(1/(1+exp(-.04*(0-302.0118626182226)))))
$$;
create or replace function public.u5_whole_bonus_price(n integer) returns numeric
language sql immutable set search_path=public as $$
 select case when n<=0 then 0 when n=1 then 100 when n=2 then 101 when n=3 then 102.1
 when n>=499 then 6262450 else 104+1.9*1.0229029653718915*(power(1.0229029653718915,n-4)-1)/(.0229029653718915) end
$$;
create or replace function public.u5_bonus_price(p_value numeric,p_max numeric default 6262450)
returns numeric language sql immutable set search_path=public as $$
 with value as(select least(499,greatest(0,p_value)) x), parts as(select floor(x)::integer n,x-floor(x) d from value)
 select p_max * (public.u5_whole_bonus_price(n)*(1-d)+public.u5_whole_bonus_price(least(499,n+1))*d) / 6262450 from parts
$$;
create or replace function public.u5_prize_price(p_prizes numeric) returns numeric
language sql immutable set search_path=public as $$select 4000*(sqrt(1+greatest(0,p_prizes)/10000)-1)$$;

-- Only published, explicitly entered prizes count; historical missing amounts stay zero.
-- Multi-stage tournament prize allocation is deliberately deferred.
create or replace function public.u5_session_prizes_allowed(p_session uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce((select e.type='training' or (e.type='tournament'
   and s.source_session_id is null and s.stage not in('qualification','semifinal')
   and not exists(select 1 from event_sessions other where other.event_id=e.id and other.status<>'cancelled'
     and (other.source_session_id is not null or other.stage in('qualification','semifinal'))))
 from event_sessions s join events e on e.id=s.event_id where s.id=p_session),false)
$$;
create or replace function public.u5_confirmed_prizes()
returns table(session_id uuid,team_id uuid,registration_id uuid,amount numeric,weight numeric)
language sql stable security definer set search_path=public as $$
 select cp.session_id,(st->>'teamId')::uuid,(prize->>'registrationId')::uuid,(prize->>'amount')::numeric,
   coalesce(rs.hidden_coefficient,case when e.type='training' then 1 else 1.2 end)
 from competition_publications cp join event_sessions s on s.id=cp.session_id join events e on e.id=s.event_id
 left join rating_event_settings rs on rs.event_id=e.id
 cross join lateral jsonb_array_elements(coalesce(cp.published->'prizes','[]'::jsonb)) prize
 cross join lateral jsonb_array_elements(coalesce(cp.published->'standings','[]'::jsonb)) st
 where cp.first_published_at is not null and s.status<>'cancelled' and e.cancelled_at is null
   and public.u5_session_prizes_allowed(s.id) and st->>'registrationId'=prize->>'registrationId'
   and st->>'teamId' is not null and (st->>'gamesPlayed')::integer>0 and (prize->>'amount')::numeric>0
$$;
create or replace function public.u5_player_prizes(p_user uuid) returns numeric
language sql stable security definer set search_path=public as $$
 with prizes as(select * from public.u5_confirmed_prizes()), contributions as (
 select p.session_id,p.registration_id,p.amount,p.weight,coalesce(player->>'userId',player->>'id') player_key,
   player->>'userId' user_id,sum((player->>'kills')::numeric) kills
 from prizes p join competition_publications cp on cp.session_id=p.session_id
 cross join lateral jsonb_array_elements(cp.published->'rows') row
 cross join lateral jsonb_array_elements(coalesce(row->'players','[]'::jsonb)) player
 where public.u4_complete_rating_session(p.session_id) and row->>'registrationId'=p.registration_id::text
   and (row->>'played')::boolean and (player->>'played')::boolean
 group by p.session_id,p.registration_id,p.amount,p.weight,coalesce(player->>'userId',player->>'id'),player->>'userId'
 ), totals as (
 select *,sum(kills) over(partition by session_id,registration_id) total_kills,
 count(*) over(partition by session_id,registration_id) participants from contributions
 ) select coalesce(sum(amount*weight*case when total_kills>0 then kills/total_kills else 1::numeric/participants end),0)
 from totals where user_id=p_user::text
$$;
create or replace function public.u5_organization_placement_bonus(p_team uuid) returns numeric
language sql stable security definer set search_path=public as $$
 with placements as (
 select s.id,coalesce(st->>'groupId','ungrouped') group_key,
 max(case when e.type='training' or not public.u2_session_has_single_group(s.id)
     or s.stage in('qualification','semifinal') or (e.final_session_id is not null and s.id<>e.final_session_id)
   then case (st->>'place')::integer when 1 then .10 when 2 then .05 when 3 then .03 else 0 end
   else case (st->>'place')::integer when 1 then .30 when 2 then .20 when 3 then .10 else 0 end end) bonus
 from competition_publications cp join event_sessions s on s.id=cp.session_id join events e on e.id=s.event_id
 cross join lateral jsonb_array_elements(coalesce(cp.published->'standings','[]'::jsonb)) st
 where cp.first_published_at is not null and s.status<>'cancelled' and e.cancelled_at is null
   and e.type in('training','tournament') and coalesce((e.competition_rules->>'ratingEnabled')::boolean,true)
   and st->>'teamId'=p_team::text and (st->>'gamesPlayed')::integer>0
 group by s.id,coalesce(st->>'groupId','ungrouped')
 ) select coalesce(sum(bonus),0) from placements
$$;
create or replace function public.u5_organization_components(p_team uuid)
returns table(base numeric,performance numeric,achievements numeric,prizes numeric,bonus numeric,games integer,wins integer,kills integer)
language sql stable security definer set search_path=public as $$
 with roster as (
 select coalesce(sum(value),0)/4 base from(select r.exact_rating value from team_members tm
 join competition_ratings r on r.target_type='player' and r.target_id=tm.user_id and r.mode='main'
 where tm.team_id=p_team order by r.exact_rating desc,tm.user_id limit 4) best
 ), fields as (
 select f.game_id,count(*) n from competition_team_facts f where f.played and f.mode in('training','tournament') group by f.game_id
 ), played as (
 select f.*,coalesce(rs.hidden_coefficient,case when f.mode='training' then 1 else 1.2 end) weight,
   (fld.n-f.place)::numeric/(fld.n-1) actual,
   fc.expected_place forecast
 from competition_team_facts f join fields fld on fld.game_id=f.game_id and fld.n>=2
 join event_games g on g.id=f.game_id and g.status<>'cancelled'
 join event_sessions s on s.id=f.session_id and s.status<>'cancelled'
 join events e on e.id=s.event_id and e.cancelled_at is null
 join competition_publications cp on cp.session_id=s.id and cp.first_published_at is not null
 left join rating_event_settings rs on rs.event_id=e.id
 left join competition_game_forecasts fc on fc.game_id=f.game_id and fc.team_id=f.team_id
 where f.team_id=p_team and f.played and f.mode in('training','tournament') and f.place between 1 and fld.n
   and coalesce((e.competition_rules->>'ratingEnabled')::boolean,true)
 ), grouped as (
 select weight,power(avg(sqrt(greatest(0,actual*(1+greatest(-1,least(1,actual-coalesce(forecast,actual))))))),2) q
 from played group by weight
 ), totals as (
 select count(*)::integer games,coalesce(sum(kills),0)::integer kills,
 count(distinct session_id) filter(where public.u2_session_winner(session_id,team_id,null))::integer wins from played
 ), components as (
 select r.base,case when t.games>=10 then r.base*coalesce((select avg(weight*q) from grouped),0) else 0 end performance,
   public.u5_organization_placement_bonus(p_team)+public.u3_award_bonus('team',p_team) achievements,
   coalesce((select sum(amount) from public.u5_confirmed_prizes() where team_id=p_team),0) prizes,t.games,t.wins,t.kills
 from roster r cross join totals t
 ) select base,performance,achievements,prizes,least(499,performance+achievements+sqrt(prizes/1000)),games,wins,kills from components
$$;
create or replace function public.recalculate_organization_rating(p_team_id uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare c record;rating numeric;
begin
 if not exists(select 1 from public.teams where id=p_team_id) then
  delete from public.competition_ratings where target_type='team' and target_id=p_team_id and mode='main';return null;
 end if;
 select * into c from public.u5_organization_components(p_team_id);
 rating:=least(999,greatest(0,c.base+c.bonus));
 insert into public.competition_ratings(target_type,target_id,mode,exact_rating,display_rating,wins,games,kills)
 values('team',p_team_id,'main',rating,round(rating),c.wins,c.games,c.kills)
 on conflict(target_type,target_id,mode) do update set exact_rating=excluded.exact_rating,display_rating=excluded.display_rating,
 wins=excluded.wins,games=excluded.games,kills=excluded.kills,updated_at=now();
 update public.teams set main_rating=round(rating) where id=p_team_id;
 return rating;
end $$;
create or replace function public.u5_player_value_exact(p_user uuid) returns numeric
language sql stable security definer set search_path=public as $$
 with score as (
 select coalesce((select exact_rating from competition_ratings where target_type='player' and target_id=p_user and mode='main'),0) rating,
 case when exists(select 1 from competition_ratings where target_type='player' and target_id=p_user and mode='main')
 then least(499,public.u4_placement_bonus(p_user)+public.u3_award_bonus('player',p_user)) else 0 end bonus
 ) select public.u5_utility_price(greatest(0,rating-bonus))+public.u5_bonus_price(bonus)
   +public.u5_prize_price(public.u5_player_prizes(p_user)) from score
$$;
create or replace function public.u5_organization_value_exact(p_team uuid) returns numeric
language sql stable security definer set search_path=public as $$
 select coalesce((select sum(public.u5_player_value_exact(tm.user_id)) from team_members tm where tm.team_id=p_team),0)
 +(1+coalesce(round(least(999,c.base+c.bonus))/nullif((select sum(greatest(0,coalesce(main_rating,0))) from teams),0),0))
 *(public.u5_utility_price(c.base,700000000)+public.u5_bonus_price(c.bonus,300000000))
 +public.u5_prize_price(c.prizes) from public.u5_organization_components(p_team) c
$$;
create or replace function public.u2_cost_for_target(p_target_type text,p_target_id uuid,p_mode text default 'main')
returns numeric language sql stable security definer set search_path=public as $$
 select case when p_mode<>'main' then public.u4_legacy_cost_for_target(p_target_type,p_target_id,p_mode)
 when p_target_type='player' then round(public.u5_player_value_exact(p_target_id))
 when p_target_type='team' then round(public.u5_organization_value_exact(p_target_id)) else 0 end
$$;

-- Protect helper formulas; only existing authenticated server endpoints expose totals.
do $$ declare signature regprocedure; begin
 for signature in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'u5_%' or p.proname='u4_legacy_cost_for_target') loop
  execute format('revoke all on function %s from public,anon,authenticated',signature);
  execute format('grant execute on function %s to service_role',signature);
 end loop;
end $$;
update public.economy_settings set currency_name='OMCITE Coins' where singleton;

-- Preserve the existing award eligibility cutoff. Only organizational series use the agreed fixed amounts.
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.u3_awards_for_target(text,uuid)'::regprocedure);
 if strpos(definition,'.5*weight*least(3,1+.25*(streak-1))')=0 then raise exception 'Unexpected award function; review migration';end if;
 definition:=replace(definition,'.5*weight*least(3,1+.25*(streak-1))',
 '(case when p_type=''team'' then case when mode=''training'' then .10 else .50 end else .5*weight end)*least(3,1+.25*(streak-1))');
 execute definition;
end $$;

-- Rebuild rating history without rewriting sporting facts or wallet entries.
do $$ declare entity uuid;begin
 delete from public.competition_ratings r where r.target_type='team' and not exists(select 1 from public.teams t where t.id=r.target_id);
 for entity in select id from public.profiles loop perform public.recalculate_player_rating(entity);end loop;
 for entity in select id from public.teams loop perform public.recalculate_organization_rating(entity);end loop;
end $$;
commit;
