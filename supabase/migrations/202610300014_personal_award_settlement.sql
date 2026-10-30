begin;
alter table public.personal_award_funds add column closed_at timestamptz,
 add column choices jsonb not null default '{}',add column checked_at timestamptz,add column last_error text;
create index personal_award_worker_queue on public.personal_award_funds(checked_at nulls first,id) where cancelled_at is null;
create table public.personal_award_payments(
 id uuid primary key default gen_random_uuid(),fund_id uuid not null references public.personal_award_funds(id),
 kind text not null check(kind in('mvp','maxKills')),plan jsonb not null,
 amount bigint not null check(amount>0),operation_id uuid not null unique references public.coin_operations(id),
 reversed_at timestamptz,created_at timestamptz not null default clock_timestamp()
);
create unique index personal_award_active_payment on public.personal_award_payments(fund_id,kind) where reversed_at is null;
create table public.personal_award_receipts(
 payment_id uuid not null references public.personal_award_payments(id),account_id uuid not null references public.coin_accounts(id),
 amount bigint not null check(amount>0),primary key(payment_id,account_id)
);
create table public.personal_award_claims(
 id uuid primary key default gen_random_uuid(),payment_id uuid not null references public.personal_award_payments(id),
 player_id uuid not null references public.profiles(id),amount bigint not null check(amount>0),
 recovered bigint not null default 0 check(recovered>=0 and recovered<=amount),
 created_at timestamptz not null default clock_timestamp(),unique(payment_id,player_id)
);
create index personal_award_open_claims on public.personal_award_claims(player_id,created_at,id) where recovered<amount;
create table public.personal_award_recoveries(
 operation_id uuid primary key references public.coin_operations(id),claim_id uuid not null references public.personal_award_claims(id),
 amount bigint not null check(amount>0),created_at timestamptz not null default clock_timestamp()
);
alter table public.personal_award_payments enable row level security;
alter table public.personal_award_receipts enable row level security;
alter table public.personal_award_claims enable row level security;
alter table public.personal_award_recoveries enable row level security;
revoke all on public.personal_award_payments,public.personal_award_receipts,public.personal_award_claims,public.personal_award_recoveries from public,anon,authenticated,service_role;
create trigger personal_award_receipt_immutable before update or delete on public.personal_award_receipts for each row execute function public.contract_frozen_guard();
create trigger personal_award_recovery_immutable before update or delete on public.personal_award_recoveries for each row execute function public.contract_frozen_guard();
create function public.personal_award_history_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then raise exception 'CONTRACT_IMMUTABLE';end if;
 if tg_table_name='personal_award_payments' then
   if(to_jsonb(new)-'reversed_at') is distinct from(to_jsonb(old)-'reversed_at') or old.reversed_at is not null or new.reversed_at is null then raise exception 'CONTRACT_IMMUTABLE';end if;
 else
   if(to_jsonb(new)-'recovered') is distinct from(to_jsonb(old)-'recovered') or new.recovered<old.recovered then raise exception 'CONTRACT_IMMUTABLE';end if;
 end if;
 return new;
end $$;
create trigger personal_award_payment_immutable before update or delete on public.personal_award_payments for each row execute function public.personal_award_history_guard();
create trigger personal_award_claim_immutable before update or delete on public.personal_award_claims for each row execute function public.personal_award_history_guard();

-- Restored coins replenish only the unused part of this fund. If replacement
-- awards have already been funded, or the fund is closed/cancelled, late debt
-- recoveries return as free organizer coins, never reserve a second prize.
create function public.personal_award_return(p_operation uuid,p_fund uuid,p_from uuid,p_amount bigint) returns void
language plpgsql security definer set search_path=public as $$
declare f public.personal_award_funds%rowtype;active_amount bigint;restore bigint:=0;
begin
 select * into strict f from public.personal_award_funds where id=p_fund for update;
 if f.closed_at is null and f.cancelled_at is null then
   select coalesce(sum(amount),0) into active_amount from public.personal_award_payments where fund_id=f.id and reversed_at is null;
   restore:=least(p_amount,greatest(0,f.total-active_amount-f.held));
   update public.personal_award_funds set held=held+restore where id=f.id;
 end if;
 if p_from=f.account_id then
   perform public.u6_coin_entry(p_operation,p_from,0,restore);
 else
   perform public.u6_coin_entry(p_operation,p_from,-p_amount);
   perform public.u6_coin_entry(p_operation,f.account_id,p_amount,restore);
 end if;
