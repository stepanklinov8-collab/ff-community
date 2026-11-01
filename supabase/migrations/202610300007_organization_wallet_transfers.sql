-- Source and recipient organizations have their own account identities.
-- Ownership only authorizes access; it never aliases money to a personal
-- balance or provides fallback funding for contractual obligations.
begin;
create or replace function public.organization_can_spend(p_team_id uuid,p_actor uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select p_actor is not null and exists(select 1 from public.teams t where t.id=p_team_id and t.dissolved_at is null
   and(t.ultimate_owner_user_id=p_actor or t.leader_id=p_actor or(t.leader_id is null and exists(
     select 1 from public.team_members m where m.team_id=t.id and m.user_id=p_actor and m.role_in_team='leader'))))
$$;
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.u6_coin_action(uuid,uuid,text,jsonb)'::regprocedure);
 needle:='select * into old from coin_operations where id=p_request;';
 if position(needle in d)=0 then raise exception 'ORGANIZATION_WALLET_AUTH_PATCH';end if;
 d:=replace(d,needle,$auth$
 if p_action in('transfer','withdraw_request') and p_input->>'teamId' is not null
   and not public.organization_can_spend((p_input->>'teamId')::uuid,p_actor) then raise exception 'Распоряжаться балансом организации может её владелец или руководитель';end if;
 if p_action='transfer' then
   if (p_input->>'userId' is null)=(p_input->>'recipientTeamId' is null) then raise exception 'Выберите одного получателя: игрока или организацию';end if;
   if p_input->>'recipientTeamId' is not null and not exists(select 1 from public.teams where id=(p_input->>'recipientTeamId')::uuid and dissolved_at is null)
     then raise exception 'Организация получателя не найдена или распущена';end if;
 end if;
 if p_action='withdraw_cancel' and not exists(select 1 from public.coin_withdrawals withdrawal join public.coin_accounts account on account.id=withdrawal.account_id
   where withdrawal.id=(p_input->>'withdrawalId')::uuid and(account.user_id=p_actor or public.organization_can_spend(account.team_id,p_actor)))
   then raise exception 'Нет прав на эту заявку';end if;
 $auth$||needle);
 needle:='b:=public.u6_coin_account(''player'',(p_input->>''userId'')::uuid);';
 if position(needle in d)=0 then raise exception 'ORGANIZATION_WALLET_RECIPIENT_PATCH';end if;
 d:=replace(d,needle,$recipient$
 if p_input->>'recipientTeamId' is not null then b:=public.u6_coin_account('organization',(p_input->>'recipientTeamId')::uuid);
 else b:=public.u6_coin_account('player',(p_input->>'userId')::uuid);end if;
 if b=a.id then raise exception 'Нельзя переводить монеты на тот же счёт';end if;
 $recipient$);
 d:=replace(d,'reason:=''Перевод игроку'';','reason:=case when p_input->>''recipientTeamId'' is not null then ''Перевод организации'' else ''Перевод игроку'' end;');
 needle:='if p_action=''withdraw_cancel'' and w.user_id<>p_actor then raise exception ''Нет прав'';end if;';
 if position(needle in d)=0 then raise exception 'ORGANIZATION_WALLET_WITHDRAW_CANCEL_PATCH';end if;
 d:=replace(d,needle,''); -- The account-based current ACL above replaces the requester's identity.
 execute d;
end $$;

create function public.organization_wallet_withdrawals(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare rows_json jsonb;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'CONTRACT_AUTH';end if;
 select coalesce(jsonb_agg(to_jsonb(row_data)),'[]') into rows_json from(
   select w.id,w.account_id,w.user_id,w.amount,w.status,w.note,w.admin_note,w.created_at,
     a.team_id as "organizationId",case when a.team_id is null then 'Личный баланс' else t.name end as "accountName",
     w.status='pending' as "canCancel"
   from public.coin_withdrawals w join public.coin_accounts a on a.id=w.account_id left join public.teams t on t.id=a.team_id
   where a.user_id=p_actor or public.organization_can_spend(a.team_id,p_actor)
   order by w.created_at desc,w.id desc limit 100
 ) row_data;
 return rows_json;
end $$;
revoke all on function public.organization_wallet_withdrawals(uuid) from public,anon,authenticated,service_role;
grant execute on function public.organization_wallet_withdrawals(uuid) to service_role;
commit;
