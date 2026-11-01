-- Durable contractual liabilities and earmarked reserves. The constructor
-- still cannot activate agreements until signing and accrual are connected.
begin;
create table public.contract_obligations(
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null references public.organization_contracts(id),
 revision integer not null,
 kind text not null check(kind in('signing','salary','appearance','kill','mvp','ranking','termination')),
 source_key text not null check(length(source_key) between 1 and 200),
 amount bigint not null check(amount between 0 and 1000000000000),
 paid bigint not null default 0 check(paid>=0),
 held bigint not null default 0 check(held>=0),
 due_at timestamptz not null check(isfinite(due_at)),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(contract_id,revision) references public.organization_contract_versions(contract_id,revision),
 unique(contract_id,kind,source_key),
 check(paid<=amount and held<=amount-paid),
 check(kind<>'signing' or source_key='initial')
);
create index contract_obligations_due on public.contract_obligations(due_at,contract_id) where paid<amount;
create table public.contract_obligation_movements(
 operation_id uuid primary key references public.coin_operations(id),
 obligation_id uuid not null references public.contract_obligations(id),
 paid_change bigint not null default 0,
 held_change bigint not null default 0,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.contract_obligations enable row level security;
alter table public.contract_obligation_movements enable row level security;
revoke all on public.contract_obligations,public.contract_obligation_movements from public,anon,authenticated,service_role;

create function public.contract_obligation_identity_guard() returns trigger
language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then raise exception 'CONTRACT_IMMUTABLE';end if;
 if new.id<>old.id or new.contract_id<>old.contract_id or new.revision<>old.revision
 or new.kind<>old.kind or new.source_key<>old.source_key or new.amount<>old.amount
 or new.due_at<>old.due_at or new.created_at<>old.created_at then raise exception 'CONTRACT_IMMUTABLE';end if;
 return new;
end $$;
create trigger contract_obligation_identity before update or delete on public.contract_obligations
 for each row execute function public.contract_obligation_identity_guard();

create function public.contract_has_debt(p_organization uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.contract_obligations o join public.organization_contracts c on c.id=o.contract_id
 where c.organization_id=p_organization and o.due_at<=now() and o.paid<o.amount)
$$;

-- Internal only: the accrual/signing transaction supplies verified facts.
-- A renewal is another revision of the SAME contract, not a new bonus source.
create function public.contract_obligation_create(p_contract uuid,p_revision integer,p_kind text,p_source text,p_amount bigint,p_due timestamptz,p_require_reserve boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;o public.contract_obligations%rowtype;a public.coin_accounts%rowtype;op uuid;result uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_amount is null or p_amount not between 0 and 1000000000000 or p_due is null or not isfinite(p_due)
 or p_require_reserve is null or p_kind is null or p_kind not in('signing','salary','appearance','kill','mvp','ranking','termination')
 or p_source is null or length(p_source) not between 1 and 200 then raise exception 'CONTRACT_INPUT';end if;
 if p_kind='signing' and p_source<>'initial' then raise exception 'CONTRACT_INPUT';end if;
 select * into c from public.organization_contracts where id=p_contract;
 if c.id is null or not exists(select 1 from public.organization_contract_versions where contract_id=c.id and revision=p_revision) then raise exception 'CONTRACT_NOT_FOUND';end if;
 select * into o from public.contract_obligations where contract_id=c.id and kind=p_kind and source_key=p_source for update;
 if found then
   if p_kind<>'signing' and (o.revision<>p_revision or o.amount<>p_amount or o.due_at<>p_due) then raise exception 'CONTRACT_OBLIGATION_CONFLICT';end if;
   -- Even changing signingAmount or dates in a renewal cannot reissue it.
   return o.id;
 end if;
 select * into a from public.coin_accounts where id=public.u6_coin_account('organization',c.organization_id) for update;
 if p_require_reserve and a.balance-a.reserved<p_amount then raise exception 'CONTRACT_FUNDS';end if;
 insert into public.contract_obligations(contract_id,revision,kind,source_key,amount,due_at)
 values(c.id,p_revision,p_kind,p_source,p_amount,p_due) returning id into result;
 -- Reserve in full only. A later-period funding shortfall remains an unfunded
 -- obligation with the ORIGINAL future due date, never an early overdue debt.
 if p_amount>0 and a.balance-a.reserved>=p_amount then
   op:=gen_random_uuid();
   insert into public.coin_operations(id,action,input,description)
   values(op,'contract_reserve',jsonb_build_object('obligationId',result),'Резерв выплаты по договору');
   perform public.u6_coin_entry(op,a.id,0,p_amount);
   update public.contract_obligations set held=p_amount where id=result;
   insert into public.contract_obligation_movements(operation_id,obligation_id,held_change) values(op,result,p_amount);
 end if;
 return result;
end $$;

create function public.contract_obligation_pay(p_actor uuid,p_request uuid,p_obligation uuid,p_amount bigint,p_automatic boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o public.contract_obligations%rowtype;c public.organization_contracts%rowtype;a public.coin_accounts%rowtype;
 old public.coin_operations%rowtype;target uuid;release bigint;payload jsonb;payment_result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_request is null or p_amount is null or p_amount<=0 or p_amount>1000000000000 or p_automatic is null then raise exception 'CONTRACT_INPUT';end if;
 select * into o from public.contract_obligations where id=p_obligation for update;
 if not found then raise exception 'CONTRACT_NOT_FOUND';end if;
 select * into strict c from public.organization_contracts where id=o.contract_id;
 -- Never trust old access on an idempotent replay.
 if not p_automatic and (p_actor is null or not coalesce(public.organization_can_spend(c.organization_id,p_actor),false)) then raise exception 'CONTRACT_FINANCE';end if;
 if p_automatic and p_actor is not null then raise exception 'CONTRACT_INPUT';end if;
 payload:=jsonb_build_object('obligationId',p_obligation,'amount',p_amount,'automatic',p_automatic);
 select * into old from public.coin_operations where id=p_request;
 if found then
   if old.actor_id is distinct from p_actor or old.action<>'contract_payment' or old.input<>payload then raise exception 'CONTRACT_CONFLICT';end if;
   return old.result;
 end if;
 if o.due_at>now() then raise exception 'CONTRACT_NOT_DUE';end if;
 if p_amount>o.amount-o.paid then raise exception 'CONTRACT_PAYMENT_AMOUNT';end if;
 if p_automatic and o.held<p_amount then raise exception 'CONTRACT_FUNDS';end if;
 select * into a from public.coin_accounts where id=public.u6_coin_account('organization',c.organization_id) for update;
 release:=least(o.held,p_amount);
 if a.reserved<o.held or a.balance-a.reserved+release<p_amount then raise exception 'CONTRACT_FUNDS';end if;
 target:=public.u6_coin_account('player',c.player_id);
 insert into public.coin_operations(id,actor_id,action,input,description)
 values(p_request,p_actor,'contract_payment',payload,'Выплата игроку по договору');
 perform public.u6_coin_entry(p_request,a.id,-p_amount,-release);
 perform public.u6_coin_entry(p_request,target,p_amount);
 update public.contract_obligations set paid=paid+p_amount,held=held-release where id=o.id;
 insert into public.contract_obligation_movements(operation_id,obligation_id,paid_change,held_change) values(p_request,o.id,p_amount,-release);
 payment_result:=jsonb_build_object('success',true,'operationId',p_request,'obligationId',o.id,'remaining',o.amount-o.paid-p_amount);
 update public.coin_operations set result=payment_result where id=p_request;
 return payment_result;
end $$;

-- A private, narrowly scoped server entry point; it cannot issue obligations,
-- reserve unrelated money, choose a different recipient or mint coins.
create function public.contract_debt_pay(p_actor uuid,p_request uuid,p_obligation uuid,p_amount bigint)
returns jsonb language sql security definer set search_path=public as $$
 select public.contract_obligation_pay(p_actor,p_request,p_obligation,p_amount,false)
$$;

create function public.contract_obligation_query(p_actor uuid,p_contract uuid,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;rows_json jsonb;manager boolean;spend boolean;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'CONTRACT_AUTH';end if;
 if p_offset is null or p_offset not between 0 and 1000000 then raise exception 'CONTRACT_INPUT';end if;
 select * into c from public.organization_contracts where id=p_contract;
 manager:=coalesce(public.can_manage_organization_contracts(c.organization_id,p_actor),false);
 if c.id is null or not(manager or(c.player_id=p_actor and exists(select 1 from public.organization_contract_versions where contract_id=c.id and offered_at is not null))) then raise exception 'CONTRACT_NOT_FOUND';end if;
 spend:=coalesce(public.organization_can_spend(c.organization_id,p_actor),false);
 select coalesce(jsonb_agg(to_jsonb(row_data)),'[]'::jsonb) into rows_json from(
   select o.id,o.revision,o.kind,o.amount,o.paid,o.held,o.due_at as "dueAt",o.amount-o.paid as remaining,
     o.due_at<=now() and o.paid<o.amount as debt,
     o.due_at+interval '7 days'<=now() and o.paid<o.amount as "overdueSevenDays"
   from public.contract_obligations o where o.contract_id=c.id order by o.due_at,o.id limit 31 offset p_offset
 )row_data;
 return jsonb_build_object('obligations',coalesce((select jsonb_agg(value order by n) from jsonb_array_elements(rows_json) with ordinality a(value,n) where n<=30),'[]'::jsonb),
   'hasMore',jsonb_array_length(rows_json)>30,'canPay',spend);
end $$;

-- Enforce the agreed withdrawal restriction inside the existing wallet RPC,
-- including completion of a previously requested external withdrawal.
do $$
declare d text;needle text;
begin
 d:=pg_get_functiondef('public.u6_coin_action(uuid,uuid,text,jsonb)'::regprocedure);
 needle:='if a.balance-a.reserved<amount then raise exception ''Недостаточно доступных монет'';end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_WITHDRAW_PATCH';end if;
 d:=replace(d,needle,'if p_action=''withdraw_request'' and a.team_id is not null and public.contract_has_debt(a.team_id) then raise exception ''CONTRACT_DEBT_WITHDRAWAL'';end if; '||needle);
 needle:='if w.status<>''pending'' then raise exception ''Заявка уже обработана'';end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_WITHDRAW_PAID_PATCH';end if;
 d:=replace(d,needle,needle||' if p_action=''withdraw_paid'' and exists(select 1 from public.coin_accounts debt_wallet where debt_wallet.id=w.account_id and debt_wallet.team_id is not null and public.contract_has_debt(debt_wallet.team_id)) then raise exception ''CONTRACT_DEBT_WITHDRAWAL'';end if;');
 execute d;
end $$;
revoke all on function public.contract_has_debt(uuid),public.contract_obligation_create(uuid,integer,text,text,bigint,timestamptz,boolean),
 public.contract_obligation_pay(uuid,uuid,uuid,bigint,boolean),public.contract_debt_pay(uuid,uuid,uuid,bigint),public.contract_obligation_query(uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.contract_debt_pay(uuid,uuid,uuid,bigint) to service_role;
grant execute on function public.contract_obligation_query(uuid,uuid,integer) to service_role;
commit;
