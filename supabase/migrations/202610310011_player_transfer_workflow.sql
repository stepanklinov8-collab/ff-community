-- Versioned invitations and approvals. Only this verified server workflow may
-- call the private preparation and final player-signature helpers.
begin;
create function public.player_transfer_party(p_deal public.market_deals,p_version public.market_versions,p_actor uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce(p_actor is not null and(p_actor=p_deal.player_id or public.can_manage_organization_contracts(p_deal.organization_id,p_actor)
   or public.market_buyer_access(p_deal,p_actor)
   or exists(select 1 from jsonb_array_elements(p_version.transfer_plan->'contracts') clause
     where public.can_manage_organization_contracts((clause->>'organizationId')::uuid,p_actor))),false)
$$;
alter function public.market_version_access(public.market_deals,public.market_versions,uuid) rename to market_organization_version_access;
create function public.market_version_access(p_deal public.market_deals,p_version public.market_versions,p_actor uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select case when p_deal.kind='organization' then public.market_organization_version_access(p_deal,p_version,p_actor)
 else coalesce(
   public.player_transfer_party(p_deal,p_version,p_actor) and(p_version.status<>'draft' or
     case when p_version.author_side='seller' then p_actor=p_deal.player_id
       else public.can_manage_organization_contracts(p_deal.organization_id,p_actor) or public.market_buyer_access(p_deal,p_actor) end)
   or public.is_full_admin(p_actor) and exists(select 1 from public.market_disputes where deal_id=p_deal.id),false) end
$$;

create function public.player_transfer_assert_review(p_deal public.market_deals,p_version public.market_versions) returns void
language plpgsql stable security definer set search_path=public as $$
begin
 perform public.player_transfer_assert_quote(p_deal,p_version);
exception when others then if sqlerrm<>'MARKET_PLAYER_EXCEPTION' then raise;end if;
end $$;

create function public.player_transfer_mutate(p_actor uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d public.market_deals%rowtype;v public.market_versions%rowtype;prior public.market_requests%rowtype;org public.teams%rowtype;
 action_value text:=p_input->>'action';keys text[];request_value uuid;deal_value uuid;revision_value integer;expected integer;
 player_value uuid;destination_value uuid;buyer_user uuid;buyer_org uuid;price_value bigint;expires_value timestamptz;quote_value jsonb;terms jsonb;
 source uuid;wallet public.coin_accounts%rowtype;operation uuid;home uuid;clause jsonb;approved boolean;reason_value text;answer jsonb;bundle jsonb;side text;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'MARKET_AUTH';end if;
 keys:=case action_value when 'player_save' then array['action','requestId','dealId','expectedRevision','playerId','destinationId','buyerUserId','buyerOrganizationId','price','expiresAt','newTerms','compensationOverrides']
   when 'home_consent' then array['action','requestId','dealId','revision','homeContractId','approve']
   when 'disclose' then array['action','requestId','dealId','revision','organizationId']
   when 'dispute' then array['action','requestId','dealId','revision','reason']
   when 'resolve' then array['action','requestId','dealId','revision','reason']
   when 'offer' then array['action','requestId','dealId','revision']
   when 'player_consent' then array['action','requestId','dealId','revision']
   when 'prepare_contract' then array['action','requestId','dealId','revision']
   when 'buyer_fund' then array['action','requestId','dealId','revision']
   when 'complete' then array['action','requestId','dealId','revision']
   when 'cancel' then array['action','requestId','dealId','revision']
   when 'reject' then array['action','requestId','dealId','revision'] else null end;
 if keys is null then raise exception 'MARKET_INPUT';end if;perform public.contract_assert_object(p_input,keys,keys);
 begin request_value:=(p_input->>'requestId')::uuid;deal_value:=(p_input->>'dealId')::uuid;exception when others then raise exception 'MARKET_INPUT';end;
 if request_value is null or deal_value is null then raise exception 'MARKET_INPUT';end if;
 select * into d from public.market_deals where id=deal_value for update;
 if d.id is not null then
   if d.kind<>'player' or not public.market_access(d.id,p_actor) then raise exception 'MARKET_NOT_FOUND';end if;
   select * into strict v from public.market_versions where deal_id=d.id and revision=d.current_revision for update;
   if action_value='prepare_contract' and not public.organization_can_spend(d.organization_id,p_actor) then raise exception 'MARKET_FINANCE';end if;
   if action_value='buyer_fund' and not public.market_buyer_access(d,p_actor,true) then raise exception 'MARKET_FINANCE';end if;
   if action_value in('complete','player_consent') and p_actor<>d.player_id then raise exception 'MARKET_FORBIDDEN';end if;
   if action_value='home_consent' then
     begin home:=(p_input->>'homeContractId')::uuid;exception when others then raise exception 'MARKET_INPUT';end;
     select value into clause from jsonb_array_elements(v.transfer_plan->'contracts') where value->>'contractId'=home::text;
     if clause is null or not public.organization_can_spend((clause->>'organizationId')::uuid,p_actor) then raise exception 'MARKET_FINANCE';end if;
   end if;
 end if;
 select * into prior from public.market_requests where id=request_value;
 if found then
   if prior.actor_id is distinct from p_actor or prior.input is distinct from p_input then raise exception 'MARKET_CONFLICT';end if;
   return prior.result;
 end if;
 if action_value='player_save' then
   perform public.contract_assert_uint(p_input->'expectedRevision',1000000);perform public.contract_assert_uint(p_input->'price',1000000000000);
   expected:=(p_input->>'expectedRevision')::integer;price_value:=(p_input->>'price')::bigint;
   begin player_value:=(p_input->>'playerId')::uuid;destination_value:=(p_input->>'destinationId')::uuid;buyer_user:=(p_input->>'buyerUserId')::uuid;buyer_org:=(p_input->>'buyerOrganizationId')::uuid;exception when others then raise exception 'MARKET_INPUT';end;
   if num_nonnulls(buyer_user,buyer_org)<>1 then raise exception 'MARKET_INPUT';end if;
   select * into org from public.teams where id=destination_value and dissolved_at is null for update;
   if org.id is null then raise exception 'MARKET_ORGANIZATION';end if;
   if not(p_actor=player_value or public.can_manage_organization_contracts(org.id,p_actor)) then raise exception 'MARKET_FORBIDDEN';end if;
   if buyer_user is not null and not public.can_manage_organization_contracts(org.id,buyer_user) then raise exception 'MARKET_PLAYER_BUYER';end if;
   if buyer_org is not null and not exists(select 1 from public.teams where id=buyer_org and dissolved_at is null) then raise exception 'MARKET_ORGANIZATION';end if;
   terms:=p_input->'newTerms';perform public.contract_validate_terms(terms);
   if not(terms->'financial'?'transferCancellation') then raise exception 'CONTRACT_TRANSFER_CANCELLATION_REQUIRED';end if;
   if jsonb_array_length(coalesce(terms->'financial'->'rentalCompensations','[]'))>0 then raise exception 'CONTRACT_INPUT';end if;
   expires_value:=public.contract_assert_timestamp(p_input->'expiresAt');
   if expires_value<=clock_timestamp() or expires_value<(terms->>'startsAt')::timestamptz then raise exception 'MARKET_DATES';end if;
   quote_value:=public.player_transfer_quote(player_value,org.id,price_value,p_input->'compensationOverrides');
   side:=case when public.can_manage_organization_contracts(org.id,p_actor) then 'buyer' else 'seller' end;
   if d.id is null then
     if expected<>0 then raise exception 'MARKET_CONFLICT';end if;
     insert into public.market_deals(id,kind,player_id,organization_id,buyer_user_id,buyer_organization_id,created_by)
     values(deal_value,'player',player_value,org.id,buyer_user,buyer_org,p_actor) returning * into d;revision_value:=1;
   else
     if d.current_revision<>expected or d.player_id<>player_value or d.organization_id<>org.id or d.buyer_user_id is distinct from buyer_user or d.buyer_organization_id is distinct from buyer_org then raise exception 'MARKET_CONFLICT';end if;
     if v.status in('completed','reversed') or exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null) then raise exception 'MARKET_STATE';end if;
     perform public.market_release(d.id,v.revision,p_actor);
     update public.market_versions set status='superseded' where deal_id=d.id and revision=v.revision;
     revision_value:=v.revision+1;update public.market_deals set current_revision=revision_value where id=d.id returning * into d;
   end if;
   insert into public.market_versions(deal_id,revision,price,expires_at,asset_revision,buyer_revision,seller_user_id,status,created_by,author_side,transfer_plan,new_terms,new_contract_id)
   values(d.id,revision_value,price_value,expires_value,org.ownership_revision,(select ownership_revision from public.teams where id=buyer_org),player_value,'draft',p_actor,side,quote_value,terms,gen_random_uuid());
   answer:=jsonb_build_object('success',true,'dealId',d.id,'revision',revision_value,'status','draft');
 else
   if d.id is null then raise exception 'MARKET_NOT_FOUND';end if;
   perform public.contract_assert_uint(p_input->'revision',1000000);revision_value:=(p_input->>'revision')::integer;
   if revision_value<>d.current_revision or not public.market_version_access(d,v,p_actor) then raise exception 'MARKET_CONFLICT';end if;
   if v.status in('draft','offered','funded') and v.expires_at<=clock_timestamp() then
     perform public.market_release(d.id,v.revision,p_actor);update public.market_versions set status='expired' where deal_id=d.id and revision=v.revision;
     action_value:='expired';answer:=jsonb_build_object('success',false,'expired',true,'status','expired');
   elsif action_value in('cancel','reject') then
     if v.status not in('draft','offered','funded') or not(p_actor=d.player_id or public.can_manage_organization_contracts(d.organization_id,p_actor) or public.market_buyer_access(d,p_actor)) then raise exception 'MARKET_STATE';end if;
     perform public.market_release(d.id,v.revision,p_actor);update public.market_versions set status=case when action_value='reject' then 'rejected' else 'cancelled' end where deal_id=d.id and revision=v.revision;
   elsif action_value='dispute' then
     reason_value:=trim(p_input->>'reason');if reason_value is null or length(reason_value) not between 3 and 1000 or v.status='draft' then raise exception 'MARKET_INPUT';end if;
     if exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null) then raise exception 'MARKET_DISPUTED';end if;
     insert into public.market_disputes(deal_id,opened_by,reason) values(d.id,p_actor,reason_value)
       on conflict(deal_id) do update set opened_by=excluded.opened_by,reason=excluded.reason,opened_at=clock_timestamp(),closed_at=null,resolved_by=null,resolution=null;
   elsif action_value='resolve' then
     reason_value:=trim(p_input->>'reason');if reason_value is null or length(reason_value) not between 3 and 1000 then raise exception 'MARKET_INPUT';end if;
     if not public.is_full_admin(p_actor) or not exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null) then raise exception 'MARKET_ADMIN';end if;
     update public.market_disputes set closed_at=clock_timestamp(),resolved_by=p_actor,resolution=reason_value where deal_id=d.id;
   else
     if exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null) then raise exception 'MARKET_DISPUTED';end if;
     if v.status not in('draft','offered','funded') then raise exception 'MARKET_STATE';end if;
     if action_value in('offer','home_consent','disclose') then perform public.player_transfer_assert_review(d,v);
     else perform public.player_transfer_assert_quote(d,v);end if;
     if action_value='offer' then
       if v.status<>'draft' or not(case when v.author_side='seller' then p_actor=d.player_id else public.can_manage_organization_contracts(d.organization_id,p_actor) end) then raise exception 'MARKET_FORBIDDEN';end if;
       update public.market_versions set status='offered' where deal_id=d.id and revision=v.revision;
     elsif action_value='player_consent' then
       if p_actor<>d.player_id or v.status<>'offered' then raise exception 'MARKET_FORBIDDEN';end if;
       insert into public.market_consents(deal_id,revision,party,signed_by) values(d.id,v.revision,'seller',p_actor) on conflict do nothing;
     elsif action_value='home_consent' then
       if v.status<>'offered' or jsonb_typeof(p_input->'approve') is distinct from 'boolean' then raise exception 'MARKET_STATE';end if;
       approved:=(p_input->>'approve')::boolean;
       if not approved then perform public.market_release(d.id,v.revision,p_actor);update public.market_versions set status='rejected' where deal_id=d.id and revision=v.revision;
       else
         insert into public.player_transfer_approvals(deal_id,revision,contract_id,organization_id,signed_by,ownership_revision)
           select d.id,v.revision,home,(clause->>'organizationId')::uuid,p_actor,ownership_revision from public.teams where id=(clause->>'organizationId')::uuid on conflict do nothing;
       end if;
     elsif action_value='disclose' then
       begin home:=(p_input->>'organizationId')::uuid;exception when others then raise exception 'MARKET_INPUT';end;
       if not public.is_organization_owner(home,p_actor) or not exists(select 1 from jsonb_array_elements(v.transfer_plan->'contracts') item where item->>'organizationId'=home::text) then raise exception 'MARKET_OWNER';end if;
       select coalesce(jsonb_agg(jsonb_build_object('contractId',c.id,'revision',cv.revision,'terms',cv.terms) order by c.id,cv.revision),'[]') into bundle
       from public.organization_contracts c join public.organization_contract_versions cv on cv.contract_id=c.id
       where c.organization_id=home and c.player_id=d.player_id and exists(select 1 from jsonb_array_elements(v.transfer_plan->'contracts') ref where ref->>'contractId'=c.id::text and(ref->>'revision')::integer=cv.revision);
       insert into public.player_transfer_disclosures(deal_id,revision,organization_id,granted_by,contracts) values(d.id,v.revision,home,p_actor,bundle) on conflict do nothing;
     elsif action_value='prepare_contract' then
       perform public.player_transfer_prepare_contract(p_actor,d.id,v.revision);
     elsif action_value='buyer_fund' then
       if v.status<>'offered' or not public.market_buyer_access(d,p_actor,true) then raise exception 'MARKET_FINANCE';end if;
       if not public.player_transfer_home_ready(d.id,v.revision) or not exists(select 1 from public.market_consents where deal_id=d.id and revision=v.revision and party='seller' and signed_by=d.player_id) then raise exception 'MARKET_PLAYER_HOME';end if;
       if not exists(select 1 from public.market_consents where deal_id=d.id and revision=v.revision and party='destination' and public.organization_can_spend(d.organization_id,signed_by)) then raise exception 'MARKET_STALE_CONSENT';end if;
       if d.buyer_user_id is not null and not public.can_manage_organization_contracts(d.organization_id,p_actor) then raise exception 'MARKET_PLAYER_BUYER';end if;
       if d.buyer_organization_id is not null and not exists(select 1 from public.teams where id=d.buyer_organization_id and dissolved_at is null and ownership_revision=v.buyer_revision) then raise exception 'MARKET_STALE_OWNER';end if;
       source:=public.u6_coin_account(case when d.buyer_user_id is null then 'organization' else 'player' end,coalesce(d.buyer_user_id,d.buyer_organization_id));
       select * into strict wallet from public.coin_accounts where id=source for update;
       if wallet.balance-wallet.reserved<v.price then raise exception 'MARKET_FUNDS';end if;
       operation:=gen_random_uuid();insert into public.coin_operations(id,actor_id,action,input,description) values(operation,p_actor,'player_transfer_reserve',jsonb_build_object('dealId',d.id,'revision',v.revision),'Резерв цены перехода игрока');
       if v.price>0 then perform public.u6_coin_entry(operation,source,0,v.price);end if;
       insert into public.market_escrows(deal_id,revision,account_id,amount,held) values(d.id,v.revision,source,v.price,v.price);
       insert into public.market_consents(deal_id,revision,party,signed_by) values(d.id,v.revision,'buyer',p_actor);
       update public.market_versions set status='funded' where deal_id=d.id and revision=v.revision;
     elsif action_value='complete' then answer:=public.player_transfer_execute(p_actor,d.id,v.revision);
     else raise exception 'MARKET_INPUT';end if;
   end if;
   if answer is null then answer:=jsonb_build_object('success',true,'dealId',d.id,'revision',v.revision,'status',(select status from public.market_versions where deal_id=d.id and revision=v.revision));end if;
 end if;
 insert into public.market_events(deal_id,revision,actor_id,action,details) values(d.id,revision_value,p_actor,'player_'||action_value,case when reason_value is null then '{}'::jsonb else jsonb_build_object('reason',reason_value) end);
 insert into public.market_requests(id,actor_id,input,result) values(request_value,p_actor,p_input,answer);
 if action_value<>'player_save' then perform public.market_notice(d.id,revision_value,'player_'||action_value);end if;
 return answer;
