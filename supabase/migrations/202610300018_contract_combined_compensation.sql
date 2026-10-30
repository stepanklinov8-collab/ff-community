-- New structured clauses can choose one of fixed amount/percentage, not add
-- them. Old signed JSON is never rewritten; the execution helper introduced
-- with termination already supports the same exact calculation.
begin;
create function public.contract_ordinary_rule(p_rule jsonb) returns void
language plpgsql set search_path=public as $$
declare keys text[];
begin
 case p_rule->>'kind'
 when 'none' then keys:=array['kind'];
 when 'fixed' then keys:=array['kind','amount'];
 when 'percent' then keys:=array['kind','basisPoints'];
 when 'combined' then keys:=array['kind','amount','basisPoints','selection'];
 else raise exception 'CONTRACT_INPUT';end case;
 perform public.contract_assert_object(p_rule,keys,keys);
 if p_rule->>'kind' in('fixed','combined') then perform public.contract_assert_uint(p_rule->'amount',1000000000000);end if;
 if p_rule->>'kind' in('percent','combined') then perform public.contract_assert_uint(p_rule->'basisPoints',10000);end if;
 if p_rule->>'kind'='combined' and coalesce(p_rule->>'selection','') not in('maximum','minimum') then raise exception 'CONTRACT_INPUT';end if;
end $$;

alter function public.contract_validate_terms(jsonb) rename to contract_validate_before_combined;
create function public.contract_validate_terms(p_terms jsonb) returns void
language plpgsql set search_path=public as $$
declare sanitized jsonb:=p_terms;key text;
begin
 if p_terms->>'schemaVersion' is distinct from '2' then
   perform public.contract_validate_before_combined(p_terms);return;
 end if;
 foreach key in array array['transfer','playerExit','organizationTermination'] loop
   perform public.contract_ordinary_rule(p_terms->key);
   if p_terms->key->>'kind'='combined' then
     sanitized:=jsonb_set(sanitized,array[key],'{"kind":"none"}');
   end if;
 end loop;
 perform public.contract_validate_before_combined(sanitized);
end $$;
revoke all on function public.contract_ordinary_rule(jsonb),public.contract_validate_before_combined(jsonb),public.contract_validate_terms(jsonb) from public,anon,authenticated,service_role;
commit;
