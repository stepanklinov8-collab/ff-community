-- New offers use host-funded rental compensation. Historical signed scopes
-- retain their recorded accounting version and their original payment history.
begin;
alter table public.contract_guest_scopes add column accounting_version integer not null default 1 check(accounting_version in(1,2)),
 add column home_terms jsonb;
create index contract_guest_scope_sessions on public.contract_guest_scopes using gin(session_ids);
create function public.contract_rental_rule(p_rule jsonb) returns void language plpgsql set search_path=public as $$
declare keys text[];begin
 case p_rule->>'kind'
 when 'none' then keys:=array['kind'];
 when 'fixed' then keys:=array['kind','amount'];
 when 'percent' then keys:=array['kind','basisPoints','basis'];
 when 'combined' then keys:=array['kind','amount','basisPoints','basis','selection'];
 else raise exception 'CONTRACT_INPUT';end case;
 perform public.contract_assert_object(p_rule,keys,keys);
 if p_rule->>'kind' in('fixed','combined') then perform public.contract_assert_uint(p_rule->'amount',1000000000000);end if;
 if p_rule->>'kind' in('percent','combined') then
   perform public.contract_assert_uint(p_rule->'basisPoints',10000);
   if coalesce(p_rule->>'basis','') not in('organization_prizes','player_payments') then raise exception 'CONTRACT_INPUT';end if;
 end if;
 if p_rule->>'kind'='combined' and coalesce(p_rule->>'selection','') not in('minimum','maximum') then raise exception 'CONTRACT_INPUT';end if;
end $$;
create function public.contract_rental_amount(p_rule jsonb,p_prizes numeric,p_player numeric) returns bigint language plpgsql set search_path=public as $$
declare value numeric;begin
 perform public.contract_rental_rule(p_rule);
 if p_prizes is null or p_player is null or p_prizes<0 or p_player<0 then raise exception 'CONTRACT_INPUT';end if;
 if p_rule->>'kind'='none' then return 0;end if;
 if p_rule->>'kind'='fixed' then return(p_rule->>'amount')::bigint;end if;
 value:=floor(case when p_rule->>'basis'='organization_prizes' then p_prizes else p_player end*(p_rule->>'basisPoints')::numeric/10000);
 if p_rule->>'kind'='combined' then value:=case when p_rule->>'selection'='maximum' then greatest(value,(p_rule->>'amount')::numeric) else least(value,(p_rule->>'amount')::numeric) end;end if;
 return value::bigint;
end $$;
create function public.contract_rental_inherit(p_rule jsonb) returns jsonb language sql immutable set search_path=public as $$
 select case when p_rule->>'kind'='percent' then p_rule||'{"basis":"player_payments"}'::jsonb else p_rule end
$$;
alter function public.contract_validate_terms(jsonb) rename to contract_validate_before_rental;
create function public.contract_validate_terms(p_terms jsonb) returns void language plpgsql set search_path=public as $$
declare item jsonb;ids uuid[]:='{}';org uuid;rows_value jsonb;
begin
 perform public.contract_validate_before_rental(jsonb_set(p_terms,'{financial}',(p_terms->'financial')-'rentalCompensations'));
 rows_value:=coalesce(p_terms->'financial'->'rentalCompensations','[]');
 if jsonb_typeof(rows_value) is distinct from 'array' or jsonb_array_length(rows_value)>2 then raise exception 'CONTRACT_INPUT';end if;
 for item in select value from jsonb_array_elements(rows_value) loop
   perform public.contract_assert_object(item,array['organizationId','compensation'],array['organizationId','compensation']);
   begin org:=(item->>'organizationId')::uuid;exception when others then raise exception 'CONTRACT_INPUT';end;
   if org is null or org=any(ids) then raise exception 'CONTRACT_INPUT';end if;ids:=array_append(ids,org);
   perform public.contract_rental_rule(item->'compensation');
 end loop;
