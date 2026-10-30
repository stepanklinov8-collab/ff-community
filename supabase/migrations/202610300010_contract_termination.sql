-- Explicit termination preserves earned debts and membership. Leaving or
-- dissolving an organization cannot silently bypass a signed contract.
begin;
create table public.contract_mutual_terminations(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null,revision integer not null,
 ownership_revision bigint not null,player_signed_by uuid references public.profiles(id),organization_signed_by uuid references public.profiles(id),
 status text not null default 'pending' check(status in('pending','accepted','declined','stale')),
 created_at timestamptz not null default clock_timestamp(),closed_at timestamptz,
 foreign key(contract_id,revision) references public.contract_agreements(contract_id,revision)
);
create unique index contract_mutual_pending on public.contract_mutual_terminations(contract_id) where status='pending';
create table public.contract_terminations(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null,revision integer not null,
 mode text not null check(mode in('mutual','player_exit','organization','unpaid')),
 actor_id uuid not null references public.profiles(id),ended_at timestamptz not null,
 player_value bigint not null,debt_snapshot bigint not null,amount bigint not null,
 obligation_id uuid references public.contract_obligations(id),operation_id uuid references public.coin_operations(id),
 mutual_id uuid references public.contract_mutual_terminations(id),unique(contract_id,revision),
 foreign key(contract_id,revision) references public.contract_agreements(contract_id,revision)
);
alter table public.contract_mutual_terminations enable row level security;
alter table public.contract_terminations enable row level security;
revoke all on public.contract_mutual_terminations,public.contract_terminations from public,anon,authenticated,service_role;
create trigger contract_termination_immutable before update or delete on public.contract_terminations for each row execute function public.contract_frozen_guard();

create function public.contract_compensation_amount(p_rule jsonb,p_value bigint,p_debt bigint default 0) returns bigint
language plpgsql immutable set search_path=public as $$
declare basis bigint;percentage bigint;
begin
 if p_rule->>'kind'='none' then return 0;end if;
 if p_rule->>'kind'='fixed' then return (p_rule->>'amount')::bigint;end if;
 basis:=case p_rule->'base'->>'kind' when 'specified' then (p_rule->'base'->>'amount')::bigint when 'contract_debt' then p_debt else p_value end;
 percentage:=floor(basis::numeric*(p_rule->>'basisPoints')::integer/10000)::bigint;
 if p_rule->>'kind'='percent' then return percentage;end if;
 if p_rule->>'kind'='combined' and p_rule->>'selection'='maximum' then return greatest(percentage,(p_rule->>'amount')::bigint);end if;
 if p_rule->>'kind'='combined' and p_rule->>'selection'='minimum' then return least(percentage,(p_rule->>'amount')::bigint);end if;
 raise exception 'CONTRACT_INPUT';
end $$;

