-- Fixed home-organization compensation uses the host's dedicated reserve.
-- Percentage compensation splits actual contractual receipts, never a second
-- debit from the player's wallet or the organizer's prize fund.
begin;
create table public.contract_guest_jobs(
 contract_id uuid not null,revision integer not null,checked_at timestamptz,
 primary key(contract_id,revision),foreign key(contract_id,revision) references public.contract_guest_activations(contract_id,revision)
);
alter table public.contract_guest_jobs enable row level security;
revoke all on public.contract_guest_jobs from public,anon,authenticated,service_role;
insert into public.contract_guest_jobs(contract_id,revision) select contract_id,revision from public.contract_guest_activations;
create function public.contract_guest_job_create() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.contract_guest_jobs(contract_id,revision) values(new.contract_id,new.revision);return new;end $$;
create trigger contract_guest_job after insert on public.contract_guest_activations for each row execute function public.contract_guest_job_create();
create table public.contract_guest_escrow_movements(
 operation_id uuid primary key references public.coin_operations(id),contract_id uuid not null,revision integer not null,home_contract_id uuid not null,
 held_change bigint not null,paid_change bigint not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(contract_id,revision,home_contract_id) references public.contract_guest_escrows(contract_id,revision,home_contract_id)
);
create table public.contract_guest_payment_shares(
 operation_id uuid not null references public.coin_operations(id),obligation_id uuid not null references public.contract_obligations(id),
 home_contract_id uuid not null,organization_id uuid not null references public.teams(id),amount bigint not null check(amount>0),
 primary key(operation_id,home_contract_id)
);
create table public.contract_guest_share_reversals(
 obligation_id uuid primary key references public.contract_obligations(id),operation_id uuid not null references public.coin_operations(id),
 amount bigint not null check(amount>0)
);
alter table public.contract_guest_escrow_movements enable row level security;
alter table public.contract_guest_payment_shares enable row level security;
alter table public.contract_guest_share_reversals enable row level security;
revoke all on public.contract_guest_escrow_movements,public.contract_guest_payment_shares,public.contract_guest_share_reversals from public,anon,authenticated,service_role;
create trigger contract_guest_escrow_movement_immutable before update or delete on public.contract_guest_escrow_movements for each row execute function public.contract_frozen_guard();
create trigger contract_guest_payment_share_immutable before update or delete on public.contract_guest_payment_shares for each row execute function public.contract_frozen_guard();
create trigger contract_guest_share_reversal_immutable before update or delete on public.contract_guest_share_reversals for each row execute function public.contract_frozen_guard();

create function public.contract_guest_credit_player(p_operation uuid,p_obligation uuid,p_target uuid,p_amount bigint) returns void
language plpgsql security definer set search_path=public as $$
declare o public.contract_obligations%rowtype;item record;deducted bigint:=0;share bigint;percent_total integer:=0;target uuid;
begin
 select * into strict o from public.contract_obligations where id=p_obligation;
 if o.kind in('signing','salary','appearance','kill','mvp','ranking','prize') and exists(select 1 from public.contract_guest_activations where contract_id=o.contract_id and revision=o.revision) then
   for item in select * from public.contract_guest_requirements where contract_id=o.contract_id and revision=o.revision and compensation->>'kind'='percent' order by home_contract_id loop
     percent_total:=percent_total+(item.compensation->>'basisPoints')::integer;
     if percent_total>10000 then raise exception 'CONTRACT_GUEST_TOTAL_SHARE';end if;
     share:=floor(p_amount::numeric*(item.compensation->>'basisPoints')::integer/10000)::bigint;
     if share=0 then continue;end if;
     target:=public.u6_coin_account('organization',item.organization_id);
     perform public.u6_coin_entry(p_operation,target,share);
     insert into public.contract_guest_payment_shares(operation_id,obligation_id,home_contract_id,organization_id,amount) values(p_operation,o.id,item.home_contract_id,item.organization_id,share);
     deducted:=deducted+share;
   end loop;
 end if;
 if p_amount>deducted then perform public.u6_coin_entry(p_operation,p_target,p_amount-deducted);end if;
