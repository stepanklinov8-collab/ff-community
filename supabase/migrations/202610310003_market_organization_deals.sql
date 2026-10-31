-- Organization sales use the existing coin ledger. Escrow, consent and title
-- change are reconciled under the same wallet lock and database transaction.
begin;
create table public.market_deals(
 id uuid primary key,organization_id uuid not null references public.teams(id),
 buyer_user_id uuid references public.profiles(id),buyer_organization_id uuid references public.teams(id),
 current_revision integer not null default 1,created_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 check(num_nonnulls(buyer_user_id,buyer_organization_id)=1)
);
create index market_deals_buyer on public.market_deals(buyer_user_id,buyer_organization_id,created_at desc);
create table public.market_versions(
 deal_id uuid not null references public.market_deals(id),revision integer not null,
 price bigint not null check(price between 0 and 1000000000000),expires_at timestamptz not null,
 asset_revision bigint not null,buyer_revision bigint,seller_user_id uuid references public.profiles(id),seller_organization_id uuid references public.teams(id),
 status text not null check(status in('draft','offered','funded','completed','cancelled','rejected','expired','superseded','reversed')),
 author_side text not null check(author_side in('buyer','seller')),
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 primary key(deal_id,revision),check(num_nonnulls(seller_user_id,seller_organization_id)=1)
);
create table public.market_disclosures(
 deal_id uuid not null,revision integer not null,granted_by uuid not null references public.profiles(id),
 bundle jsonb not null,created_at timestamptz not null default clock_timestamp(),primary key(deal_id,revision),
 foreign key(deal_id,revision) references public.market_versions(deal_id,revision)
);
create table public.market_consents(
 deal_id uuid not null,revision integer not null,party text not null check(party in('seller','buyer')),
 signed_by uuid not null references public.profiles(id),signed_at timestamptz not null default clock_timestamp(),
 primary key(deal_id,revision,party),foreign key(deal_id,revision) references public.market_versions(deal_id,revision)
);
create table public.market_escrows(
 deal_id uuid not null,revision integer not null,account_id uuid not null references public.coin_accounts(id),
 amount bigint not null check(amount>=0),held bigint not null check(held>=0 and held<=amount),
 primary key(deal_id,revision),foreign key(deal_id,revision) references public.market_versions(deal_id,revision)
);
create table public.market_executions(
 deal_id uuid not null,revision integer not null,operation_id uuid not null unique references public.coin_operations(id),
 seller_account_id uuid not null references public.coin_accounts(id),restore_bundle jsonb not null,related_party boolean not null,
 completed_at timestamptz not null default clock_timestamp(),primary key(deal_id,revision),
 foreign key(deal_id,revision) references public.market_versions(deal_id,revision)
);
create table public.market_events(
 id bigint generated always as identity primary key,deal_id uuid not null references public.market_deals(id),revision integer not null,
 actor_id uuid references public.profiles(id),action text not null,details jsonb not null default '{}',created_at timestamptz not null default clock_timestamp()
);
create index market_events_deal on public.market_events(deal_id,id desc);
create table public.market_requests(
 id uuid primary key,actor_id uuid not null references public.profiles(id),input jsonb not null,result jsonb not null
);
create table public.market_disputes(
 deal_id uuid primary key references public.market_deals(id),opened_by uuid not null references public.profiles(id),reason text not null,
 opened_at timestamptz not null default clock_timestamp(),closed_at timestamptz,resolved_by uuid references public.profiles(id),resolution text
);
do $$declare relation text;begin
 foreach relation in array array['market_deals','market_versions','market_disclosures','market_consents','market_escrows','market_executions','market_events','market_requests','market_disputes'] loop
   execute format('alter table public.%I enable row level security',relation);
   execute format('revoke all on public.%I from public,anon,authenticated,service_role',relation);
 end loop;
 foreach relation in array array['market_disclosures','market_consents','market_executions','market_events','market_requests'] loop
   execute format('create trigger market_immutable before update or delete on public.%I for each row execute function public.contract_frozen_guard()',relation);
 end loop;
end $$;

