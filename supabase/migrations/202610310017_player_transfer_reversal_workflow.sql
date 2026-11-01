-- A reviewed immutable decision, not a caller-provided fault/debit permission.
begin;
create table public.player_transfer_reversal_proposals(
 id uuid primary key default gen_random_uuid(),deal_id uuid not null,revision integer not null,
 cause text not null,mode text not null,reason text not null,fingerprint text not null,decision_fingerprint text not null,
 assessment jsonb not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 foreign key(deal_id,revision) references public.market_versions(deal_id,revision),unique(deal_id,revision,decision_fingerprint)
);
alter table public.player_transfer_reversal_proposals enable row level security;
revoke all on public.player_transfer_reversal_proposals from public,anon,authenticated,service_role;
create trigger reversal_proposal_immutable before update or delete on public.player_transfer_reversal_proposals
 for each row execute function public.contract_frozen_guard();

-- Approved: cancellation settlement is fixed at confirmation. Later result
-- corrections follow their original prize flow, never rescale this decision.
create function public.player_return_timing(p_policy jsonb) returns text
language sql immutable security definer set search_path=public as $$select 'fixed'::text$$;

create function public.player_transfer_reversal_signer(p_deal public.market_deals,p_version public.market_versions,p_party text,p_actor uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce(case p_party when 'player' then p_actor=p_deal.player_id
 when 'organization' then public.organization_can_spend(p_deal.organization_id,p_actor)
 when 'buyer' then case when p_deal.buyer_user_id is not null then p_actor=p_deal.buyer_user_id else public.organization_can_spend(p_deal.buyer_organization_id,p_actor) end
 when 'previous' then public.organization_can_spend((p_version.transfer_plan->>'oldOrganizationId')::uuid,p_actor) else false end,false)
$$;

-- The former organization without an active contract is still a roster party
-- for reversal, but gains no access to the new employment terms.
alter function public.player_transfer_party(public.market_deals,public.market_versions,uuid) rename to player_transfer_party_before_reversal;
create function public.player_transfer_party(p_deal public.market_deals,p_version public.market_versions,p_actor uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select public.player_transfer_party_before_reversal(p_deal,p_version,p_actor)
 or coalesce(public.can_manage_organization_contracts((p_version.transfer_plan->>'oldOrganizationId')::uuid,p_actor),false)
$$;

create function public.player_transfer_reversal_view(p_actor uuid,p_deal public.market_deals,p_version public.market_versions) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare proposal public.player_transfer_reversal_proposals%rowtype;party_value text;org_value uuid;version_value bigint;signer_value uuid;
 signatures jsonb:='[]';signature public.player_transfer_reverse_consents%rowtype;valid boolean;opened boolean;full_terms boolean;admin_cash boolean;answer jsonb;
begin
 opened:=exists(select 1 from public.market_disputes where deal_id=p_deal.id and closed_at is null);
 admin_cash:=public.is_full_admin(p_actor) and public.u6_coin_admin(p_actor);
 full_terms:=p_actor=p_deal.player_id or public.can_manage_organization_contracts(p_deal.organization_id,p_actor) or admin_cash;
 select * into proposal from public.player_transfer_reversal_proposals where deal_id=p_deal.id and revision=p_version.revision order by created_at desc,id desc limit 1;
 answer:=jsonb_build_object('canReview',opened and p_version.status='completed' and p_version.revision=p_deal.current_revision and admin_cash);
 if proposal.id is null then return answer||jsonb_build_object('proposal',null);end if;
 foreach party_value in array case when p_version.transfer_plan->>'oldOrganizationId' is null then array['player','organization','buyer'] else array['player','organization','buyer','previous'] end loop
   org_value:=case party_value when 'organization' then p_deal.organization_id when 'buyer' then p_deal.buyer_organization_id when 'previous' then(p_version.transfer_plan->>'oldOrganizationId')::uuid end;
   version_value:=case when org_value is null then 0 else(select ownership_revision from public.teams where id=org_value) end;
   select * into signature from public.player_transfer_reverse_consents where deal_id=p_deal.id and revision=p_version.revision and fingerprint=proposal.decision_fingerprint and party=party_value
     and ownership_revision=version_value and public.player_transfer_reversal_signer(p_deal,p_version,party_value,signed_by) order by signed_at desc limit 1;
   valid:=signature.deal_id is not null and signature.ownership_revision=version_value and public.player_transfer_reversal_signer(p_deal,p_version,party_value,signature.signed_by);
   signatures:=signatures||jsonb_build_array(jsonb_build_object('party',party_value,'signed',valid,'signedAt',case when valid then signature.signed_at end,
     'canSign',opened and p_version.status='completed' and proposal.cause='mutual' and not valid and public.player_transfer_reversal_signer(p_deal,p_version,party_value,p_actor)));
 end loop;
 return answer||jsonb_build_object('proposal',jsonb_build_object('id',proposal.id,'cause',proposal.cause,'mode',proposal.mode,'reason',proposal.reason,'createdAt',proposal.created_at,
   'price',proposal.assessment->'price','oldOrganizationId',proposal.assessment->'oldOrganizationId','organizationId',p_deal.organization_id,
   'paid',case when full_terms then proposal.assessment->'paid' else null end,'returns',case when full_terms then proposal.assessment->'returns' else null end,
   'policy',case when full_terms then proposal.assessment->'policy' else null end,'consents',signatures,
   'canExecute',opened and p_version.status='completed' and admin_cash and(proposal.cause<>'mutual' or public.player_transfer_mutual_ready(p_deal.id,p_version.revision,proposal.decision_fingerprint))));
end $$;

alter function public.player_transfer_mutate(uuid,jsonb) rename to player_transfer_mutate_before_reversal;
create function public.player_transfer_mutate(p_actor uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare action_value text:=p_input->>'action';request_value uuid;deal_value uuid;revision_value integer;d public.market_deals%rowtype;v public.market_versions%rowtype;
 prior public.market_requests%rowtype;proposal public.player_transfer_reversal_proposals%rowtype;assessment_value jsonb;cause_value text;reason_value text;mode_value text;
 party_value text;org_value uuid;ownership_value bigint;answer jsonb;keys text[];
begin
 if action_value not in('reverse_review','reverse_consent','reverse_complete') or action_value is null then return public.player_transfer_mutate_before_reversal(p_actor,p_input);end if;
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'MARKET_AUTH';end if;
 keys:=case action_value when 'reverse_review' then array['action','requestId','dealId','revision','cause','reason']
 when 'reverse_consent' then array['action','requestId','dealId','revision','proposalId','party'] else array['action','requestId','dealId','revision','proposalId'] end;
 perform public.contract_assert_object(p_input,keys,keys);
 begin request_value:=(p_input->>'requestId')::uuid;deal_value:=(p_input->>'dealId')::uuid;revision_value:=(p_input->>'revision')::integer;exception when others then raise exception 'MARKET_INPUT';end;
 if request_value is null or deal_value is null or revision_value is null then raise exception 'MARKET_INPUT';end if;
 select * into d from public.market_deals where id=deal_value for update;
 if d.kind is distinct from 'player' or not public.market_access(d.id,p_actor) then raise exception 'MARKET_NOT_FOUND';end if;
 if d.current_revision<>revision_value then raise exception 'MARKET_CONFLICT';end if;
 select * into strict v from public.market_versions where deal_id=d.id and revision=revision_value for update;
 if action_value in('reverse_review','reverse_complete') then
   if not public.is_full_admin(p_actor) then raise exception 'MARKET_ADMIN';end if;
   if not public.u6_coin_admin(p_actor) then raise exception 'MARKET_CASH_ADMIN';end if;
 else
   party_value:=p_input->>'party';
   if not public.player_transfer_reversal_signer(d,v,party_value,p_actor) then raise exception 'MARKET_FINANCE';end if;
 end if;
 -- Current authorization precedes idempotent request lookup.
 select * into prior from public.market_requests where id=request_value;
 if found then
   if prior.actor_id is distinct from p_actor or prior.input is distinct from p_input then raise exception 'MARKET_CONFLICT';end if;return prior.result;
 end if;
 if action_value='reverse_review' then
   cause_value:=p_input->>'cause';reason_value:=trim(p_input->>'reason');
   if reason_value is null or length(reason_value) not between 3 and 1000 then raise exception 'MARKET_INPUT';end if;
   assessment_value:=public.player_transfer_reversal_assess(p_actor,d.id,v.revision,cause_value);
   mode_value:=public.player_return_timing(assessment_value->'policy');
   insert into public.player_transfer_reversal_proposals(deal_id,revision,cause,mode,reason,fingerprint,decision_fingerprint,assessment,created_by)
   values(d.id,v.revision,cause_value,mode_value,reason_value,assessment_value->>'fingerprint',md5((assessment_value->>'fingerprint')||':'||mode_value||':'||reason_value),assessment_value,p_actor)
   on conflict(deal_id,revision,decision_fingerprint) do nothing;
   select * into strict proposal from public.player_transfer_reversal_proposals where deal_id=d.id and revision=v.revision and decision_fingerprint=md5((assessment_value->>'fingerprint')||':'||mode_value||':'||reason_value);
   answer:=jsonb_build_object('success',true,'proposalId',proposal.id);
 else
   begin select * into proposal from public.player_transfer_reversal_proposals where id=(p_input->>'proposalId')::uuid and deal_id=d.id and revision=v.revision;exception when others then raise exception 'MARKET_INPUT';end;
   if proposal.id is null or proposal.id is distinct from(select id from public.player_transfer_reversal_proposals where deal_id=d.id and revision=v.revision order by created_at desc,id desc limit 1) then raise exception 'MARKET_CONFLICT';end if;
   if action_value='reverse_complete' then
     if public.player_return_timing(proposal.assessment->'policy') is distinct from proposal.mode then raise exception 'MARKET_CONFLICT';end if;
     answer:=public.player_transfer_reverse_execute(p_actor,d.id,v.revision,proposal.cause,proposal.mode,proposal.fingerprint,proposal.reason);
   else
     if proposal.cause<>'mutual' or v.status<>'completed' or not exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null) then raise exception 'MARKET_STATE';end if;
     org_value:=case party_value when 'organization' then d.organization_id when 'buyer' then d.buyer_organization_id when 'previous' then(v.transfer_plan->>'oldOrganizationId')::uuid end;
     ownership_value:=case when org_value is null then 0 else(select ownership_revision from public.teams where id=org_value) end;
     insert into public.player_transfer_reverse_consents(deal_id,revision,fingerprint,party,signed_by,ownership_revision)
     values(d.id,v.revision,proposal.decision_fingerprint,party_value,p_actor,ownership_value) on conflict do nothing;
     answer:=jsonb_build_object('success',true,'proposalId',proposal.id,'party',party_value);
   end if;
 end if;
 insert into public.market_requests(id,actor_id,input,result) values(request_value,p_actor,p_input,answer);
 insert into public.market_events(deal_id,revision,actor_id,action,details) values(d.id,v.revision,p_actor,action_value,jsonb_build_object('proposalId',proposal.id));
 perform public.market_notice(d.id,v.revision,action_value);return answer;
end $$;

alter function public.player_transfer_query(uuid,jsonb) rename to player_transfer_query_before_reversal;
create function public.player_transfer_query(p_actor uuid,p_input jsonb) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare answer jsonb;d public.market_deals%rowtype;v public.market_versions%rowtype;begin
 answer:=public.player_transfer_query_before_reversal(p_actor,p_input);
 if not(answer?'deal') then return answer;end if;
 select * into strict d from public.market_deals where id=(answer->'deal'->>'id')::uuid;
 select * into strict v from public.market_versions where deal_id=d.id and revision=(answer->'deal'->>'revision')::integer;
 return answer||jsonb_build_object('reversal',public.player_transfer_reversal_view(p_actor,d,v));
end $$;
revoke all on function public.player_return_timing(jsonb),public.player_transfer_reversal_signer(public.market_deals,public.market_versions,text,uuid),
 public.player_transfer_party_before_reversal(public.market_deals,public.market_versions,uuid),public.player_transfer_party(public.market_deals,public.market_versions,uuid),
 public.player_transfer_reversal_view(uuid,public.market_deals,public.market_versions),public.player_transfer_mutate_before_reversal(uuid,jsonb),public.player_transfer_mutate(uuid,jsonb),
 public.player_transfer_query_before_reversal(uuid,jsonb),public.player_transfer_query(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.player_transfer_mutate(uuid,jsonb),public.player_transfer_query(uuid,jsonb) to service_role;
commit;