end $$;

create function public.contract_guest_reverse_shares(p_obligation uuid,p_operation uuid) returns bigint
language plpgsql security definer set search_path=public as $$
declare item record;total bigint:=0;host uuid;source uuid;
begin
 if exists(select 1 from public.contract_guest_share_reversals where obligation_id=p_obligation) then raise exception 'CONTRACT_CANCELLED';end if;
 for item in select organization_id,sum(amount)::bigint amount from public.contract_guest_payment_shares where obligation_id=p_obligation group by organization_id order by organization_id loop
   source:=public.u6_coin_account('organization',item.organization_id);
   perform public.u6_coin_entry(p_operation,source,-item.amount);total:=total+item.amount;
 end loop;
 if total>0 then
   select c.organization_id into strict host from public.contract_obligations o join public.organization_contracts c on c.id=o.contract_id where o.id=p_obligation;
   source:=public.u6_coin_account('organization',host);perform public.u6_coin_entry(p_operation,source,total);
   insert into public.contract_guest_share_reversals(obligation_id,operation_id,amount) values(p_obligation,p_operation,total);
 end if;
 return total;
end $$;
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_obligation_pay(uuid,uuid,uuid,bigint,boolean)'::regprocedure);
 needle:='perform public.u6_coin_entry(p_request,target,p_amount);';
 if position(needle in d)=0 then raise exception 'CONTRACT_GUEST_INCOME_PATCH';end if;
 execute replace(d,needle,'perform public.contract_guest_credit_player(p_request,o.id,target,p_amount);');
 d:=pg_get_functiondef('public.contract_obligation_cancel_internal(uuid,uuid,uuid,text)'::regprocedure);
 needle:='if o.paid>0 then';
 if position(needle in d)=0 then raise exception 'CONTRACT_GUEST_REVERSAL_PATCH';end if;
 d:=replace(d,needle,'returned:=public.contract_guest_reverse_shares(o.id,p_request); if o.paid>returned then');
 d:=replace(d,'values(o.id,c.player_id,c.organization_id,o.paid)','values(o.id,c.player_id,c.organization_id,o.paid-returned)');
 needle:='select recovered into returned from public.contract_player_claims where id=claim;';
 if position(needle in d)=0 then raise exception 'CONTRACT_GUEST_RECOVERY_PATCH';end if;
 execute replace(d,needle,'select recovered+returned into returned from public.contract_player_claims where id=claim;');
 d:=pg_get_functiondef('public.contract_tournament_freeze(uuid)'::regprocedure);
 needle:='where c.kind=''main'' and a.signed_at<=cutoff';
 if position(needle in d)=0 then raise exception 'CONTRACT_GUEST_TOURNAMENT_PATCH';end if;
 execute replace(d,needle,'where (c.kind=''main'' or(c.kind=''guest'' and c.event_id=e.id and c.session_id is null and exists(select 1 from public.contract_guest_activations ga where ga.contract_id=c.id and ga.revision=a.revision))) and a.signed_at<=cutoff');
 d:=pg_get_functiondef('public.contract_obligation_query(uuid,uuid,integer)'::regprocedure);
 needle:='o.amount,o.paid,o.held,';
 if position(needle in d)=0 then raise exception 'CONTRACT_GUEST_PAYMENT_LABEL_PATCH';end if;
 execute replace(d,needle,needle||' coalesce((select sum(sh.amount) from public.contract_guest_payment_shares sh where sh.obligation_id=o.id),0) as "guestShares",o.paid-coalesce((select sum(sh.amount) from public.contract_guest_payment_shares sh where sh.obligation_id=o.id),0) as "playerPaid",');
end $$;

