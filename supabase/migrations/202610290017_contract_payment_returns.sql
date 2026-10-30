-- Owner cancellation preserves original liabilities and payment history.
-- Only unreserved player coins are returned; the rest is a separate claim.
begin;
alter table public.contract_obligations add column cancelled_at timestamptz,
 add column cancelled_by uuid references public.profiles(id),add column cancellation_reason text;
create table public.contract_player_claims(
 id uuid primary key default gen_random_uuid(),
 obligation_id uuid not null unique references public.contract_obligations(id),
 player_id uuid not null references public.profiles(id),
 organization_id uuid not null references public.teams(id),
 amount bigint not null check(amount>0 and amount<=1000000000000),
 recovered bigint not null default 0 check(recovered>=0 and recovered<=amount),
 created_at timestamptz not null default clock_timestamp()
);
create index contract_player_claims_open on public.contract_player_claims(player_id,created_at,id) where recovered<amount;
create table public.contract_player_recoveries(
 operation_id uuid primary key references public.coin_operations(id),
 claim_id uuid not null references public.contract_player_claims(id),amount bigint not null check(amount>0),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.contract_player_claims enable row level security;
alter table public.contract_player_recoveries enable row level security;
revoke all on public.contract_player_claims,public.contract_player_recoveries from public,anon,authenticated,service_role;

create function public.contract_player_has_debt(p_player uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.contract_player_claims where player_id=p_player and recovered<amount)
$$;

create function public.contract_recover_player_claims(p_player uuid) returns bigint
language plpgsql security definer set search_path=public as $$
declare a public.coin_accounts%rowtype;c public.contract_player_claims%rowtype;value bigint;op uuid;total bigint:=0;target uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into a from public.coin_accounts where user_id=p_player for update;
 if not found or a.balance<=a.reserved then return 0;end if;
 for c in select * from public.contract_player_claims where player_id=p_player and recovered<amount order by created_at,id for update loop
   value:=least(c.amount-c.recovered,a.balance-a.reserved);
   if value<=0 then exit;end if;
   target:=public.u6_coin_account('organization',c.organization_id);op:=gen_random_uuid();
   insert into public.coin_operations(id,action,input,description) values(op,'contract_return',jsonb_build_object('claimId',c.id),'Возврат отменённой выплаты организации');
   -- Mark recovery inside the same transaction before the ledger callback.
   update public.contract_player_claims set recovered=recovered+value where id=c.id;
   insert into public.contract_player_recoveries(operation_id,claim_id,amount) values(op,c.id,value);
   perform public.u6_coin_entry(op,a.id,-value,0);
   perform public.u6_coin_entry(op,target,value,0);
   a.balance:=a.balance-value;total:=total+value;
 end loop;
 return total;
end $$;

create function public.contract_recover_on_entry() returns trigger
language plpgsql security definer set search_path=public as $$
declare player uuid;
begin
 if new.amount>0 or new.reserved_change<0 then
   select user_id into player from public.coin_accounts where id=new.account_id;
   if player is not null and public.contract_player_has_debt(player) then perform public.contract_recover_player_claims(player);end if;
 end if;
 return new;
end $$;
create trigger contract_recover_player_income after insert on public.coin_entries for each row execute function public.contract_recover_on_entry();

create function public.contract_obligation_cancel(p_actor uuid,p_request uuid,p_obligation uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o public.contract_obligations%rowtype;c public.organization_contracts%rowtype;old public.coin_operations%rowtype;
 payload jsonb;result_value jsonb;claim uuid;returned bigint:=0;account_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_request is null or p_reason is null or length(trim(p_reason)) not between 3 and 1000 then raise exception 'CONTRACT_INPUT';end if;
 select * into o from public.contract_obligations where id=p_obligation for update;
 if not found then raise exception 'CONTRACT_NOT_FOUND';end if;
 select * into strict c from public.organization_contracts where id=o.contract_id;
 if not coalesce(public.is_organization_owner(c.organization_id,p_actor),false) then raise exception 'CONTRACT_OWNER';end if;
 payload:=jsonb_build_object('obligationId',p_obligation,'reason',trim(p_reason));
 select * into old from public.coin_operations where id=p_request;
 if found then
   if old.actor_id is distinct from p_actor or old.action<>'contract_cancel' or old.input<>payload then raise exception 'CONTRACT_CONFLICT';end if;
   return old.result;
 end if;
 if o.cancelled_at is not null then raise exception 'CONTRACT_CANCELLED';end if;
 insert into public.coin_operations(id,actor_id,action,input,description) values(p_request,p_actor,'contract_cancel',payload,'Отмена начисления: '||trim(p_reason));
 account_id:=public.u6_coin_account('organization',c.organization_id);
 if o.held>0 then perform public.u6_coin_entry(p_request,account_id,0,-o.held);end if;
 insert into public.contract_obligation_movements(operation_id,obligation_id,held_change) values(p_request,o.id,-o.held);
 update public.contract_obligations set cancelled_at=clock_timestamp(),cancelled_by=p_actor,cancellation_reason=trim(p_reason),held=0 where id=o.id;
 if o.paid>0 then
   insert into public.contract_player_claims(obligation_id,player_id,organization_id,amount)
   values(o.id,c.player_id,c.organization_id,o.paid) returning id into claim;
   perform public.contract_recover_player_claims(c.player_id);
   select recovered into returned from public.contract_player_claims where id=claim;
 end if;
 result_value:=jsonb_build_object('success',true,'operationId',p_request,'obligationId',o.id,'returned',returned,'recoveryDebt',o.paid-returned);
 update public.coin_operations set result=result_value where id=p_request;
 return result_value;
end $$;

-- Do not let a stale payment request revive an owner-cancelled liability.
do $$ declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_obligation_pay(uuid,uuid,uuid,bigint,boolean)'::regprocedure);
 needle:='if o.due_at>clock_timestamp() then';
 if position(needle in d)=0 then raise exception 'CONTRACT_CANCEL_PAY_PATCH';end if;
 execute replace(d,needle,'if o.cancelled_at is not null then raise exception ''CONTRACT_CANCELLED'';end if; '||needle);
 d:=pg_get_functiondef('public.contract_has_debt(uuid)'::regprocedure);
 needle:='o.paid<o.amount';
 if position(needle in d)=0 then raise exception 'CONTRACT_CANCEL_DEBT_PATCH';end if;
 execute replace(d,needle,needle||' and o.cancelled_at is null');
 d:=pg_get_functiondef('public.contract_obligation_identity_guard()'::regprocedure);
 needle:='return new;';
 execute replace(d,needle,'if old.cancelled_at is not null and (new.cancelled_at is distinct from old.cancelled_at or new.cancelled_by is distinct from old.cancelled_by or new.cancellation_reason is distinct from old.cancellation_reason or new.paid<>old.paid or new.held<>old.held) then raise exception ''CONTRACT_IMMUTABLE'';end if; '||needle);
 d:=pg_get_functiondef('public.u6_coin_action(uuid,uuid,text,jsonb)'::regprocedure);
 needle:='if a.balance-a.reserved<amount then raise exception ''Недостаточно доступных монет'';end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_PLAYER_WITHDRAW_PATCH';end if;
 d:=replace(d,needle,'if p_action=''withdraw_request'' and a.user_id is not null and public.contract_player_has_debt(a.user_id) then raise exception ''CONTRACT_PLAYER_DEBT_WITHDRAWAL'';end if; '||needle);
 needle:='if w.status<>''pending'' then raise exception ''Заявка уже обработана'';end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_PLAYER_WITHDRAW_PAID_PATCH';end if;
 d:=replace(d,needle,needle||' if p_action=''withdraw_paid'' and exists(select 1 from public.coin_accounts player_wallet where player_wallet.id=w.account_id and public.contract_player_has_debt(player_wallet.user_id)) then raise exception ''CONTRACT_PLAYER_DEBT_WITHDRAWAL'';end if;');
 execute d;
end $$;

create or replace function public.contract_obligation_query(p_actor uuid,p_contract uuid,p_offset integer default 0)
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
   select o.id,o.revision,o.kind,o.amount,o.paid,o.held,o.due_at as "dueAt",
     case when o.cancelled_at is null then o.amount-o.paid else 0 end as remaining,
     o.cancelled_at is null and o.due_at<=now() and o.paid<o.amount as debt,
     o.cancelled_at is null and o.due_at+interval '7 days'<=now() and o.paid<o.amount as "overdueSevenDays",
     o.cancelled_at as "cancelledAt",o.cancellation_reason as "cancellationReason",
     coalesce(r.recovered,0) as returned,coalesce(r.amount-r.recovered,0) as "recoveryDebt"
   from public.contract_obligations o left join public.contract_player_claims r on r.obligation_id=o.id
   where o.contract_id=c.id order by o.due_at,o.id limit 31 offset p_offset
 )row_data;
 return jsonb_build_object('obligations',coalesce((select jsonb_agg(value order by n) from jsonb_array_elements(rows_json) with ordinality a(value,n) where n<=30),'[]'::jsonb),
   'hasMore',jsonb_array_length(rows_json)>30,'canPay',spend,'canCancel',coalesce(public.is_organization_owner(c.organization_id,p_actor),false));
end $$;
revoke all on function public.contract_player_has_debt(uuid),public.contract_recover_player_claims(uuid),public.contract_recover_on_entry(),
 public.contract_obligation_cancel(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.contract_obligation_cancel(uuid,uuid,uuid,text) to service_role;

create function public.contract_player_debt_summary(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare total numeric;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'CONTRACT_AUTH';end if;
 select coalesce(sum(amount-recovered),0) into total from public.contract_player_claims where player_id=p_actor;
 return jsonb_build_object('total',total,'withdrawalBlocked',total>0);
end $$;
revoke all on function public.contract_player_debt_summary(uuid) from public,anon,authenticated,service_role;
grant execute on function public.contract_player_debt_summary(uuid) to service_role;
commit;
