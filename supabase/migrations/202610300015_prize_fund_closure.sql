begin;
alter table public.event_prize_funds add column closed_at timestamptz,add column last_error text;
-- After explicit closure unused reserves no longer exist. Base reversals must
-- use the actual held amount, not recreate the original total implicitly.
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.u6_settle_prizes_before_contracts(uuid,jsonb,uuid,boolean)'::regprocedure);
 needle:='delta:=f.total-new_total;';
 if position(needle in definition)=0 then raise exception 'PODIUM_CLOSURE_BASE_PATCH';end if;
 definition:=replace(definition,needle,'delta:=f.held+old_total-new_total;');
 needle:='if new_total>f.total then raise exception ''Призы превышают зарезервированный фонд'';end if;';
 if position(needle in definition)=0 then raise exception 'PODIUM_CLOSURE_FUNDING_PATCH';end if;
 definition:=replace(definition,needle,needle||$patch$
 if new_total>f.held+old_total then
   delta:=new_total-f.held-old_total;
   if not(public.u6_coin_admin(p_actor) or exists(select 1 from public.coin_accounts where id=f.account_id and user_id=p_actor)) then raise exception 'CONTRACT_FINANCE';end if;
   if not exists(select 1 from public.coin_accounts where id=f.account_id and balance-reserved>=delta) then raise exception 'CONTRACT_FUNDS';end if;
   op:=gen_random_uuid();
   insert into public.coin_operations(id,actor_id,action,input,description) values(op,p_actor,'prize_reopen_reserve',jsonb_build_object('sessionId',p_session),'Обеспечение исправленных призов после закрытия фонда');
   perform public.u6_coin_entry(op,f.account_id,0,delta);
   update public.event_prize_funds set held=held+delta where session_id=p_session;f.held:=f.held+delta;
 end if;
 $patch$);
 execute definition;
