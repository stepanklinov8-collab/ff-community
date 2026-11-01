-- Private cancellation executor. The public controller must choose timing
-- from the agreed product/contract rule, never from an unchecked client field.
begin;
create table public.player_transfer_reverse_consents(
 deal_id uuid not null,revision integer not null,fingerprint text not null,
 party text not null check(party in('player','organization','buyer','previous')),
 signed_by uuid not null references public.profiles(id),ownership_revision bigint not null,
 signed_at timestamptz not null default clock_timestamp(),primary key(deal_id,revision,fingerprint,party,signed_by,ownership_revision),
 foreign key(deal_id,revision) references public.market_versions(deal_id,revision)
);
create table public.player_transfer_reversals(
 deal_id uuid not null,revision integer not null,actor_id uuid not null references public.profiles(id),
 cause text not null,mode text not null,fingerprint text not null,reason text not null,
 price_operation_id uuid not null unique references public.coin_operations(id),job_id uuid not null unique references public.player_return_jobs(id),
 cutoff_at timestamptz not null,created_at timestamptz not null default clock_timestamp(),result jsonb not null,
 primary key(deal_id,revision),foreign key(deal_id,revision) references public.market_versions(deal_id,revision)
);
do $$declare relation text;begin
 foreach relation in array array['player_transfer_reverse_consents','player_transfer_reversals'] loop
   execute format('alter table public.%I enable row level security',relation);
   execute format('revoke all on public.%I from public,anon,authenticated,service_role',relation);
   execute format('create trigger transfer_reversal_immutable before update or delete on public.%I for each row execute function public.contract_frozen_guard()',relation);
 end loop;
end $$;
create function public.player_transfer_mutual_ready(p_deal uuid,p_revision integer,p_fingerprint text) returns boolean
language sql stable security definer set search_path=public as $$
 with context as(select d.*,v.transfer_plan from public.market_deals d join public.market_versions v on v.deal_id=d.id and v.revision=p_revision where d.id=p_deal and d.kind='player'),
 required as(
   select 'player'::text party,null::uuid organization_id,player_id user_id from context
   union all select 'organization',organization_id,null from context
   union all select 'buyer',buyer_organization_id,buyer_user_id from context
   union all select 'previous',(transfer_plan->>'oldOrganizationId')::uuid,null from context where transfer_plan->>'oldOrganizationId' is not null
 ) select exists(select 1 from context) and not exists(select 1 from required r where not exists(
   select 1 from public.player_transfer_reverse_consents s where s.deal_id=p_deal and s.revision=p_revision and s.fingerprint=p_fingerprint and s.party=r.party
     and(case when r.user_id is not null then s.signed_by=r.user_id and s.ownership_revision=0
       else public.organization_can_spend(r.organization_id,s.signed_by) and s.ownership_revision=(select ownership_revision from public.teams where id=r.organization_id) end)))
$$;

