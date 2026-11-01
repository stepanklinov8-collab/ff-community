-- Separate signed fine, unrelated to winnings or the ordinary early-exit fee.
begin;
create function public.contract_transfer_penalty_validate(p_policy jsonb) returns void language plpgsql set search_path=public as $$
declare cause_value text;reasons text[]:=array['mutual','player_fault','hiring_organization_fault','previous_organization_fault','no_fault'];begin
 perform public.contract_assert_object(p_policy,reasons,reasons);
 foreach cause_value in array reasons loop perform public.contract_ordinary_rule(p_policy->cause_value);end loop;
end $$;
alter function public.contract_validate_terms(jsonb) rename to contract_validate_before_transfer_penalty;
create function public.contract_validate_terms(p_terms jsonb) returns void language plpgsql set search_path=public as $$begin
 if p_terms->'financial'?'transferCancellationPenalty' then perform public.contract_transfer_penalty_validate(p_terms->'financial'->'transferCancellationPenalty');end if;
 perform public.contract_validate_before_transfer_penalty(p_terms#-'{financial,transferCancellationPenalty}');
end $$;

alter table public.contract_player_claims drop constraint contract_player_claims_kind_check,drop constraint contract_claim_source;
alter table public.contract_player_claims add constraint contract_player_claims_kind_check check(kind in('return','no_show','transfer_return','transfer_penalty')),
 add constraint contract_claim_source check((kind='return' and obligation_id is not null and session_id is null)
 or(kind='no_show' and obligation_id is null and contract_id is not null and revision is not null and session_id is not null and player_value is not null)
 or(kind='transfer_return' and obligation_id is null and contract_id is not null and revision is not null and session_id is null and player_value is null)
 or(kind='transfer_penalty' and obligation_id is null and contract_id is not null and revision is not null and session_id is null and player_value is not null));
create table public.player_transfer_penalties(
 deal_id uuid not null,revision integer not null,claim_id uuid unique references public.contract_player_claims(id),
 quote jsonb not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(deal_id,revision),
 foreign key(deal_id,revision) references public.player_transfer_reversals(deal_id,revision)
);
alter table public.player_transfer_penalties enable row level security;
revoke all on public.player_transfer_penalties from public,anon,authenticated,service_role;
create trigger transfer_penalty_immutable before update or delete on public.player_transfer_penalties for each row execute function public.contract_frozen_guard();

alter function public.player_transfer_reversal_assess(uuid,uuid,integer,text) rename to player_transfer_reversal_assess_before_penalty;
create function public.player_transfer_reversal_assess(p_actor uuid,p_deal uuid,p_revision integer,p_cause text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare answer jsonb;policy_value jsonb;original_policy jsonb;rule_value jsonb;value_snapshot bigint:=0;amount_value bigint:=0;latest jsonb;begin
 answer:=public.player_transfer_reversal_assess_before_penalty(p_actor,p_deal,p_revision,p_cause);
 select cv.terms->'financial'->'transferCancellationPenalty' into policy_value from public.organization_contract_versions cv
 where cv.contract_id=(answer->>'contractId')::uuid and cv.revision=(answer->>'claimRevision')::integer;
 select new_terms->'financial'->'transferCancellationPenalty' into original_policy from public.market_versions where deal_id=p_deal and revision=p_revision;
 if policy_value is distinct from original_policy then raise exception 'MARKET_PLAYER_LATER_POLICY';end if;
 if policy_value is not null then
   perform public.contract_transfer_penalty_validate(policy_value);rule_value:=policy_value->p_cause;
   if rule_value->>'kind' in('percent','combined') then value_snapshot:=round(public.u2_cost_for_target('player',(answer->>'playerId')::uuid,'main'))::bigint;end if;
   amount_value:=public.contract_compensation_amount(rule_value,value_snapshot);
   perform public.contract_assert_uint(to_jsonb(amount_value),1000000000000);
 else rule_value:=jsonb_build_object('kind','none');end if;
 answer:=(answer-'fingerprint')||jsonb_build_object('penalty',jsonb_build_object('rule',rule_value,'playerValue',value_snapshot,'amount',amount_value,'organizationId',answer->'organizationId'));
 return answer||jsonb_build_object('fingerprint',md5((answer-'paid'-'returns')::text));
end $$;

alter function public.player_transfer_reverse_execute(uuid,uuid,integer,text,text,text,text) rename to player_transfer_reverse_before_penalty;
create function public.player_transfer_reverse_execute(p_actor uuid,p_deal uuid,p_revision integer,p_cause text,p_mode text,p_expected text,p_reason text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare assessment_value jsonb;answer jsonb;penalty_result jsonb;amount_value bigint;claim_value uuid;collected bigint;old_result jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if not public.is_full_admin(p_actor) then raise exception 'MARKET_ADMIN';end if;
 if not public.u6_coin_admin(p_actor) then raise exception 'MARKET_CASH_ADMIN';end if;
 select result into old_result from public.player_transfer_penalties where deal_id=p_deal and revision=p_revision;
 if old_result is not null then
   answer:=public.player_transfer_reverse_before_penalty(p_actor,p_deal,p_revision,p_cause,p_mode,p_expected,p_reason);return answer||jsonb_build_object('penalty',old_result);
 end if;
 assessment_value:=public.player_transfer_reversal_assess(p_actor,p_deal,p_revision,p_cause);
 if assessment_value->>'fingerprint' is distinct from p_expected then raise exception 'MARKET_CONFLICT';end if;
 answer:=public.player_transfer_reverse_before_penalty(p_actor,p_deal,p_revision,p_cause,p_mode,p_expected,p_reason);
 amount_value:=(assessment_value->'penalty'->>'amount')::bigint;
 if amount_value>0 then
   insert into public.contract_player_claims(player_id,organization_id,amount,kind,contract_id,revision,player_value)
   values((assessment_value->>'playerId')::uuid,(assessment_value->>'organizationId')::uuid,amount_value,'transfer_penalty',
     (assessment_value->>'contractId')::uuid,(assessment_value->>'claimRevision')::integer,(assessment_value->'penalty'->>'playerValue')::bigint) returning id into claim_value;
   perform public.contract_recover_player_claims((assessment_value->>'playerId')::uuid);
   select recovered into collected from public.contract_player_claims where id=claim_value;
 else collected:=0;end if;
 penalty_result:=assessment_value->'penalty'||jsonb_build_object('claimId',claim_value,'paid',collected,'remaining',amount_value-collected);
 insert into public.player_transfer_penalties(deal_id,revision,claim_id,quote,result) values(p_deal,p_revision,claim_value,assessment_value->'penalty',penalty_result);
 return answer||jsonb_build_object('penalty',penalty_result);
end $$;

-- The ordinary owner waiver/refund uses the receiving organization's own
-- contract account. No other organization's or owner's wallet is substituted.
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.contract_no_show_cancel_internal(uuid,uuid,uuid,text)'::regprocedure);
 needle:='where id=p_claim and kind=''no_show'' for update';
 if position(needle in definition)=0 then raise exception 'TRANSFER_PENALTY_CANCEL_PATCH';end if;
 definition:=replace(definition,needle,'where id=p_claim and kind in(''no_show'',''transfer_penalty'') for update');
 execute replace(definition,'''Отмена штрафа за неявку: ''','''Отмена договорного штрафа: ''');
 definition:=pg_get_functiondef('public.contract_fine_query(uuid,uuid,integer)'::regprocedure);
 needle:='select claim.id,claim.revision,claim.amount,claim.recovered as paid,';
 if position(needle in definition)=0 then raise exception 'TRANSFER_PENALTY_QUERY_PATCH';end if;
 definition:=replace(definition,needle,'select claim.id,claim.kind,(select deal_id from public.player_transfer_penalties where claim_id=claim.id) as "dealId",claim.revision,claim.amount,claim.recovered as paid,');
 definition:=replace(definition,'join public.contract_session_frames frame on frame.session_id=claim.session_id','left join public.contract_session_frames frame on frame.session_id=claim.session_id');
 definition:=replace(definition,'join public.events e on e.id=frame.event_id','left join public.events e on e.id=frame.event_id');
 execute replace(definition,'claim.kind=''no_show'' order by','claim.kind in(''no_show'',''transfer_penalty'') order by');
 definition:=pg_get_functiondef('public.player_transfer_reversal_view(uuid,public.market_deals,public.market_versions)'::regprocedure);
 needle:='''price'',proposal.assessment->''price'',';
 if position(needle in definition)=0 then raise exception 'TRANSFER_PENALTY_VIEW_PATCH';end if;
 execute replace(definition,needle,needle||'''penalty'',proposal.assessment->''penalty''||coalesce((select jsonb_build_object(''paid'',coalesce(c.recovered,0),''remaining'',case when c.cancelled_at is not null then 0 else coalesce(c.amount-c.recovered,0) end,''cancelledAt'',c.cancelled_at,''cancellationReason'',c.cancellation_reason) from public.player_transfer_penalties p left join public.contract_player_claims c on c.id=p.claim_id where p.deal_id=p_deal.id and p.revision=p_version.revision),''{}''::jsonb),');
end $$;
revoke all on function public.contract_transfer_penalty_validate(jsonb),public.contract_validate_before_transfer_penalty(jsonb),public.contract_validate_terms(jsonb),
 public.player_transfer_reversal_assess_before_penalty(uuid,uuid,integer,text),public.player_transfer_reversal_assess(uuid,uuid,integer,text),
 public.player_transfer_reverse_before_penalty(uuid,uuid,integer,text,text,text,text),public.player_transfer_reverse_execute(uuid,uuid,integer,text,text,text,text)
 from public,anon,authenticated,service_role;
commit;
