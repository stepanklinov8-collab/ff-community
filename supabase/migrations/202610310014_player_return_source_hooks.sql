-- Reconcile after the complete payment/correction transaction, never halfway
-- through replacing a prize. Refunds are not themselves eligible new income.
begin;
create table public.player_return_dirty(
 job_id uuid not null references public.player_return_jobs(id),transaction_id bigint not null,
 primary key(job_id,transaction_id)
);
alter table public.player_return_dirty enable row level security;
revoke all on public.player_return_dirty from public,anon,authenticated,service_role;
create function public.player_return_mark(p_contract uuid,p_revision integer) returns void
language sql security definer set search_path=public as $$
 insert into public.player_return_dirty(job_id,transaction_id)
 select id,txid_current() from public.player_return_jobs
 where contract_id=p_contract and p_revision=any(eligible_revisions) and mode='recalculate'
 on conflict do nothing
$$;
create function public.player_return_obligation_changed() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.kind not in('signing','salary','appearance','kill','mvp','ranking','prize') then return null;end if;
 if tg_op='INSERT' then
   if new.paid>0 then perform public.player_return_mark(new.contract_id,new.revision);end if;
 elsif new.paid is distinct from old.paid or new.cancelled_at is distinct from old.cancelled_at then
   perform public.player_return_mark(new.contract_id,new.revision);
 end if;
 return null;
end $$;
create trigger player_return_obligation_changed after insert or update of paid,cancelled_at on public.contract_obligations
 for each row execute function public.player_return_obligation_changed();
create function public.player_return_award_changed() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.plan->>'contractId' is not null then
   perform public.player_return_mark((new.plan->>'contractId')::uuid,(new.plan->>'revision')::integer);
 end if;
 return null;
end $$;
create trigger player_return_award_changed after insert or update of reversed_at on public.personal_award_payments
 for each row execute function public.player_return_award_changed();
create function public.player_return_flush() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if exists(select 1 from public.player_return_dirty where job_id=new.job_id and transaction_id=new.transaction_id) then
   delete from public.player_return_dirty where job_id=new.job_id and transaction_id=new.transaction_id;
   perform public.player_return_settle(new.job_id);
 end if;
 return null;
end $$;
create constraint trigger player_return_at_transaction_end after insert on public.player_return_dirty
 deferrable initially deferred for each row execute function public.player_return_flush();

-- An original cancellation result is computed before deferred reconciliation.
-- Mark it so the client refreshes the final rows rather than reporting a
-- temporary recovery debt as the completed amount.
alter function public.contract_obligation_cancel_internal(uuid,uuid,uuid,text) rename to contract_obligation_cancel_before_player_returns;
create function public.contract_obligation_cancel_internal(p_actor uuid,p_request uuid,p_obligation uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare answer jsonb;begin
 answer:=public.contract_obligation_cancel_before_player_returns(p_actor,p_request,p_obligation,p_reason);
 if exists(select 1 from public.contract_obligations o join public.player_return_jobs j on j.contract_id=o.contract_id
   where o.id=p_obligation and j.mode='recalculate' and o.revision=any(j.eligible_revisions)) then
   answer:=answer||jsonb_build_object('returnReconciliation',true);
 end if;
 return answer;
end $$;
revoke all on function public.player_return_mark(uuid,integer),public.player_return_obligation_changed(),public.player_return_award_changed(),public.player_return_flush(),
 public.contract_obligation_cancel_before_player_returns(uuid,uuid,uuid,text),public.contract_obligation_cancel_internal(uuid,uuid,uuid,text)
 from public,anon,authenticated,service_role;
commit;
