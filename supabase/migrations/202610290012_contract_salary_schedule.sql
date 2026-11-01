-- Internal payroll engine. No public activation endpoint or cron hook yet.
begin;
create table public.contract_salary_schedules(
 contract_id uuid not null,
 revision integer not null,
 starts_at timestamptz not null check(isfinite(starts_at)),
 anchor_at timestamptz not null check(isfinite(anchor_at) and anchor_at<=starts_at),
 ends_at timestamptz check(ends_at is null or(isfinite(ends_at) and ends_at>=starts_at)),
 amount bigint not null check(amount between 0 and 1000000000000),
 period_days integer not null check(period_days between 1 and 1000000),
 next_index integer not null default 0 check(next_index>=0),
 finished boolean not null default false,
 primary key(contract_id,revision),
 foreign key(contract_id,revision) references public.organization_contract_versions(contract_id,revision)
);
create table public.contract_salary_periods(
 contract_id uuid not null,
 revision integer not null,
 period_index integer not null check(period_index>=0),
 starts_at timestamptz not null,
 due_at timestamptz not null check(due_at>starts_at),
 amount bigint not null check(amount between 0 and 1000000000000),
 held bigint not null default 0 check(held>=0 and held<=amount),
 reserve_operation uuid references public.coin_operations(id),
 allocation_operation uuid references public.coin_operations(id),
 obligation_id uuid unique references public.contract_obligations(id),
 processed_at timestamptz,
 cancelled_at timestamptz,
 primary key(contract_id,revision,period_index),
 foreign key(contract_id,revision) references public.contract_salary_schedules(contract_id,revision)
);
create table public.contract_salary_adjustments(
 operation_id uuid primary key references public.coin_operations(id),
 contract_id uuid not null,revision integer not null,period_index integer not null,
 previous_due_at timestamptz not null,new_due_at timestamptz not null,
 previous_amount bigint not null,new_amount bigint not null,released bigint not null check(released>=0),
 cancelled boolean not null,reason text not null,created_at timestamptz not null default clock_timestamp(),
 foreign key(contract_id,revision,period_index) references public.contract_salary_periods(contract_id,revision,period_index)
);
alter table public.contract_salary_schedules enable row level security;
alter table public.contract_salary_periods enable row level security;
alter table public.contract_salary_adjustments enable row level security;
revoke all on public.contract_salary_schedules,public.contract_salary_periods,public.contract_salary_adjustments from public,anon,authenticated,service_role;

-- A delayed worker must not open a withdrawal window after payday. Inspect the
-- next unposted period (and its successor if the first partial period floors to
-- zero), without issuing a payment or processing the whole history in a read.
create or replace function public.contract_has_debt(p_organization uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.contract_obligations o join public.organization_contracts c on c.id=o.contract_id
   where c.organization_id=p_organization and o.due_at<=now() and o.paid<o.amount)
 or exists(select 1 from public.contract_salary_schedules s join public.organization_contracts c on c.id=s.contract_id
   cross join lateral (values(s.next_index::numeric),(s.next_index::numeric+1)) n(i)
   cross join lateral (select greatest(s.starts_at,s.anchor_at+make_interval(secs=>s.period_days::numeric*86400*n.i)) starts,
     least(s.ends_at,s.anchor_at+make_interval(secs=>s.period_days::numeric*86400*(n.i+1))) ends) period
   where c.organization_id=p_organization and not s.finished and period.ends>period.starts and period.ends<=now()
   and floor(s.amount::numeric*extract(epoch from(period.ends-period.starts))/(s.period_days::numeric*86400))>0)
$$;

-- A historical unfunded liability must not be auto-funded on a late retry.
-- Mandatory initial funding remains atomic even when immediately payable.
do $$ declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_obligation_create(uuid,integer,text,text,bigint,timestamptz,boolean)'::regprocedure);
 needle:='if p_amount>0 and a.balance-a.reserved>=p_amount then';
 if position(needle in d)=0 then raise exception 'CONTRACT_RESERVE_DUE_PATCH';end if;
 d:=replace(d,needle,'if p_amount>0 and a.balance-a.reserved>=p_amount and (p_require_reserve or p_due>clock_timestamp()) then');
 execute d;
 d:=pg_get_functiondef('public.contract_obligation_pay(uuid,uuid,uuid,bigint,boolean)'::regprocedure);
 needle:='if o.due_at>now() then';
 if position(needle in d)=0 then raise exception 'CONTRACT_PAYMENT_CLOCK_PATCH';end if;
 d:=replace(d,needle,'if o.due_at>clock_timestamp() then');
 execute d;
