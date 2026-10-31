-- Preserve playing position as well as administrative role. Old unreviewed
-- snapshots cannot silently invent the player's former roster position.
begin;
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.player_transfer_quote(uuid,uuid,bigint,jsonb)'::regprocedure);
 needle:='select m.team_id,m.role_in_team,t.leader_id,t.ownership_revision into membership';
 if position(needle in definition)=0 then raise exception 'TRANSFER_POSITION_QUOTE_PATCH';end if;
 definition:=replace(definition,needle,'select m.team_id,m.role_in_team,m.position,t.leader_id,t.ownership_revision into membership');
 needle:='''oldRole'',membership.role_in_team,';
 if position(needle in definition)=0 then raise exception 'TRANSFER_POSITION_SNAPSHOT_PATCH';end if;
 execute replace(definition,needle,needle||'''oldPosition'',membership.position,');
end $$;
create or replace function public.player_transfer_memberships(p_player uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('organizationId',m.team_id,'role',m.role_in_team,'position',m.position) order by m.team_id),'[]')
 from public.team_members m where m.user_id=p_player
$$;
drop trigger market_roster_write_barrier on public.team_members;
create trigger market_roster_write_barrier before insert or delete or update of team_id,user_id,role_in_team,position on public.team_members
 for each statement execute function public.market_write_barrier();

