-- Contractual shares come from the funded organization's prize account.
-- Incomplete participation holds that prize, rather than permitting its owner
-- to withdraw the money before the player's entitlement can be established.
begin;
alter table public.contract_obligations drop constraint contract_obligations_kind_check;
alter table public.contract_obligations add constraint contract_obligations_kind_check
 check(kind in('signing','salary','appearance','kill','mvp','ranking','termination','fine_refund','prize'));
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_obligation_create(uuid,integer,text,text,bigint,timestamptz,boolean)'::regprocedure);
 needle:='''termination'',''fine_refund''';
 if position(needle in d)=0 then raise exception 'CONTRACT_PRIZE_KIND_PATCH';end if;
 execute replace(d,needle,needle||',''prize''');
end $$;
create table public.contract_prize_holds(
 session_id uuid not null references public.event_prize_funds(session_id),organization_id uuid not null references public.teams(id),
 held bigint not null check(held>=0),primary key(session_id,organization_id)
);
create table public.contract_prize_runs(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references public.event_prize_funds(session_id),
 organization_id uuid not null references public.teams(id),plan jsonb not null,created_at timestamptz not null default clock_timestamp()
);
create index contract_prize_runs_latest on public.contract_prize_runs(session_id,organization_id,created_at desc,id);
create table public.contract_prize_charges(
 session_id uuid not null,contract_id uuid not null,revision integer not null,generation integer not null check(generation>0),
 obligation_id uuid not null unique references public.contract_obligations(id),run_id uuid not null references public.contract_prize_runs(id),
 primary key(session_id,contract_id,generation),foreign key(session_id,contract_id) references public.contract_session_terms(session_id,contract_id)
);
alter table public.contract_prize_holds enable row level security;
alter table public.contract_prize_runs enable row level security;
alter table public.contract_prize_charges enable row level security;
revoke all on public.contract_prize_holds,public.contract_prize_runs,public.contract_prize_charges from public,anon,authenticated,service_role;
create trigger contract_prize_run_immutable before update or delete on public.contract_prize_runs for each row execute function public.contract_frozen_guard();
create trigger contract_prize_charge_immutable before update or delete on public.contract_prize_charges for each row execute function public.contract_frozen_guard();

create function public.contract_prize_hold_set(p_session uuid,p_organization uuid,p_amount bigint) returns void
language plpgsql security definer set search_path=public as $$
declare old_amount bigint;op uuid;account_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_amount is null or p_amount not between 0 and 1000000000000 then raise exception 'CONTRACT_INPUT';end if;
 select held into old_amount from public.contract_prize_holds where session_id=p_session and organization_id=p_organization for update;
 old_amount:=coalesce(old_amount,0);
 if old_amount=p_amount then return;end if;
 account_id:=public.u6_coin_account('organization',p_organization);op:=gen_random_uuid();
 insert into public.coin_operations(id,action,input,description) values(op,'contract_prize_hold',jsonb_build_object('sessionId',p_session,'organizationId',p_organization),'Резерв призовых до расчёта долей по договорам');
 perform public.u6_coin_entry(op,account_id,0,p_amount-old_amount);
 insert into public.contract_prize_holds(session_id,organization_id,held) values(p_session,p_organization,p_amount)
 on conflict(session_id,organization_id) do update set held=excluded.held;
end $$;

