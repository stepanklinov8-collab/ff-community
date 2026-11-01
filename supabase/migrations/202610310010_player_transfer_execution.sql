-- Final player signature, effective new agreement, old-contract cutover,
-- price split and roster move are inseparable. Private controller helper.
begin;
create table public.player_transfer_executions(
 deal_id uuid not null,revision integer not null,operation_id uuid not null unique references public.coin_operations(id),
 new_contract_id uuid not null references public.organization_contracts(id),effective_at timestamptz not null,
 payments jsonb not null,post_memberships jsonb not null,related_party boolean not null,
 created_at timestamptz not null default clock_timestamp(),primary key(deal_id,revision),
 foreign key(deal_id,revision) references public.market_versions(deal_id,revision)
);
alter table public.player_transfer_executions enable row level security;
revoke all on public.player_transfer_executions from public,anon,authenticated,service_role;
create trigger player_transfer_execution_immutable before update or delete on public.player_transfer_executions
 for each row execute function public.contract_frozen_guard();

-- During the exact final-signature transaction the newly activated receiving
-- contract must not look like an unrelated conflicting old main agreement.
-- No generic context value or caller-provided contract ID can bypass this.
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.player_transfer_quote(uuid,uuid,bigint,jsonb)'::regprocedure);
 needle:='where c.player_id=p_player and c.kind=''main'' and t.dissolved_at is null';
 if position(needle in definition)=0 then raise exception 'TRANSFER_QUOTE_ACTIVATION_PATCH';end if;
 execute replace(definition,needle,needle||$patch$
    and not exists(select 1 from public.market_deals receiving join public.market_versions rv
      on rv.deal_id=receiving.id and rv.revision=receiving.current_revision
      where receiving.kind='player' and receiving.player_id=p_player and receiving.organization_id=p_destination
        and rv.new_contract_id=c.id and rv.status='funded'
        and current_setting('omcite.player_transfer_context',true)=receiving.id::text||':'||rv.revision||':accept')$patch$);
end $$;

create function public.player_transfer_memberships(p_player uuid) returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('organizationId',m.team_id,'role',m.role_in_team) order by m.team_id),'[]')
 from public.team_members m where m.user_id=p_player
$$;

