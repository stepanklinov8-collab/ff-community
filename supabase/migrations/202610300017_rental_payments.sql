begin;
create table public.contract_rental_fees(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null,revision integer not null,home_contract_id uuid not null,
 amount bigint not null check(amount>=0),paid bigint not null default 0,held bigint not null default 0,
 due_at timestamptz not null,plan jsonb not null,
 check(paid>=0 and held>=0 and paid+held<=amount),unique(contract_id,revision,home_contract_id),
 foreign key(contract_id,revision,home_contract_id) references public.contract_guest_requirements(contract_id,revision,home_contract_id)
);
create table public.contract_rental_runs(id uuid primary key default gen_random_uuid(),fee_id uuid not null references public.contract_rental_fees(id),plan jsonb not null,created_at timestamptz not null default clock_timestamp());
create index contract_rental_due on public.contract_rental_fees(contract_id,due_at) where paid<amount;
create table public.contract_rental_movements(operation_id uuid primary key references public.coin_operations(id),fee_id uuid not null references public.contract_rental_fees(id),paid_change bigint not null,held_change bigint not null,created_at timestamptz not null default clock_timestamp());
alter table public.contract_rental_fees enable row level security;
alter table public.contract_rental_runs enable row level security;
alter table public.contract_rental_movements enable row level security;
revoke all on public.contract_rental_fees,public.contract_rental_runs,public.contract_rental_movements from public,anon,authenticated,service_role;
create trigger contract_rental_run_immutable before update or delete on public.contract_rental_runs for each row execute function public.contract_frozen_guard();
create trigger contract_rental_movement_immutable before update or delete on public.contract_rental_movements for each row execute function public.contract_frozen_guard();
create function public.contract_rental_fee_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then raise exception 'CONTRACT_IMMUTABLE';end if;
 if row(new.id,new.contract_id,new.revision,new.home_contract_id,new.due_at) is distinct from row(old.id,old.contract_id,old.revision,old.home_contract_id,old.due_at) then raise exception 'CONTRACT_IMMUTABLE';end if;
 return new;
end $$;
create trigger contract_rental_fee_immutable before update or delete on public.contract_rental_fees for each row execute function public.contract_rental_fee_guard();

create function public.contract_rental_bases(p_contract uuid,p_revision integer) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;s public.contract_guest_scopes%rowtype;prizes numeric;payments numeric;personal numeric;
begin
 select * into strict c from public.organization_contracts where id=p_contract;
 select * into strict s from public.contract_guest_scopes where contract_id=p_contract and revision=p_revision;
 -- Funded team awards before sharing with players; never arbitrary figures
 -- typed in a result, nor grants/transfers/unpaid prizes in a wallet.
 select coalesce(sum((a->>'amount')::numeric),0) into prizes from public.event_prize_funds f cross join lateral jsonb_array_elements(f.awards) a
 where f.session_id=any(s.session_ids) and not f.cancelled and a->>'teamId'=c.organization_id::text;
 -- Personal prizes count only to the extent explicitly assigned to the host.
 select coalesce(sum((p.plan->>'organizationAmount')::numeric),0) into personal from public.personal_award_payments p join public.personal_award_funds f on f.id=p.fund_id
 where p.reversed_at is null and f.cancelled_at is null and f.event_id=s.event_id and(f.session_id=any(s.session_ids) or(c.session_id is null and f.session_id is null))
 and p.plan->>'organizationId'=c.organization_id::text;
 prizes:=prizes+personal;
 -- The original welcome payment is not reissued by an amendment, but it
 -- remains part of this same rental's actual receipts across revisions.
 select coalesce(sum(o.paid),0) into payments from public.contract_obligations o where o.contract_id=c.id and o.cancelled_at is null
 and o.kind in('signing','salary','appearance','kill','mvp','ranking','prize');
 select coalesce(sum((p.plan->>'playerAmount')::numeric),0) into personal from public.personal_award_payments p join public.personal_award_funds f on f.id=p.fund_id
 where p.reversed_at is null and f.cancelled_at is null and p.plan->>'contractId'=c.id::text;
 return jsonb_build_object('organizationPrizes',prizes,'playerPayments',payments+personal);