-- Keep the existing organizer reserve and canonical podium calculation.
-- Corrected/cancelled gross awards first reverse their contractual shares.
alter function public.u6_settle_session_prizes(uuid,jsonb,uuid,boolean) rename to u6_settle_prizes_before_contracts;
create function public.u6_settle_session_prizes(p_session uuid,p_awards jsonb,p_actor uuid,p_cancel boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare fund public.event_prize_funds%rowtype;item record;award jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into fund from public.event_prize_funds where session_id=p_session for update;
 if not found or fund.cancelled then return;end if;
 if fund.awards is distinct from p_awards or p_cancel then
   for item in select organization_id from public.contract_prize_holds where session_id=p_session and held>0 order by organization_id loop
     perform public.contract_prize_hold_set(p_session,item.organization_id,0);
   end loop;
   for item in select o.id from public.contract_prize_charges c join public.contract_obligations o on o.id=c.obligation_id
     where c.session_id=p_session and o.cancelled_at is null order by o.id
   loop perform public.contract_obligation_cancel_internal(null,gen_random_uuid(),item.id,'Исправление призового фонда сессии');end loop;
 end if;
 perform public.u6_settle_prizes_before_contracts(p_session,p_awards,p_actor,p_cancel);
 if p_cancel or fund.awards=p_awards then return;end if;
 perform public.contract_session_freeze(p_session);
 for award in select value from jsonb_array_elements(p_awards) loop
   if exists(select 1 from public.contract_session_terms where session_id=p_session and organization_id=(award->>'teamId')::uuid) then
     perform public.contract_prize_hold_set(p_session,(award->>'teamId')::uuid,(award->>'amount')::bigint);
   end if;
 end loop;
end $$;

create function public.contract_session_prize_plan(p_session uuid,p_organization uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare fund public.event_prize_funds%rowtype;frame public.contract_session_frames%rowtype;t record;plan jsonb;allocation jsonb;
 recipients jsonb:='[]';entries jsonb:='[]';gross bigint;total integer;share integer;stat_row jsonb;player_row jsonb;kill_sum bigint;
begin
 select * into fund from public.event_prize_funds where session_id=p_session;
 if not found then return jsonb_build_object('ready',false,'reason','no_prize_fund');end if;
 select * into frame from public.contract_session_frames where session_id=p_session;
 if frame.session_id is null then return jsonb_build_object('ready',false,'reason','missing_session_snapshot');end if;
 select coalesce(sum((value->>'amount')::bigint),0) into gross from jsonb_array_elements(fund.awards) where value->>'teamId'=p_organization::text;
 if fund.cancelled or gross=0 then return jsonb_build_object('ready',true,'gross',0,'entries','[]'::jsonb);end if;
 for stat_row in select r from public.competition_publications cp cross join lateral jsonb_array_elements(cp.published->'rows') r
   where cp.session_id=p_session and r->>'teamId'=p_organization::text and r->>'played'='true'
 loop
   if stat_row->>'detail' is distinct from 'players' or jsonb_typeof(stat_row->'players') is distinct from 'array' then
     return jsonb_build_object('ready',false,'reason','incomplete_player_statistics');end if;
   kill_sum:=0;
   for player_row in select value from jsonb_array_elements(stat_row->'players') loop
     if jsonb_typeof(player_row->'played') is distinct from 'boolean' then return jsonb_build_object('ready',false,'reason','incomplete_player_statistics');end if;
     if player_row->>'played'='true' then
       if player_row->'kills' is null or player_row->'kills'='null'::jsonb then return jsonb_build_object('ready',false,'reason','incomplete_player_statistics');end if;
       perform public.contract_assert_uint(player_row->'kills',1000000);kill_sum:=kill_sum+(player_row->>'kills')::bigint;
     end if;
   end loop;
   if stat_row->'kills' is null or stat_row->'kills'='null'::jsonb or kill_sum<>(stat_row->>'kills')::bigint then
     return jsonb_build_object('ready',false,'reason','incomplete_player_statistics');end if;
 end loop;
 for t in select * from public.contract_session_terms where session_id=p_session and organization_id=p_organization order by player_id,contract_id loop
   plan:=public.contract_session_accrual_plan(p_session,t.contract_id);
   if plan->>'ready' is distinct from 'true' then return jsonb_build_object('ready',false,'reason',coalesce(plan->>'reason','incomplete_player_statistics'));end if;
   total:=coalesce(total,(plan->>'totalGames')::integer);
   if total is null or total<1 then return jsonb_build_object('ready',false,'reason','missing_games');end if;
   share:=case when frame.event_type='training' then (t.conditions->>'trainingShareBps')::integer else (t.conditions->>'tournamentShareBps')::integer end;
   if plan->>'eligible' is distinct from 'true' then share:=0;end if;
   recipients:=recipients||jsonb_build_array(jsonb_build_object('playerId',t.player_id,'playedGames',coalesce((plan->>'playedGames')::integer,0),
     'shareBps',share,'participation',t.terms->'participation','guestObligations','[]'::jsonb));
   entries:=entries||jsonb_build_array(jsonb_build_object('contractId',t.contract_id,'revision',t.revision,'playerId',t.player_id));
 end loop;
 if total is null then return jsonb_build_object('ready',true,'gross',gross,'entries','[]'::jsonb);end if;
 allocation:=public.contract_prize_allocation(gross,total,recipients);
 select coalesce(jsonb_agg(e||jsonb_build_object('amount',(p->>'net')::bigint) order by e->>'contractId'),'[]') into entries
 from jsonb_array_elements(entries) e join jsonb_array_elements(allocation->'payouts') p on p->>'playerId'=e->>'playerId';
 return jsonb_build_object('ready',true,'gross',gross,'organizationAmount',allocation->'organizationAmount','entries',entries);
end $$;

create function public.contract_session_prize_settle(p_session uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare organization record;item record;plan jsonb;prior public.contract_prize_runs%rowtype;run uuid;obligation uuid;
 expected bigint;active_total bigint;previous_expected bigint;previous_funding bigint;generation integer;due timestamptz;funded boolean;
 changed boolean;prepared integer:=0;pending integer:=0;old_charge public.contract_obligations%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if not exists(select 1 from public.event_prize_funds where session_id=p_session) then return jsonb_build_object('ready',true,'prepared',0);end if;
 for organization in
   select distinct organization_id from public.contract_session_terms where session_id=p_session
   union select organization_id from public.contract_prize_holds where session_id=p_session
 loop
   plan:=public.contract_session_prize_plan(p_session,organization.organization_id);
   if plan->>'ready' is distinct from 'true' then pending:=pending+1;continue;end if;
   perform public.contract_prize_hold_set(p_session,organization.organization_id,0);
   select * into prior from public.contract_prize_runs where session_id=p_session and organization_id=organization.organization_id order by created_at desc,id desc limit 1;
   changed:=prior.id is null or prior.plan is distinct from plan;
   if not changed then
     select exists(select 1 from jsonb_array_elements(plan->'entries') e where (e->>'amount')::bigint is distinct from
       (select coalesce(sum(o.amount),0) from public.contract_prize_charges c join public.contract_obligations o on o.id=c.obligation_id
        where c.session_id=p_session and c.contract_id=(e->>'contractId')::uuid and o.cancelled_at is null)
       and not exists(select 1 from public.contract_prize_charges c join public.contract_obligations o on o.id=c.obligation_id
         where c.session_id=p_session and c.contract_id=(e->>'contractId')::uuid and o.cancelled_by is not null)) into changed;
   end if;
   if not changed then continue;end if;
   insert into public.contract_prize_runs(session_id,organization_id,plan) values(p_session,organization.organization_id,plan) returning id into run;
   for item in select contract_id,revision from public.contract_session_terms where session_id=p_session and organization_id=organization.organization_id order by contract_id loop
     if exists(select 1 from public.contract_prize_charges c join public.contract_obligations x on x.id=c.obligation_id where c.session_id=p_session and c.contract_id=item.contract_id and x.cancelled_by is not null) then continue;end if;
     select coalesce(max((e->>'amount')::bigint),0) into expected from jsonb_array_elements(plan->'entries') e where e->>'contractId'=item.contract_id::text;
     select coalesce(sum(x.amount),0),min(x.due_at) into active_total,due from public.contract_prize_charges c join public.contract_obligations x on x.id=c.obligation_id where c.session_id=p_session and c.contract_id=item.contract_id and x.cancelled_at is null;
     if expected=active_total then continue;end if;
     select coalesce(max((e->>'amount')::bigint),0) into previous_expected from jsonb_array_elements(coalesce(prior.plan->'entries','[]')) e where e->>'contractId'=item.contract_id::text;
     select coalesce(sum(x.paid+x.held),0) into previous_funding from public.contract_prize_charges c join public.contract_obligations x on x.id=c.obligation_id where c.session_id=p_session and c.contract_id=item.contract_id and c.run_id=prior.id;
     if active_total>expected then
       for old_charge in select x.* from public.contract_prize_charges c join public.contract_obligations x on x.id=c.obligation_id where c.session_id=p_session and c.contract_id=item.contract_id and x.cancelled_at is null order by c.generation desc loop
         perform public.contract_obligation_cancel_internal(null,gen_random_uuid(),old_charge.id,'Уточнение доли призовых по подтверждённым результатам');
       end loop;
       active_total:=0;
     end if;
     if expected<=active_total then continue;end if;
     if expected<previous_expected then
       select min(x.due_at) into due from public.contract_prize_charges c join public.contract_obligations x on x.id=c.obligation_id where c.session_id=p_session and c.contract_id=item.contract_id;
     else due:=clock_timestamp();end if;
     select coalesce(max(c.generation),0)+1 into generation from public.contract_prize_charges c where c.session_id=p_session and c.contract_id=item.contract_id;
     funded:=(expected>=previous_expected or previous_funding>=expected-active_total) and exists(select 1 from public.coin_accounts a where a.team_id=organization.organization_id and a.balance-a.reserved>=expected-active_total);
     obligation:=public.contract_obligation_create(item.contract_id,item.revision,'prize','session:'||p_session||':prize:'||generation,expected-active_total,coalesce(due,clock_timestamp()),funded);
     insert into public.contract_prize_charges(session_id,contract_id,revision,generation,obligation_id,run_id) values(p_session,item.contract_id,item.revision,generation,obligation,run);
     -- A previously unfunded debt stays manual after a later top-up.
     if funded then perform public.contract_obligation_pay(null,gen_random_uuid(),obligation,expected-active_total,true);end if;
     prepared:=prepared+1;
   end loop;
 end loop;
 return jsonb_build_object('ready',pending=0,'pendingOrganizations',pending,'prepared',prepared);
end $$;

-- Reconcile prize shares when an earlier result changes the scope of a later
-- session's limit, not only when that later publication itself is edited.
do $$declare d text;signature regprocedure;needle text;begin
 foreach signature in array array['public.contract_session_settle_before_tournament(uuid)'::regprocedure,'public.contract_tournament_settle_all(uuid)'::regprocedure] loop
   d:=pg_get_functiondef(signature);
   needle:='perform public.contract_session_settle(affected.session_id,context.contract_id);';
   if position(needle in d)>0 then d:=replace(d,needle,'perform public.contract_session_prize_settle(affected.session_id); '||needle);
   else
     needle:='result:=public.contract_session_settle(affected.session_id,context.contract_id);';
     if position(needle in d)=0 then raise exception 'CONTRACT_PRIZE_LIMIT_HOOK_PATCH';end if;
     d:=replace(d,needle,'perform public.contract_session_prize_settle(affected.session_id); '||needle);
   end if;
   execute d;
 end loop;
end $$;
alter function public.contract_session_publish_settle(uuid) rename to contract_session_publish_before_prize_shares;
create function public.contract_session_publish_settle(p_session uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare answer jsonb;
begin
 answer:=public.contract_session_publish_before_prize_shares(p_session);
 if answer->>'ready'='true' then answer:=answer||jsonb_build_object('prizeShares',public.contract_session_prize_settle(p_session));end if;
 return answer;
end $$;
revoke all on function public.contract_prize_hold_set(uuid,uuid,bigint),public.u6_settle_prizes_before_contracts(uuid,jsonb,uuid,boolean),
 public.u6_settle_session_prizes(uuid,jsonb,uuid,boolean),public.contract_session_prize_plan(uuid,uuid),public.contract_session_prize_settle(uuid),
 public.contract_session_publish_before_prize_shares(uuid),public.contract_session_publish_settle(uuid)
 from public,anon,authenticated,service_role;
commit;