end $$;
create or replace function public.contract_guest_capture(p_contract uuid,p_revision integer) returns void
language plpgsql security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;e public.events%rowtype;terms jsonb;first_start timestamptz;last_end timestamptz;ids uuid[];homes jsonb;home jsonb;overrides jsonb;special jsonb;fee jsonb;policy_value text;
begin
 select * into strict c from public.organization_contracts where id=p_contract;
 select * into strict e from public.events where id=c.event_id;
 select v.terms into strict terms from public.organization_contract_versions v where v.contract_id=p_contract and v.revision=p_revision;
 if e.cancelled_at is not null or e.frozen_at is not null or e.is_published is distinct from true or e.moderation_status is distinct from 'approved' or e.type not in('training','tournament') or(e.type='training' and c.session_id is null) then raise exception 'CONTRACT_GUEST_SESSION';end if;
 select array_agg(s.id order by s.start_time,s.id),min(s.start_time),max(s.end_time) into ids,first_start,last_end
 from public.event_sessions s where s.event_id=e.id and s.status<>'cancelled' and(c.session_id is null or s.id=c.session_id);
 if cardinality(ids) is null or first_start<=clock_timestamp() or last_end is null or last_end<first_start
   or(terms->>'startsAt')::timestamptz>first_start or(terms->>'endsAt')::timestamptz is distinct from last_end
   or exists(select 1 from public.event_sessions where id=any(ids) and(end_time is null or end_time<start_time)) then raise exception 'CONTRACT_GUEST_DATES';end if;
 if exists(select 1 from public.competition_publications where session_id=any(ids) and first_published_at is not null) then raise exception 'CONTRACT_GUEST_DATES';end if;
 if exists(select 1 from public.organization_contracts mc join public.contract_agreements a on a.contract_id=mc.id
   where mc.player_id=c.player_id and mc.organization_id=c.organization_id and mc.kind='main' and a.effective_at<last_end
     and(public.contract_effective_end(a.contract_id,a.revision) is null or public.contract_effective_end(a.contract_id,a.revision)>first_start)) then raise exception 'CONTRACT_ALREADY_ACTIVE';end if;
 homes:=public.contract_guest_home_terms(c.player_id,c.organization_id,first_start);
 if (select count(*) from jsonb_array_elements(homes))<>(select count(distinct value->>'organizationId') from jsonb_array_elements(homes)) then raise exception 'CONTRACT_AMBIGUOUS_VERSION';end if;
 overrides:=coalesce(terms->'financial'->'rentalCompensations','[]');
 if exists(select 1 from jsonb_array_elements(overrides) o where not exists(select 1 from jsonb_array_elements(homes) h where h->>'organizationId'=o->>'organizationId')) then raise exception 'CONTRACT_RENTAL_ORGANIZATION';end if;
 if exists(select 1 from jsonb_array_elements(homes) h where not exists(select 1 from jsonb_array_elements(overrides) o where o->>'organizationId'=h->>'organizationId')) then raise exception 'CONTRACT_RENTAL_REVIEW';end if;
 insert into public.contract_guest_scopes(contract_id,revision,event_id,session_ids,starts_at,ends_at,accounting_version,home_terms)
 values(c.id,p_revision,e.id,ids,first_start,last_end,2,homes);
 for home in select value from jsonb_array_elements(homes) loop
   fee:=public.contract_rental_inherit(home->'compensation');policy_value:=home->>'policy';
   select value->'compensation' into special from jsonb_array_elements(overrides) where value->>'organizationId'=home->>'organizationId';
   if special is not null then
     if special is distinct from fee and policy_value='allowed' then policy_value:='consent';end if;
     fee:=special;
   end if;
   perform public.contract_rental_rule(fee);
   insert into public.contract_guest_requirements(contract_id,revision,home_contract_id,home_revision,organization_id,policy,compensation)
   values(c.id,p_revision,(home->>'contractId')::uuid,(home->>'revision')::integer,(home->>'organizationId')::uuid,policy_value,fee);
   if policy_value in('consent','forbidden') then
     insert into public.notifications(user_id,type,title,body,link)
     select distinct p.id,'contract_guest','Согласование аренды игрока','Проверьте условия аренды, источник оплаты и основание процента.','/contracts'
     from(select ultimate_owner_user_id id from public.teams where id=(home->>'organizationId')::uuid union select leader_id from public.teams where id=(home->>'organizationId')::uuid) p
     where p.id is not null and public.organization_can_spend((home->>'organizationId')::uuid,p.id);
   end if;
 end loop;