create function public.player_return_paid(p_contract uuid,p_revisions integer[],p_player uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare category_value text;amount_value numeric;answer jsonb:='{}';begin
 if not exists(select 1 from public.organization_contracts where id=p_contract and player_id=p_player and kind='main') then raise exception 'CONTRACT_PARTIES';end if;
 foreach category_value in array array['signing','salary','appearance','kill','mvp','ranking','prize','personalAward'] loop
   if category_value='personalAward' then
     select coalesce(sum(r.amount),0) into amount_value from public.personal_award_payments p join public.personal_award_receipts r on r.payment_id=p.id
       join public.coin_accounts a on a.id=r.account_id where p.plan->>'contractId'=p_contract::text
       and(p.plan->>'revision')::integer=any(p_revisions) and p.reversed_at is null and a.user_id=p_player;
   else
     select coalesce(sum(o.paid),0) into amount_value from public.contract_obligations o where o.contract_id=p_contract and o.revision=any(p_revisions)
       and o.kind=category_value and o.cancelled_at is null;
   end if;
   if amount_value>9007199254740991 then raise exception 'CONTRACT_COIN_RANGE';end if;
   answer:=answer||jsonb_build_object(category_value,amount_value);
 end loop;return answer;
end $$;

create function public.player_transfer_reversal_assess(p_actor uuid,p_deal uuid,p_revision integer,p_cause text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d public.market_deals%rowtype;v public.market_versions%rowtype;execution public.player_transfer_executions%rowtype;
 destination public.teams%rowtype;former public.teams%rowtype;latest record;agreements jsonb;eligible integer[];paid jsonb;policy jsonb;assessment jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if not public.is_full_admin(p_actor) then raise exception 'MARKET_ADMIN';end if;
 if not public.u6_coin_admin(p_actor) then raise exception 'MARKET_CASH_ADMIN';end if;
 select * into d from public.market_deals where id=p_deal for update;
 if d.kind is distinct from 'player' or not exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null) then raise exception 'MARKET_ADMIN';end if;
 if p_cause is null or p_cause not in('mutual','player_fault','hiring_organization_fault','previous_organization_fault','no_fault') then raise exception 'MARKET_INPUT';end if;
 if d.current_revision is distinct from p_revision then raise exception 'MARKET_CONFLICT';end if;
 select * into strict v from public.market_versions where deal_id=d.id and revision=p_revision for update;
 if v.status<>'completed' then raise exception 'MARKET_STATE';end if;
 select * into execution from public.player_transfer_executions where deal_id=d.id and revision=v.revision;
 if execution.deal_id is null then raise exception 'MARKET_STATE';end if;
 if public.player_transfer_memberships(d.player_id) is distinct from execution.post_memberships then raise exception 'MARKET_LATER_CHANGES';end if;
 if exists(select 1 from public.player_transfer_executions later join public.market_deals other on other.id=later.deal_id
   join public.market_versions ov on ov.deal_id=later.deal_id and ov.revision=later.revision
   where other.player_id=d.player_id and later.created_at>execution.created_at and ov.status='completed') then raise exception 'MARKET_LATER_CHANGES';end if;
 select * into strict destination from public.teams where id=d.organization_id for update;
 if destination.dissolved_at is not null or destination.ownership_revision<>v.asset_revision or destination.leader_id=d.player_id then raise exception 'MARKET_LATER_CHANGES';end if;
 if d.buyer_organization_id is not null and not exists(select 1 from public.teams where id=d.buyer_organization_id and dissolved_at is null and ownership_revision=v.buyer_revision) then raise exception 'MARKET_LATER_CHANGES';end if;
 if v.transfer_plan->>'oldOrganizationId' is not null then
   if not(v.transfer_plan?'oldPosition') then raise exception 'MARKET_PLAYER_RESTORE_REVIEW';end if;
   select * into former from public.teams where id=(v.transfer_plan->>'oldOrganizationId')::uuid for update;
   if former.id is null or former.dissolved_at is not null or former.ownership_revision is distinct from(v.transfer_plan->>'oldOwnershipRevision')::bigint then raise exception 'MARKET_LATER_CHANGES';end if;
   if (select count(*) from public.team_members where team_id=former.id)>=(case when former.type='guild' then 60 else 12 end) then raise exception 'MARKET_PLAYER_CAPACITY';end if;
 end if;
 if exists(select 1 from public.organization_contracts c join public.contract_agreements a on a.contract_id=c.id join public.teams t on t.id=c.organization_id
   where c.player_id=d.player_id and c.kind='main' and t.type=destination.type and c.id<>v.new_contract_id
     and coalesce(public.contract_effective_end(a.contract_id,a.revision),'infinity')>clock_timestamp()) then raise exception 'MARKET_LATER_CHANGES';end if;
 select a.revision,cv.terms into latest from public.contract_agreements a join public.organization_contract_versions cv using(contract_id,revision)
   where a.contract_id=v.new_contract_id and a.effective_at<=clock_timestamp() order by a.effective_at desc,a.revision desc limit 1;
 policy:=latest.terms->'financial'->'transferCancellation';
 if policy is null or policy is distinct from v.new_terms->'financial'->'transferCancellation' then raise exception 'MARKET_PLAYER_LATER_POLICY';end if;
 perform public.contract_transfer_cancellation_validate(policy);
 select coalesce(jsonb_agg(jsonb_build_object('revision',a.revision,'effectiveAt',a.effective_at,'endedAt',a.ended_at) order by a.revision),'[]'),
   array_agg(a.revision order by a.revision) filter(where a.effective_at<=clock_timestamp()) into agreements,eligible
   from public.contract_agreements a where a.contract_id=v.new_contract_id;
 if eligible is null then raise exception 'MARKET_STATE';end if;
 paid:=public.player_return_paid(v.new_contract_id,eligible,d.player_id);
 assessment:=jsonb_build_object('dealId',d.id,'revision',v.revision,'cause',p_cause,'playerId',d.player_id,'organizationId',d.organization_id,
   'oldOrganizationId',v.transfer_plan->'oldOrganizationId','oldRole',v.transfer_plan->'oldRole','oldPosition',v.transfer_plan->'oldPosition',
   'price',v.price,'pricePayments',execution.payments,'contractId',v.new_contract_id,'claimRevision',latest.revision,
   'eligibleRevisions',eligible,'agreements',agreements,'policy',policy,'paid',paid,
   'returns',public.contract_transfer_cancellation_quote(policy,p_cause,paid));
 -- The decision binds the reviewed parties, roster, signed policy and original
 -- price, not a volatile clock value or a temporarily available cash balance.
 return assessment||jsonb_build_object('fingerprint',md5((assessment-'paid'-'returns')::text));
end $$;
revoke all on function public.player_transfer_memberships(uuid),public.player_return_paid(uuid,integer[],uuid),public.player_transfer_reversal_assess(uuid,uuid,integer,text)
 from public,anon,authenticated,service_role;
commit;