end $$;

create function public.personal_award_recover(p_player uuid) returns bigint
language plpgsql security definer set search_path=public as $$
declare item record;a public.coin_accounts%rowtype;value bigint;op uuid;total bigint:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 for item in select c.*,p.fund_id from public.personal_award_claims c join public.personal_award_payments p on p.id=c.payment_id
   where c.player_id=p_player and c.recovered<c.amount order by c.created_at,c.id for update of c
 loop
   select * into a from public.coin_accounts where user_id=p_player for update;
   if not found or a.balance<=a.reserved then exit;end if;
   value:=least(item.amount-item.recovered,a.balance-a.reserved);op:=gen_random_uuid();
   update public.personal_award_claims set recovered=recovered+value where id=item.id;
   insert into public.coin_operations(id,action,input,description) values(op,'personal_award_recovery',jsonb_build_object('claimId',item.id),'Возврат исправленного личного приза');
   insert into public.personal_award_recoveries(operation_id,claim_id,amount) values(op,item.id,value);
   perform public.personal_award_return(op,item.fund_id,a.id,value);total:=total+value;
 end loop;
 return total;
end $$;
alter function public.contract_player_has_debt(uuid) rename to contract_player_has_debt_before_personal;
create function public.contract_player_has_debt(p_player uuid) returns boolean language sql stable security definer set search_path=public as $$
 select public.contract_player_has_debt_before_personal(p_player) or exists(select 1 from public.personal_award_claims where player_id=p_player and recovered<amount)
$$;
alter function public.contract_recover_player_claims(uuid) rename to contract_recover_before_personal;
create function public.contract_recover_player_claims(p_player uuid) returns bigint language plpgsql security definer set search_path=public as $$
declare total bigint;begin total:=public.contract_recover_before_personal(p_player);return total+public.personal_award_recover(p_player);end $$;
-- Refresh the installed trigger body too: long-lived database connections
-- must resolve the new unified recovery helpers after this migration.
create or replace function public.contract_recover_on_entry() returns trigger language plpgsql security definer set search_path=public as $$
declare player uuid;begin
 if new.amount>0 or new.reserved_change<0 then
   select user_id into player from public.coin_accounts where id=new.account_id;
   if player is not null and public.contract_player_has_debt(player) then perform public.contract_recover_player_claims(player);end if;
 end if;
 return new;
end $$;
alter function public.contract_player_debt_summary(uuid) rename to contract_debt_summary_before_personal;
create function public.contract_player_debt_summary(p_actor uuid) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;award_total bigint;begin
 result:=public.contract_debt_summary_before_personal(p_actor);
 select coalesce(sum(amount-recovered),0) into award_total from public.personal_award_claims where player_id=p_actor;
 return result||jsonb_build_object('total',(result->>'total')::numeric+award_total,'withdrawalBlocked',(result->>'withdrawalBlocked')::boolean or award_total>0)
   ||case when award_total>0 then jsonb_build_object('personalAwards',award_total) else '{}'::jsonb end;
end $$;

create function public.personal_award_reverse(p_payment uuid) returns void
language plpgsql security definer set search_path=public as $$
declare p public.personal_award_payments%rowtype;r record;op uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into p from public.personal_award_payments where id=p_payment for update;
 if not found or p.reversed_at is not null then return;end if;
 update public.personal_award_payments set reversed_at=clock_timestamp() where id=p.id;
 for r in select receipt.*,account.user_id from public.personal_award_receipts receipt join public.coin_accounts account on account.id=receipt.account_id where receipt.payment_id=p.id order by receipt.account_id loop
   if r.user_id is not null then
     insert into public.personal_award_claims(payment_id,player_id,amount) values(p.id,r.user_id,r.amount);
     perform public.contract_recover_player_claims(r.user_id);
   else
     op:=gen_random_uuid();
     insert into public.coin_operations(id,action,input,description) values(op,'personal_award_reversal',jsonb_build_object('paymentId',p.id),'Возврат доли организации из исправленного личного приза');
     perform public.personal_award_return(op,p.fund_id,r.account_id,r.amount);
   end if;
 end loop;