end $$;

alter function public.market_notice(uuid,integer,text) rename to market_organization_notice;
create function public.market_notice(p_deal uuid,p_revision integer,p_action text) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.market_deals where id=p_deal and kind='player') then perform public.market_organization_notice(p_deal,p_revision,p_action);return;end if;
 insert into public.competition_notification_outbox(dedupe_key,user_id,title,body,link)
 select 'player-market:'||p_deal||':'||p_revision||':'||p_action||':'||actor,actor,'Переход игрока',
   'Изменилось состояние предложения. Откройте переход для просмотра условий.','/transfers?dealId='||p_deal
 from(
   select player_id actor from public.market_deals where id=p_deal
   union select buyer_user_id from public.market_deals where id=p_deal
   union select t.ultimate_owner_user_id from public.market_deals d join public.teams t on t.id in(d.organization_id,d.buyer_organization_id) where d.id=p_deal
   union select t.leader_id from public.market_deals d join public.teams t on t.id in(d.organization_id,d.buyer_organization_id) where d.id=p_deal
   union select t.ultimate_owner_user_id from public.market_versions v cross join lateral jsonb_array_elements(v.transfer_plan->'contracts') ref join public.teams t on t.id=(ref->>'organizationId')::uuid where v.deal_id=p_deal and v.revision=p_revision
   union select t.leader_id from public.market_versions v cross join lateral jsonb_array_elements(v.transfer_plan->'contracts') ref join public.teams t on t.id=(ref->>'organizationId')::uuid where v.deal_id=p_deal and v.revision=p_revision
 ) recipients where actor is not null on conflict(dedupe_key) do nothing;