create function public.market_version_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if (to_jsonb(new)-'status') is distinct from(to_jsonb(old)-'status') then raise exception 'MARKET_IMMUTABLE';end if;return new;
end $$;
create trigger market_version_guard before update on public.market_versions for each row execute function public.market_version_guard();
create trigger market_version_delete before delete on public.market_versions for each row execute function public.contract_frozen_guard();

create function public.market_buyer_access(p_deal public.market_deals,p_actor uuid,p_financial boolean default false) returns boolean
language sql stable security definer set search_path=public as $$
 select p_actor is not null and(coalesce(p_deal.buyer_user_id=p_actor,false) or case when p_financial then public.organization_can_spend(p_deal.buyer_organization_id,p_actor) else public.can_manage_organization_contracts(p_deal.buyer_organization_id,p_actor) end)
$$;
create function public.market_version_access(p_deal public.market_deals,p_version public.market_versions,p_actor uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select coalesce(p_actor is not null and(
  (p_version.status<>'draft' or p_version.author_side='buyer') and public.market_buyer_access(p_deal,p_actor)
  or (p_version.status<>'draft' or p_version.author_side='seller') and(
    p_version.seller_user_id=p_actor or public.can_manage_organization_contracts(p_version.seller_organization_id,p_actor)
    or p_version.status in('draft','offered','funded') and p_version.asset_revision=(select ownership_revision from public.teams where id=p_deal.organization_id)
      and public.can_manage_organization_contracts(p_deal.organization_id,p_actor))
  or public.is_full_admin(p_actor) and exists(select 1 from public.market_disputes s where s.deal_id=p_deal.id)),false)
$$;
create function public.market_access(p_deal uuid,p_actor uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.market_deals d join public.market_versions v on v.deal_id=d.id where d.id=p_deal and public.market_version_access(d,v,p_actor))
$$;

create function public.market_bundle(p_organization uuid,p_restore boolean default false) returns jsonb
language sql stable security definer set search_path=public as $$
 with recursive tree as(
  select id from public.teams where id=p_organization
  union all select t.id from public.teams t join tree p on t.owner_team_id=p.id
 ), organizations as(
  select t.id,t.name,t.type,t.leader_id,t.owner_user_id,t.owner_team_id,t.dissolved_at,
   case when p_restore then null else t.ownership_revision end ownership_revision,
   coalesce(a.balance,0) balance,coalesce(a.reserved,0) reserved
  from tree s join public.teams t on t.id=s.id left join public.coin_accounts a on a.team_id=t.id
 ), contracts as(
  select c.id,c.organization_id,c.player_id,p.nickname player_name,a.revision,a.signed_at,a.effective_at,public.contract_effective_end(a.contract_id,a.revision) ends_at,v.terms
  from tree t join public.organization_contracts c on c.organization_id=t.id join public.contract_agreements a on a.contract_id=c.id
  join public.organization_contract_versions v using(contract_id,revision) join public.profiles p on p.id=c.player_id
  where public.contract_effective_end(a.contract_id,a.revision) is null or public.contract_effective_end(a.contract_id,a.revision)>clock_timestamp()
 ), obligations as(
  select o.id,c.organization_id,o.contract_id,o.revision,o.kind,o.amount,o.paid,o.held,o.due_at,o.cancelled_at
  from tree t join public.organization_contracts c on c.organization_id=t.id join public.contract_obligations o on o.contract_id=c.id
  where o.cancelled_at is null and(o.paid<o.amount or o.held>0)
 ), rentals as(
  select f.id,c.organization_id,f.amount,f.paid,f.held,f.due_at from tree t join public.organization_contracts c on c.organization_id=t.id
  join public.contract_rental_fees f on f.contract_id=c.id where f.amount>f.paid or f.held>0
 ) select jsonb_build_object(
 'organizations',coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from organizations o),'[]'),
 'members',coalesce((select jsonb_agg(jsonb_build_object('organizationId',m.team_id,'userId',m.user_id,'role',m.role_in_team) order by m.team_id,m.user_id) from tree t join public.team_members m on m.team_id=t.id),'[]'),
 'contracts',coalesce((select jsonb_agg(to_jsonb(c) order by c.id,c.revision) from contracts c),'[]'),
 'obligations',coalesce((select jsonb_agg(to_jsonb(o) order by o.id) from obligations o),'[]'),
 'rentals',coalesce((select jsonb_agg(to_jsonb(r) order by r.id) from rentals r),'[]'))