end $$;
create or replace function public.personal_award_cancel(p_fund uuid) returns void
language plpgsql security definer set search_path=public as $$
declare f public.personal_award_funds%rowtype;item record;op uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into f from public.personal_award_funds where id=p_fund for update;
 if not found or f.cancelled_at is not null then return;end if;
 -- Mark cancellation before returning receipts: those returns are free coins.
 update public.personal_award_funds set cancelled_at=clock_timestamp(),held=0,last_error=null where id=f.id;
 for item in select id from public.personal_award_payments where fund_id=f.id and reversed_at is null order by id loop perform public.personal_award_reverse(item.id);end loop;
 if f.held>0 then
   op:=gen_random_uuid();insert into public.coin_operations(id,action,input,description) values(op,'personal_award_release',jsonb_build_object('fundId',f.id),'Освобождение личных призов отменённого выступления');
   perform public.u6_coin_entry(op,f.account_id,0,-f.held);
 end if;
end $$;

create function public.personal_award_key(p_plan jsonb) returns jsonb language sql immutable set search_path=public as $$
 select(p_plan-'winner')||jsonb_build_object('winnerKey',p_plan#>>'{winner,key}')
$$;
create function public.personal_award_official_mvp(p_fund uuid) returns text
language plpgsql stable security definer set search_path=public as $$
declare f public.personal_award_funds%rowtype;mvps jsonb;candidates jsonb;key_value text;
begin
 select * into f from public.personal_award_funds where id=p_fund;
 if f.session_id is null then return null;end if;
 select published->'mvps' into mvps from public.competition_publications where session_id=f.session_id;
 if jsonb_typeof(mvps) is distinct from 'array' then return null;end if;
 if jsonb_array_length(mvps)<>1 then return null;end if;
 key_value:='user:'||(mvps->>0);candidates:=public.personal_award_candidates(f.event_id,f.session_id);
 if exists(select 1 from jsonb_array_elements(coalesce(candidates->'players','[]')) p where p->>'key'=key_value and p->>'mvpCandidate'='true') then return key_value;end if;
 return null;
end $$;
create function public.personal_award_current_plan(p_fund uuid,p_kind text) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare plan jsonb;choice text;begin
 select choices->>p_kind into choice from public.personal_award_funds where id=p_fund;
 if p_kind='mvp' then choice:=coalesce(public.personal_award_official_mvp(p_fund),choice);end if;
 begin plan:=public.personal_award_distribution(p_fund,p_kind,choice);
 exception when raise_exception then
   if sqlerrm<>'PERSONAL_AWARD_WINNER' then raise;end if;
   return jsonb_build_object('ready',false,'reason','stale_winner_choice');
 end;
 return plan;
end $$;
create function public.personal_award_funding_needed(p_fund uuid,p_plans jsonb default null) returns bigint
language sql stable security definer set search_path=public as $$
 with plans as(
   select k,coalesce(p_plans->k,public.personal_award_current_plan(p_fund,k)) plan from unnest(array['mvp','maxKills']) k
 ), changed as(
   select plans.*,p.id payment_id from plans left join public.personal_award_payments p on p.fund_id=p_fund and p.kind=plans.k and p.reversed_at is null
   where p.id is null or public.personal_award_key(p.plan) is distinct from public.personal_award_key(plans.plan)
 ), receipts as(
   select r.account_id,sum(r.amount) amount from changed c join public.personal_award_receipts r on r.payment_id=c.payment_id group by r.account_id
 )
 select greatest(0,coalesce((select sum((plan->>'amount')::bigint) from changed where plan->>'ready'='true'),0)
   -(select held from public.personal_award_funds where id=p_fund)
   -coalesce((select sum(case when a.user_id is null then r.amount else least(r.amount,greatest(0,a.balance-a.reserved)) end) from receipts r join public.coin_accounts a on a.id=r.account_id),0))::bigint
$$;
create function public.personal_award_settle(p_fund uuid,p_allow_funding boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare f public.personal_award_funds%rowtype;plan jsonb;kind_value text;previous public.personal_award_payments%rowtype;
 op uuid;payment uuid;amount bigint;missing bigint;wallet public.coin_accounts%rowtype;receivers jsonb;recipient record;item jsonb;pending integer:=0;error_value text;paid integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into f from public.personal_award_funds where id=p_fund for update;
 if not found then raise exception 'CONTRACT_NOT_FOUND';end if;
 if f.cancelled_at is not null then return jsonb_build_object('pending',0,'cancelled',true);end if;
 if exists(select 1 from public.events where id=f.event_id and cancelled_at is not null)
   or(f.session_id is not null and exists(select 1 from public.event_sessions where id=f.session_id and status='cancelled')) then
   perform public.personal_award_cancel(f.id);return jsonb_build_object('pending',0,'cancelled',true);
 end if;
 foreach kind_value in array array['mvp','maxKills'] loop
   plan:=public.personal_award_current_plan(f.id,kind_value);
   select * into previous from public.personal_award_payments where fund_id=f.id and kind=kind_value and reversed_at is null for update;
   if f.closed_at is not null then
     if(previous.id is not null and public.personal_award_key(previous.plan) is distinct from public.personal_award_key(plan))
       or(previous.id is null and(plan->>'amount')::bigint>0 and plan->>'ready'='true') then
       error_value:='closed_results_changed';pending:=pending+1;
     end if;
     continue;
   end if;
   if previous.id is not null and public.personal_award_key(previous.plan) is not distinct from public.personal_award_key(plan) then continue;end if;
   if previous.id is not null then perform public.personal_award_reverse(previous.id);end if;
   if plan->>'ready' is distinct from 'true' then
     -- A zero-kill event has no eligible personal award. Its unused budget can
     -- be released only by an explicit final closure, never by a draft edit.
     if plan->>'reason'<>'no_eligible_winner' then pending:=pending+1;error_value:=plan->>'reason';end if;
     continue;
   end if;
   amount:=coalesce((plan->>'amount')::bigint,0);if amount=0 then continue;end if;
   select * into strict f from public.personal_award_funds where id=p_fund;
   missing:=greatest(0,amount-f.held);
   if missing>0 then
     select * into strict wallet from public.coin_accounts where id=f.account_id for update;
     if wallet.balance-wallet.reserved<missing then pending:=pending+1;error_value:='insufficient_funds';continue;end if;
     if not p_allow_funding then pending:=pending+1;error_value:='additional_funding_required';continue;end if;
     op:=gen_random_uuid();insert into public.coin_operations(id,action,input,description) values(op,'personal_award_refund_reserve',jsonb_build_object('fundId',f.id),'Восстановление фонда исправленных личных призов');
     update public.personal_award_funds set held=held+missing where id=f.id;
     perform public.u6_coin_entry(op,f.account_id,0,missing);
   end if;
   receivers:='[]';
   if(plan->>'playerAmount')::bigint>0 then receivers:=receivers||jsonb_build_array(jsonb_build_object('accountId',public.u6_coin_account('player',(plan#>>'{winner,userId}')::uuid),'amount',(plan->>'playerAmount')::bigint));end if;
   if(plan->>'organizationAmount')::bigint>0 then receivers:=receivers||jsonb_build_array(jsonb_build_object('accountId',public.u6_coin_account('organization',(plan->>'organizationId')::uuid),'amount',(plan->>'organizationAmount')::bigint));end if;
   for item in select value from jsonb_array_elements(coalesce(plan->'homeShares','[]')) loop
     receivers:=receivers||jsonb_build_array(jsonb_build_object('accountId',public.u6_coin_account('organization',(item->>'organizationId')::uuid),'amount',(item->>'amount')::bigint));
   end loop;
   if(select coalesce(sum((value->>'amount')::bigint),0) from jsonb_array_elements(receivers))<>amount then raise exception 'PERSONAL_AWARD_CONSERVATION';end if;
   op:=gen_random_uuid();payment:=gen_random_uuid();
   insert into public.coin_operations(id,action,input,description) values(op,'personal_award_payout',jsonb_build_object('fundId',f.id,'kind',kind_value,'paymentId',payment),case when kind_value='mvp' then 'Личный приз MVP' else 'Личный приз за максимум киллов' end);
   insert into public.personal_award_payments(id,fund_id,kind,plan,amount,operation_id) values(payment,f.id,kind_value,plan,amount,op);
   insert into public.personal_award_receipts(payment_id,account_id,amount) select payment,(value->>'accountId')::uuid,sum((value->>'amount')::bigint) from jsonb_array_elements(receivers) group by value->>'accountId';
   update public.personal_award_funds set held=held-amount where id=f.id;
   -- Group debits and credits by account, including an organizer who wins
   -- their own event. coin_entries admits one entry per operation/account.
   for recipient in
     select account_id,sum(delta)::bigint delta,sum(reserve_delta)::bigint reserve_delta from(
       select f.account_id account_id,-amount delta,-amount reserve_delta
       union all select receipt.account_id,receipt.amount,0 from public.personal_award_receipts receipt where receipt.payment_id=payment
     ) movement group by account_id order by sum(delta),account_id
   loop perform public.u6_coin_entry(op,recipient.account_id,recipient.delta,recipient.reserve_delta);end loop;
   paid:=paid+1;
 end loop;
 update public.personal_award_funds set checked_at=clock_timestamp(),last_error=error_value where id=p_fund;
 return jsonb_build_object('pending',pending,'paid',paid,'reason',error_value);
end $$;

create function public.personal_award_can_manage(p_actor uuid,p_fund uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select p_actor is not null and exists(select 1 from public.personal_award_funds f join public.events e on e.id=f.event_id
   where f.id=p_fund and(public.is_full_admin(p_actor) or e.organizer_user_id=p_actor
     or(f.session_id is not null and exists(select 1 from public.event_sessions where id=f.session_id and responsible_user_id=p_actor))))
$$;
create function public.personal_award_query(p_actor uuid,p_event uuid,p_session uuid default null) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare f public.personal_award_funds%rowtype;plans jsonb;history jsonb;access boolean;funding bigint;
begin
 select fund.* into f from public.personal_award_funds fund join public.events e on e.id=fund.event_id
 where fund.event_id=p_event and((e.type='training' and fund.session_id=p_session) or(e.type='tournament' and fund.session_id is null));
 if not found then
   select public.is_full_admin(p_actor) or e.organizer_user_id=p_actor or exists(select 1 from public.event_sessions where id=p_session and event_id=e.id and responsible_user_id=p_actor) into access from public.events e where e.id=p_event;
   if access is distinct from true then raise exception 'CONTRACT_FORBIDDEN';end if;
   return jsonb_build_object('fund',null);
 end if;
 if not public.personal_award_can_manage(p_actor,f.id) then raise exception 'CONTRACT_FORBIDDEN';end if;
 plans:=jsonb_build_object('mvp',public.personal_award_current_plan(f.id,'mvp'),'maxKills',public.personal_award_current_plan(f.id,'maxKills'));
 funding:=public.personal_award_funding_needed(f.id,plans);
 select coalesce(jsonb_agg(to_jsonb(h)),'[]') into history from(
   select p.id,p.kind,p.amount,p.created_at as "createdAt",p.reversed_at as "reversedAt",p.plan#>>'{winner,nickname}' as nickname,
     p.plan->'playerAmount' as "playerAmount",p.plan->'organizationAmount' as "organizationAmount",p.plan->'homeShares' as "homeShares",
     coalesce((select sum(c.amount-c.recovered) from public.personal_award_claims c where c.payment_id=p.id),0) as "recoveryDebt"
   from public.personal_award_payments p where fund_id=f.id order by created_at desc,id desc limit 30
 ) h;
 return jsonb_build_object('fund',to_jsonb(f),'plans',plans,'candidates',public.personal_award_candidates(f.event_id,f.session_id),
   'history',history,'activeKinds',(select coalesce(jsonb_agg(kind),'[]') from public.personal_award_payments where fund_id=f.id and reversed_at is null),
   'additionalReserve',funding,
   'canFund',public.u6_coin_admin(p_actor) or exists(select 1 from public.coin_accounts where id=f.account_id and user_id=p_actor),
   'fingerprint',md5(jsonb_build_object('plans',plans,'funding',funding)::text),'canReopen',public.u6_coin_admin(p_actor));
end $$;
create function public.personal_award_action(p_actor uuid,p_request uuid,p_fund uuid,p_action text,p_expected text,p_kind text default null,p_winner text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare f public.personal_award_funds%rowtype;old public.coin_operations%rowtype;input_value jsonb;current_value jsonb;result_value jsonb;settled jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_request is null or p_action is null or p_action not in('choose','settle','close','reopen') then raise exception 'CONTRACT_INPUT';end if;
 select * into f from public.personal_award_funds where id=p_fund for update;
 if not found or not public.personal_award_can_manage(p_actor,p_fund) then raise exception 'CONTRACT_FORBIDDEN';end if;
 if p_action='reopen' and not public.u6_coin_admin(p_actor) then raise exception 'CONTRACT_FINANCE';end if;
 input_value:=jsonb_build_object('fundId',p_fund,'action',p_action,'expected',p_expected,'kind',p_kind,'winner',p_winner);
 select * into old from public.coin_operations where id=p_request;
 if found then
   if old.actor_id is distinct from p_actor or old.action<>'personal_award_action' or old.input is distinct from input_value then raise exception 'CONTRACT_CONFLICT';end if;
   return old.result;
 end if;
 if f.cancelled_at is not null then raise exception 'CONTRACT_STATE';end if;
 if f.closed_at is not null and p_action<>'reopen' then raise exception 'PERSONAL_AWARD_CLOSED';end if;
 current_value:=public.personal_award_query(p_actor,f.event_id,f.session_id);
 if p_expected is distinct from current_value->>'fingerprint' then raise exception 'CONTRACT_QUOTE_CHANGED';end if;
 insert into public.coin_operations(id,actor_id,action,input,description) values(p_request,p_actor,'personal_award_action',input_value,'Управление личными денежными наградами');
 if p_action='choose' then
   if p_kind is null or p_kind not in('mvp','maxKills') or p_winner is null then raise exception 'CONTRACT_INPUT';end if;
   if p_kind='mvp' and public.personal_award_official_mvp(f.id) is not null and public.personal_award_official_mvp(f.id) is distinct from p_winner then raise exception 'PERSONAL_AWARD_WINNER';end if;
   result_value:=public.personal_award_distribution(f.id,p_kind,p_winner);
   if result_value->>'ready' is distinct from 'true' then raise exception 'PERSONAL_AWARD_PENDING';end if;
   update public.personal_award_funds set choices=jsonb_set(choices,array[p_kind],to_jsonb(p_winner)) where id=f.id;
 elsif p_action='reopen' then
   if f.closed_at is null then raise exception 'CONTRACT_STATE';end if;
   update public.personal_award_funds set closed_at=null where id=f.id;
 end if;
 settled:=public.personal_award_settle(f.id,p_action in('settle','reopen') and (public.u6_coin_admin(p_actor) or exists(select 1 from public.coin_accounts where id=f.account_id and user_id=p_actor)));
 if p_action='reopen' and settled->>'reason'='insufficient_funds' then raise exception 'CONTRACT_FUNDS';end if;
 if p_action='close' then
   if(settled->>'pending')::integer>0 then raise exception 'PERSONAL_AWARD_PENDING';end if;
   select * into strict f from public.personal_award_funds where id=p_fund;
   update public.personal_award_funds set held=0,closed_at=clock_timestamp() where id=f.id;
   if f.held>0 then perform public.u6_coin_entry(p_request,f.account_id,0,-f.held);end if;
 end if;
 result_value:=jsonb_build_object('success',true,'settlement',settled);
 update public.coin_operations set result=result_value where id=p_request;
 return result_value;
end $$;

alter function public.contract_session_publish_settle(uuid) rename to contract_publish_before_personal_awards;
create function public.contract_session_publish_settle(p_session uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;item record;begin
 result:=public.contract_publish_before_personal_awards(p_session);
 for item in select f.id from public.personal_award_funds f join public.event_sessions s on s.event_id=f.event_id where s.id=p_session and(f.session_id=s.id or f.session_id is null) loop
   perform public.personal_award_settle(item.id);
 end loop;
 return result;
end $$;
alter function public.contract_maintenance_run() rename to contract_maintenance_before_personal_awards;
create function public.contract_maintenance_run() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;job record;processed integer:=0;begin
 result:=public.contract_maintenance_before_personal_awards();
 for job in select id from public.personal_award_funds where cancelled_at is null order by checked_at nulls first,id limit 100 for update loop
   perform public.personal_award_settle(job.id);processed:=processed+1;
 end loop;
 return result||jsonb_build_object('personalAwardFunds',processed);
end $$;
do $$declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and(proname like 'personal_award_%' or proname in(
   'contract_player_has_debt_before_personal','contract_recover_before_personal','contract_debt_summary_before_personal',
   'contract_player_has_debt','contract_recover_player_claims','contract_player_debt_summary','contract_publish_before_personal_awards',
   'contract_session_publish_settle','contract_maintenance_before_personal_awards','contract_maintenance_run')) loop
   execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
grant execute on function public.personal_award_query(uuid,uuid,uuid),public.personal_award_action(uuid,uuid,uuid,text,text,text,text),public.contract_player_debt_summary(uuid),public.contract_maintenance_run() to service_role;
notify pgrst,'reload schema';
commit;
