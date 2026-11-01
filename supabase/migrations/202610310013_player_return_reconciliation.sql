-- Private financial worker. A later verified administrative cancellation
-- creates its immutable job from signed clauses; no caller can create one.
begin;
create table public.player_return_jobs(
 id uuid primary key default gen_random_uuid(),deal_id uuid not null,revision integer not null,
 contract_id uuid not null references public.organization_contracts(id),claim_revision integer not null,
 player_id uuid not null references public.profiles(id),organization_id uuid not null references public.teams(id),
 cause text not null check(cause in('mutual','player_fault','hiring_organization_fault','previous_organization_fault','no_fault')),
 policy jsonb not null,mode text not null check(mode in('fixed','recalculate')),fixed_targets jsonb,
 eligible_revisions integer[] not null check(cardinality(eligible_revisions)>0),cutoff_at timestamptz not null,
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 unique(deal_id,revision),unique(contract_id),foreign key(deal_id,revision) references public.market_versions(deal_id,revision),
 foreign key(contract_id,claim_revision) references public.organization_contract_versions(contract_id,revision),
 check(mode<>'fixed' or fixed_targets is not null)
);
create table public.player_return_runs(
 id uuid primary key default gen_random_uuid(),job_id uuid not null references public.player_return_jobs(id),
 source_state jsonb not null,targets jsonb not null,closed_sources jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create table public.player_return_claims(
 run_id uuid not null references public.player_return_runs(id),category text not null check(category in('signing','salary','appearance','kill','mvp','ranking','prize','personalAward')),
 claim_id uuid primary key references public.contract_player_claims(id)
);
create table public.player_return_refunds(
 run_id uuid not null references public.player_return_runs(id),category text not null check(category in('signing','salary','appearance','kill','mvp','ranking','prize','personalAward')),
 obligation_id uuid primary key references public.contract_obligations(id)
);
create index player_return_runs_job on public.player_return_runs(job_id,created_at);
create index personal_award_contract_receipts on public.personal_award_payments((plan->>'contractId')) where reversed_at is null;
do $$declare relation text;begin
 foreach relation in array array['player_return_jobs','player_return_runs','player_return_claims','player_return_refunds'] loop
   execute format('alter table public.%I enable row level security',relation);
   execute format('revoke all on public.%I from public,anon,authenticated,service_role',relation);
   execute format('create trigger player_return_immutable before update or delete on public.%I for each row execute function public.contract_frozen_guard()',relation);
 end loop;
end $$;
alter table public.contract_player_claims drop constraint contract_player_claims_kind_check,drop constraint contract_claim_source;
alter table public.contract_player_claims add constraint contract_player_claims_kind_check check(kind in('return','no_show','transfer_return')),
 add constraint contract_claim_source check((kind='return' and obligation_id is not null and session_id is null)
 or(kind='no_show' and obligation_id is null and contract_id is not null and revision is not null and session_id is not null and player_value is not null)
 or(kind='transfer_return' and obligation_id is null and contract_id is not null and revision is not null and session_id is null and player_value is null));

create function public.player_return_state(p_job uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare j public.player_return_jobs%rowtype;category_value text;paid_value numeric;collected numeric;refunded numeric;player_debt numeric;organization_debt numeric;
 paid_json jsonb:='{}';collected_json jsonb:='{}';refunded_json jsonb:='{}';player_json jsonb:='{}';organization_json jsonb:='{}';
begin
 select * into strict j from public.player_return_jobs where id=p_job;
 if not exists(select 1 from public.organization_contracts where id=j.contract_id and kind='main' and player_id=j.player_id and organization_id=j.organization_id) then raise exception 'CONTRACT_PARTIES';end if;
 foreach category_value in array array['signing','salary','appearance','kill','mvp','ranking','prize','personalAward'] loop
   if category_value='personalAward' then
     select coalesce(sum(r.amount),0) into paid_value from public.personal_award_payments p
       join public.personal_award_receipts r on r.payment_id=p.id join public.coin_accounts a on a.id=r.account_id
       where p.plan->>'contractId'=j.contract_id::text and(p.plan->>'revision')::integer=any(j.eligible_revisions)
       and p.reversed_at is null and a.user_id=j.player_id;
   else
     select coalesce(sum(o.paid),0) into paid_value from public.contract_obligations o where o.contract_id=j.contract_id
       and o.revision=any(j.eligible_revisions) and o.kind=category_value and o.cancelled_at is null;
   end if;
   select coalesce(sum(c.recovered),0),coalesce(sum(case when c.cancelled_at is null then c.amount-c.recovered else 0 end),0)
     into collected,player_debt from public.player_return_claims link join public.player_return_runs run on run.id=link.run_id
     join public.contract_player_claims c on c.id=link.claim_id where run.job_id=j.id and link.category=category_value;
   select coalesce(sum(o.paid),0),coalesce(sum(case when o.cancelled_at is null then o.amount-o.paid else 0 end),0)
     into refunded,organization_debt from public.player_return_refunds link join public.player_return_runs run on run.id=link.run_id
     join public.contract_obligations o on o.id=link.obligation_id where run.job_id=j.id and link.category=category_value;
   if greatest(paid_value,collected,refunded,player_debt,organization_debt)>9007199254740991 or refunded>collected then raise exception 'CONTRACT_RETURN_HISTORY';end if;
   paid_json:=paid_json||jsonb_build_object(category_value,paid_value);collected_json:=collected_json||jsonb_build_object(category_value,collected);
   refunded_json:=refunded_json||jsonb_build_object(category_value,refunded);player_json:=player_json||jsonb_build_object(category_value,player_debt);organization_json:=organization_json||jsonb_build_object(category_value,organization_debt);
 end loop;
 return jsonb_build_object('paid',paid_json,'collected',collected_json,'refunded',refunded_json,'playerDebt',player_json,'organizationDebt',organization_json);
end $$;

create function public.player_return_settle(p_job uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare j public.player_return_jobs%rowtype;state_value jsonb;quote_value jsonb;targets jsonb:='{}';category_value text;item jsonb;
 changed text[]:='{}';net_value numeric;target_value numeric;accounted numeric;difference numeric;amount_value bigint;
 run_value uuid;claim_value uuid;obligation_value uuid;old_refund public.contract_obligations%rowtype;operation uuid;source uuid;closed jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into strict j from public.player_return_jobs where id=p_job for update;
 state_value:=public.player_return_state(j.id);
 perform public.contract_transfer_cancellation_validate(j.policy);
 if j.mode='fixed' then
   perform public.contract_assert_object(j.fixed_targets,array['signing','salary','appearance','kill','mvp','ranking','prize','personalAward'],array['signing','salary','appearance','kill','mvp','ranking','prize','personalAward']);
   targets:=j.fixed_targets;
 else
   quote_value:=public.contract_transfer_cancellation_quote(j.policy,j.cause,state_value->'paid');
   for item in select value from jsonb_array_elements(quote_value->'items') loop targets:=targets||jsonb_build_object(item->>'kind',item->'amount');end loop;
 end if;
 foreach category_value in array array['signing','salary','appearance','kill','mvp','ranking','prize','personalAward'] loop
   perform public.contract_assert_uint(targets->category_value,9007199254740991);
   net_value:=(state_value->'collected'->>category_value)::numeric-(state_value->'refunded'->>category_value)::numeric;
   target_value:=(targets->>category_value)::numeric;
   accounted:=net_value+(state_value->'playerDebt'->>category_value)::numeric-(state_value->'organizationDebt'->>category_value)::numeric;
   if accounted<>target_value or((state_value->'playerDebt'->>category_value)::numeric>0 and(state_value->'organizationDebt'->>category_value)::numeric>0) then changed:=array_append(changed,category_value);end if;
 end loop;
 if cardinality(changed)=0 then return jsonb_build_object('changed',false,'state',state_value,'targets',targets);end if;
 run_value:=gen_random_uuid();
 closed:=jsonb_build_object('claims',(select coalesce(jsonb_agg(link.claim_id),'[]') from public.player_return_claims link join public.player_return_runs run on run.id=link.run_id join public.contract_player_claims c on c.id=link.claim_id where run.job_id=j.id and link.category=any(changed) and c.cancelled_at is null),
   'refunds',(select coalesce(jsonb_agg(link.obligation_id),'[]') from public.player_return_refunds link join public.player_return_runs run on run.id=link.run_id join public.contract_obligations o on o.id=link.obligation_id where run.job_id=j.id and link.category=any(changed) and o.cancelled_at is null and o.paid<o.amount));
 insert into public.player_return_runs(id,job_id,source_state,targets,closed_sources) values(run_value,j.id,state_value,targets,closed);
 source:=public.u6_coin_account('organization',j.organization_id);
 foreach category_value in array changed loop
   update public.contract_player_claims c set cancelled_at=clock_timestamp(),cancellation_reason='Пересчёт возврата по подписанным условиям перехода'
   where c.id in(select link.claim_id from public.player_return_claims link join public.player_return_runs run on run.id=link.run_id where run.job_id=j.id and link.category=category_value) and c.cancelled_at is null;
   -- Close only the unpaid remainder of worker-created refunds. Paid history
   -- stays paid; this is not the owner's "cancel and reclaim payment" action.
   for old_refund in select o.* from public.player_return_refunds link join public.player_return_runs run on run.id=link.run_id
     join public.contract_obligations o on o.id=link.obligation_id where run.job_id=j.id and link.category=category_value and o.cancelled_at is null and o.paid<o.amount order by o.id for update of o loop
     operation:=gen_random_uuid();insert into public.coin_operations(id,action,input,description) values(operation,'player_return_adjust',jsonb_build_object('runId',run_value,'obligationId',old_refund.id),'Пересчёт невыплаченного остатка возврата');
     if old_refund.held>0 then perform public.u6_coin_entry(operation,source,0,-old_refund.held);end if;
     insert into public.contract_obligation_movements(operation_id,obligation_id,held_change) values(operation,old_refund.id,-old_refund.held);
     update public.contract_obligations set held=0,cancelled_at=clock_timestamp(),cancellation_reason='Пересчёт остатка возврата по подписанным условиям перехода' where id=old_refund.id;
   end loop;
   net_value:=(state_value->'collected'->>category_value)::numeric-(state_value->'refunded'->>category_value)::numeric;
   difference:=(targets->>category_value)::numeric-net_value;
   while difference>0 loop
     amount_value:=least(difference,1000000000000)::bigint;
     insert into public.contract_player_claims(player_id,organization_id,amount,kind,contract_id,revision)
       values(j.player_id,j.organization_id,amount_value,'transfer_return',j.contract_id,j.claim_revision) returning id into claim_value;
     insert into public.player_return_claims(run_id,category,claim_id) values(run_value,category_value,claim_value);difference:=difference-amount_value;
   end loop;
   while difference<0 loop
     amount_value:=least(-difference,1000000000000)::bigint;
     obligation_value:=public.contract_obligation_create(j.contract_id,j.claim_revision,'fine_refund','transfer-return:'||run_value||':'||category_value||':'||difference,amount_value,clock_timestamp(),
       exists(select 1 from public.coin_accounts where id=source and balance-reserved>=amount_value));
     insert into public.player_return_refunds(run_id,category,obligation_id) values(run_value,category_value,obligation_value);difference:=difference+amount_value;
   end loop;
 end loop;
 perform public.contract_recover_player_claims(j.player_id);
 for old_refund in select o.* from public.player_return_refunds link join public.contract_obligations o on o.id=link.obligation_id
   where link.run_id=run_value and o.held=o.amount and o.amount>0 and o.cancelled_at is null order by o.id loop
   perform public.contract_obligation_pay(null,gen_random_uuid(),old_refund.id,old_refund.amount,true);
 end loop;
 return jsonb_build_object('changed',true,'runId',run_value,'state',public.player_return_state(j.id),'targets',targets);
end $$;
revoke all on function public.player_return_state(uuid),public.player_return_settle(uuid) from public,anon,authenticated,service_role;
commit;
