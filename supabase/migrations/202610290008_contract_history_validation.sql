-- Preserve access to previously sent terms without exposing private drafts.
begin;
create or replace function public.contract_validate_terms(p_terms jsonb) returns void
language plpgsql set search_path=public as $$
declare key text; value jsonb; starts timestamptz; ends timestamptz; allowed text[];
begin
 if jsonb_typeof(p_terms) is distinct from 'object' then raise exception 'CONTRACT_INPUT';end if;
 allowed:=array['startsAt','endsAt','limit','trainingShareBps','tournamentShareBps','personalShareBps',
   'participation','transfer','transferRequiresConsent','playerExit','organizationTermination','guestPolicy','guestCompensation','note'];
 if not p_terms ?& allowed or exists(select 1 from jsonb_object_keys(p_terms) k where not k=any(allowed)) then raise exception 'CONTRACT_INPUT';end if;
 foreach key in array array['startsAt','endsAt'] loop
   value:=p_terms->key;
   if key='endsAt' and value='null'::jsonb then continue;end if;
   if jsonb_typeof(value) is distinct from 'string' or (p_terms->>key)!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then raise exception 'CONTRACT_DATES';end if;
 end loop;
 begin
   starts:=(p_terms->>'startsAt')::timestamptz;ends:=(p_terms->>'endsAt')::timestamptz;
 exception when invalid_datetime_format or datetime_field_overflow then raise exception 'CONTRACT_DATES';end;
 if starts is null or not isfinite(starts) or (ends is not null and (not isfinite(ends) or ends<=starts)) then raise exception 'CONTRACT_DATES';end if;
 foreach key in array array['trainingShareBps','tournamentShareBps','personalShareBps'] loop
   if jsonb_typeof(p_terms->key) is distinct from 'number' or (p_terms->>key)!~'^\d+$' or (p_terms->>key)::numeric not between 0 and 10000 then raise exception 'CONTRACT_SHARE';end if;
 end loop;
 value:=p_terms->'limit';
 if value<>'null'::jsonb then
   if jsonb_typeof(value) is distinct from 'object' then raise exception 'CONTRACT_LIMIT';end if;
   if not value ?& array['unit','count'] or coalesce(value->>'unit','') not in('games','trainings','tournaments')
     or jsonb_typeof(value->'count') is distinct from 'number' or (value->>'count')!~'^\d+$'
     or (value->>'count')::numeric not between 1 and 1000000
     or exists(select 1 from jsonb_object_keys(value) k where k not in('unit','count')) then raise exception 'CONTRACT_LIMIT';end if;
 end if;
 value:=p_terms->'participation';
 if jsonb_typeof(value) is distinct from 'object' then raise exception 'CONTRACT_INPUT';end if;
 if coalesce(value->>'mode','') not in('any','proportional','minimum') then raise exception 'CONTRACT_INPUT';end if;
 allowed:=case when value->>'mode'='minimum' then array['mode','games'] else array['mode'] end;
 if not value ?& allowed or exists(select 1 from jsonb_object_keys(value) k where not k=any(allowed)) then raise exception 'CONTRACT_INPUT';end if;
 if value->>'mode'='minimum' and (jsonb_typeof(value->'games') is distinct from 'number' or (value->>'games')!~'^\d+$' or (value->>'games')::numeric not between 1 and 10000) then raise exception 'CONTRACT_INPUT';end if;
 foreach key in array array['transfer','playerExit','organizationTermination','guestCompensation'] loop
   value:=p_terms->key;
   if jsonb_typeof(value) is distinct from 'object' then raise exception 'CONTRACT_INPUT';end if;
   if coalesce(value->>'kind','') not in('none','fixed','percent') then raise exception 'CONTRACT_INPUT';end if;
   allowed:=case value->>'kind' when 'fixed' then array['kind','amount'] when 'percent' then array['kind','basisPoints'] else array['kind'] end;
   if not value ?& allowed or exists(select 1 from jsonb_object_keys(value) k where not k=any(allowed)) then raise exception 'CONTRACT_INPUT';end if;
   if value->>'kind'='fixed' and (jsonb_typeof(value->'amount') is distinct from 'number' or (value->>'amount')!~'^\d+$' or (value->>'amount')::numeric not between 0 and 1000000000000) then raise exception 'CONTRACT_INPUT';end if;
   if value->>'kind'='percent' and (jsonb_typeof(value->'basisPoints') is distinct from 'number' or (value->>'basisPoints')!~'^\d+$' or (value->>'basisPoints')::numeric not between 0 and 10000) then raise exception 'CONTRACT_SHARE';end if;
 end loop;
 if jsonb_typeof(p_terms->'transferRequiresConsent') is distinct from 'boolean'
   or coalesce(p_terms->>'guestPolicy','') not in('forbidden','allowed','consent')
   or jsonb_typeof(p_terms->'note') is distinct from 'string' or length(p_terms->>'note')>4000 then raise exception 'CONTRACT_INPUT';end if;
 if p_terms->>'guestPolicy'='forbidden' and p_terms->'guestCompensation'->>'kind'<>'none' then raise exception 'CONTRACT_GUEST_FORBIDDEN';end if;
