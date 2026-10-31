begin;
alter table public.market_executions add column buyer_root_user_id uuid references public.profiles(id),add column seller_root_user_id uuid references public.profiles(id);
create function public.market_mutate(p_actor uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d public.market_deals%rowtype;v public.market_versions%rowtype;asset public.teams%rowtype;
 old public.market_requests%rowtype;escrow public.market_escrows%rowtype;execution public.market_executions%rowtype;
 action_value text;request_value uuid;deal_value uuid;revision_value integer;expected integer;price_value bigint;expires_value timestamptz;
 buyer_user uuid;buyer_org uuid;buyer_revision bigint;buyer_root uuid;seller_signer uuid;buyer_signer uuid;source uuid;target uuid;operation uuid;wallet public.coin_accounts%rowtype;
 keys text[];answer jsonb;bundle jsonb;disclosed jsonb;reason_value text;author_side text;buyer_access boolean;seller_access boolean;related boolean;
 previous_setting text:=coalesce(current_setting('omcite.allow_organization_owner_transfer',true),'off');
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'MARKET_AUTH';end if;
 action_value:=p_input->>'action';
 keys:=case action_value when 'save' then array['action','requestId','dealId','expectedRevision','organizationId','buyerUserId','buyerOrganizationId','price','expiresAt']
   when 'dispute' then array['action','requestId','dealId','revision','reason']
   when 'resolve' then array['action','requestId','dealId','revision','reason']
   when 'reverse' then array['action','requestId','dealId','revision','reason']
   else array['action','requestId','dealId','revision'] end;
 if coalesce(action_value,'') not in('save','offer','disclose','seller_accept','buyer_fund','complete','cancel','reject','dispute','resolve','reverse') then raise exception 'MARKET_INPUT';end if;
 perform public.contract_assert_object(p_input,keys,keys);
 begin request_value:=(p_input->>'requestId')::uuid;deal_value:=(p_input->>'dealId')::uuid;exception when others then raise exception 'MARKET_INPUT';end;
 if request_value is null or deal_value is null then raise exception 'MARKET_INPUT';end if;
 select * into d from public.market_deals where id=deal_value for update;
 if d.id is not null and not public.market_access(d.id,p_actor) then raise exception 'MARKET_FORBIDDEN';end if;
 if action_value='reverse' and not public.u6_coin_admin(p_actor) then raise exception 'MARKET_CASH_ADMIN';end if;
 if action_value in('buyer_fund','complete') and d.id is not null and not public.market_buyer_access(d,p_actor,true) then raise exception 'MARKET_FINANCE';end if;
 select * into old from public.market_requests where id=request_value;
 if found then
   if old.actor_id is distinct from p_actor or old.input is distinct from p_input then raise exception 'MARKET_CONFLICT';end if;
   return old.result;
 end if;
 if action_value='save' then
   perform public.contract_assert_uint(p_input->'expectedRevision',1000000);perform public.contract_assert_uint(p_input->'price',1000000000000);
   expected:=(p_input->>'expectedRevision')::integer;price_value:=(p_input->>'price')::bigint;expires_value:=public.contract_assert_timestamp(p_input->'expiresAt');
   if expires_value<=clock_timestamp() then raise exception 'MARKET_DATES';end if;
   begin buyer_user:=(p_input->>'buyerUserId')::uuid;buyer_org:=(p_input->>'buyerOrganizationId')::uuid;exception when others then raise exception 'MARKET_INPUT';end;
   if num_nonnulls(buyer_user,buyer_org)<>1 then raise exception 'MARKET_INPUT';end if;
   select * into asset from public.teams where id=(p_input->>'organizationId')::uuid for update;
   if asset.id is null or asset.dissolved_at is not null or num_nonnulls(asset.owner_user_id,asset.owner_team_id)<>1 then raise exception 'MARKET_ORGANIZATION';end if;
   buyer_access:=coalesce(buyer_user=p_actor,false) or coalesce(public.can_manage_organization_contracts(buyer_org,p_actor),false);
   seller_access:=coalesce(public.can_manage_organization_contracts(asset.id,p_actor),false);
   if not(buyer_access or seller_access) then raise exception 'MARKET_FORBIDDEN';end if;
   if buyer_user is not null and not exists(select 1 from public.profiles where id=buyer_user) then raise exception 'MARKET_INPUT';end if;
   if buyer_org is not null then
     select ownership_revision into buyer_revision from public.teams where id=buyer_org and dissolved_at is null;
     if buyer_revision is null then raise exception 'MARKET_ORGANIZATION';end if;
   end if;
   author_side:=case when buyer_access then 'buyer' else 'seller' end;
   if d.id is null then
     if expected<>0 then raise exception 'MARKET_CONFLICT';end if;
     insert into public.market_deals(id,organization_id,buyer_user_id,buyer_organization_id,created_by) values(deal_value,asset.id,buyer_user,buyer_org,p_actor) returning * into d;
     revision_value:=1;
   else
     if d.current_revision<>expected or d.organization_id<>asset.id or d.buyer_user_id is distinct from buyer_user or d.buyer_organization_id is distinct from buyer_org then raise exception 'MARKET_CONFLICT';end if;
     select * into strict v from public.market_versions where deal_id=d.id and revision=d.current_revision;
     if not public.market_version_access(d,v,p_actor) then raise exception 'MARKET_FORBIDDEN';end if;
     if v.status in('completed','reversed') then raise exception 'MARKET_STATE';end if;
     perform public.market_release(d.id,v.revision,p_actor);
     update public.market_versions set status='superseded' where deal_id=d.id and revision=v.revision;
     if v.status<>'draft' then perform public.market_notice(d.id,v.revision,'superseded');end if;
     revision_value:=d.current_revision+1;
     update public.market_deals set current_revision=revision_value where id=d.id returning * into d;
   end if;
   insert into public.market_versions(deal_id,revision,price,expires_at,asset_revision,buyer_revision,seller_user_id,seller_organization_id,status,created_by,author_side)
   values(d.id,revision_value,price_value,expires_value,asset.ownership_revision,buyer_revision,asset.owner_user_id,asset.owner_team_id,'draft',p_actor,author_side) returning * into v;
   perform public.market_assert_current(d,v);
   answer:=jsonb_build_object('success',true,'dealId',d.id,'revision',revision_value,'status','draft');
 else
   if d.id is null then raise exception 'MARKET_NOT_FOUND';end if;
   perform public.contract_assert_uint(p_input->'revision',1000000);revision_value:=(p_input->>'revision')::integer;
   if revision_value<>d.current_revision then raise exception 'MARKET_CONFLICT';end if;
   select * into strict v from public.market_versions where deal_id=d.id and revision=revision_value for update;
   if not public.market_version_access(d,v,p_actor) then raise exception 'MARKET_FORBIDDEN';end if;
   select * into strict asset from public.teams where id=d.organization_id for update;
   if v.status in('draft','offered','funded') and v.expires_at<=clock_timestamp() then
     perform public.market_release(d.id,v.revision,p_actor);update public.market_versions set status='expired' where deal_id=d.id and revision=v.revision;
     action_value:='expired';answer:=jsonb_build_object('success',false,'expired',true,'status','expired');
   elsif action_value in('cancel','reject') then
     if v.status not in('draft','offered','funded') then raise exception 'MARKET_STATE';end if;
     if not(public.market_buyer_access(d,p_actor) or public.is_organization_owner(asset.id,p_actor)) then raise exception 'MARKET_FORBIDDEN';end if;
     perform public.market_release(d.id,v.revision,p_actor);
     update public.market_versions set status=case when action_value='reject' then 'rejected' else 'cancelled' end where deal_id=d.id and revision=v.revision;
   elsif action_value='offer' then
     if v.status<>'draft' then raise exception 'MARKET_STATE';end if;
     if not(case when v.author_side='buyer' then public.market_buyer_access(d,p_actor) else public.can_manage_organization_contracts(asset.id,p_actor) end) then raise exception 'MARKET_FORBIDDEN';end if;
     perform public.market_assert_current(d,v);update public.market_versions set status='offered' where deal_id=d.id and revision=v.revision;
   elsif action_value in('disclose','seller_accept','buyer_fund','complete') then
     if v.status not in('offered','funded') then raise exception 'MARKET_STATE';end if;
     if exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null) then raise exception 'MARKET_DISPUTED';end if;
     perform public.market_assert_current(d,v);bundle:=public.market_bundle(asset.id);
     select x.bundle into disclosed from public.market_disclosures x where x.deal_id=d.id and x.revision=v.revision;
     if action_value='disclose' then
       if not public.is_organization_owner(asset.id,p_actor) then raise exception 'MARKET_OWNER';end if;
       if disclosed is null then insert into public.market_disclosures(deal_id,revision,granted_by,bundle) values(d.id,v.revision,p_actor,bundle);
       elsif disclosed is distinct from bundle then raise exception 'MARKET_DISCLOSURE_CHANGED';end if;
     else
       if disclosed is null then raise exception 'MARKET_DISCLOSURE_REQUIRED';end if;
       if disclosed is distinct from bundle then raise exception 'MARKET_DISCLOSURE_CHANGED';end if;
       if action_value='seller_accept' then
         if not public.is_organization_owner(asset.id,p_actor) then raise exception 'MARKET_OWNER';end if;
         insert into public.market_consents(deal_id,revision,party,signed_by) values(d.id,v.revision,'seller',p_actor) on conflict do nothing;
       else
         if not public.market_buyer_access(d,p_actor,true) then raise exception 'MARKET_FINANCE';end if;
         select signed_by into seller_signer from public.market_consents where deal_id=d.id and revision=v.revision and party='seller';
         if seller_signer is null or not public.is_organization_owner(asset.id,seller_signer) then raise exception 'MARKET_SELLER_CONSENT';end if;
         source:=public.u6_coin_account(case when d.buyer_user_id is null then 'organization' else 'player' end,coalesce(d.buyer_user_id,d.buyer_organization_id));
         select * into strict wallet from public.coin_accounts where id=source for update;
         select * into escrow from public.market_escrows where deal_id=d.id and revision=v.revision for update;
         if action_value='buyer_fund' then
           if v.status<>'offered' or escrow.deal_id is not null then raise exception 'MARKET_STATE';end if;
           if wallet.balance-wallet.reserved<v.price then raise exception 'MARKET_FUNDS';end if;
           operation:=gen_random_uuid();insert into public.coin_operations(id,actor_id,action,input,description) values(operation,p_actor,'market_reserve',jsonb_build_object('dealId',d.id,'revision',v.revision),'Резерв цены покупки организации');
           if v.price>0 then perform public.u6_coin_entry(operation,source,0,v.price);end if;
           insert into public.market_escrows(deal_id,revision,account_id,amount,held) values(d.id,v.revision,source,v.price,v.price);
           insert into public.market_consents(deal_id,revision,party,signed_by) values(d.id,v.revision,'buyer',p_actor);
           update public.market_versions set status='funded' where deal_id=d.id and revision=v.revision;
         else
           if v.status<>'funded' or escrow.account_id is distinct from source or escrow.amount is distinct from v.price or escrow.held is distinct from v.price then raise exception 'MARKET_RESERVE';end if;
           select signed_by into buyer_signer from public.market_consents where deal_id=d.id and revision=v.revision and party='buyer';
           if buyer_signer is null or not public.market_buyer_access(d,buyer_signer,true) then raise exception 'MARKET_STALE_CONSENT';end if;
           if wallet.reserved<v.price or wallet.balance-(wallet.reserved-v.price)<v.price then raise exception 'MARKET_FUNDS';end if;
           target:=public.u6_coin_account(case when v.seller_user_id is null then 'organization' else 'player' end,coalesce(v.seller_user_id,v.seller_organization_id));
           buyer_root:=coalesce(d.buyer_user_id,(select ultimate_owner_user_id from public.teams where id=d.buyer_organization_id));related:=buyer_root=asset.ultimate_owner_user_id;
           operation:=gen_random_uuid();insert into public.coin_operations(id,actor_id,action,input,description) values(operation,p_actor,'market_sale',jsonb_build_object('dealId',d.id,'revision',v.revision),'Покупка организации и передача собственности');
           if source=target then perform public.u6_coin_entry(operation,source,0,-v.price);
           else perform public.u6_coin_entry(operation,source,-v.price,-v.price);perform public.u6_coin_entry(operation,target,v.price);end if;
           perform set_config('omcite.allow_organization_owner_transfer','on',true);
           update public.teams set owner_user_id=d.buyer_user_id,owner_team_id=d.buyer_organization_id where id=asset.id;
           perform set_config('omcite.allow_organization_owner_transfer',previous_setting,true);
           update public.market_escrows set held=0 where deal_id=d.id and revision=v.revision;
           insert into public.market_executions(deal_id,revision,operation_id,seller_account_id,restore_bundle,related_party,buyer_root_user_id,seller_root_user_id)
           values(d.id,v.revision,operation,target,public.market_bundle(asset.id,true),related,buyer_root,asset.ultimate_owner_user_id);
           update public.market_versions set status='completed' where deal_id=d.id and revision=v.revision;
         end if;
       end if;
     end if;
   elsif action_value='dispute' then
     reason_value:=trim(p_input->>'reason');if reason_value is null or length(reason_value) not between 3 and 1000 or v.status='draft' then raise exception 'MARKET_INPUT';end if;
     if exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null) then raise exception 'MARKET_DISPUTED';end if;
     insert into public.market_disputes(deal_id,opened_by,reason) values(d.id,p_actor,reason_value)
     on conflict(deal_id) do update set opened_by=excluded.opened_by,reason=excluded.reason,opened_at=clock_timestamp(),closed_at=null,resolved_by=null,resolution=null;
   elsif action_value in('resolve','reverse') then
     reason_value:=trim(p_input->>'reason');if reason_value is null or length(reason_value) not between 3 and 1000 then raise exception 'MARKET_INPUT';end if;
     if not public.is_full_admin(p_actor) or not exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null) then raise exception 'MARKET_ADMIN';end if;
     if action_value='reverse' then
       if not public.u6_coin_admin(p_actor) then raise exception 'MARKET_CASH_ADMIN';end if;
       if v.status<>'completed' then raise exception 'MARKET_STATE';end if;
       select * into strict execution from public.market_executions where deal_id=d.id and revision=v.revision;
       if asset.owner_user_id is distinct from d.buyer_user_id or asset.owner_team_id is distinct from d.buyer_organization_id
         or coalesce(d.buyer_user_id,(select ultimate_owner_user_id from public.teams where id=d.buyer_organization_id)) is distinct from execution.buyer_root_user_id
         or coalesce(v.seller_user_id,(select ultimate_owner_user_id from public.teams where id=v.seller_organization_id)) is distinct from execution.seller_root_user_id
         or public.market_bundle(asset.id,true) is distinct from execution.restore_bundle then raise exception 'MARKET_LATER_CHANGES';end if;
       if exists(select 1 from public.market_executions e join public.market_deals other on other.id=e.deal_id join public.market_versions ov on ov.deal_id=e.deal_id and ov.revision=e.revision
         where e.completed_at>execution.completed_at and ov.status='completed' and other.organization_id in(select (row_value->>'id')::uuid from jsonb_array_elements(execution.restore_bundle->'organizations') row_value)) then raise exception 'MARKET_LATER_CHANGES';end if;
       select * into strict escrow from public.market_escrows where deal_id=d.id and revision=v.revision;
       operation:=gen_random_uuid();insert into public.coin_operations(id,actor_id,action,input,description,reverses_id) values(operation,p_actor,'market_reverse',jsonb_build_object('dealId',d.id,'revision',v.revision,'reason',reason_value),reason_value,execution.operation_id);
       if escrow.account_id<>execution.seller_account_id then perform public.u6_coin_entry(operation,execution.seller_account_id,-v.price);perform public.u6_coin_entry(operation,escrow.account_id,v.price);end if;
       perform set_config('omcite.allow_organization_owner_transfer','on',true);
       update public.teams set owner_user_id=v.seller_user_id,owner_team_id=v.seller_organization_id where id=asset.id;
       perform set_config('omcite.allow_organization_owner_transfer',previous_setting,true);
       update public.market_versions set status='reversed' where deal_id=d.id and revision=v.revision;
     end if;
     update public.market_disputes set closed_at=clock_timestamp(),resolved_by=p_actor,resolution=reason_value where deal_id=d.id;
   else raise exception 'MARKET_INPUT';end if;
   if answer is null then answer:=jsonb_build_object('success',true,'dealId',d.id,'revision',v.revision,'status',(select status from public.market_versions where deal_id=d.id and revision=v.revision));end if;
 end if;
 insert into public.market_events(deal_id,revision,actor_id,action,details) values(d.id,coalesce(revision_value,v.revision),p_actor,action_value,case when reason_value is not null then jsonb_build_object('reason',reason_value) else '{}' end);
 insert into public.market_requests(id,actor_id,input,result) values(request_value,p_actor,p_input,answer);
 if action_value<>'save' then perform public.market_notice(d.id,coalesce(revision_value,v.revision),action_value);end if;
 return answer;
exception when others then perform set_config('omcite.allow_organization_owner_transfer',previous_setting,true);raise;
end $$;
revoke all on function public.market_mutate(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.market_mutate(uuid,jsonb) to service_role;

alter function public.contract_maintenance_run() rename to contract_maintenance_before_market;
create function public.contract_maintenance_run() returns jsonb language plpgsql security definer set search_path=public as $$
declare answer jsonb;begin answer:=public.contract_maintenance_before_market();return answer||jsonb_build_object('expiredMarketDeals',public.market_expire());end $$;
revoke all on function public.contract_maintenance_before_market(),public.contract_maintenance_run() from public,anon,authenticated,service_role;
grant execute on function public.contract_maintenance_run() to service_role;
commit;
