begin;

-- Old requests remain valid history. Only newly created requests require the
-- new fields; names/countries are never inferred or filled retrospectively.
alter table public.coin_withdrawals
 add column full_name_latin text check(full_name_latin is null or(char_length(full_name_latin) between 3 and 160 and full_name_latin ~ '^[A-Za-z][A-Za-z .''-]*[A-Za-z]$')),
 add column transfer_country text check(transfer_country is null or(char_length(btrim(transfer_country)) between 2 and 80 and transfer_country !~ '[[:cntrl:]]'));

do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.u6_coin_action(uuid,uuid,text,jsonb)'::regprocedure);
 needle:='elsif p_action=''withdraw_request'' then';
 if position(needle in d)=0 then raise exception 'WITHDRAWAL_DETAILS_BRANCH_MISSING';end if;
 d:=replace(d,needle,needle||$validation$
   if char_length(btrim(coalesce(p_input->>'fullNameLatin',''))) not between 3 and 160
      or btrim(p_input->>'fullNameLatin') !~ '^[A-Za-z][A-Za-z .''-]*[A-Za-z]$'
      then raise exception 'Укажите ФИО получателя латинскими буквами';end if;
   if char_length(btrim(coalesce(p_input->>'transferCountry',''))) not between 2 and 80
      or p_input->>'transferCountry' ~ '[[:digit:][:cntrl:]]'
      then raise exception 'Укажите страну перевода';end if;
 $validation$);
 needle:='insert into coin_withdrawals(id,account_id,user_id,amount,note)';
 if position(needle in d)=0 then raise exception 'WITHDRAWAL_DETAILS_COLUMNS_MISSING';end if;
 d:=replace(d,needle,'insert into coin_withdrawals(id,account_id,user_id,amount,note,full_name_latin,transfer_country)');
 needle:='values(p_request,a.id,p_actor,amount,left(coalesce(p_input->>''note'',''''),2000));';
 if position(needle in d)=0 then raise exception 'WITHDRAWAL_DETAILS_VALUES_MISSING';end if;
 d:=replace(d,needle,'values(p_request,a.id,p_actor,amount,left(coalesce(p_input->>''note'',''''),2000),btrim(p_input->>''fullNameLatin''),btrim(p_input->>''transferCountry''));');
 execute d;
end $$;

create or replace function public.organization_wallet_withdrawals(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare rows_json jsonb;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'CONTRACT_AUTH';end if;
 select coalesce(jsonb_agg(to_jsonb(row_data)),'[]') into rows_json from(
  select w.id,w.account_id,w.user_id,w.amount,w.status,w.note,w.admin_note,w.created_at,w.full_name_latin,w.transfer_country,
   a.team_id as "organizationId",case when a.team_id is null then 'Личный баланс' else t.name end as "accountName",w.status='pending' as "canCancel"
  from coin_withdrawals w join coin_accounts a on a.id=w.account_id left join teams t on t.id=a.team_id
  where a.user_id=p_actor or public.organization_can_spend(a.team_id,p_actor)
  order by w.created_at desc,w.id desc limit 100
 ) row_data;
 return rows_json;
end $$;

alter table public.coin_request_deliveries add column requester_nickname text,add column requester_contact_url text;
create or replace function public.coin_request_notify() returns trigger
language plpgsql security definer set search_path=public as $$
declare kind text:=case tg_table_name when 'coin_deposits' then 'deposit' else 'withdrawal' end;
 nickname text;contact text;notice text;
begin
 if kind='deposit' then
  select left(regexp_replace(coalesce(p.nickname,''),'[[:space:][:cntrl:]]+',' ','g'),80),to_jsonb(p)->>'contact_social_url'
  into nickname,contact from profiles p where p.id=new.user_id;
  if contact is null or char_length(contact)>300 or contact !~ '^https://(t[.]me|telegram[.]me|((www|m)[.])?vk[.](com|ru)|max[.]ru|(www[.])?instagram[.]com)/[^[:space:]]+$' then contact:=null;end if;
 end if;
 insert into coin_request_deliveries(kind,request_id,channel,amount,requester_nickname,requester_contact_url)
 select kind,new.id,c,new.amount,nickname,contact from unnest(array['push','vk']) c on conflict do nothing;
 notice:=new.amount||' OMCITE Coins.';
 if kind='deposit' then notice:=notice||E'\nНик на сайте: '||coalesce(nullif(btrim(nickname),''),'Не указан')||E'\nКонтакт: '||coalesce(contact,'не указан в профиле');end if;
 insert into notifications(user_id,type,title,body,link)
 select p.id,'financial_request',case kind when 'deposit' then 'Заявка на пополнение' else 'Заявка на вывод' end,
 notice||E'\nОткройте заявку для проверки.','/admin/wallet?requestId='||new.id
 from profiles p where public.u6_coin_admin(p.id);
 return new;
end $$;

-- Preserve service-only access inherited by replaced functions.
revoke all on function public.organization_wallet_withdrawals(uuid),public.coin_request_notify() from public,anon,authenticated,service_role;
grant execute on function public.organization_wallet_withdrawals(uuid) to service_role;
commit;
