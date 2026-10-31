begin;
create function public.player_transfer_query(p_actor uuid,p_input jsonb) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare d public.market_deals%rowtype;v public.market_versions%rowtype;deal_value uuid;offset_value integer;rows_value jsonb;organizations jsonb;
 requirements jsonb;clause jsonb;org_id uuid;contract_value uuid;consents jsonb;disclosed jsonb;document jsonb;manager boolean;financial boolean;buyer boolean;
 current_value boolean;fresh boolean:=true;pending boolean;home_ready boolean;player_consent boolean;prepared boolean;disputed boolean;can_read_terms boolean;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'MARKET_AUTH';end if;
 perform public.contract_assert_object(p_input,array[]::text[],array['dealId','revision','offset','search','searchKind','chat','before','history','events']);
 offset_value:=coalesce((p_input->>'offset')::integer,0);if offset_value not between 0 and 1000000 then raise exception 'MARKET_INPUT';end if;
 if p_input?'search' then return public.market_query(p_actor,p_input);end if;
 begin deal_value:=(p_input->>'dealId')::uuid;exception when others then raise exception 'MARKET_INPUT';end;
 if deal_value is null then
   select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value."createdAt" desc,row_value.id),'[]') into rows_value from(
     select listed.id,listed.player_id as "playerId",p.nickname as "playerName",listed.organization_id as "organizationId",t.name as "organizationName",t.type,
       latest.revision,latest.price,latest.status,latest.expires_at as "expiresAt",listed.created_at as "createdAt",
       (select count(*) from public.market_messages m where m.deal_id=listed.id and m.sender_id<>p_actor and m.id>coalesce((select last_seen from public.market_reads where deal_id=listed.id and user_id=p_actor),0)) as unread,
       exists(select 1 from public.market_disputes s where s.deal_id=listed.id and s.closed_at is null) as disputed
     from public.market_deals listed join public.teams t on t.id=listed.organization_id join public.profiles p on p.id=listed.player_id
     cross join lateral(select mv.* from public.market_versions mv where mv.deal_id=listed.id and public.market_version_access(listed,mv,p_actor) order by revision desc limit 1) latest
     where listed.kind='player' order by listed.created_at desc,listed.id limit 31 offset offset_value
   ) row_value;
   select coalesce(jsonb_agg(to_jsonb(row_value)),'[]') into organizations from(select id,name,type,public.organization_can_spend(id,p_actor) as "canSpend" from public.teams where dissolved_at is null and public.can_manage_organization_contracts(id,p_actor) order by name,id limit 100) row_value;
   return jsonb_build_object('deals',coalesce((select jsonb_agg(value order by n) from jsonb_array_elements(rows_value) with ordinality x(value,n) where n<=30),'[]'),
     'hasMore',jsonb_array_length(rows_value)>30,'organizations',organizations,'userId',p_actor);
 end if;
 select * into d from public.market_deals where id=deal_value and kind='player';
 if d.id is null or not public.market_access(d.id,p_actor) then raise exception 'MARKET_NOT_FOUND';end if;
 if p_input->>'chat'='true' or p_input->>'history'='true' or p_input->>'events'='true' then return public.market_query(p_actor,p_input);end if;
 select * into v from public.market_versions where deal_id=d.id and public.market_version_access(d,market_versions,p_actor)
   and(not(p_input?'revision') or revision=(p_input->>'revision')::integer) order by revision desc limit 1;
 if v.deal_id is null then raise exception 'MARKET_NOT_FOUND';end if;
 manager:=coalesce(public.can_manage_organization_contracts(d.organization_id,p_actor),false);
 financial:=coalesce(public.organization_can_spend(d.organization_id,p_actor),false);buyer:=coalesce(public.market_buyer_access(d,p_actor,true),false);
 current_value:=v.revision=d.current_revision;pending:=current_value and v.status in('draft','offered','funded') and v.expires_at>clock_timestamp();
 begin perform public.player_transfer_assert_quote(d,v);exception when others then
   if sqlerrm in('MARKET_PLAYER_CHANGED','MARKET_PLAYER_EXCEPTION','MARKET_PLAYER_CONTRACT_CONFLICT','MARKET_PLAYER_ALREADY_MEMBER','MARKET_PLAYER_MEMBERSHIP','MARKET_ORGANIZATION') then fresh:=false;else raise;end if;
 end;
 home_ready:=public.player_transfer_home_ready(d.id,v.revision);
 select exists(select 1 from public.market_consents where deal_id=d.id and revision=v.revision and party='seller' and signed_by=d.player_id) into player_consent;
 select exists(select 1 from public.market_consents where deal_id=d.id and revision=v.revision and party='destination' and public.organization_can_spend(d.organization_id,signed_by)) into prepared;
 select exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null) into disputed;
 can_read_terms:=p_actor=d.player_id or manager or public.market_buyer_access(d,p_actor) or public.is_full_admin(p_actor) and exists(select 1 from public.market_disputes where deal_id=d.id);
 requirements:='[]';
 for clause in select value from jsonb_array_elements(v.transfer_plan->'contracts') loop
   org_id:=(clause->>'organizationId')::uuid;contract_value:=(clause->>'contractId')::uuid;document:=null;
   select contracts into disclosed from public.player_transfer_disclosures where deal_id=d.id and revision=v.revision and organization_id=org_id;
   if p_actor=d.player_id or public.can_manage_organization_contracts(org_id,p_actor) or public.is_full_admin(p_actor) and exists(select 1 from public.market_disputes where deal_id=d.id) then
     select terms into document from public.organization_contract_versions where contract_id=contract_value and revision=(clause->>'revision')::integer;
   elsif disclosed is not null and can_read_terms then
     select value->'terms' into document from jsonb_array_elements(disclosed) where value->>'contractId'=contract_value::text;
   end if;
   requirements:=requirements||jsonb_build_array(jsonb_build_object('contractId',contract_value,'organizationId',org_id,'organizationName',(select name from public.teams where id=org_id),
     'relation',clause->>'relation','requiresConsent',clause->'requiresConsent','fee',case when document is null then null else clause->'fee' end,
     'approved',exists(select 1 from public.player_transfer_approvals a where a.deal_id=d.id and a.revision=v.revision and a.contract_id=contract_value
       and a.ownership_revision=(select ownership_revision from public.teams where id=org_id) and public.organization_can_spend(org_id,a.signed_by)),
     'canApprove',pending and v.status='offered' and not disputed and public.organization_can_spend(org_id,p_actor) and(clause->>'requiresConsent')::boolean,
     'canDisclose',pending and v.status in('offered','funded') and not disputed and public.is_organization_owner(org_id,p_actor) and disclosed is null,'terms',document));
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('party',party,'signedBy',signed_by,'signedAt',signed_at)),'[]') into consents from public.market_consents where deal_id=d.id and revision=v.revision;
 return jsonb_build_object('deal',jsonb_build_object('id',d.id,'playerId',d.player_id,'playerName',(select nickname from public.profiles where id=d.player_id),
   'organizationId',d.organization_id,'organizationName',(select name from public.teams where id=d.organization_id),
   'buyerUserId',d.buyer_user_id,'buyerOrganizationId',d.buyer_organization_id,'buyerName',coalesce((select nickname from public.profiles where id=d.buyer_user_id),(select name from public.teams where id=d.buyer_organization_id)),
   'revision',v.revision,'price',v.price,'status',v.status,'expiresAt',v.expires_at,'isCurrent',current_value,'isPlayer',p_actor=d.player_id,'startsReady',(v.new_terms->>'startsAt')::timestamptz<=clock_timestamp(),
   'newTerms',case when can_read_terms then v.new_terms else null end,'newContractId',v.new_contract_id,
   'organizationFees',v.transfer_plan->'organizationFees','playerAmount',v.transfer_plan->'playerAmount','requiresFeeException',v.transfer_plan->'requiresFeeException',
   'compensationOverrides',case when p_actor=d.player_id or manager then coalesce((select jsonb_agg(jsonb_build_object('contractId',value->>'contractId','amount',value->'fee')) from jsonb_array_elements(v.transfer_plan->'contracts') where value->>'override'='true'),'[]') else null end,
   'requirements',requirements,'consents',consents,'fresh',fresh,'homeReady',home_ready,'prepared',prepared,'playerConsented',player_consent,'disputed',disputed,
   'canEdit',pending and not disputed and(p_actor=d.player_id or manager),
   'canOffer',pending and v.status='draft' and not disputed and(case when v.author_side='seller' then p_actor=d.player_id else manager end),
   'canPlayerConsent',pending and v.status='offered' and fresh and not disputed and p_actor=d.player_id and not player_consent,
   'canPrepare',pending and v.status='offered' and fresh and not disputed and financial and home_ready and player_consent and not prepared,
   'canFund',pending and v.status='offered' and fresh and not disputed and buyer and home_ready and player_consent and prepared,
   'canComplete',pending and v.status='funded' and fresh and not disputed and p_actor=d.player_id and home_ready and prepared and(v.new_terms->>'startsAt')::timestamptz<=clock_timestamp(),
   'canCancel',pending and(p_actor=d.player_id or manager or public.market_buyer_access(d,p_actor)),
   'canDispute',v.status<>'draft' and not disputed and public.player_transfer_party(d,v,p_actor),'canResolve',disputed and public.is_full_admin(p_actor),
   'canMessage',public.player_transfer_party(d,v,p_actor) or disputed and public.is_full_admin(p_actor)),
   'priceReserve',(select jsonb_build_object('amount',amount,'held',held) from public.market_escrows where deal_id=d.id and revision=v.revision),
   'contractReserve',case when can_read_terms then(select jsonb_build_object('amount',amount,'held',held) from public.player_transfer_startup_escrows where deal_id=d.id and revision=v.revision) else null end,
   'dispute',(select jsonb_build_object('reason',reason,'closedAt',closed_at,'resolution',resolution) from public.market_disputes where deal_id=d.id));
end $$;
revoke all on function public.player_transfer_query(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.player_transfer_query(uuid,jsonb) to service_role;
commit;