end $$;
create function public.contract_rental_move(p_fee uuid,p_paid bigint,p_held bigint,p_actor uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare f public.contract_rental_fees%rowtype;host uuid;home uuid;source uuid;target uuid;op uuid:=gen_random_uuid();
begin
 select * into strict f from public.contract_rental_fees where id=p_fee for update;
 select c.organization_id,r.organization_id into strict host,home from public.organization_contracts c join public.contract_guest_requirements r on r.contract_id=c.id
 where c.id=f.contract_id and r.revision=f.revision and r.home_contract_id=f.home_contract_id;
 source:=public.u6_coin_account('organization',host);target:=public.u6_coin_account('organization',home);
 update public.contract_rental_fees set paid=paid+p_paid,held=held+p_held where id=f.id;
 insert into public.coin_operations(id,actor_id,action,input,description) values(op,p_actor,'contract_rental_movement',jsonb_build_object('feeId',f.id,'paidChange',p_paid,'heldChange',p_held),'Расчёт аренды: счёт нанявшей организации → основная организация');
 insert into public.contract_rental_movements(operation_id,fee_id,paid_change,held_change) values(op,f.id,p_paid,p_held);
 perform public.u6_coin_entry(op,source,-p_paid,p_held);
 if p_paid<>0 then perform public.u6_coin_entry(op,target,p_paid);end if;
 return op;
end $$;
create function public.contract_rental_settle(p_contract uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare assessment jsonb;bases jsonb;s public.contract_guest_scopes%rowtype;c public.organization_contracts%rowtype;r record;
 f public.contract_rental_fees%rowtype;escrow public.contract_guest_escrows%rowtype;expected bigint;prior_amount bigint;plan_value jsonb;source uuid;wallet public.coin_accounts%rowtype;
 transfer_amount bigint;extra bigint;payment bigint;op uuid;changed boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into strict s from public.contract_guest_scopes where contract_id=p_contract and revision=p_revision;
 if s.accounting_version<>2 or not exists(select 1 from public.contract_guest_activations where contract_id=p_contract and revision=p_revision) then return jsonb_build_object('ready',false,'reason','rental_not_active');end if;
 update public.contract_guest_jobs set checked_at=clock_timestamp() where contract_id=p_contract and revision=p_revision;
 assessment:=public.contract_guest_participation(p_contract,p_revision);
 if assessment->>'ready' is distinct from 'true' then return assessment;end if;
 select * into strict c from public.organization_contracts where id=p_contract;source:=public.u6_coin_account('organization',c.organization_id);
 bases:=public.contract_rental_bases(p_contract,p_revision);
 for r in select * from public.contract_guest_requirements where contract_id=p_contract and revision=p_revision order by home_contract_id loop
   expected:=case when(assessment->>'played')::integer>0 then public.contract_rental_amount(r.compensation,(bases->>'organizationPrizes')::numeric,(bases->>'playerPayments')::numeric) else 0 end;
   plan_value:=jsonb_build_object('rule',r.compensation,'basis',bases,'played',(assessment->>'played')::integer,'amount',expected);
   select * into f from public.contract_rental_fees where contract_id=p_contract and revision=p_revision and home_contract_id=r.home_contract_id for update;
   changed:=f.id is null or f.plan is distinct from plan_value;prior_amount:=coalesce(f.amount,0);
   if f.id is null then
     select * into escrow from public.contract_guest_escrows where contract_id=p_contract and revision=p_revision and home_contract_id=r.home_contract_id for update;
     transfer_amount:=least(coalesce(escrow.held,0),expected);
     insert into public.contract_rental_fees(contract_id,revision,home_contract_id,amount,held,due_at,plan) values(p_contract,p_revision,r.home_contract_id,expected,transfer_amount,s.ends_at,plan_value) returning * into f;
     if escrow.held>0 then
       op:=gen_random_uuid();insert into public.coin_operations(id,action,input,description) values(op,'contract_rental_adopt_reserve',jsonb_build_object('feeId',f.id),'Перенос подписанного резерва в расчёт аренды');
       update public.contract_guest_escrows set held=0 where contract_id=p_contract and revision=p_revision and home_contract_id=r.home_contract_id;
       insert into public.contract_guest_escrow_movements(operation_id,contract_id,revision,home_contract_id,held_change,paid_change) values(op,p_contract,p_revision,r.home_contract_id,-escrow.held,0);
       perform public.u6_coin_entry(op,source,0,-(escrow.held-transfer_amount));
     end if;
   elsif changed then
     if f.paid>expected then perform public.contract_rental_move(f.id,expected-f.paid,0);end if;
     select * into strict f from public.contract_rental_fees where id=f.id;
     if f.held>expected-f.paid then perform public.contract_rental_move(f.id,0,expected-f.paid-f.held);end if;
     update public.contract_rental_fees set amount=expected,plan=plan_value where id=f.id;
   end if;
   if changed then insert into public.contract_rental_runs(fee_id,plan) values(f.id,plan_value);end if;
   select * into strict f from public.contract_rental_fees where id=f.id;
   -- Only the newly earned increase is automatically funded. Old unfunded
   -- debts remain manual after a later top-up, like player contract debts.
   if changed and expected>prior_amount then
     select * into strict wallet from public.coin_accounts where id=source for update;
     extra:=least(greatest(0,expected-f.paid-f.held),expected-prior_amount,greatest(0,wallet.balance-wallet.reserved));
     if extra>0 then perform public.contract_rental_move(f.id,0,extra);end if;
   end if;
   select * into strict f from public.contract_rental_fees where id=f.id;
   select * into strict wallet from public.coin_accounts where id=source for update;
   payment:=least(f.held,greatest(0,wallet.balance-wallet.reserved+f.held));
   if payment>0 then perform public.contract_rental_move(f.id,payment,-payment);end if;
 end loop;
 return assessment||jsonb_build_object('payer','organization','bases',bases);
end $$;

alter function public.contract_guest_credit_player(uuid,uuid,uuid,bigint) rename to contract_guest_credit_before_rental;
create function public.contract_guest_credit_player(p_operation uuid,p_obligation uuid,p_target uuid,p_amount bigint) returns void language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.contract_obligations o join public.contract_guest_scopes s on s.contract_id=o.contract_id and s.revision=o.revision where o.id=p_obligation and s.accounting_version=2) then
   perform public.u6_coin_entry(p_operation,p_target,p_amount);
 else perform public.contract_guest_credit_before_rental(p_operation,p_obligation,p_target,p_amount);end if;
end $$;
alter function public.contract_guest_settle(uuid,integer) rename to contract_guest_settle_before_rental;
create function public.contract_guest_settle(p_contract uuid,p_revision integer) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.contract_guest_scopes where contract_id=p_contract and revision=p_revision and accounting_version=2) then
   if current_setting('omcite.rental_defer',true)='on' then return jsonb_build_object('ready',false,'reason','rental_deferred');end if;
   return public.contract_rental_settle(p_contract,p_revision);
 end if;
 return public.contract_guest_settle_before_rental(p_contract,p_revision);