create function public.contract_guest_participation(p_contract uuid,p_revision integer) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;scope public.contract_guest_scopes%rowtype;completion jsonb;session record;plan jsonb;played integer:=0;
begin
 select * into strict c from public.organization_contracts where id=p_contract;
 select * into strict scope from public.contract_guest_scopes where contract_id=p_contract and revision=p_revision;
 if public.contract_effective_end(p_contract,p_revision)<=scope.starts_at then return jsonb_build_object('ready',true,'played',0);end if;
 if exists(select 1 from public.events where id=c.event_id and cancelled_at is not null) then return jsonb_build_object('ready',true,'played',0);end if;
 if c.session_id is null then
   completion:=public.contract_tournament_completion(c.event_id);
   if completion->>'ready' is distinct from 'true' then return completion;end if;
   if completion->>'cancelled'='true' then return jsonb_build_object('ready',true,'played',0);end if;
 end if;
 for session in select s.* from public.event_sessions s where s.id=any(scope.session_ids) order by s.start_time,s.id loop
   if session.status='cancelled' then continue;end if;
   if session.end_time>clock_timestamp() then return jsonb_build_object('ready',false,'reason','session_not_finished');end if;
   if not exists(select 1 from public.competition_publications where session_id=session.id and first_published_at is not null and published is not null) then return jsonb_build_object('ready',false,'reason','unpublished');end if;
   if not exists(select 1 from public.contract_session_terms where session_id=session.id and contract_id=c.id and revision=p_revision) then continue;end if;
   plan:=public.contract_session_raw_accrual_plan(session.id,c.id);
   if plan->>'ready' is distinct from 'true' then return plan;end if;
   if plan->>'cancelled' is distinct from 'true' then played:=played+coalesce((plan->>'playedGames')::integer,0);end if;
 end loop;
 return jsonb_build_object('ready',true,'played',played);
end $$;