create function public.player_transfer_reverse_execute(p_actor uuid,p_deal uuid,p_revision integer,p_cause text,p_mode text,p_expected text,p_reason text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d public.market_deals%rowtype;v public.market_versions%rowtype;execution public.player_transfer_executions%rowtype;prior public.player_transfer_reversals%rowtype;
 assessment jsonb;policy jsonb;paid jsonb;initial_quote jsonb;fixed_targets jsonb:='{}';item jsonb;eligible integer[];cutoff timestamptz;
 agreement record;movement record;source uuid;operation uuid;job uuid;answer jsonb;decision_fingerprint text;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if not public.is_full_admin(p_actor) then raise exception 'MARKET_ADMIN';end if;
 if not public.u6_coin_admin(p_actor) then raise exception 'MARKET_CASH_ADMIN';end if;
 if p_mode is null or p_mode not in('fixed','recalculate') or p_reason is null or length(trim(p_reason)) not between 3 and 1000
   or p_expected is null or p_expected!~'^[a-f0-9]{32}$' then raise exception 'MARKET_INPUT';end if;
 select * into d from public.market_deals where id=p_deal for update;
 if d.kind is distinct from 'player' or d.current_revision is distinct from p_revision then raise exception 'MARKET_NOT_FOUND';end if;
 select * into strict v from public.market_versions where deal_id=d.id and revision=p_revision for update;
 select * into prior from public.player_transfer_reversals where deal_id=d.id and revision=v.revision;
 if found then
   if prior.cause is distinct from p_cause or prior.mode<>p_mode or prior.fingerprint<>p_expected or prior.reason<>trim(p_reason) then raise exception 'MARKET_CONFLICT';end if;
   return prior.result;
 end if;
 assessment:=public.player_transfer_reversal_assess(p_actor,p_deal,p_revision,p_cause);
 if assessment->>'fingerprint'<>p_expected then raise exception 'MARKET_CONFLICT';end if;
 decision_fingerprint:=md5(p_expected||':'||p_mode||':'||trim(p_reason));
 if p_cause='mutual' and not public.player_transfer_mutual_ready(d.id,v.revision,decision_fingerprint) then raise exception 'MARKET_PLAYER_MUTUAL';end if;
 select * into strict execution from public.player_transfer_executions where deal_id=d.id and revision=v.revision;
 select account_id into strict source from public.market_escrows where deal_id=d.id and revision=v.revision;
 select array_agg(value::integer order by value::integer) into eligible from jsonb_array_elements_text(assessment->'eligibleRevisions');
 policy:=assessment->'policy';cutoff:=clock_timestamp();
 perform public.contract_freeze_due_values();
 for agreement in select contract_id,revision from public.contract_agreements where contract_id=v.new_contract_id and(ended_at is null or ended_at>cutoff) order by revision for update loop
   perform public.contract_salary_schedule_close(agreement.contract_id,agreement.revision,cutoff,'Отмена завершённого перехода');
   update public.contract_agreements set ended_at=cutoff,end_reason='player_transfer_reversed:'||d.id where contract_id=agreement.contract_id and revision=agreement.revision;
 end loop;
 perform public.contract_salary_process(v.new_contract_id);
 update public.organization_contract_versions cv set status='cancelled',responded_at=cutoff where cv.contract_id=v.new_contract_id and cv.status in('draft','offered')
   and not exists(select 1 from public.contract_agreements a where a.contract_id=cv.contract_id and a.revision=cv.revision);
 -- This restores membership only. No old agreement, salary schedule, initial
 -- bonus or delegated permission is reopened or recreated.
 delete from public.team_members where team_id=d.organization_id and user_id=d.player_id;
 if assessment->>'oldOrganizationId' is not null then
   insert into public.team_members(team_id,user_id,role_in_team,position)
     values((assessment->>'oldOrganizationId')::uuid,d.player_id,assessment->>'oldRole',assessment->>'oldPosition');
 end if;
 operation:=gen_random_uuid();insert into public.coin_operations(id,actor_id,action,input,description,reverses_id)
 values(operation,p_actor,'player_transfer_reverse',jsonb_build_object('dealId',d.id,'revision',v.revision,'cause',p_cause,'reason',trim(p_reason)),trim(p_reason),execution.operation_id);
 -- Price reversals use the original actual recipients, grouping related
 -- accounts. Contract payment returns are a separate reserve-safe debt flow.
 for movement in select account_id,sum(delta)::bigint delta from(
   select source account_id,v.price delta
   union all select(value->>'accountId')::uuid,-(value->>'amount')::bigint from jsonb_array_elements(execution.payments)
 ) changes group by account_id order by sum(delta),account_id loop
   perform public.u6_coin_entry(operation,movement.account_id,movement.delta);
 end loop;
 paid:=public.player_return_paid(v.new_contract_id,eligible,d.player_id);
 initial_quote:=public.contract_transfer_cancellation_quote(policy,p_cause,paid);
 for item in select value from jsonb_array_elements(initial_quote->'items') loop fixed_targets:=fixed_targets||jsonb_build_object(item->>'kind',item->'amount');end loop;
 insert into public.player_return_jobs(deal_id,revision,contract_id,claim_revision,player_id,organization_id,cause,policy,mode,fixed_targets,eligible_revisions,cutoff_at,created_by)
 values(d.id,v.revision,v.new_contract_id,(assessment->>'claimRevision')::integer,d.player_id,d.organization_id,p_cause,policy,p_mode,fixed_targets,eligible,cutoff,p_actor) returning id into job;
 perform public.player_return_settle(job);
 update public.market_versions set status='reversed' where deal_id=d.id and revision=v.revision;
 update public.market_disputes set closed_at=clock_timestamp(),resolved_by=p_actor,resolution=trim(p_reason) where deal_id=d.id;
 answer:=jsonb_build_object('success',true,'status','reversed','dealId',d.id,'revision',v.revision,'priceOperationId',operation,'jobId',job,'state',public.player_return_state(job));
 insert into public.player_transfer_reversals(deal_id,revision,actor_id,cause,mode,fingerprint,reason,price_operation_id,job_id,cutoff_at,result)
 values(d.id,v.revision,p_actor,p_cause,p_mode,p_expected,trim(p_reason),operation,job,cutoff,answer);
 insert into public.market_events(deal_id,revision,actor_id,action,details) values(d.id,v.revision,p_actor,'player_reversed',jsonb_build_object('cause',p_cause,'mode',p_mode,'reason',trim(p_reason),'jobId',job));
 perform public.market_notice(d.id,v.revision,'player_reversed');
 return answer;
end $$;
revoke all on function public.player_transfer_mutual_ready(uuid,integer,text),public.player_transfer_reverse_execute(uuid,uuid,integer,text,text,text,text)
 from public,anon,authenticated,service_role;
commit;
