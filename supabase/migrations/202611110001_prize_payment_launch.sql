-- OMCITE coin prizes start with performances from 9 November, Moscow time.
-- Result publication time must never make an earlier performance payable.
begin;
create function public.u7_prize_launch_at() returns timestamptz
language sql immutable set search_path=public as $$ select timestamptz '2026-11-09 00:00:00+03' $$;
create function public.u7_session_prizes_payable(p_session uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce((select s.start_time>=public.u7_prize_launch_at() from public.event_sessions s where s.id=p_session),false)
$$;
create function public.u7_personal_prizes_payable(p_event uuid,p_session uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select case when p_session is not null then exists(
  select 1 from public.event_sessions s where s.id=p_session and s.event_id=p_event and s.start_time>=public.u7_prize_launch_at())
 else coalesce((select min(s.start_time)>=public.u7_prize_launch_at() from public.event_sessions s where s.event_id=p_event and s.status<>'cancelled'),false) end
$$;

-- Patch the existing functions in place, preserving their ACLs and all existing
-- funding, publication, contract and cancellation rules. Patch the base podium
-- mover too: explicit administrative closure can bypass the ordinary wrapper.
do $$declare signature regprocedure;definition text;guard text;begin
 for signature,guard in select * from (values
  ('public.u6_reserve_session_prizes(uuid)'::regprocedure,
   'if not public.u7_session_prizes_payable(p_session) then return;end if;'),
  ('public.u6_settle_session_prizes(uuid,jsonb,uuid,boolean)'::regprocedure,
   'if not public.u7_session_prizes_payable(p_session) and (p_cancel is not true or p_awards is distinct from ''[]''::jsonb) then return;end if;'),
  ('public.u6_settle_prizes_before_contracts(uuid,jsonb,uuid,boolean)'::regprocedure,
   'if not public.u7_session_prizes_payable(p_session) and (p_cancel is not true or p_awards is distinct from ''[]''::jsonb) then return;end if;'),
  ('public.contract_session_prize_settle(uuid)'::regprocedure,
   'if not public.u7_session_prizes_payable(p_session) then return jsonb_build_object(''ready'',true,''prepared'',0,''pendingOrganizations'',0,''reason'',''before_prize_launch'');end if;'),
  ('public.personal_award_reserve(uuid,uuid)'::regprocedure,
   'if not public.u7_personal_prizes_payable(p_event,p_session) then return;end if;'),
  ('public.personal_award_settle(uuid,boolean)'::regprocedure,
   'if exists(select 1 from public.personal_award_funds launch_fund where launch_fund.id=p_fund and not public.u7_personal_prizes_payable(launch_fund.event_id,launch_fund.session_id)) then return jsonb_build_object(''pending'',0,''paid'',0,''reason'',''before_prize_launch'');end if;')
 ) patches(signature,guard) loop
  definition:=pg_get_functiondef(signature);
  if position('u7_' in definition)>0 then raise exception 'PRIZE_LAUNCH_ALREADY_PATCHED';end if;
  if not definition~*E'\\mbegin\\M' then raise exception 'PRIZE_LAUNCH_PATCH_MISSING_BEGIN';end if;
  definition:=regexp_replace(definition,E'\\mbegin\\M',E'begin\n -- OMCITE prize launch cutoff.\n '||guard,'i');
  execute definition;
 end loop;
end $$;

-- No old winnings are manufactured or silently reversed. Release only old,
-- unpaid promises, keeping event status, results, ratings and prices intact.
do $$declare fund record;begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if exists(select 1 from public.event_prize_funds f where not public.u7_session_prizes_payable(f.session_id) and not f.cancelled and f.awards<>'[]'::jsonb)
  or exists(select 1 from public.personal_award_payments p join public.personal_award_funds f on f.id=p.fund_id
   where p.reversed_at is null and not public.u7_personal_prizes_payable(f.event_id,f.session_id)) then
  raise exception 'PRIZE_LAUNCH_OLD_PAID_REVIEW_REQUIRED';
 end if;
 for fund in select session_id from public.event_prize_funds where not cancelled and not public.u7_session_prizes_payable(session_id) order by session_id loop
  perform public.u6_settle_session_prizes(fund.session_id,'[]'::jsonb,null,true);
 end loop;
 for fund in select id from public.personal_award_funds where cancelled_at is null and not public.u7_personal_prizes_payable(event_id,session_id) order by id loop
  perform public.personal_award_cancel(fund.id);
 end loop;
end $$;
revoke all on function public.u7_prize_launch_at(),public.u7_session_prizes_payable(uuid),public.u7_personal_prizes_payable(uuid,uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