end $$;

create function public.contract_salary_prepare(p_contract uuid,p_revision integer,p_index integer,p_required boolean)
returns void language plpgsql security definer set search_path=public as $$
declare s public.contract_salary_schedules%rowtype;c public.organization_contracts%rowtype;p public.contract_salary_periods%rowtype;
 a public.coin_accounts%rowtype;start_at timestamptz;due timestamptz;pay_amount bigint;duration_seconds numeric;op uuid;existing boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_index is null or p_index<0 or p_required is null then raise exception 'CONTRACT_INPUT';end if;
 select * into s from public.contract_salary_schedules where contract_id=p_contract and revision=p_revision for update;
 if not found then raise exception 'CONTRACT_NOT_FOUND';end if;
 select * into p from public.contract_salary_periods where contract_id=p_contract and revision=p_revision and period_index=p_index for update;
 existing:=found;
 if existing and (p.cancelled_at is not null or p.processed_at is not null or p.held>0) then return;end if;
 duration_seconds:=s.period_days::numeric*86400;
 -- Seconds, not session timezone/calendar days: N days are exactly N*24 hours.
 start_at:=greatest(s.starts_at,s.anchor_at+make_interval(secs=>duration_seconds*p_index));
 if s.ends_at is not null and start_at>=s.ends_at then return;end if;
 due:=least(s.anchor_at+make_interval(secs=>duration_seconds*(p_index::numeric+1)),s.ends_at);
 if due<=start_at then raise exception 'CONTRACT_PAYROLL_PERIOD';end if;
 pay_amount:=floor(s.amount::numeric*extract(epoch from(due-start_at))/duration_seconds)::bigint;
 if existing and (p.starts_at<>start_at or p.due_at<>due or p.amount<>pay_amount) then raise exception 'CONTRACT_PAYROLL_PERIOD';end if;
 select * into strict c from public.organization_contracts where id=p_contract;
 select * into a from public.coin_accounts where id=public.u6_coin_account('organization',c.organization_id) for update;
 if p_required and a.balance-a.reserved<pay_amount then raise exception 'CONTRACT_FUNDS';end if;
 if not existing then
   insert into public.contract_salary_periods(contract_id,revision,period_index,starts_at,due_at,amount)
   values(p_contract,p_revision,p_index,start_at,due,pay_amount);
 end if;
 if pay_amount>0 and a.balance-a.reserved>=pay_amount and (p_required or due>clock_timestamp()) then
   op:=gen_random_uuid();
   insert into public.coin_operations(id,action,input,description) values(op,'contract_salary_reserve',
     jsonb_build_object('contractId',p_contract,'revision',p_revision,'period',p_index),'Резерв зарплатного периода');
   perform public.u6_coin_entry(op,a.id,0,pay_amount);
   update public.contract_salary_periods set held=pay_amount,reserve_operation=op where contract_id=p_contract and revision=p_revision and period_index=p_index;
 end if;
end $$;

