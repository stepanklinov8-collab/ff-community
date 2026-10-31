-- A transfer proposal may prepare the receiving organization's contract
-- before membership. It cannot be accepted through the ordinary signing API.
-- No old agreement is ended by this preparation step.
begin;
alter table public.market_consents drop constraint market_consents_party_check;
alter table public.market_consents add constraint market_consents_party_check check(party in('seller','buyer','destination'));

create function public.player_transfer_can_prepare(p_contract uuid,p_organization uuid,p_player uuid,p_actor uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.market_deals d join public.market_versions v on v.deal_id=d.id and v.revision=d.current_revision
 where d.kind='player' and v.new_contract_id=p_contract and d.organization_id=p_organization and d.player_id=p_player
   and v.status in('offered','funded') and (
    current_setting('omcite.player_transfer_context',true)=d.id::text||':'||v.revision||':prepare' and public.organization_can_spend(d.organization_id,p_actor)
    or current_setting('omcite.player_transfer_context',true)=d.id::text||':'||v.revision||':accept' and p_actor=d.player_id and v.status='funded'))
$$;
do $$declare f record;definition text;updated text;needle text;count_value integer:=0;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'contract_mutate%' and pronargs=2 loop
  definition:=pg_get_functiondef(f.signature);updated:=definition;
  needle:='not exists(select 1 from public.team_members where team_id=organization_id_value and user_id=player_id_value)';
  updated:=replace(updated,needle,needle||' and not public.player_transfer_can_prepare(contract_id_value,organization_id_value,player_id_value,p_actor)');
  needle:='not exists(select 1 from public.team_members where team_id=c.organization_id and user_id=c.player_id)';
  updated:=replace(updated,needle,needle||' and not public.player_transfer_can_prepare(c.id,c.organization_id,c.player_id,p_actor)');
  if updated<>definition then execute updated;count_value:=count_value+1;end if;
 end loop;
 if count_value=0 then raise exception 'PLAYER_CONTRACT_MEMBER_PATCH';end if;
end $$;

