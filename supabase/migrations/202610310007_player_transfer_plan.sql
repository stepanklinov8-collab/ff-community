-- Private preparation only. Organization-sale actions remain explicitly
-- blocked for player records until their distinct completion flow is used.
begin;
alter table public.market_deals add column kind text not null default 'organization' check(kind in('organization','player')),
 add column player_id uuid references public.profiles(id),
 add constraint market_asset_kind check((kind='organization' and player_id is null) or(kind='player' and player_id is not null));
alter table public.market_versions add column transfer_plan jsonb,add column new_terms jsonb,add column new_contract_id uuid;
create unique index market_new_contract on public.market_versions(new_contract_id) where new_contract_id is not null;
create table public.player_transfer_approvals(
 deal_id uuid not null,revision integer not null,contract_id uuid not null references public.organization_contracts(id),
 organization_id uuid not null references public.teams(id),signed_by uuid not null references public.profiles(id),ownership_revision bigint not null,
 signed_at timestamptz not null default clock_timestamp(),primary key(deal_id,revision,contract_id),
 foreign key(deal_id,revision) references public.market_versions(deal_id,revision)
);
create table public.player_transfer_disclosures(
 deal_id uuid not null,revision integer not null,organization_id uuid not null references public.teams(id),
 granted_by uuid not null references public.profiles(id),contracts jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(deal_id,revision,organization_id),foreign key(deal_id,revision) references public.market_versions(deal_id,revision)
);
create table public.player_transfer_startup_escrows(
 deal_id uuid not null,revision integer not null,account_id uuid not null references public.coin_accounts(id),
 amount bigint not null check(amount between 0 and 2000000000000),held bigint not null check(held between 0 and amount),
 primary key(deal_id,revision),foreign key(deal_id,revision) references public.market_versions(deal_id,revision)
);
do $$declare relation text;begin
 foreach relation in array array['player_transfer_approvals','player_transfer_disclosures','player_transfer_startup_escrows'] loop
   execute format('alter table public.%I enable row level security',relation);
   execute format('revoke all on public.%I from public,anon,authenticated,service_role',relation);
 end loop;
 foreach relation in array array['player_transfer_approvals','player_transfer_disclosures'] loop
   execute format('create trigger transfer_immutable before update or delete on public.%I for each row execute function public.contract_frozen_guard()',relation);
 end loop;
end $$;
create function public.player_transfer_quote(p_player uuid,p_destination uuid,p_price bigint,p_overrides jsonb default '[]') returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare destination public.teams%rowtype;membership record;row_value record;rule jsonb;override_value jsonb;item jsonb;ids uuid[]:='{}';contract_value uuid;
 contracts_value jsonb:='[]';old_agreements jsonb:='[]';guests jsonb:='[]';fee bigint;raw_fee bigint;fees bigint:=0;relation_value text;needs_consent boolean;
