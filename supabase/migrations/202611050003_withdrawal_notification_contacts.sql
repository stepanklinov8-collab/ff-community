begin;

-- Share the same trusted profile snapshot for both kinds of finance request.
-- Do not resend previous requests or infer missing historical identities.
create or replace function public.coin_request_notify() returns trigger
language plpgsql security definer set search_path=public as $$
declare kind text:=case tg_table_name when 'coin_deposits' then 'deposit' else 'withdrawal' end;
 nickname text;contact text;notice text;
begin
 select left(regexp_replace(coalesce(p.nickname,''),'[[:space:][:cntrl:]]+',' ','g'),80),to_jsonb(p)->>'contact_social_url'
 into nickname,contact from profiles p where p.id=new.user_id;
 if contact is null or char_length(contact)>300 or contact !~ '^https://(t[.]me|telegram[.]me|((www|m)[.])?vk[.](com|ru)|max[.]ru|(www[.])?instagram[.]com)/[^[:space:]]+$' then contact:=null;end if;
 insert into coin_request_deliveries(kind,request_id,channel,amount,requester_nickname,requester_contact_url)
 select kind,new.id,c,new.amount,nickname,contact from unnest(array['push','vk']) c on conflict do nothing;
 notice:=new.amount||' OMCITE Coins.'||E'\nНик на сайте: '||coalesce(nullif(btrim(nickname),''),'Не указан')||E'\nКонтакт: '||coalesce(contact,'не указан в профиле');
 insert into notifications(user_id,type,title,body,link)
 select p.id,'financial_request',case kind when 'deposit' then 'Заявка на пополнение' else 'Заявка на вывод' end,
 notice||E'\nОткройте заявку для проверки.','/admin/wallet?requestId='||new.id
 from profiles p where public.u6_coin_admin(p.id);
 return new;
end $$;
revoke all on function public.coin_request_notify() from public,anon,authenticated,service_role;
commit;
