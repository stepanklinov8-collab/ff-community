begin;

create table public.coin_funding_actions(
 id uuid primary key, actor_id uuid not null references profiles(id), action text not null,
 input jsonb not null, result jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.coin_deposits(
 id uuid primary key references coin_funding_actions(id), account_id uuid not null references coin_accounts(id),
 user_id uuid not null references profiles(id), amount bigint not null check(amount between 1 and 1000000000000),
 status text not null default 'pending' check(status in('pending','credited','rejected','cancelled')),
 admin_note text not null default '', resolved_by uuid references profiles(id),
 created_at timestamptz not null default now(), resolved_at timestamptz
);
create index coin_deposits_pending on coin_deposits(created_at,id) where status='pending';
create table public.coin_request_deliveries(
 id integer generated always as identity primary key,
 kind text not null check(kind in('deposit','withdrawal')), request_id uuid not null,
 channel text not null check(channel in('push','vk')), amount bigint not null,
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(),
 lease_id uuid, lease_until timestamptz, delivered_at timestamptz, last_error text,
 created_at timestamptz not null default now(), unique(kind,request_id,channel)
);
create index coin_request_delivery_pending on coin_request_deliveries(next_attempt_at,id) where delivered_at is null;

create function public.coin_request_notify() returns trigger
language plpgsql security definer set search_path=public as $$
declare kind text:=case tg_table_name when 'coin_deposits' then 'deposit' else 'withdrawal' end;
begin
 insert into coin_request_deliveries(kind,request_id,channel,amount)
 select kind,new.id,c,new.amount from unnest(array['push','vk']) c on conflict do nothing;
 insert into notifications(user_id,type,title,body,link)
 select p.id,'financial_request',case kind when 'deposit' then 'Заявка на пополнение' else 'Заявка на вывод' end,
 new.amount||' OMCITE Coins. Откройте заявку для проверки.','/admin/wallet?requestId='||new.id
 from profiles p where public.u6_coin_admin(p.id);
 return new;
end $$;
create trigger coin_deposit_notify after insert on coin_deposits for each row execute function coin_request_notify();
create trigger coin_withdrawal_notify after insert on coin_withdrawals for each row execute function coin_request_notify();

create function public.coin_deposit_action(p_actor uuid,p_request uuid,p_action text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare old coin_funding_actions%rowtype; d coin_deposits%rowtype; a coin_accounts%rowtype;
 v_account uuid; v_amount bigint; v_result jsonb; v_reason text:=left(btrim(coalesce(p_input->>'reason','')),1000);
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_actor is null or not exists(select 1 from profiles where id=p_actor) then raise exception 'Необходима авторизация';end if;
 if p_action not in('deposit_request','deposit_cancel','deposit_credit','deposit_reject') then raise exception 'Проверьте действие';end if;
 if p_action in('deposit_credit','deposit_reject') and not public.u6_coin_admin(p_actor) then raise exception 'Нет прав на управление балансами';end if;
 select * into old from coin_funding_actions where id=p_request;
 if found then
  if old.actor_id<>p_actor or old.action<>p_action or old.input<>p_input then raise exception 'Конфликт ключа операции';end if;
  return old.result;
 end if;
 if p_action='deposit_request' then
  v_amount:=(p_input->>'amount')::bigint;
  if v_amount is null or v_amount<1 or v_amount>1000000000000 then raise exception 'Проверьте сумму';end if;
  if p_input->>'teamId' is not null then
   if not public.organization_can_spend((p_input->>'teamId')::uuid,p_actor) then raise exception 'Нет прав на счёт организации';end if;
   v_account:=public.u6_coin_account('organization',(p_input->>'teamId')::uuid);
  else v_account:=public.u6_coin_account('player',p_actor);end if;
  -- Bound unprocessed requests; retries with the same key remain idempotent.
  if (select count(*) from coin_deposits where user_id=p_actor and status='pending')>=5 then raise exception 'Сначала дождитесь обработки или отмените прежние заявки';end if;
 end if;
 insert into coin_funding_actions(id,actor_id,action,input) values(p_request,p_actor,p_action,p_input);
 if p_action='deposit_request' then
  insert into coin_deposits(id,account_id,user_id,amount) values(p_request,v_account,p_actor,v_amount);
 else
  select * into d from coin_deposits where id=(p_input->>'depositId')::uuid for update;
  if not found then raise exception 'Заявка не найдена';end if;
  select * into strict a from coin_accounts where id=d.account_id;
  if p_action='deposit_cancel' and not(coalesce(a.user_id=p_actor,false) or coalesce(public.organization_can_spend(a.team_id,p_actor),false)) then raise exception 'Нет прав на эту заявку';end if;
  if d.status<>'pending' then raise exception 'Заявка уже обработана';end if;
  if p_action in('deposit_credit','deposit_reject') and char_length(v_reason)<3 then raise exception 'Укажите подтверждение оплаты или причину отказа';end if;
  if p_action='deposit_credit' then
   -- Reuse the established money/debt ledger. The amount and account come only
   -- from the locked request, never from the administrator's submitted amount.
   perform public.u6_coin_action(p_actor,p_request,'adjust',jsonb_build_object(
    'kind',case when a.team_id is null then 'player' else 'organization' end,
    'ownerId',coalesce(a.user_id,a.team_id),'amount',d.amount,
    'reason','Пополнение по заявке '||d.id||': '||v_reason));
  end if;
  update coin_deposits set status=case p_action when 'deposit_credit' then 'credited' when 'deposit_reject' then 'rejected' else 'cancelled' end,
   admin_note=case when p_action='deposit_cancel' then '' else v_reason end,resolved_by=p_actor,resolved_at=now() where id=d.id;
  if p_action in('deposit_credit','deposit_reject') then
   insert into notifications(user_id,type,title,body,link) values(d.user_id,'financial_request',
    case p_action when 'deposit_credit' then 'Пополнение подтверждено' else 'Пополнение отклонено' end,
    d.amount||' OMCITE Coins. '||v_reason,'/wallet');
  end if;
 end if;
 v_result:=jsonb_build_object('success',true,'operationId',p_request);
 update coin_funding_actions set result=v_result where id=p_request;
 return v_result;
end $$;

create function public.coin_deposits_list(p_actor uuid,p_admin boolean default false) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 if p_actor is null or not exists(select 1 from profiles where id=p_actor) then raise exception 'Необходима авторизация';end if;
 if p_admin and not public.u6_coin_admin(p_actor) then raise exception 'Нет прав на управление балансами';end if;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into result from(
  select d.*,a.team_id as "organizationId",coalesce(t.name,'Личный баланс') as "accountName"
  from coin_deposits d join coin_accounts a on a.id=d.account_id left join teams t on t.id=a.team_id
  where (p_admin and d.status='pending') or (not p_admin and(a.user_id=p_actor or public.organization_can_spend(a.team_id,p_actor)))
  order by d.created_at desc,d.id desc limit 100
 ) r;
 return result;
end $$;

create function public.coin_notifications_claim(p_channels text[],p_lease uuid) returns setof coin_request_deliveries
language sql security definer set search_path=public as $$
 update coin_request_deliveries set lease_id=p_lease,lease_until=now()+interval '2 minutes',attempts=attempts+1
 where id in(select id from coin_request_deliveries where delivered_at is null and channel=any(p_channels)
 and next_attempt_at<=now() and(lease_until is null or lease_until<now()) order by id for update skip locked limit 4)
 returning *
$$;
create function public.coin_notifications_finish(p_id integer,p_lease uuid,p_error text default null) returns void
language sql security definer set search_path=public as $$
 update coin_request_deliveries set delivered_at=case when p_error is null then now() end,
 last_error=left(p_error,80),lease_until=null,lease_id=null,
 next_attempt_at=now()+make_interval(secs=>least(3600,60*power(2,least(attempts,6)))::integer)
 where id=p_id and lease_id=p_lease and delivered_at is null
$$;

create function public.coin_finance_recipients() returns setof uuid
language sql stable security definer set search_path=public as $$
 select id from profiles where public.u6_coin_admin(id)
$$;

alter table coin_funding_actions enable row level security;
alter table coin_deposits enable row level security;
alter table coin_request_deliveries enable row level security;
revoke all on coin_funding_actions,coin_deposits,coin_request_deliveries from public,anon,authenticated;
grant all on coin_funding_actions,coin_deposits,coin_request_deliveries to service_role;
grant usage,select on sequence coin_request_deliveries_id_seq to service_role;
revoke all on function coin_request_notify(),coin_deposit_action(uuid,uuid,text,jsonb),coin_deposits_list(uuid,boolean),coin_notifications_claim(text[],uuid),coin_notifications_finish(integer,uuid,text) from public,anon,authenticated,service_role;
revoke all on function coin_finance_recipients() from public,anon,authenticated,service_role;
grant execute on function coin_finance_recipients() to service_role;
grant execute on function coin_deposit_action(uuid,uuid,text,jsonb),coin_deposits_list(uuid,boolean),coin_notifications_claim(text[],uuid),coin_notifications_finish(integer,uuid,text) to service_role;
commit;