create function public.contract_salary_schedule_create(p_contract uuid,p_revision integer,p_effective timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare t jsonb;previous public.contract_salary_schedules%rowtype;finish timestamptz;anchor timestamptz;first_index integer;days integer;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_effective is null or not isfinite(p_effective) then raise exception 'CONTRACT_DATES';end if;
 select terms into t from public.organization_contract_versions where contract_id=p_contract and revision=p_revision;
 if t is null then raise exception 'CONTRACT_NOT_FOUND';end if;
 perform public.contract_validate_terms(t);
 if t->'financial'->'salary'='null'::jsonb then return;end if;
 finish:=(t->>'endsAt')::timestamptz;
 if p_effective<(t->>'startsAt')::timestamptz or finish<=p_effective then raise exception 'CONTRACT_DATES';end if;
 select * into previous from public.contract_salary_schedules where contract_id=p_contract and revision=p_revision;
 if found then
   if previous.starts_at<>p_effective then raise exception 'CONTRACT_CONFLICT';end if;
   return;
 end if;
 -- Amendments need a closed/split prior schedule. Never overlap payroll while
 -- the amendment/termination transaction has not implemented that transition.
 if exists(select 1 from public.contract_salary_schedules where contract_id=p_contract
   and (ends_at is null or ends_at>p_effective) and (finish is null or starts_at<finish)) then raise exception 'CONTRACT_PAYROLL_OVERLAP';end if;
 days:=(t->'financial'->'salary'->>'periodDays')::integer;
 -- A renewal with the same cadence continues the existing calendar, including
 -- the unpaid remainder of the current period. No new full period at signing.
 select * into previous from public.contract_salary_schedules where contract_id=p_contract and ends_at=p_effective
   and period_days=days and starts_at<p_effective order by starts_at desc,revision desc limit 1;
 anchor:=case when found then previous.anchor_at else p_effective end;
 first_index:=floor(extract(epoch from(p_effective-anchor))/(days::numeric*86400))::integer;
 insert into public.contract_salary_schedules(contract_id,revision,starts_at,anchor_at,ends_at,amount,period_days,next_index)
 values(p_contract,p_revision,p_effective,anchor,finish,(t->'financial'->'salary'->>'amount')::bigint,days,first_index);
 perform public.contract_salary_prepare(p_contract,p_revision,first_index,true);
end $$;

-- Shorten only the unearned part. Already posted liabilities are immutable;
-- retrospective corrections require a distinct compensation/reversal flow.
create function public.contract_salary_schedule_close(p_contract uuid,p_revision integer,p_end timestamptz,p_reason text)
returns void language plpgsql security definer set search_path=public as $$
declare s public.contract_salary_schedules%rowtype;p public.contract_salary_periods%rowtype;
 closing timestamptz;pay_amount bigint;release bigint;org uuid;account_id uuid;op uuid;cancelled boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_end is null or not isfinite(p_end) or p_reason is null or length(p_reason) not between 1 and 200 then raise exception 'CONTRACT_INPUT';end if;
 select * into s from public.contract_salary_schedules where contract_id=p_contract and revision=p_revision for update;
 if not found then return;end if;
 closing:=greatest(p_end,s.starts_at);
 if s.ends_at is not null and closing>=s.ends_at then return;end if;
 if exists(select 1 from public.contract_salary_periods where contract_id=p_contract and revision=p_revision and processed_at is not null and due_at>closing)
 then raise exception 'CONTRACT_PAYROLL_ALREADY_POSTED';end if;
 select organization_id into org from public.organization_contracts where id=p_contract;
 account_id:=public.u6_coin_account('organization',org);
 for p in select * from public.contract_salary_periods where contract_id=p_contract and revision=p_revision
   and processed_at is null and cancelled_at is null and due_at>closing order by period_index for update loop
   cancelled:=p.starts_at>=closing;
   pay_amount:=case when cancelled then 0 else floor(s.amount::numeric*extract(epoch from(closing-p.starts_at))/(s.period_days::numeric*86400))::bigint end;
   release:=greatest(0,p.held-pay_amount);
   op:=gen_random_uuid();
   insert into public.coin_operations(id,action,input,description) values(op,'contract_salary_adjust',
     jsonb_build_object('contractId',p_contract,'revision',p_revision,'period',p.period_index,'reason',p_reason),'Перерасчёт незавершённого зарплатного периода');
   perform public.u6_coin_entry(op,account_id,0,-release);
   insert into public.contract_salary_adjustments(operation_id,contract_id,revision,period_index,previous_due_at,new_due_at,previous_amount,new_amount,released,cancelled,reason)
   values(op,p_contract,p_revision,p.period_index,p.due_at,case when cancelled then p.due_at else closing end,p.amount,pay_amount,release,cancelled,p_reason);
   update public.contract_salary_periods set amount=pay_amount,held=held-release,
     due_at=case when cancelled then due_at else closing end,cancelled_at=case when cancelled then clock_timestamp() else null end
   where contract_id=p_contract and revision=p_revision and period_index=p.period_index;
 end loop;
 update public.contract_salary_schedules set ends_at=closing,finished=false where contract_id=p_contract and revision=p_revision;
end $$;

create function public.contract_salary_process(p_contract uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.contract_salary_schedules%rowtype;p public.contract_salary_periods%rowtype;
 obligation public.contract_obligations%rowtype;obligation_key uuid;org uuid;account_id uuid;op uuid;used integer:=0;cursor_index integer;has_more boolean:=false;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select organization_id into org from public.organization_contracts where id=p_contract;
 if org is null then raise exception 'CONTRACT_NOT_FOUND';end if;
 account_id:=public.u6_coin_account('organization',org);
 for s in select * from public.contract_salary_schedules where contract_id=p_contract and not finished order by starts_at,revision for update loop
   cursor_index:=s.next_index;
   loop
     if used>=100 then has_more:=true;exit;end if;
     perform public.contract_salary_prepare(s.contract_id,s.revision,cursor_index,false);
     select * into p from public.contract_salary_periods where contract_id=s.contract_id and revision=s.revision and period_index=cursor_index for update;
     if not found then update public.contract_salary_schedules set finished=true where contract_id=s.contract_id and revision=s.revision;exit;end if;
     if p.cancelled_at is not null then update public.contract_salary_schedules set finished=true where contract_id=s.contract_id and revision=s.revision;exit;end if;
     if p.due_at>clock_timestamp() then exit;end if;
     if p.processed_at is null then
       obligation_key:=public.contract_obligation_create(s.contract_id,s.revision,'salary',
         'period:'||s.revision||':'||cursor_index,p.amount,p.due_at,false);
       select * into strict obligation from public.contract_obligations where id=obligation_key for update;
       if p.held>0 then
         -- Ownership of an existing reserve moves from the payroll period to
         -- its now-due liability. Physical reserved balance does not change.
         if obligation.held<>0 or obligation.paid<>0 then raise exception 'CONTRACT_OBLIGATION_CONFLICT';end if;
         op:=gen_random_uuid();
         insert into public.coin_operations(id,action,input,description) values(op,'contract_salary_allocate',
           jsonb_build_object('obligationId',obligation.id,'period',cursor_index),'Зарплатный резерв передан начислению');
         perform public.u6_coin_entry(op,account_id,0,0);
         update public.contract_obligations set held=p.held where id=obligation.id;
         insert into public.contract_obligation_movements(operation_id,obligation_id,held_change) values(op,obligation.id,p.held);
         update public.contract_salary_periods set held=0,allocation_operation=op where contract_id=s.contract_id and revision=s.revision and period_index=cursor_index;
         begin
           perform public.contract_obligation_pay(null,gen_random_uuid(),obligation.id,p.amount,true);
         exception when others then
           if sqlerrm<>'CONTRACT_FUNDS' then raise;end if;
           -- Admin debit can invalidate funding. Preserve liability and hold;
           -- this processed period is NEVER retried automatically after top-up.
         end;
       end if;
       update public.contract_salary_periods set processed_at=clock_timestamp(),obligation_id=obligation.id where contract_id=s.contract_id and revision=s.revision and period_index=cursor_index;
     end if;
     cursor_index:=cursor_index+1;used:=used+1;
     update public.contract_salary_schedules set next_index=cursor_index where contract_id=s.contract_id and revision=s.revision;
   end loop;
   if used>=100 then exit;end if;
 end loop;
 return jsonb_build_object('processed',used,'hasMore',has_more);
end $$;
revoke all on function public.contract_salary_prepare(uuid,integer,integer,boolean),public.contract_salary_schedule_create(uuid,integer,timestamptz),
 public.contract_salary_schedule_close(uuid,integer,timestamptz,text),public.contract_salary_process(uuid) from public,anon,authenticated,service_role;
commit;