alter function public.contract_mutate(uuid,jsonb) rename to contract_mutate_before_transfer_contract;
create function public.contract_mutate(p_actor uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare linked record;contract_value uuid;begin
 begin contract_value:=(p_input->>'contractId')::uuid;exception when others then raise exception 'CONTRACT_INPUT';end;
 select d.id,d.organization_id,d.player_id,v.revision,v.new_terms,v.new_contract_id into linked
 from public.market_deals d join public.market_versions v on v.deal_id=d.id and v.revision=d.current_revision
 where d.kind='player' and v.new_contract_id=contract_value and v.status in('draft','offered','funded');
 if found then
   if p_actor is null or not(p_actor=linked.player_id or public.can_manage_organization_contracts(linked.organization_id,p_actor)) then raise exception 'CONTRACT_NOT_FOUND';end if;
   if not public.player_transfer_can_prepare(contract_value,linked.organization_id,linked.player_id,p_actor) then raise exception 'CONTRACT_TRANSFER_REQUIRED';end if;
   if p_input->>'action'='save' and(p_input->'terms' is distinct from linked.new_terms or p_input->>'kind'<>'main'
     or(p_input->>'organizationId')::uuid is distinct from linked.organization_id or(p_input->>'playerId')::uuid is distinct from linked.player_id
     or p_input->'eventId'<>'null'::jsonb or p_input->'sessionId'<>'null'::jsonb) then raise exception 'CONTRACT_INPUT';end if;
 end if;
 return public.contract_mutate_before_transfer_contract(p_actor,p_input);
end $$;

create function public.player_transfer_assert_quote(p_deal public.market_deals,p_version public.market_versions) returns void
language plpgsql stable security definer set search_path=public as $$
declare overrides_value jsonb;quote_value jsonb;begin
 select coalesce(jsonb_agg(jsonb_build_object('contractId',value->>'contractId','amount',(value->>'fee')::bigint)),'[]') into overrides_value
 from jsonb_array_elements(p_version.transfer_plan->'contracts') where value->>'override'='true';
 quote_value:=public.player_transfer_quote(p_deal.player_id,p_deal.organization_id,p_version.price,overrides_value);
 if quote_value is distinct from p_version.transfer_plan then raise exception 'MARKET_PLAYER_CHANGED';end if;
 if quote_value->>'requiresFeeException'='true' then raise exception 'MARKET_PLAYER_EXCEPTION';end if;
end $$;

create function public.player_transfer_home_ready(p_deal uuid,p_revision integer) returns boolean
language sql stable security definer set search_path=public as $$
 select not exists(select 1 from public.market_versions v cross join lateral jsonb_array_elements(v.transfer_plan->'contracts') clause
 where v.deal_id=p_deal and v.revision=p_revision and clause->>'requiresConsent'='true'
  and not exists(select 1 from public.player_transfer_approvals approval where approval.deal_id=v.deal_id and approval.revision=v.revision
    and approval.contract_id=(clause->>'contractId')::uuid and approval.organization_id=(clause->>'organizationId')::uuid
    and approval.ownership_revision=(select ownership_revision from public.teams where id=approval.organization_id)
    and public.organization_can_spend(approval.organization_id,approval.signed_by)))
$$;

create function public.player_transfer_prepare_contract(p_actor uuid,p_deal uuid,p_revision integer) returns void
language plpgsql security definer set search_path=public as $$
declare d public.market_deals%rowtype;v public.market_versions%rowtype;source uuid;wallet public.coin_accounts%rowtype;amount_value bigint;signing bigint;salary_amount bigint;days_value integer;starts timestamptz;ends timestamptz;
 operation uuid;previous text:=coalesce(current_setting('omcite.player_transfer_context',true),'');
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into d from public.market_deals where id=p_deal for update;
 select * into v from public.market_versions where deal_id=p_deal and revision=p_revision for update;
 if d.kind is distinct from 'player' or d.current_revision is distinct from p_revision or v.status<>'offered' or v.new_contract_id is null then raise exception 'MARKET_STATE';end if;
 if not public.organization_can_spend(d.organization_id,p_actor) then raise exception 'MARKET_FINANCE';end if;
 if not exists(select 1 from public.market_consents where deal_id=d.id and revision=v.revision and party='seller' and signed_by=d.player_id) then raise exception 'MARKET_PLAYER_CONSENT';end if;
 if not public.player_transfer_home_ready(d.id,v.revision) then raise exception 'MARKET_PLAYER_HOME';end if;
 if exists(select 1 from public.market_consents where deal_id=d.id and revision=v.revision and party='destination') then raise exception 'MARKET_STATE';end if;
 perform public.player_transfer_assert_quote(d,v);perform public.contract_validate_terms(v.new_terms);
 if jsonb_array_length(coalesce(v.new_terms->'financial'->'rentalCompensations','[]'))>0 then raise exception 'CONTRACT_INPUT';end if;
 starts:=greatest(clock_timestamp(),(v.new_terms->>'startsAt')::timestamptz);ends:=(v.new_terms->>'endsAt')::timestamptz;
 if ends<=starts then raise exception 'CONTRACT_DATES';end if;
 signing:=(v.new_terms->'financial'->>'signingAmount')::bigint;
 salary_amount:=coalesce((v.new_terms->'financial'->'salary'->>'amount')::bigint,0);days_value:=coalesce((v.new_terms->'financial'->'salary'->>'periodDays')::integer,1);
 amount_value:=signing+floor(salary_amount::numeric*greatest(0,extract(epoch from(least(starts+make_interval(days=>days_value),ends)-starts)))/(days_value::numeric*86400))::bigint;
 source:=public.u6_coin_account('organization',d.organization_id);select * into strict wallet from public.coin_accounts where id=source for update;
 if wallet.balance-wallet.reserved<amount_value then raise exception 'MARKET_FUNDS';end if;
 perform set_config('omcite.player_transfer_context',d.id::text||':'||v.revision||':prepare',true);
 perform public.contract_mutate(p_actor,jsonb_build_object('action','save','requestId',gen_random_uuid(),'contractId',v.new_contract_id,'expectedRevision',0,
   'organizationId',d.organization_id,'playerId',d.player_id,'kind','main','eventId',null,'sessionId',null,'terms',v.new_terms));
 perform public.contract_mutate(p_actor,jsonb_build_object('action','offer','requestId',gen_random_uuid(),'contractId',v.new_contract_id,'revision',1));
 operation:=gen_random_uuid();insert into public.coin_operations(id,actor_id,action,input,description) values(operation,p_actor,'player_contract_reserve',jsonb_build_object('dealId',d.id,'revision',v.revision),'Резерв первоначальных выплат нового договора перехода');
 if amount_value>0 then perform public.u6_coin_entry(operation,source,0,amount_value);end if;
 insert into public.player_transfer_startup_escrows(deal_id,revision,account_id,amount,held) values(d.id,v.revision,source,amount_value,amount_value);
 insert into public.market_consents(deal_id,revision,party,signed_by) values(d.id,v.revision,'destination',p_actor);
 perform set_config('omcite.player_transfer_context',previous,true);
exception when others then perform set_config('omcite.player_transfer_context',previous,true);raise;
end $$;

create function public.player_transfer_release_contract(p_deal uuid,p_revision integer,p_actor uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v public.market_versions%rowtype;escrow public.player_transfer_startup_escrows%rowtype;operation uuid;begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into v from public.market_versions where deal_id=p_deal and revision=p_revision;
 if exists(select 1 from public.contract_agreements where contract_id=v.new_contract_id) then raise exception 'MARKET_PLAYER_SIGNED';end if;
 select * into escrow from public.player_transfer_startup_escrows where deal_id=p_deal and revision=p_revision for update;
 if escrow.held>0 then
   operation:=gen_random_uuid();insert into public.coin_operations(id,actor_id,action,input,description) values(operation,p_actor,'player_contract_release',jsonb_build_object('dealId',p_deal,'revision',p_revision),'Освобождение резерва неподписанного договора перехода');
   perform public.u6_coin_entry(operation,escrow.account_id,0,-escrow.held);
   update public.player_transfer_startup_escrows set held=0 where deal_id=p_deal and revision=p_revision;
 end if;
 if exists(select 1 from public.organization_contract_versions where contract_id=v.new_contract_id and status in('draft','offered')) then
   update public.organization_contract_versions set status='cancelled',responded_at=clock_timestamp() where contract_id=v.new_contract_id and status in('draft','offered');
   insert into public.market_events(deal_id,revision,actor_id,action) values(p_deal,p_revision,p_actor,'contract_offer_cancelled');
 end if;
end $$;
alter function public.market_release(uuid,integer,uuid) rename to market_release_organizations;
create function public.market_release(p_deal uuid,p_revision integer,p_actor uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 perform public.market_release_organizations(p_deal,p_revision,p_actor);
 if exists(select 1 from public.market_deals where id=p_deal and kind='player') then perform public.player_transfer_release_contract(p_deal,p_revision,p_actor);end if;
end $$;

alter function public.contract_query(uuid,jsonb) rename to contract_query_before_transfer_contract;
create function public.contract_query(p_actor uuid,p_input jsonb) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare answer jsonb;item jsonb;rows_value jsonb:='[]';linked uuid;begin
 answer:=public.contract_query_before_transfer_contract(p_actor,p_input);
 if jsonb_typeof(answer->'contracts')='array' then
   for item in select value from jsonb_array_elements(answer->'contracts') loop
     select d.id into linked from public.market_deals d join public.market_versions v on v.deal_id=d.id and v.revision=d.current_revision
       where d.kind='player' and v.new_contract_id=(item->>'id')::uuid and v.status in('draft','offered','funded');
     if linked is not null then item:=item||jsonb_build_object('transferDealId',linked,'transferPending',true,'canEdit',false,'canOffer',false);end if;
     rows_value:=rows_value||jsonb_build_array(item);
   end loop;
   answer:=jsonb_set(answer,'{contracts}',rows_value);
 end if;return answer;
end $$;
revoke all on function public.player_transfer_can_prepare(uuid,uuid,uuid,uuid),public.player_transfer_assert_quote(public.market_deals,public.market_versions),
 public.player_transfer_home_ready(uuid,integer),public.player_transfer_prepare_contract(uuid,uuid,integer),public.player_transfer_release_contract(uuid,integer,uuid),public.market_release_organizations(uuid,integer,uuid),public.market_release(uuid,integer,uuid),public.contract_mutate_before_transfer_contract(uuid,jsonb),public.contract_mutate(uuid,jsonb),public.contract_query_before_transfer_contract(uuid,jsonb),public.contract_query(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.contract_mutate(uuid,jsonb),public.contract_query(uuid,jsonb) to service_role;
commit;