create function public.contract_guest_settle(p_contract uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare assessment jsonb;escrow record;host uuid;source uuid;target uuid;op uuid;paid_delta bigint;held_delta bigint;account public.coin_accounts%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 update public.contract_guest_jobs set checked_at=clock_timestamp() where contract_id=p_contract and revision=p_revision;
 assessment:=public.contract_guest_participation(p_contract,p_revision);
 if assessment->>'ready' is distinct from 'true' then return assessment;end if;
 select organization_id into strict host from public.organization_contracts where id=p_contract;source:=public.u6_coin_account('organization',host);
 for escrow in select e.*,r.organization_id from public.contract_guest_escrows e join public.contract_guest_requirements r using(contract_id,revision,home_contract_id)
   where e.contract_id=p_contract and e.revision=p_revision order by e.home_contract_id for update of e
 loop
   paid_delta:=0;held_delta:=0;target:=public.u6_coin_account('organization',escrow.organization_id);
   if (assessment->>'played')::integer>0 and escrow.paid=0 then
     select * into strict account from public.coin_accounts where id=source for update;
     if account.balance-account.reserved+escrow.held<escrow.amount then return jsonb_build_object('ready',false,'reason','insufficient_guest_reserve');end if;
     op:=gen_random_uuid();insert into public.coin_operations(id,action,input,description) values(op,'contract_guest_fixed',jsonb_build_object('contractId',p_contract,'revision',p_revision,'homeContractId',escrow.home_contract_id),'Фиксированная компенсация за подтверждённое гостевое выступление');
     perform public.u6_coin_entry(op,source,-escrow.amount,-escrow.held);perform public.u6_coin_entry(op,target,escrow.amount);
     held_delta:=-escrow.held;paid_delta:=escrow.amount;
   elsif (assessment->>'played')::integer=0 and(escrow.held>0 or escrow.paid>0) then
     op:=gen_random_uuid();insert into public.coin_operations(id,action,input,description) values(op,'contract_guest_release',jsonb_build_object('contractId',p_contract,'revision',p_revision,'homeContractId',escrow.home_contract_id),'Отмена компенсации: отмена события или отсутствие гостевого участия');
     if escrow.paid>0 then perform public.u6_coin_entry(op,target,-escrow.paid);perform public.u6_coin_entry(op,source,escrow.paid);end if;
     if escrow.held>0 then perform public.u6_coin_entry(op,source,0,-escrow.held);end if;
     held_delta:=-escrow.held;paid_delta:=-escrow.paid;
   else continue;end if;
   update public.contract_guest_escrows set held=held+held_delta,paid=paid+paid_delta where contract_id=p_contract and revision=p_revision and home_contract_id=escrow.home_contract_id;
   insert into public.contract_guest_escrow_movements(operation_id,contract_id,revision,home_contract_id,held_change,paid_change) values(op,p_contract,p_revision,escrow.home_contract_id,held_delta,paid_delta);
 end loop;
 return assessment;
end $$;

-- Finish/reconcile guest fees after the result and all contractual accruals.
alter function public.contract_session_publish_settle(uuid) rename to contract_session_publish_before_guest_fees;
create function public.contract_session_publish_settle(p_session uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare answer jsonb;item record;
begin
 answer:=public.contract_session_publish_before_guest_fees(p_session);
 for item in select a.contract_id,a.revision from public.contract_guest_activations a join public.contract_guest_scopes s using(contract_id,revision) where p_session=any(s.session_ids) order by a.contract_id,a.revision loop
   perform public.contract_guest_settle(item.contract_id,item.revision);
 end loop;
 return answer;
end $$;
alter function public.contract_maintenance_run() rename to contract_maintenance_before_guest_fees;
create function public.contract_maintenance_run() returns jsonb
language plpgsql security definer set search_path=public as $$
declare answer jsonb;item record;checked integer:=0;
begin
 answer:=public.contract_maintenance_before_guest_fees();
 for item in select j.contract_id,j.revision from public.contract_guest_jobs j
   join public.contract_guest_scopes s using(contract_id,revision)
   where s.starts_at<=clock_timestamp() order by j.checked_at nulls first,j.contract_id,j.revision limit 100 for update of j
 loop perform public.contract_guest_settle(item.contract_id,item.revision);checked:=checked+1;end loop;
 return answer||jsonb_build_object('checkedGuestContracts',checked);
end $$;
create function public.contract_guest_after_cancel() returns trigger language plpgsql security definer set search_path=public as $$
declare item record;
begin
 if tg_table_name='events' then
   if new.cancelled_at is null then return new;end if;
 else if new.status<>'cancelled' then return new;end if;end if;
   for item in select a.contract_id,a.revision from public.contract_guest_activations a join public.contract_guest_scopes s using(contract_id,revision)
     where (tg_table_name='events' and s.event_id=new.id) or(tg_table_name='event_sessions' and new.id=any(s.session_ids)) order by a.contract_id,a.revision
   loop perform public.contract_guest_settle(item.contract_id,item.revision);end loop;
 return new;
end $$;
create trigger contract_guest_cancel_event after update of cancelled_at on public.events for each row execute function public.contract_guest_after_cancel();
create trigger contract_guest_cancel_session after update of status on public.event_sessions for each row execute function public.contract_guest_after_cancel();
-- Existing session/event cancellation hooks call publication settlement.
-- Early explicit termination releases a still-unearned guest escrow now.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_terminate(uuid,uuid,uuid,integer,text,bigint,text)'::regprocedure);
 needle:='perform public.contract_salary_process(p_contract);';
 if position(needle in d)=0 then raise exception 'CONTRACT_GUEST_TERMINATION_PATCH';end if;
 execute replace(d,needle,needle||' if c.kind=''guest'' then perform public.contract_guest_settle(p_contract,p_revision);end if;');
end $$;
revoke all on function public.contract_guest_credit_player(uuid,uuid,uuid,bigint),public.contract_guest_reverse_shares(uuid,uuid),public.contract_guest_participation(uuid,integer),public.contract_guest_settle(uuid,integer),
 public.contract_session_publish_before_guest_fees(uuid),public.contract_session_publish_settle(uuid),public.contract_maintenance_before_guest_fees(),public.contract_maintenance_run()
 ,public.contract_guest_job_create(),public.contract_guest_after_cancel()
 from public,anon,authenticated,service_role;
grant execute on function public.contract_maintenance_run() to service_role;
commit;