end $$;
alter function public.u6_settle_session_prizes(uuid,jsonb,uuid,boolean) rename to u6_settle_before_fund_closure;
create function public.u6_settle_session_prizes(p_session uuid,p_awards jsonb,p_actor uuid,p_cancel boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare f public.event_prize_funds%rowtype;next_total bigint;prior_total bigint;
begin
 select * into f from public.event_prize_funds where session_id=p_session for update;
 if f.closed_at is not null and not p_cancel then
   if f.awards is distinct from p_awards then update public.event_prize_funds set last_error='closed_results_changed' where session_id=p_session;end if;
   return;
 end if;
 if not p_cancel then
   select coalesce(sum((value->>'amount')::bigint),0) into next_total from jsonb_array_elements(p_awards);
   select coalesce(sum((value->>'amount')::bigint),0) into prior_total from jsonb_array_elements(f.awards);
   if next_total>coalesce(f.held,0)+prior_total then
     update public.event_prize_funds set last_error='additional_funding_required' where session_id=p_session;return;
   end if;
 end if;
 perform public.u6_settle_before_fund_closure(p_session,p_awards,p_actor,p_cancel);
end $$;
alter function public.contract_session_prize_settle(uuid) rename to contract_prize_settle_before_closure;
create function public.contract_session_prize_settle(p_session uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare f public.event_prize_funds%rowtype;item record;plan jsonb;previous jsonb;changed boolean:=false;
begin
 select * into f from public.event_prize_funds where session_id=p_session;
 if not f.cancelled and f.last_error='additional_funding_required' then return jsonb_build_object('ready',false,'pendingOrganizations',1,'reason','additional_funding_required');end if;
 if f.closed_at is not null and not f.cancelled then
   for item in select distinct organization_id from public.contract_session_terms where session_id=p_session loop
     plan:=public.contract_session_prize_plan(p_session,item.organization_id);
     select r.plan into previous from public.contract_prize_runs r where session_id=p_session and organization_id=item.organization_id order by created_at desc,id desc limit 1;
     if previous is distinct from plan then changed:=true;end if;
   end loop;
   if changed then update public.event_prize_funds set last_error='closed_results_changed' where session_id=p_session;end if;
   return jsonb_build_object('ready',not changed,'pendingOrganizations',case when changed then 1 else 0 end,'closed',true);
 end if;
 return public.contract_prize_settle_before_closure(p_session);
end $$;
create function public.podium_fund_can_manage(p_actor uuid,p_session uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select p_actor is not null and exists(select 1 from public.event_sessions s join public.events e on e.id=s.event_id where s.id=p_session
   and(public.is_full_admin(p_actor) or e.organizer_user_id=p_actor or s.responsible_user_id=p_actor))
$$;
create function public.podium_fund_awards(p_session uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare published_value jsonb;prizes jsonb;awards jsonb;
begin
 select published into published_value from public.competition_publications where session_id=p_session and first_published_at is not null;
 if published_value is null then return null;end if;
 prizes:=public.u6_calculate_prizes(p_session,published_value);
 select coalesce(jsonb_agg(jsonb_build_object('teamId',r.team_id,'amount',(p->>'amount')::bigint) order by r.team_id),'[]') into awards
 from jsonb_array_elements(prizes) p join public.event_registrations r on r.id=(p->>'registrationId')::uuid and r.session_id=p_session;
 return awards;
end $$;
create function public.podium_fund_query(p_actor uuid,p_session uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare f public.event_prize_funds%rowtype;published_value jsonb;desired jsonb;additional bigint;
begin
 if not public.podium_fund_can_manage(p_actor,p_session) then raise exception 'CONTRACT_FORBIDDEN';end if;
 select * into f from public.event_prize_funds where session_id=p_session;
 if not found then return jsonb_build_object('fund',null);end if;
 select published into published_value from public.competition_publications where session_id=p_session;
 desired:=public.podium_fund_awards(p_session);
 select greatest(0,coalesce((select sum((value->>'amount')::bigint) from jsonb_array_elements(desired)),0)
   -coalesce((select sum((value->>'amount')::bigint) from jsonb_array_elements(f.awards)),0)-f.held) into additional;
 return jsonb_build_object('fund',to_jsonb(f),'desiredAwards',desired,'additionalReserve',additional,
   'canFund',public.u6_coin_admin(p_actor) or exists(select 1 from public.coin_accounts where id=f.account_id and user_id=p_actor),
   'canReopen',public.u6_coin_admin(p_actor),'fingerprint',md5(jsonb_build_object('published',published_value,'awards',f.awards,'closedAt',f.closed_at,'held',f.held)::text));
end $$;
create function public.podium_fund_action(p_actor uuid,p_request uuid,p_session uuid,p_action text,p_expected text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare f public.event_prize_funds%rowtype;s public.event_sessions%rowtype;old public.coin_operations%rowtype;payload jsonb;view_value jsonb;desired jsonb;shares jsonb;result_value jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_request is null or p_action is null or p_action not in('close','reopen') then raise exception 'CONTRACT_INPUT';end if;
 if not public.podium_fund_can_manage(p_actor,p_session) then raise exception 'CONTRACT_FORBIDDEN';end if;
 if p_action='reopen' and not public.u6_coin_admin(p_actor) then raise exception 'CONTRACT_FINANCE';end if;
 payload:=jsonb_build_object('sessionId',p_session,'action',p_action,'expected',p_expected);
 select * into old from public.coin_operations where id=p_request;
 if found then
   if old.actor_id is distinct from p_actor or old.action<>'podium_fund_action' or old.input is distinct from payload then raise exception 'CONTRACT_CONFLICT';end if;
   return old.result;
 end if;
 select * into s from public.event_sessions where id=p_session;
 select * into f from public.event_prize_funds where session_id=p_session for update;
 if not found or f.cancelled or s.status='cancelled' or exists(select 1 from public.events where id=s.event_id and cancelled_at is not null) then raise exception 'CONTRACT_STATE';end if;
 if s.end_time is null or s.end_time>clock_timestamp() then raise exception 'PERSONAL_AWARD_PENDING';end if;
 if(p_action='close' and f.closed_at is not null) or(p_action='reopen' and f.closed_at is null) then raise exception 'CONTRACT_STATE';end if;
 view_value:=public.podium_fund_query(p_actor,p_session);
 if p_expected is distinct from view_value->>'fingerprint' then raise exception 'CONTRACT_QUOTE_CHANGED';end if;
 desired:=public.podium_fund_awards(p_session);if desired is null then raise exception 'PERSONAL_AWARD_PENDING';end if;
 if(view_value->>'additionalReserve')::bigint>0 and view_value->>'canFund' is distinct from 'true' then raise exception 'CONTRACT_FINANCE';end if;
 if p_action='close' and exists(select 1 from public.personal_award_funds where event_id=s.event_id and(session_id=s.id or session_id is null) and cancelled_at is null and closed_at is null) then raise exception 'PERSONAL_AWARD_PENDING';end if;
 insert into public.coin_operations(id,actor_id,action,input,description) values(p_request,p_actor,'podium_fund_action',payload,case when p_action='close' then 'Закрытие призов топ-3 и возврат остатка' else 'Административное открытие исправленных призов топ-3' end);
 update public.event_prize_funds set closed_at=null,last_error=null where session_id=p_session;
 -- This explicit financial confirmation can replenish a previously released
 -- budget; the ordinary publication wrapper above never does so silently.
 perform public.u6_settle_before_fund_closure(p_session,desired,p_actor);
 shares:=public.contract_session_prize_settle(p_session);
 if p_action='close' then
   if shares->>'ready' is distinct from 'true' then raise exception 'PERSONAL_AWARD_PENDING';end if;
   select * into strict f from public.event_prize_funds where session_id=p_session;
   update public.event_prize_funds set held=0,closed_at=clock_timestamp() where session_id=p_session;
   if f.held>0 then perform public.u6_coin_entry(p_request,f.account_id,0,-f.held);end if;
 end if;
 result_value:=jsonb_build_object('success',true,'shares',shares);
 update public.coin_operations set result=result_value where id=p_request;
 return result_value;
end $$;
revoke all on function public.u6_settle_before_fund_closure(uuid,jsonb,uuid,boolean),public.u6_settle_session_prizes(uuid,jsonb,uuid,boolean),
 public.contract_prize_settle_before_closure(uuid),public.contract_session_prize_settle(uuid),public.podium_fund_can_manage(uuid,uuid),
 public.podium_fund_awards(uuid),public.podium_fund_query(uuid,uuid),public.podium_fund_action(uuid,uuid,uuid,text,text)
 from public,anon,authenticated,service_role;
grant execute on function public.podium_fund_query(uuid,uuid),public.podium_fund_action(uuid,uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
