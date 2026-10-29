-- Constructor v2: validated proposals only. No activation or wallet writes.
begin;
alter function public.contract_validate_terms(jsonb) rename to contract_validate_terms_v1;

create function public.contract_assert_object(v jsonb, required_keys text[], allowed_keys text[]) returns void
language plpgsql set search_path=public as $$
begin
 if jsonb_typeof(v) is distinct from 'object' then raise exception 'CONTRACT_INPUT';end if;
 if not v ?& required_keys or exists(select 1 from jsonb_object_keys(v) k where not k=any(allowed_keys)) then raise exception 'CONTRACT_INPUT';end if;
end $$;
create function public.contract_assert_uint(v jsonb, upper_bound numeric) returns void
language plpgsql set search_path=public as $$
begin
 if jsonb_typeof(v) is distinct from 'number' then raise exception 'CONTRACT_INPUT';end if;
 if v::text !~ '^\d+$' or v::numeric>upper_bound then raise exception 'CONTRACT_INPUT';end if;
end $$;
create function public.contract_assert_timestamp(v jsonb) returns timestamptz
language plpgsql set search_path=public as $$
declare result timestamptz;
begin
 if jsonb_typeof(v) is distinct from 'string' or (v#>>'{}') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then raise exception 'CONTRACT_DATES';end if;
 begin result:=(v#>>'{}')::timestamptz;exception when others then raise exception 'CONTRACT_DATES';end;
 if not isfinite(result) then raise exception 'CONTRACT_DATES';end if;
 return result;
end $$;
create function public.contract_validate_overdue_compensation(v jsonb) returns void
language plpgsql set search_path=public as $$
declare keys text[];b jsonb;
begin
 if jsonb_typeof(v) is distinct from 'object' or coalesce(v->>'kind','') not in('none','fixed','percent','combined') then raise exception 'CONTRACT_INPUT';end if;
 keys:=case v->>'kind' when 'none' then array['kind'] when 'fixed' then array['kind','amount']
   when 'percent' then array['kind','basisPoints','base'] else array['kind','amount','basisPoints','base','selection'] end;
 perform public.contract_assert_object(v,keys,keys);
 if v->>'kind' in('fixed','combined') then perform public.contract_assert_uint(v->'amount',1000000000000);end if;
 if v->>'kind' in('percent','combined') then
   perform public.contract_assert_uint(v->'basisPoints',10000);
   b:=v->'base';
   if jsonb_typeof(b) is distinct from 'object' or coalesce(b->>'kind','') not in('specified','player_value','contract_debt') then raise exception 'CONTRACT_INPUT';end if;
   keys:=case b->>'kind' when 'specified' then array['kind','amount'] else array['kind'] end;
   perform public.contract_assert_object(b,keys,keys);
   if b->>'kind'='specified' then perform public.contract_assert_uint(b->'amount',1000000000000);end if;
 end if;
 if v->>'kind'='combined' and coalesce(v->>'selection','') not in('maximum','minimum') then raise exception 'CONTRACT_INPUT';end if;
end $$;

create function public.contract_validate_terms(p_terms jsonb) returns void
language plpgsql set search_path=public as $$
declare f jsonb;v jsonb;b jsonb;k text;keys text[];ids uuid[];target uuid;starts timestamptz;ends timestamptz;bs timestamptz;be timestamptz;
begin
 if jsonb_typeof(p_terms) is distinct from 'object' or p_terms->'schemaVersion' is distinct from '2'::jsonb or p_terms?'note' then raise exception 'CONTRACT_SCHEMA';end if;
 -- Legacy validation remains exact for common fields and historical structure.
 perform public.contract_validate_terms_v1((p_terms-'schemaVersion'-'financial')||jsonb_build_object('note',''));
 starts:=(p_terms->>'startsAt')::timestamptz;ends:=(p_terms->>'endsAt')::timestamptz;
 f:=p_terms->'financial';
 keys:=array['signingAmount','salary','rates','overdueCompensation','rankingBonuses','eventOverrides'];
 perform public.contract_assert_object(f,keys,keys);
 perform public.contract_assert_uint(f->'signingAmount',1000000000000);
 v:=f->'salary';
 if v<>'null'::jsonb then
   keys:=array['amount','periodDays'];perform public.contract_assert_object(v,keys,keys);
   perform public.contract_assert_uint(v->'amount',1000000000000);
   perform public.contract_assert_uint(v->'periodDays',1000000);
   if (v->>'periodDays')::numeric<1 then raise exception 'CONTRACT_INPUT';end if;
 end if;
 keys:=array['perGame','perSession','perTournament','perKill','perMvp'];
 perform public.contract_assert_object(f->'rates',keys,keys);
 foreach k in array keys loop perform public.contract_assert_uint(f->'rates'->k,1000000000000);end loop;
 perform public.contract_validate_overdue_compensation(f->'overdueCompensation');
 if jsonb_typeof(f->'rankingBonuses') is distinct from 'array' or jsonb_typeof(f->'eventOverrides') is distinct from 'array' then raise exception 'CONTRACT_INPUT';end if;
 if jsonb_array_length(f->'rankingBonuses')>20 or jsonb_array_length(f->'eventOverrides')>20 then raise exception 'CONTRACT_INPUT';end if;
 ids:=array[]::uuid[];
 for v in select value from jsonb_array_elements(f->'rankingBonuses') loop
   keys:=array['id','ranking','mode','top','startsAt','endsAt','amount'];perform public.contract_assert_object(v,keys,keys);
   begin target:=(v->>'id')::uuid;exception when others then raise exception 'CONTRACT_INPUT';end;
   if target is null or target=any(ids) then raise exception 'CONTRACT_INPUT';end if;ids:=array_append(ids,target);
   if coalesce(v->>'ranking','') not in('organizations','teams','guilds') or coalesce(v->>'mode','') not in('at_end','best','throughout') then raise exception 'CONTRACT_INPUT';end if;
   perform public.contract_assert_uint(v->'top',1000000);perform public.contract_assert_uint(v->'amount',1000000000000);
   if (v->>'top')::numeric<1 then raise exception 'CONTRACT_INPUT';end if;
   bs:=public.contract_assert_timestamp(v->'startsAt');be:=public.contract_assert_timestamp(v->'endsAt');
   if be<=bs or bs<starts or (ends is not null and be>ends) then raise exception 'CONTRACT_DATES';end if;
 end loop;
 ids:=array[]::uuid[];
 for v in select value from jsonb_array_elements(f->'eventOverrides') loop
   keys:=array['eventId','values'];perform public.contract_assert_object(v,keys,keys);
   begin target:=(v->>'eventId')::uuid;exception when others then raise exception 'CONTRACT_INPUT';end;
   if target is null or target=any(ids) then raise exception 'CONTRACT_INPUT';end if;ids:=array_append(ids,target);
   if not exists(select 1 from public.events where id=target and cancelled_at is null) then raise exception 'CONTRACT_EVENT';end if;
   b:=v->'values';keys:=array['trainingShareBps','tournamentShareBps','personalShareBps','perGame','perSession','perTournament','perKill','perMvp'];
   perform public.contract_assert_object(b,array[]::text[],keys);
   if b='{}'::jsonb then raise exception 'CONTRACT_INPUT';end if;
   for k in select jsonb_object_keys(b) loop
     perform public.contract_assert_uint(b->k,case when k in('trainingShareBps','tournamentShareBps','personalShareBps') then 10000 else 1000000000000 end);
   end loop;
 end loop;
end $$;

-- Old prose remains readable, but cannot be sent as a new executable proposal.
do $$
declare definition text;needle text;
begin
 select pg_get_functiondef('public.contract_mutate(uuid,jsonb)'::regprocedure) into definition;
 needle:='if action=''offer'' then';
 if position(needle in definition)=0 then raise exception 'CONTRACT_CONSTRUCTOR_PATCH';end if;
 definition:=replace(definition,needle,needle||' perform public.contract_validate_terms(v.terms);');
 execute definition;
end $$;
revoke all on function public.contract_validate_terms_v1(jsonb),public.contract_assert_object(jsonb,text[],text[]),
 public.contract_assert_uint(jsonb,numeric),public.contract_assert_timestamp(jsonb),public.contract_validate_overdue_compensation(jsonb),public.contract_validate_terms(jsonb)
 from public,anon,authenticated,service_role;
commit;