end $$;

-- Shared chat/history retains its existing paging, reply and audit behavior.
-- Organization detail must never disclose the receiving organization's bundle
-- merely because a player transfer points at that organization.
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.market_query(uuid,jsonb)'::regprocedure);
 needle:='order by listed.created_at desc,listed.id limit 31 offset offset_value';
 if position(needle in definition)=0 then raise exception 'PLAYER_MARKET_LIST_PATCH';end if;
 definition:=replace(definition,needle,'where listed.kind=''organization'' '||needle);
 needle:='select bundle into disclosed from public.market_disclosures';
 if position(needle in definition)=0 then raise exception 'PLAYER_MARKET_QUERY_PATCH';end if;
 execute replace(definition,needle,'if d.kind=''player'' then raise exception ''MARKET_PLAYER_FLOW'';end if; '||needle);
 definition:=pg_get_functiondef('public.market_chat_action(uuid,jsonb)'::regprocedure);
 needle:='if public.is_full_admin(p_actor) and not exists';
 if position(needle in definition)=0 then raise exception 'PLAYER_CHAT_PARTY_PATCH';end if;
 execute replace(definition,needle,'if not(d.kind=''player'' and public.player_transfer_party(d,v,p_actor)) and public.is_full_admin(p_actor) and not exists');
end $$;
revoke all on function public.player_transfer_party(public.market_deals,public.market_versions,uuid),public.market_organization_version_access(public.market_deals,public.market_versions,uuid),
 public.market_version_access(public.market_deals,public.market_versions,uuid),public.player_transfer_mutate(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.player_transfer_assert_review(public.market_deals,public.market_versions),public.market_organization_notice(uuid,integer,text),public.market_notice(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.player_transfer_mutate(uuid,jsonb) to service_role;
commit;