end $$;

create function public.contract_history(p_actor uuid,p_contract uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.organization_contracts%rowtype; manager boolean; result jsonb;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'CONTRACT_AUTH';end if;
 if p_offset is null or p_offset not between 0 and 1000000 then raise exception 'CONTRACT_INPUT';end if;
 select * into c from public.organization_contracts where id=p_contract;
 manager:=coalesce(public.can_manage_organization_contracts(c.organization_id,p_actor),false);
 if c.id is null or not(manager or (c.player_id=p_actor and exists(select 1 from public.organization_contract_versions where contract_id=c.id and offered_at is not null))) then raise exception 'CONTRACT_NOT_FOUND';end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from(
   select revision,status,terms,created_at as "createdAt",offered_at as "offeredAt",responded_at as "respondedAt"
   from public.organization_contract_versions where contract_id=c.id and (manager or offered_at is not null)
   order by revision desc limit 31 offset p_offset
 ) x;
 return jsonb_build_object('versions',coalesce((select jsonb_agg(value order by n) from jsonb_array_elements(result) with ordinality a(value,n) where n<=30),'[]'::jsonb),'hasMore',jsonb_array_length(result)>30);
end $$;
revoke all on function public.contract_history(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.contract_history(uuid,uuid,integer) to service_role;

-- Keep the existing query/search authorization; change only version visibility
-- and dispatch history through its independently protected function.
do $$
declare definition text; needle text; replacement text;
begin
 select pg_get_functiondef('public.contract_query(uuid,jsonb)'::regprocedure) into definition;
 needle:='if org is not null and not public.can_manage_organization_contracts(org,p_actor) then';
 if position(needle in definition)=0 then raise exception 'CONTRACT_QUERY_SCOPE_PATCH';end if;
 -- Players may filter their own contracts by organization. Directory searches
 -- remain limited to the organization's current contract managers.
 definition:=replace(definition,needle,'if p_input?''search'' and org is not null and not public.can_manage_organization_contracts(org,p_actor) then');
 needle:='if p_input?''search'' then';
 if position(needle in definition)=0 then raise exception 'CONTRACT_QUERY_HISTORY_PATCH';end if;
 definition:=replace(definition,needle,'if p_input->>''history''=''true'' then return public.contract_history(p_actor,contract_id_value,offset_value);end if; '||needle);
 needle:='join public.organization_contract_versions v on v.contract_id=c.id and v.revision=c.current_revision';
 replacement:='join lateral (select cv.* from public.organization_contract_versions cv where cv.contract_id=c.id and (public.can_manage_organization_contracts(c.organization_id,p_actor) or cv.offered_at is not null) order by cv.revision desc limit 1) v on true';
 if position(needle in definition)=0 then raise exception 'CONTRACT_QUERY_VERSION_PATCH';end if;
 definition:=replace(definition,needle,replacement);
 execute definition;
end $$;
commit;