$$;

create function public.market_assert_current(p_deal public.market_deals,p_version public.market_versions) returns void
language plpgsql stable security definer set search_path=public as $$
declare asset public.teams%rowtype;cycle_value boolean;begin
 select * into asset from public.teams where id=p_deal.organization_id;
 if asset.id is null or asset.dissolved_at is not null or asset.ownership_revision<>p_version.asset_revision
   or asset.owner_user_id is distinct from p_version.seller_user_id or asset.owner_team_id is distinct from p_version.seller_organization_id then raise exception 'MARKET_STALE_OWNER';end if;
 if p_deal.buyer_organization_id is not null then
   if not exists(select 1 from public.teams where id=p_deal.buyer_organization_id and dissolved_at is null and ownership_revision=p_version.buyer_revision) then raise exception 'MARKET_STALE_OWNER';end if;
   with recursive parents as(select id,owner_team_id from public.teams where id=p_deal.buyer_organization_id union all select t.id,t.owner_team_id from public.teams t join parents p on t.id=p.owner_team_id)
   select coalesce(bool_or(id=asset.id),false) into cycle_value from parents;
   if cycle_value then raise exception 'MARKET_CYCLE';end if;
 end if;
end $$;

create function public.market_notice(p_deal uuid,p_revision integer,p_action text) returns void
language plpgsql security definer set search_path=public as $$
begin
 insert into public.competition_notification_outbox(dedupe_key,user_id,title,body,link)
 select 'market:'||p_deal||':'||p_revision||':'||p_action||':'||actor,actor,'Сделка с организацией',
 'Изменилось состояние предложения. Откройте сделку для просмотра условий.','/market?dealId='||p_deal
 from(
  select d.buyer_user_id actor from public.market_deals d where d.id=p_deal
  union select t.ultimate_owner_user_id from public.market_deals d join public.teams t on t.id=d.buyer_organization_id where d.id=p_deal
  union select t.leader_id from public.market_deals d join public.teams t on t.id=d.buyer_organization_id where d.id=p_deal
  union select v.seller_user_id from public.market_versions v where v.deal_id=p_deal and v.revision=p_revision
  union select t.ultimate_owner_user_id from public.market_versions v join public.teams t on t.id=v.seller_organization_id where v.deal_id=p_deal and v.revision=p_revision
 ) recipients where actor is not null on conflict(dedupe_key) do nothing;
end $$;

create function public.market_release(p_deal uuid,p_revision integer,p_actor uuid) returns void
language plpgsql security definer set search_path=public as $$
declare escrow public.market_escrows%rowtype;operation uuid;begin
 select * into escrow from public.market_escrows where deal_id=p_deal and revision=p_revision for update;
 if escrow.held>0 then
  operation:=gen_random_uuid();insert into public.coin_operations(id,actor_id,action,input,description) values(operation,p_actor,'market_release',jsonb_build_object('dealId',p_deal,'revision',p_revision),'Освобождение резерва сделки');
  perform public.u6_coin_entry(operation,escrow.account_id,0,-escrow.held);
  update public.market_escrows set held=0 where deal_id=p_deal and revision=p_revision;
 end if;
end $$;

create function public.market_expire() returns integer language plpgsql security definer set search_path=public as $$
declare row_value record;count_value integer:=0;begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 for row_value in select v.deal_id,v.revision from public.market_versions v join public.market_deals d on d.id=v.deal_id and d.current_revision=v.revision
   where v.status in('draft','offered','funded') and v.expires_at<=clock_timestamp() order by v.expires_at,v.deal_id limit 100 for update of v
 loop
  perform public.market_release(row_value.deal_id,row_value.revision,null);
  update public.market_versions set status='expired' where deal_id=row_value.deal_id and revision=row_value.revision;
  insert into public.market_events(deal_id,revision,action) values(row_value.deal_id,row_value.revision,'expired');
  perform public.market_notice(row_value.deal_id,row_value.revision,'expired');count_value:=count_value+1;
 end loop;return count_value;
end $$;
do $$declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'market_%' loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
commit;