end $$;
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.contract_mutate(uuid,jsonb)'::regprocedure);
 needle:='if requirements<>current_homes then';if position(needle in definition)=0 then raise exception 'RENTAL_HOME_SNAPSHOT_PATCH';end if;
 definition:=replace(definition,needle,'if (case when scope.accounting_version=2 then scope.home_terms else requirements end)<>current_homes then');
 needle:='and compensation->>''kind''=''fixed'' order by home_contract_id';if position(needle in definition)=0 then raise exception 'RENTAL_RESERVE_PATCH';end if;
 definition:=replace(definition,needle,'and (compensation->>''kind''=''fixed'' or(scope.accounting_version=2 and compensation->>''kind''=''combined'')) order by home_contract_id');
 execute definition;
 definition:=pg_get_functiondef('public.contract_guest_query(uuid,uuid)'::regprocedure);
 needle:='''captured'',scope.contract_id is not null';if position(needle in definition)=0 then raise exception 'RENTAL_QUERY_VERSION_PATCH';end if;
 definition:=replace(definition,needle,needle||',''accountingVersion'',scope.accounting_version');
 needle:='r.policy,r.compensation,';if position(needle in definition)=0 then raise exception 'RENTAL_INBOX_VERSION_PATCH';end if;
 execute replace(definition,needle,needle||'s.accounting_version as "accountingVersion",');
end $$;
create function public.contract_rental_options(p_actor uuid,p_host uuid,p_player uuid,p_event uuid,p_session uuid default null) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare start_value timestamptz;homes jsonb;result jsonb;
begin
 if not coalesce(public.can_manage_organization_contracts(p_host,p_actor),false) then raise exception 'CONTRACT_FORBIDDEN';end if;
 if not exists(select 1 from public.events where id=p_event and type in('training','tournament') and cancelled_at is null and is_published and moderation_status='approved') then raise exception 'CONTRACT_EVENT';end if;
 select min(start_time) into start_value from public.event_sessions where event_id=p_event and status<>'cancelled' and(p_session is null or id=p_session);
 if start_value is null or start_value<=clock_timestamp() then raise exception 'CONTRACT_GUEST_DATES';end if;
 homes:=public.contract_guest_home_terms(p_player,p_host,start_value);
 select coalesce(jsonb_agg(jsonb_build_object('organizationId',t.id,'name',t.name,'policy',h->'policy','compensation',public.contract_rental_inherit(h->'compensation')) order by t.name),'[]') into result
 from jsonb_array_elements(homes) h join public.teams t on t.id=(h->>'organizationId')::uuid;
 return jsonb_build_object('organizations',result,'startsAt',start_value);
end $$;
-- Acceptance is enabled only with the paired money engine installed.
alter function public.contract_mutate(uuid,jsonb) rename to contract_mutate_before_rental;
create function public.contract_mutate(p_actor uuid,p_input jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if p_input->>'action'='save' and p_input->>'kind'<>'guest' and jsonb_array_length(coalesce(p_input#>'{terms,financial,rentalCompensations}','[]'))>0 then raise exception 'CONTRACT_RENTAL_ORGANIZATION';end if;
 if p_input->>'action'='accept' and exists(select 1 from public.contract_guest_scopes where contract_id=(p_input->>'contractId')::uuid and revision=(p_input->>'revision')::integer and accounting_version=2)
   and to_regprocedure('public.contract_rental_settle(uuid,integer)') is null then raise exception 'CONTRACT_RENTAL_ENGINE';end if;
 return public.contract_mutate_before_rental(p_actor,p_input);
end $$;
do $$declare f record;begin for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and(proname like 'contract_rental_%' or proname in('contract_validate_terms','contract_validate_before_rental','contract_mutate','contract_mutate_before_rental')) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;end $$;
grant execute on function public.contract_rental_options(uuid,uuid,uuid,uuid,uuid),public.contract_mutate(uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