begin
 if p_player is null or not exists(select 1 from public.profiles where id=p_player) then raise exception 'MARKET_PLAYER';end if;
 if p_price is null or p_price not between 0 and 1000000000000 or jsonb_typeof(p_overrides) is distinct from 'array' or jsonb_array_length(p_overrides)>2 then raise exception 'MARKET_INPUT';end if;
 select * into destination from public.teams where id=p_destination and dissolved_at is null;
 if destination.id is null then raise exception 'MARKET_ORGANIZATION';end if;
 if (select count(*) from public.team_members m join public.teams t on t.id=m.team_id where m.user_id=p_player and t.type=destination.type and t.dissolved_at is null)>1 then raise exception 'MARKET_PLAYER_MEMBERSHIP';end if;
 select m.team_id,m.role_in_team,t.leader_id,t.ownership_revision into membership from public.team_members m join public.teams t on t.id=m.team_id
 where m.user_id=p_player and t.type=destination.type and t.dissolved_at is null;
 if membership.team_id=destination.id then raise exception 'MARKET_PLAYER_ALREADY_MEMBER';end if;
 for item in select value from jsonb_array_elements(p_overrides) loop
   perform public.contract_assert_object(item,array['contractId','amount'],array['contractId','amount']);perform public.contract_assert_uint(item->'amount',1000000000000);
   begin contract_value:=(item->>'contractId')::uuid;exception when others then raise exception 'MARKET_INPUT';end;
   if contract_value is null or contract_value=any(ids) then raise exception 'MARKET_INPUT';end if;ids:=array_append(ids,contract_value);
 end loop;
 for row_value in
  select distinct on(c.id) c.id,c.organization_id,t.type,t.ownership_revision,a.revision,a.effective_at,
    public.contract_effective_end(a.contract_id,a.revision) ends_at,v.terms
  from public.organization_contracts c join public.teams t on t.id=c.organization_id
  join public.contract_agreements a on a.contract_id=c.id join public.organization_contract_versions v using(contract_id,revision)
  where c.player_id=p_player and c.kind='main' and t.dissolved_at is null
    and coalesce(public.contract_effective_end(a.contract_id,a.revision),'infinity')>clock_timestamp()
  order by c.id,(a.effective_at<=clock_timestamp()) desc,case when a.effective_at<=clock_timestamp() then a.effective_at end desc,a.effective_at,a.revision desc
 loop
   if row_value.type=destination.type and row_value.organization_id is distinct from membership.team_id then raise exception 'MARKET_PLAYER_CONTRACT_CONFLICT';end if;
   relation_value:=case when row_value.organization_id=membership.team_id then 'leaving' else 'retained' end;
   select value into override_value from jsonb_array_elements(p_overrides) where value->>'contractId'=row_value.id::text;
   if relation_value='retained' and override_value is not null then raise exception 'MARKET_INPUT';end if;
   raw_fee:=case when relation_value='leaving' then public.contract_compensation_amount(coalesce(row_value.terms->'transfer','{"kind":"none"}'),p_price) else 0 end;
   fee:=coalesce((override_value->>'amount')::bigint,raw_fee);fees:=fees+fee;
   needs_consent:=case when relation_value='leaving' then coalesce((row_value.terms->>'transferRequiresConsent')::boolean,true) or override_value is not null or raw_fee>p_price
     else coalesce(row_value.terms->>'guestPolicy','consent') in('forbidden','consent') end;
   contracts_value:=contracts_value||jsonb_build_array(jsonb_build_object('contractId',row_value.id,'organizationId',row_value.organization_id,
     'revision',row_value.revision,'ownershipRevision',row_value.ownership_revision,'relation',relation_value,'rawFee',raw_fee,'fee',fee,
     'override',override_value is not null,'requiresConsent',needs_consent,'termsHash',md5(row_value.terms::text)));
   if relation_value='leaving' then
    select old_agreements||coalesce(jsonb_agg(jsonb_build_object('contractId',a.contract_id,'revision',a.revision,'signedAt',a.signed_at,'effectiveAt',a.effective_at,
      'originalEnd',public.contract_effective_end(a.contract_id,a.revision),'organizationSigner',a.organization_signer,'playerSigner',a.player_signer,'termsHash',md5(v.terms::text)) order by a.effective_at,a.revision),'[]') into old_agreements
    from public.contract_agreements a join public.organization_contract_versions v using(contract_id,revision)
    where a.contract_id=row_value.id and coalesce(public.contract_effective_end(a.contract_id,a.revision),'infinity')>clock_timestamp();
   end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_overrides) o where not exists(select 1 from jsonb_array_elements(contracts_value) c where c->>'contractId'=o->>'contractId' and c->>'relation'='leaving')) then raise exception 'MARKET_INPUT';end if;
 select coalesce(jsonb_agg(jsonb_build_object('contractId',c.id,'organizationId',c.organization_id,'eventId',c.event_id,'sessionId',c.session_id,
   'revision',a.revision,'effectiveAt',a.effective_at,'endsAt',public.contract_effective_end(a.contract_id,a.revision),'termsHash',md5(v.terms::text)) order by c.id,a.revision),'[]') into guests
 from public.organization_contracts c join public.contract_agreements a on a.contract_id=c.id join public.organization_contract_versions v using(contract_id,revision)
 where c.player_id=p_player and c.kind='guest' and coalesce(public.contract_effective_end(a.contract_id,a.revision),'infinity')>clock_timestamp();
 return jsonb_build_object('playerId',p_player,'destinationId',destination.id,'destinationType',destination.type,'destinationRevision',destination.ownership_revision,
   'oldOrganizationId',membership.team_id,'oldRole',membership.role_in_team,'oldLeaderId',membership.leader_id,'oldOwnershipRevision',membership.ownership_revision,
   'contracts',contracts_value,'oldAgreements',old_agreements,'guestCommitments',guests,'price',p_price,'organizationFees',fees,'playerAmount',greatest(0,p_price-fees),'requiresFeeException',fees>p_price);
end $$;

-- Prevent organization-sale endpoints from ever changing the destination's
-- ownership when the asset is a player.
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.market_mutate(uuid,jsonb)'::regprocedure);
 needle:='if d.id is not null and not public.market_access(d.id,p_actor) then raise exception ''MARKET_FORBIDDEN'';end if;';
 if position(needle in definition)=0 then raise exception 'PLAYER_FLOW_GUARD_PATCH';end if;
 execute replace(definition,needle,needle||' if d.kind=''player'' then raise exception ''MARKET_PLAYER_FLOW'';end if;');
end $$;
revoke all on function public.player_transfer_quote(uuid,uuid,bigint,jsonb) from public,anon,authenticated,service_role;
commit;