create function public.player_transfer_execute(p_actor uuid,p_deal uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d public.market_deals%rowtype;v public.market_versions%rowtype;destination public.teams%rowtype;
 price_hold public.market_escrows%rowtype;startup public.player_transfer_startup_escrows%rowtype;wallet public.coin_accounts%rowtype;
 previous text:=coalesce(current_setting('omcite.player_transfer_context',true),'');source uuid;operation uuid;reserve_operation uuid;
 signer uuid;old_org uuid;item jsonb;old_agreement record;movement record;effective timestamptz;payments_value jsonb:='[]';
 old_contract uuid;amount_value bigint;net_value bigint;answer jsonb;existing public.player_transfer_executions%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into d from public.market_deals where id=p_deal for update;
 if d.kind is distinct from 'player' or p_actor is null or p_actor is distinct from d.player_id then raise exception 'MARKET_FORBIDDEN';end if;
 if d.current_revision is distinct from p_revision then raise exception 'MARKET_CONFLICT';end if;
 select * into strict v from public.market_versions where deal_id=d.id and revision=p_revision for update;
 select * into existing from public.player_transfer_executions where deal_id=d.id and revision=v.revision;
 if found and v.status='completed' then return jsonb_build_object('success',true,'dealId',d.id,'revision',v.revision,'status','completed','contractId',existing.new_contract_id);end if;
 if v.status<>'funded' or v.expires_at<=clock_timestamp() then raise exception 'MARKET_STATE';end if;
 if exists(select 1 from public.market_disputes where deal_id=d.id and closed_at is null) then raise exception 'MARKET_DISPUTED';end if;
 if (v.new_terms->>'startsAt')::timestamptz>clock_timestamp() then raise exception 'MARKET_PLAYER_START';end if;
 perform public.player_transfer_assert_quote(d,v);
 if not exists(select 1 from public.market_consents where deal_id=d.id and revision=v.revision and party='seller' and signed_by=d.player_id) then raise exception 'MARKET_PLAYER_CONSENT';end if;
 if not public.player_transfer_home_ready(d.id,v.revision) then raise exception 'MARKET_PLAYER_HOME';end if;
 select signed_by into signer from public.market_consents where deal_id=d.id and revision=v.revision and party='destination';
 if signer is null or not public.organization_can_spend(d.organization_id,signer) then raise exception 'MARKET_STALE_CONSENT';end if;
 select signed_by into signer from public.market_consents where deal_id=d.id and revision=v.revision and party='buyer';
 if signer is null or not public.market_buyer_access(d,signer,true) then raise exception 'MARKET_STALE_CONSENT';end if;
 if d.buyer_organization_id is not null and not exists(select 1 from public.teams where id=d.buyer_organization_id and dissolved_at is null and ownership_revision=v.buyer_revision) then raise exception 'MARKET_STALE_OWNER';end if;
 if d.buyer_user_id is not null and not public.can_manage_organization_contracts(d.organization_id,d.buyer_user_id) then raise exception 'MARKET_STALE_CONSENT';end if;
 select * into strict destination from public.teams where id=d.organization_id for update;
 if destination.dissolved_at is not null then raise exception 'MARKET_ORGANIZATION';end if;
 if (select count(*) from public.team_members where team_id=destination.id)>=(case when destination.type='guild' then 60 else 12 end) then raise exception 'MARKET_PLAYER_CAPACITY';end if;
 old_org:=(v.transfer_plan->>'oldOrganizationId')::uuid;
 if old_org is not null then
   perform 1 from public.teams where id=old_org for update;
   if exists(select 1 from public.teams where id=old_org and leader_id=d.player_id) then raise exception 'MARKET_PLAYER_LEADER';end if;
 end if;
 source:=public.u6_coin_account(case when d.buyer_user_id is null then 'organization' else 'player' end,coalesce(d.buyer_user_id,d.buyer_organization_id));
 select * into price_hold from public.market_escrows where deal_id=d.id and revision=v.revision for update;
 if price_hold.account_id is distinct from source or price_hold.amount is distinct from v.price or price_hold.held is distinct from v.price then raise exception 'MARKET_RESERVE';end if;
 select * into startup from public.player_transfer_startup_escrows where deal_id=d.id and revision=v.revision for update;
 if startup.account_id is distinct from public.u6_coin_account('organization',d.organization_id) or startup.held is distinct from startup.amount or startup.deal_id is null then raise exception 'MARKET_RESERVE';end if;
 -- Validate both actual source collaterals before releasing either hold. The
 -- other hold on a shared account remains protected throughout activation.
 for wallet in select * from public.coin_accounts where id in(source,startup.account_id) order by id for update loop
   amount_value:=case when wallet.id=source then v.price else 0 end+case when wallet.id=startup.account_id then startup.held else 0 end;
   if wallet.reserved<amount_value or wallet.balance<wallet.reserved then raise exception 'MARKET_FUNDS';end if;
 end loop;
 perform public.contract_freeze_due_values();
 reserve_operation:=gen_random_uuid();
 insert into public.coin_operations(id,actor_id,action,input,description) values(reserve_operation,p_actor,'player_contract_activate',jsonb_build_object('dealId',d.id,'revision',v.revision),'Использование резерва нового договора перехода');
 if startup.held>0 then perform public.u6_coin_entry(reserve_operation,startup.account_id,0,-startup.held);end if;
 update public.player_transfer_startup_escrows set held=0 where deal_id=d.id and revision=v.revision;
 perform set_config('omcite.player_transfer_context',d.id::text||':'||v.revision||':accept',true);
 perform public.contract_mutate(p_actor,jsonb_build_object('action','accept','requestId',gen_random_uuid(),'contractId',v.new_contract_id,'revision',1));
 select effective_at into effective from public.contract_agreements where contract_id=v.new_contract_id and revision=1 and player_signer=d.player_id;
 if effective is null or effective>clock_timestamp() or public.contract_effective_end(v.new_contract_id,1)<=clock_timestamp() then raise exception 'MARKET_PLAYER_CONTRACT';end if;
 -- Recheck immediately after the real bilateral signature; ignore only the
 -- exact new receiving agreement through the private context above.
 perform public.player_transfer_assert_quote(d,v);
 for item in select value from jsonb_array_elements(v.transfer_plan->'contracts') where value->>'relation'='leaving' loop
   old_contract:=(item->>'contractId')::uuid;
   for old_agreement in select contract_id,revision from public.contract_agreements where contract_id=old_contract and(ended_at is null or ended_at>effective) order by revision for update loop
     perform public.contract_salary_schedule_close(old_agreement.contract_id,old_agreement.revision,effective,'Завершённый переход игрока');
     update public.contract_agreements set ended_at=effective,end_reason='player_transfer:'||d.id where contract_id=old_agreement.contract_id and revision=old_agreement.revision;
   end loop;
   perform public.contract_salary_process(old_contract);
   update public.organization_contract_versions cv set status='cancelled',responded_at=effective where cv.contract_id=old_contract and cv.status in('draft','offered')
     and not exists(select 1 from public.contract_agreements a where a.contract_id=cv.contract_id and a.revision=cv.revision);
   amount_value:=(item->>'fee')::bigint;
   if amount_value>0 then payments_value:=payments_value||jsonb_build_array(jsonb_build_object('accountId',public.u6_coin_account('organization',(item->>'organizationId')::uuid),'amount',amount_value));end if;
 end loop;
 if old_org is not null then delete from public.team_members where team_id=old_org and user_id=d.player_id;end if;
 insert into public.team_members(team_id,user_id,role_in_team) values(destination.id,d.player_id,'main');
 net_value:=(v.transfer_plan->>'playerAmount')::bigint;
 if net_value>0 then payments_value:=payments_value||jsonb_build_array(jsonb_build_object('accountId',public.u6_coin_account('player',d.player_id),'amount',net_value));end if;
 if (select coalesce(sum((value->>'amount')::bigint),0) from jsonb_array_elements(payments_value))<>v.price then raise exception 'MARKET_PLAYER_CONSERVATION';end if;
 operation:=gen_random_uuid();insert into public.coin_operations(id,actor_id,action,input,description) values(operation,p_actor,'player_transfer',jsonb_build_object('dealId',d.id,'revision',v.revision),'Подписание договора, переход игрока и распределение цены');
 for movement in select account_id,sum(delta)::bigint delta,sum(reserve_delta)::bigint reserve_delta from(
   select source account_id,-v.price delta,-v.price reserve_delta
   union all select (value->>'accountId')::uuid,(value->>'amount')::bigint,0 from jsonb_array_elements(payments_value)
 ) changes group by account_id order by sum(delta),account_id loop
   perform public.u6_coin_entry(operation,movement.account_id,movement.delta,movement.reserve_delta);
 end loop;
 update public.market_escrows set held=0 where deal_id=d.id and revision=v.revision;
 insert into public.player_transfer_executions(deal_id,revision,operation_id,new_contract_id,effective_at,payments,post_memberships,related_party)
 values(d.id,v.revision,operation,v.new_contract_id,effective,payments_value,public.player_transfer_memberships(d.player_id),
   coalesce(d.buyer_user_id=d.player_id or (select ultimate_owner_user_id from public.teams where id=old_org)=destination.ultimate_owner_user_id,false));
 update public.market_versions set status='completed' where deal_id=d.id and revision=v.revision;
 insert into public.market_events(deal_id,revision,actor_id,action,details) values(d.id,v.revision,p_actor,'player_completed',jsonb_build_object('contractId',v.new_contract_id,'effectiveAt',effective));
 perform set_config('omcite.player_transfer_context',previous,true);
 return jsonb_build_object('success',true,'dealId',d.id,'revision',v.revision,'status','completed','contractId',v.new_contract_id);
exception when others then perform set_config('omcite.player_transfer_context',previous,true);raise;
end $$;
revoke all on function public.player_transfer_memberships(uuid),public.player_transfer_execute(uuid,uuid,integer) from public,anon,authenticated,service_role;
commit;