create function public.contract_termination_query(p_actor uuid,p_contract uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;a public.contract_agreements%rowtype;t jsonb;manager boolean;price bigint;debt bigint;late boolean;pending jsonb;
begin
 if p_actor is null then raise exception 'CONTRACT_AUTH';end if;
 select * into c from public.organization_contracts where id=p_contract;
 manager:=coalesce(public.organization_can_spend(c.organization_id,p_actor),false);
 if c.id is null or not(manager or c.player_id=p_actor) then raise exception 'CONTRACT_NOT_FOUND';end if;
 select * into a from public.contract_agreements where contract_id=p_contract
   and(public.contract_effective_end(contract_id,revision) is null or public.contract_effective_end(contract_id,revision)>clock_timestamp())
   order by (effective_at<=clock_timestamp()) desc,effective_at,revision desc limit 1;
 if a.contract_id is null then return jsonb_build_object('active',false);end if;
 select terms into t from public.organization_contract_versions where contract_id=p_contract and revision=a.revision;
 price:=round(public.u2_cost_for_target('player',c.player_id,'main'))::bigint;
 select coalesce(sum(amount-paid),0),coalesce(bool_or(due_at+interval '7 days'<=clock_timestamp()),false) into debt,late
   from public.contract_obligations where contract_id=p_contract and cancelled_at is null and due_at<=clock_timestamp() and paid<amount;
 select jsonb_build_object('id',m.id,'playerSigned',m.player_signed_by is not null,'organizationSigned',m.organization_signed_by is not null) into pending
   from public.contract_mutual_terminations m where m.contract_id=p_contract and m.revision=a.revision and m.status='pending'
     and m.ownership_revision=(select ownership_revision from public.teams where id=c.organization_id)
     and(m.organization_signed_by is null or public.organization_can_spend(c.organization_id,m.organization_signed_by));
 return jsonb_build_object('active',true,'revision',a.revision,'isPlayer',c.player_id=p_actor,'canManage',manager,'playerValue',price,'debt',debt,'overdueSevenDays',late,
   'playerExitAmount',public.contract_compensation_amount(t->'playerExit',price),
   'organizationAmount',public.contract_compensation_amount(t->'organizationTermination',price),
   'unpaidAmount',public.contract_compensation_amount(t->'financial'->'overdueCompensation',price,debt),'pending',pending);
end $$;

create function public.contract_terminate(p_actor uuid,p_request uuid,p_contract uuid,p_revision integer,p_mode text,p_expected_amount bigint,p_party text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;a public.contract_agreements%rowtype;v jsonb;quote jsonb;old public.contract_operations%rowtype;
 payload jsonb;response jsonb;proposal public.contract_mutual_terminations%rowtype;ownership bigint;ending timestamptz;
 fee_amount bigint;price bigint;debt bigint;obligation uuid;operation uuid;account public.coin_accounts%rowtype;target uuid;entry record;manager boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_actor is null then raise exception 'CONTRACT_AUTH';end if;
 if p_request is null or p_revision is null or p_revision<1 or p_mode is null or p_mode not in('mutual','decline','player_exit','organization','unpaid') then raise exception 'CONTRACT_INPUT';end if;
 select * into c from public.organization_contracts where id=p_contract for update;
 manager:=coalesce(public.organization_can_spend(c.organization_id,p_actor),false);
 if c.id is null or not(manager or c.player_id=p_actor) then raise exception 'CONTRACT_FORBIDDEN';end if;
 if p_mode='mutual' and(p_party is null or p_party not in('player','organization') or(p_party='player' and c.player_id<>p_actor) or(p_party='organization' and not manager)) then raise exception 'CONTRACT_FORBIDDEN';end if;
 payload:=jsonb_build_object('action','terminate','contractId',p_contract,'revision',p_revision,'mode',p_mode,'expectedAmount',p_expected_amount,'party',p_party);
 select * into old from public.contract_operations where id=p_request;
 if found then
   if old.actor_id<>p_actor or old.input<>payload then raise exception 'CONTRACT_CONFLICT';end if;return old.result;
 end if;
 quote:=public.contract_termination_query(p_actor,p_contract);
 if quote->>'active' is distinct from 'true' then raise exception 'CONTRACT_TERMINATED';end if;
 if (quote->>'revision')::integer<>p_revision then raise exception 'CONTRACT_CONFLICT';end if;
 select * into strict a from public.contract_agreements where contract_id=p_contract and revision=p_revision;
 select terms into v from public.organization_contract_versions where contract_id=p_contract and revision=p_revision;
 select ownership_revision into ownership from public.teams where id=c.organization_id;
 select * into proposal from public.contract_mutual_terminations where contract_id=p_contract and status='pending' for update;
 if proposal.id is not null and(proposal.revision<>p_revision or proposal.ownership_revision<>ownership or
    (proposal.organization_signed_by is not null and not public.organization_can_spend(c.organization_id,proposal.organization_signed_by))) then
   update public.contract_mutual_terminations set status='stale',closed_at=clock_timestamp() where id=proposal.id;proposal:=null;
 end if;
 if p_mode='decline' then
   if proposal.id is null then raise exception 'CONTRACT_STATE';end if;
   update public.contract_mutual_terminations set status='declined',closed_at=clock_timestamp() where id=proposal.id;
   response:=jsonb_build_object('success',true,'ended',false,'pending',false);
 elsif p_mode='mutual' then
   if proposal.id is null then
     insert into public.contract_mutual_terminations(contract_id,revision,ownership_revision) values(p_contract,p_revision,ownership) returning * into proposal;
   end if;
   -- An owner who is also the contracted player confirms each side explicitly
   -- in separate actions; one click never supplies both signatures.
   if p_party='player' then
     update public.contract_mutual_terminations set player_signed_by=p_actor where id=proposal.id returning * into proposal;
   else update public.contract_mutual_terminations set organization_signed_by=p_actor where id=proposal.id returning * into proposal;end if;
   if proposal.player_signed_by is null or proposal.organization_signed_by is null then response:=jsonb_build_object('success',true,'ended',false,'pending',true);end if;
 elsif p_mode in('player_exit','unpaid') and c.player_id<>p_actor then raise exception 'CONTRACT_FORBIDDEN';
 elsif p_mode='organization' and not manager then raise exception 'CONTRACT_FINANCE';end if;
 if response is null then
   if p_mode='unpaid' and quote->>'overdueSevenDays' is distinct from 'true' then raise exception 'CONTRACT_NOT_OVERDUE';end if;
   ending:=clock_timestamp();price:=(quote->>'playerValue')::bigint;
   -- Freeze already-started sessions before ending the agreement so earned
   -- sporting obligations survive even if their results are entered later.
   perform public.contract_freeze_due_values();
   for entry in select contract_id,revision from public.contract_agreements where contract_id=p_contract and(ended_at is null or ended_at>ending) order by revision loop
     perform public.contract_salary_schedule_close(entry.contract_id,entry.revision,ending,'Досрочное завершение договора');
     update public.contract_agreements set ended_at=ending,end_reason='termination:'||p_mode where contract_id=entry.contract_id and revision=entry.revision;
   end loop;
   perform public.contract_salary_process(p_contract);
   select coalesce(sum(o.amount-o.paid),0) into debt from public.contract_obligations o where o.contract_id=p_contract and o.cancelled_at is null and o.due_at<=ending and o.paid<o.amount;
   fee_amount:=case p_mode when 'mutual' then 0 when 'player_exit' then public.contract_compensation_amount(v->'playerExit',price)
     when 'organization' then public.contract_compensation_amount(v->'organizationTermination',price)
     else public.contract_compensation_amount(v->'financial'->'overdueCompensation',price,debt) end;
   if p_mode in('player_exit','organization') and fee_amount is distinct from p_expected_amount then raise exception 'CONTRACT_QUOTE_CHANGED';end if;
   if p_mode='player_exit' and fee_amount>0 then
     select * into strict account from public.coin_accounts where id=public.u6_coin_account('player',c.player_id) for update;
     if account.balance-account.reserved<fee_amount then raise exception 'CONTRACT_FUNDS';end if;
     operation:=gen_random_uuid();target:=public.u6_coin_account('organization',c.organization_id);
     insert into public.coin_operations(id,actor_id,action,input,description) values(operation,p_actor,'contract_exit',payload,'Компенсация организации за досрочный выход');
     perform public.u6_coin_entry(operation,account.id,-fee_amount);perform public.u6_coin_entry(operation,target,fee_amount);
   elsif fee_amount>0 then
     obligation:=public.contract_obligation_create(p_contract,p_revision,'termination','termination:'||p_revision,fee_amount,ending,
       exists(select 1 from public.coin_accounts where team_id=c.organization_id and balance-reserved>=fee_amount));
     if exists(select 1 from public.contract_obligations o where o.id=obligation and o.held=fee_amount) then perform public.contract_obligation_pay(null,gen_random_uuid(),obligation,fee_amount,true);end if;
   end if;
   if p_mode='mutual' then update public.contract_mutual_terminations set status='accepted',closed_at=ending where id=proposal.id;end if;
   insert into public.contract_terminations(contract_id,revision,mode,actor_id,ended_at,player_value,debt_snapshot,amount,obligation_id,operation_id,mutual_id)
     values(p_contract,p_revision,p_mode,p_actor,ending,price,debt,fee_amount,obligation,operation,case when p_mode='mutual' then proposal.id else null end);
   update public.organization_contract_versions set status='cancelled',responded_at=ending where contract_id=p_contract and status='offered'
     and not exists(select 1 from public.contract_agreements signed_agreement where signed_agreement.contract_id=p_contract and signed_agreement.revision=organization_contract_versions.revision);
   response:=jsonb_build_object('success',true,'ended',true,'endedAt',ending,'amount',fee_amount,'debt',debt,'obligationId',obligation);
 end if;
 insert into public.contract_operations(id,actor_id,input,result) values(p_request,p_actor,payload,response);
 return response;
end $$;

create function public.contract_has_active_membership(p_organization uuid,p_player uuid default null) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.organization_contracts c join public.contract_agreements a on a.contract_id=c.id
   where c.organization_id=p_organization and c.kind='main' and(p_player is null or c.player_id=p_player)
     and(public.contract_effective_end(a.contract_id,a.revision) is null or public.contract_effective_end(a.contract_id,a.revision)>clock_timestamp()))
$$;
create function public.contract_protect_membership() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if tg_op='DELETE' or row(new.team_id,new.user_id) is distinct from row(old.team_id,old.user_id) then
   if public.contract_has_active_membership(old.team_id,old.user_id) then raise exception 'CONTRACT_ACTIVE_MEMBERSHIP';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger contract_roster_protection before delete or update of team_id,user_id on public.team_members for each row execute function public.contract_protect_membership();
create function public.contract_protect_organization() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if (tg_op='DELETE' or(new.dissolved_at is not null and old.dissolved_at is null)) and public.contract_has_active_membership(old.id) then raise exception 'CONTRACT_ACTIVE_MEMBERSHIP';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger contract_organization_protection before delete or update of dissolved_at on public.teams for each row execute function public.contract_protect_organization();
revoke all on function public.contract_compensation_amount(jsonb,bigint,bigint),public.contract_termination_query(uuid,uuid),
 public.contract_terminate(uuid,uuid,uuid,integer,text,bigint,text),public.contract_has_active_membership(uuid,uuid),public.contract_protect_membership(),public.contract_protect_organization()
 from public,anon,authenticated,service_role;
grant execute on function public.contract_termination_query(uuid,uuid),public.contract_terminate(uuid,uuid,uuid,integer,text,bigint,text) to service_role;
commit;
