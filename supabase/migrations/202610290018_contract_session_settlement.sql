-- Internal settlement only: public signing/cron remain disabled until every
-- clause, participation limit and guest consent is connected.
begin;
-- Share the exact reserve-safe return transaction with result corrections.
-- A system correction has no human actor; never impersonate the owner.
alter function public.contract_obligation_cancel(uuid,uuid,uuid,text) rename to contract_obligation_cancel_internal;
do $$ declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_obligation_cancel_internal(uuid,uuid,uuid,text)'::regprocedure);
 needle:='if not coalesce(public.is_organization_owner(c.organization_id,p_actor),false) then';
 if position(needle in d)=0 then raise exception 'CONTRACT_SYSTEM_CANCEL_PATCH';end if;
 execute replace(d,needle,'if p_actor is not null and not coalesce(public.is_organization_owner(c.organization_id,p_actor),false) then');
end $$;
create function public.contract_obligation_cancel(p_actor uuid,p_request uuid,p_obligation uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if p_actor is null then raise exception 'CONTRACT_AUTH';end if;
 return public.contract_obligation_cancel_internal(p_actor,p_request,p_obligation,p_reason);
end $$;
revoke all on function public.contract_obligation_cancel_internal(uuid,uuid,uuid,text),public.contract_obligation_cancel(uuid,uuid,uuid,text)
 from public,anon,authenticated,service_role;
grant execute on function public.contract_obligation_cancel(uuid,uuid,uuid,text) to service_role;

create table public.contract_session_settlement_runs(
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.contract_session_frames(session_id),
 contract_id uuid not null references public.organization_contracts(id),
 publication_revision integer not null,
 plan jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create index contract_session_runs_latest on public.contract_session_settlement_runs(session_id,contract_id,created_at desc,id);
create table public.contract_session_charges(
 session_id uuid not null,
 contract_id uuid not null,
 kind text not null,
 source_key text not null,
 generation integer not null check(generation>0),
 obligation_id uuid not null unique references public.contract_obligations(id),
 run_id uuid not null references public.contract_session_settlement_runs(id),
 primary key(session_id,contract_id,kind,source_key,generation),
 foreign key(session_id,contract_id) references public.contract_session_terms(session_id,contract_id)
);
alter table public.contract_session_settlement_runs enable row level security;
alter table public.contract_session_charges enable row level security;
revoke all on public.contract_session_settlement_runs,public.contract_session_charges from public,anon,authenticated,service_role;
create trigger contract_session_runs_immutable before update or delete on public.contract_session_settlement_runs
 for each row execute function public.contract_frozen_guard();
create trigger contract_session_charges_immutable before update or delete on public.contract_session_charges
 for each row execute function public.contract_frozen_guard();

create function public.contract_session_settle(p_session uuid,p_contract uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare plan jsonb;previous public.contract_session_settlement_runs%rowtype;t public.contract_session_terms%rowtype;
 row record;entry jsonb;expected numeric;active_total numeric;delta bigint;run uuid;obligation uuid;o public.contract_obligations%rowtype;
 generation integer;created_count integer:=0;cancelled_count integer:=0;paid_count integer:=0;pub_revision integer;due timestamptz;charge_due timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 plan:=public.contract_session_accrual_plan(p_session,p_contract);
 if plan->>'ready' is distinct from 'true' then return plan||jsonb_build_object('applied',false);end if;
 select * into strict t from public.contract_session_terms where session_id=p_session and contract_id=p_contract;
 -- Counting and exhausting a signed appearance limit must precede payments.
 if t.terms->'limit' is not null and t.terms->'limit'<>'null'::jsonb then
   return jsonb_build_object('ready',false,'applied',false,'reason','participation_limit_pending');
 end if;
 select revision into pub_revision from public.competition_publications where session_id=p_session;
 if pub_revision is null then return jsonb_build_object('ready',false,'applied',false,'reason','unpublished');end if;
 select * into previous from public.contract_session_settlement_runs where session_id=p_session and contract_id=p_contract
 order by created_at desc,id desc limit 1;
 -- A retry, comment edit or identical publication must not fund old debt from
 -- a later top-up, reissue a payment, or undo a manual owner cancellation.
 if previous.id is not null and previous.plan=plan then
   return jsonb_build_object('ready',true,'applied',true,'unchanged',true,'runId',previous.id);
 end if;
 due:=clock_timestamp();
 insert into public.contract_session_settlement_runs(session_id,contract_id,publication_revision,plan,created_at)
 values(p_session,p_contract,pub_revision,plan,due) returning id into run;

 -- Reconcile the old and new amount per sporting fact. Increases add only the
 -- difference at today's deadline; decreases cancel newest tranches first and
 -- retain the earliest deadline for any replacement balance. This keeps old
 -- due dates intact and avoids briefly paying a full correction twice.
 for row in
   select keys.kind,keys.source_key from(
     select ch.kind,ch.source_key from public.contract_session_charges ch where ch.session_id=p_session and ch.contract_id=p_contract
     union select e->>'kind',e->>'source' from jsonb_array_elements(plan->'entries') e
   )keys order by keys.kind,keys.source_key
 loop
   if row.kind not in('appearance','kill','mvp') then raise exception 'CONTRACT_RESULT_INPUT';end if;
   if exists(select 1 from public.contract_session_charges ch join public.contract_obligations x on x.id=ch.obligation_id
     where ch.session_id=p_session and ch.contract_id=p_contract and ch.kind=row.kind and ch.source_key=row.source_key
       and x.cancelled_by is not null) then continue;end if;
   select coalesce(max((e->>'amount')::numeric),0) into expected from jsonb_array_elements(plan->'entries') e
   where e->>'kind'=row.kind and e->>'source'=row.source_key;
   select coalesce(sum(x.amount),0),min(x.due_at) into active_total,charge_due
   from public.contract_session_charges ch join public.contract_obligations x on x.id=ch.obligation_id
   where ch.session_id=p_session and ch.contract_id=p_contract and ch.kind=row.kind and ch.source_key=row.source_key and x.cancelled_at is null;
   if expected=active_total then continue;end if;
   if active_total>expected then
     for o in select x.* from public.contract_session_charges ch join public.contract_obligations x on x.id=ch.obligation_id
       where ch.session_id=p_session and ch.contract_id=p_contract and ch.kind=row.kind and ch.source_key=row.source_key and x.cancelled_at is null
       order by ch.generation desc for update of x
     loop
       exit when active_total<=expected;
       perform public.contract_obligation_cancel_internal(null,gen_random_uuid(),o.id,'Исправление опубликованных результатов сессии');
       active_total:=active_total-o.amount;cancelled_count:=cancelled_count+1;
     end loop;
     charge_due:=coalesce(charge_due,due);
   else
     charge_due:=due;
   end if;
   delta:=floor(expected-active_total)::bigint;
   if delta<=0 then continue;end if;
   select coalesce(max(ch.generation),0)+1 into generation from public.contract_session_charges ch
   where ch.session_id=p_session and ch.contract_id=p_contract and ch.kind=row.kind and ch.source_key=row.source_key;
   obligation:=public.contract_obligation_create(p_contract,t.revision,row.kind,row.source_key||':revision:'||generation,delta,charge_due,
     exists(select 1 from public.coin_accounts a where a.team_id=t.organization_id and a.balance-a.reserved>=delta));
   insert into public.contract_session_charges(session_id,contract_id,kind,source_key,generation,obligation_id,run_id)
   values(p_session,p_contract,row.kind,row.source_key,generation,obligation,run);
   created_count:=created_count+1;
   select * into strict o from public.contract_obligations where id=obligation;
   if o.held=o.amount and o.amount>0 then
     perform public.contract_obligation_pay(null,gen_random_uuid(),o.id,o.amount,true);
     paid_count:=paid_count+1;
   end if;
 end loop;
 return jsonb_build_object('ready',true,'applied',true,'runId',run,'created',created_count,'cancelled',cancelled_count,'paid',paid_count);
end $$;
revoke all on function public.contract_session_settle(uuid,uuid) from public,anon,authenticated,service_role;
commit;