end $$;
alter function public.contract_has_debt(uuid) rename to contract_debt_before_rental;
create function public.contract_has_debt(p_organization uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.contract_debt_before_rental(p_organization) or exists(select 1 from public.contract_rental_fees f join public.organization_contracts c on c.id=f.contract_id where c.organization_id=p_organization and f.amount>f.paid and f.due_at<=clock_timestamp())
$$;

-- Rental personal prizes go to the host/guest according to the signed split.
-- The home organization's fee is a separate host expense, never a deduction.
do $$declare d text;needle text;begin
 d:=replace(pg_get_functiondef('public.personal_award_distribution(uuid,text,text)'::regprocedure),E'\r\n',E'\n');
 needle:='if matches=1 then'||E'\n   for home in';
 if position(needle in d)=0 then raise exception 'RENTAL_PERSONAL_AWARD_PATCH';end if;
 execute replace(d,needle,'if matches=1 and not exists(select 1 from public.contract_guest_scopes where contract_id=anchor.contract_id and revision=anchor.revision and accounting_version=2) then'||E'\n   for home in');
end $$;
create function public.contract_rental_refresh(p_contract uuid,p_revision integer) returns void language plpgsql security definer set search_path=public as $$
begin if current_setting('omcite.rental_defer',true)='on' then return;end if;
 if exists(select 1 from public.contract_guest_scopes where contract_id=p_contract and revision=p_revision and accounting_version=2) then perform public.contract_rental_settle(p_contract,p_revision);end if;end $$;
alter function public.contract_obligation_pay(uuid,uuid,uuid,bigint,boolean) rename to contract_pay_before_rental;
create function public.contract_obligation_pay(p_actor uuid,p_request uuid,p_obligation uuid,p_amount bigint,p_system boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare answer jsonb;o public.contract_obligations%rowtype;begin
 answer:=public.contract_pay_before_rental(p_actor,p_request,p_obligation,p_amount,p_system);
 select * into strict o from public.contract_obligations where id=p_obligation;perform public.contract_rental_refresh(o.contract_id,o.revision);return answer;
end $$;
alter function public.contract_obligation_cancel_internal(uuid,uuid,uuid,text) rename to contract_cancel_before_rental;
create function public.contract_obligation_cancel_internal(p_actor uuid,p_request uuid,p_obligation uuid,p_reason text) returns jsonb language plpgsql security definer set search_path=public as $$
declare answer jsonb;o public.contract_obligations%rowtype;begin
 answer:=public.contract_cancel_before_rental(p_actor,p_request,p_obligation,p_reason);
 select * into strict o from public.contract_obligations where id=p_obligation;perform public.contract_rental_refresh(o.contract_id,o.revision);return answer;
end $$;
create function public.contract_rental_refresh_award(p_fund uuid) returns void language plpgsql security definer set search_path=public as $$
declare f public.personal_award_funds%rowtype;item record;begin
 if current_setting('omcite.rental_defer',true)='on' then return;end if;
 select * into strict f from public.personal_award_funds where id=p_fund;
 for item in select s.contract_id,s.revision from public.contract_guest_scopes s join public.contract_guest_activations a using(contract_id,revision)
   where s.accounting_version=2 and s.event_id=f.event_id and(f.session_id is null or f.session_id=any(s.session_ids)) loop
   perform public.contract_rental_settle(item.contract_id,item.revision);
 end loop;
end $$;
-- Finish all player entitlements before funding additional host expenses.
-- A fee callback must not consume another player's still-unallocated prize.
alter function public.contract_session_publish_settle(uuid) rename to contract_publish_before_rental;
create function public.contract_session_publish_settle(p_session uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare answer jsonb;previous text:=coalesce(current_setting('omcite.rental_defer',true),'off');item record;
begin
 perform set_config('omcite.rental_defer','on',true);
 answer:=public.contract_publish_before_rental(p_session);
 perform set_config('omcite.rental_defer',previous,true);
 if previous<>'on' then
   for item in select s.contract_id,s.revision from public.contract_guest_scopes s join public.contract_guest_activations a using(contract_id,revision) where s.accounting_version=2 and p_session=any(s.session_ids) loop
     perform public.contract_rental_settle(item.contract_id,item.revision);
   end loop;
 end if;
 return answer;
exception when others then perform set_config('omcite.rental_defer',previous,true);raise;
end $$;
-- The same guarantee applies to administrative reopening/closing of a prize
-- fund, which can redistribute prize shares outside the publication wrapper.
alter function public.contract_session_prize_settle(uuid) rename to contract_prizes_before_rental;
create function public.contract_session_prize_settle(p_session uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare answer jsonb;previous text:=coalesce(current_setting('omcite.rental_defer',true),'off');item record;
begin
 perform set_config('omcite.rental_defer','on',true);answer:=public.contract_prizes_before_rental(p_session);perform set_config('omcite.rental_defer',previous,true);
 if previous<>'on' then
   for item in select s.contract_id,s.revision from public.contract_guest_scopes s join public.contract_guest_activations a using(contract_id,revision) where s.accounting_version=2 and p_session=any(s.session_ids) loop perform public.contract_rental_settle(item.contract_id,item.revision);end loop;
 end if;
 return answer;
exception when others then perform set_config('omcite.rental_defer',previous,true);raise;
end $$;
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.personal_award_settle(uuid,boolean)'::regprocedure);
 needle:='return jsonb_build_object(''pending'',pending,''paid'',paid,''reason'',error_value);';
 if position(needle in d)=0 then raise exception 'RENTAL_AWARD_SETTLE_PATCH';end if;
 execute replace(d,needle,'perform public.contract_rental_refresh_award(p_fund); '||needle);
 d:=pg_get_functiondef('public.personal_award_cancel(uuid)'::regprocedure);
 needle:='end if;'||E'\nend';
 d:=replace(d,E'\r\n',E'\n');if position(needle in d)=0 then raise exception 'RENTAL_AWARD_CANCEL_PATCH';end if;
 execute replace(d,needle,'end if; perform public.contract_rental_refresh_award(p_fund);'||E'\nend');
end $$;
create function public.contract_rental_query(p_actor uuid,p_contract uuid default null,p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;host_access boolean;rows_value jsonb;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'CONTRACT_AUTH';end if;
 if p_offset is null or p_offset not between 0 and 1000000 then raise exception 'CONTRACT_INPUT';end if;
 if p_contract is null then
   select coalesce(jsonb_agg(to_jsonb(entry)),'[]') into rows_value from(
     select distinct gc.id,host.name as "hostName",p.nickname as "playerName",e.title as "eventTitle",gc.created_at
     from public.contract_guest_requirements r join public.organization_contracts gc on gc.id=r.contract_id
     join public.contract_guest_scopes s using(contract_id,revision) join public.contract_guest_activations a using(contract_id,revision)
     join public.teams host on host.id=gc.organization_id join public.profiles p on p.id=gc.player_id join public.events e on e.id=gc.event_id
     where s.accounting_version=2 and public.organization_can_spend(r.organization_id,p_actor)
     order by gc.created_at desc,gc.id desc limit 31 offset p_offset
   ) entry;
   return jsonb_build_object('incoming',coalesce((select jsonb_agg(value order by n) from jsonb_array_elements(rows_value) with ordinality x(value,n) where n<=30),'[]'),'hasMore',jsonb_array_length(rows_value)>30);
 end if;
 select * into c from public.organization_contracts where id=p_contract;
 if c.id is null or c.kind<>'guest' then raise exception 'CONTRACT_NOT_FOUND';end if;
 host_access:=p_actor=c.player_id or coalesce(public.can_manage_organization_contracts(c.organization_id,p_actor),false);
 if not host_access and not exists(select 1 from public.contract_guest_requirements r where r.contract_id=c.id and public.organization_can_spend(r.organization_id,p_actor)) then raise exception 'CONTRACT_FORBIDDEN';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'revision',r.revision,'organizationId',r.organization_id,'organizationName',t.name,
   'rule',r.compensation,'accountingVersion',s.accounting_version,'amount',f.amount,'paid',coalesce(f.paid,0),'held',coalesce(f.held,e.held,0),
   'dueAt',f.due_at,'plan',f.plan,'remaining',greatest(0,coalesce(f.amount-f.paid,0))) order by r.revision desc,t.name),'[]') into rows_value
 from public.contract_guest_requirements r join public.contract_guest_scopes s using(contract_id,revision) join public.teams t on t.id=r.organization_id
 left join public.contract_rental_fees f using(contract_id,revision,home_contract_id) left join public.contract_guest_escrows e using(contract_id,revision,home_contract_id)
 where r.contract_id=c.id and(host_access or public.organization_can_spend(r.organization_id,p_actor));
 return jsonb_build_object('rows',rows_value,'canPay',coalesce(public.organization_can_spend(c.organization_id,p_actor),false));
end $$;
create function public.contract_rental_pay(p_actor uuid,p_request uuid,p_fee uuid,p_amount bigint) returns jsonb language plpgsql security definer set search_path=public as $$
declare f public.contract_rental_fees%rowtype;host uuid;source uuid;wallet public.coin_accounts%rowtype;old public.coin_operations%rowtype;payload jsonb;answer jsonb;needed bigint;assessment jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into f from public.contract_rental_fees where id=p_fee for update;
 select organization_id into host from public.organization_contracts where id=f.contract_id;
 if f.id is null or not coalesce(public.organization_can_spend(host,p_actor),false) then raise exception 'CONTRACT_FINANCE';end if;
 if p_request is null or p_amount is null or p_amount not between 1 and 1000000000000 then raise exception 'CONTRACT_INPUT';end if;
 payload:=jsonb_build_object('feeId',p_fee,'amount',p_amount);select * into old from public.coin_operations where id=p_request;
 if found then if old.actor_id is distinct from p_actor or old.action<>'contract_rental_manual' or old.input is distinct from payload then raise exception 'CONTRACT_CONFLICT';end if;return old.result;end if;
 -- Reconcile actual evidence before accepting a stale displayed debt.
 assessment:=public.contract_rental_settle(f.contract_id,f.revision);
 if assessment->>'ready' is distinct from 'true' then raise exception 'CONTRACT_RENTAL_PENDING';end if;
 select * into strict f from public.contract_rental_fees where id=p_fee;
 if f.amount-f.paid<p_amount or f.due_at>clock_timestamp() then raise exception 'CONTRACT_PAYMENT_AMOUNT';end if;
 source:=public.u6_coin_account('organization',host);select * into strict wallet from public.coin_accounts where id=source for update;
 needed:=greatest(0,p_amount-f.held);if wallet.balance-wallet.reserved<needed then raise exception 'CONTRACT_FUNDS';end if;
 insert into public.coin_operations(id,actor_id,action,input,description) values(p_request,p_actor,'contract_rental_manual',payload,'Подтверждение оплаты долга основной организации за аренду');
 if needed>0 then perform public.contract_rental_move(f.id,0,needed,p_actor);end if;
 perform public.contract_rental_move(f.id,p_amount,-p_amount,p_actor);
 answer:=jsonb_build_object('success',true,'paid',p_amount,'remaining',f.amount-f.paid-p_amount);
 update public.coin_operations set result=answer where id=p_request;return answer;
end $$;
do $$declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and(proname like 'contract_rental_%' or proname in(
 'contract_guest_credit_player','contract_guest_credit_before_rental','contract_guest_settle','contract_guest_settle_before_rental',
 'contract_debt_before_rental','contract_has_debt','contract_obligation_pay','contract_pay_before_rental','contract_obligation_cancel_internal','contract_cancel_before_rental','contract_publish_before_rental','contract_session_publish_settle','contract_prizes_before_rental','contract_session_prize_settle')) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;
end $$;
grant execute on function public.contract_rental_options(uuid,uuid,uuid,uuid,uuid),public.contract_rental_query(uuid,uuid,integer),public.contract_rental_pay(uuid,uuid,uuid,bigint) to service_role;
notify pgrst,'reload schema';
commit;
