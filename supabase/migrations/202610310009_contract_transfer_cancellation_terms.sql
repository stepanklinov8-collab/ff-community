-- Executable, signed return clauses for each adjudicated cause of a completed
-- transfer's cancellation. This migration validates/quotes only; it does not
-- expose a reversal action or authorize a caller-selected cause/debit.
begin;
create function public.contract_transfer_cancellation_validate(p_policy jsonb) returns void
language plpgsql set search_path=public as $$
declare reasons text[]:=array['mutual','player_fault','hiring_organization_fault','previous_organization_fault','no_fault'];
 kinds text[]:=array['signing','salary','appearance','kill','mvp','ranking','prize','personalAward'];cause text;kind_value text;
begin
 perform public.contract_assert_object(p_policy,reasons,reasons);
 foreach cause in array reasons loop
   perform public.contract_assert_object(p_policy->cause,kinds,kinds);
   foreach kind_value in array kinds loop perform public.contract_ordinary_rule(p_policy->cause->kind_value);end loop;
 end loop;
end $$;

alter function public.contract_validate_terms(jsonb) rename to contract_validate_before_transfer_cancellation;
create function public.contract_validate_terms(p_terms jsonb) returns void
language plpgsql set search_path=public as $$
begin
 if p_terms->'financial'?'transferCancellation' then
   perform public.contract_transfer_cancellation_validate(p_terms->'financial'->'transferCancellation');
 end if;
 perform public.contract_validate_before_transfer_cancellation(p_terms#-'{financial,transferCancellation}');
end $$;

create function public.contract_transfer_cancellation_quote(p_policy jsonb,p_reason text,p_paid jsonb) returns jsonb
language plpgsql set search_path=public as $$
declare kinds text[]:=array['signing','salary','appearance','kill','mvp','ranking','prize','personalAward'];
 kind_value text;paid_value bigint;requested bigint;returned bigint;total_value numeric:=0;items jsonb:='[]';
begin
 perform public.contract_transfer_cancellation_validate(p_policy);
 if p_reason is null or p_reason not in('mutual','player_fault','hiring_organization_fault','previous_organization_fault','no_fault') then raise exception 'CONTRACT_INPUT';end if;
 perform public.contract_assert_object(p_paid,kinds,kinds);
 foreach kind_value in array kinds loop
   perform public.contract_assert_uint(p_paid->kind_value,9007199254740991);
   paid_value:=(p_paid->>kind_value)::bigint;
   requested:=public.contract_compensation_amount(p_policy->p_reason->kind_value,paid_value);
   returned:=least(paid_value,requested);total_value:=total_value+returned;
   items:=items||jsonb_build_array(jsonb_build_object('kind',kind_value,'paid',paid_value,'requested',requested,'amount',returned));
 end loop;
 if total_value>9007199254740991 then raise exception 'CONTRACT_COIN_RANGE';end if;
 return jsonb_build_object('reason',p_reason,'items',items,'total',total_value);
end $$;

-- An actual new transfer needs explicit agreed consequences. Ordinary legacy
-- agreements stay readable/signable and are never rewritten on migration.
do $$declare definition text;needle text;begin
 definition:=pg_get_functiondef('public.player_transfer_prepare_contract(uuid,uuid,integer)'::regprocedure);
 needle:='perform public.player_transfer_assert_quote(d,v);perform public.contract_validate_terms(v.new_terms);';
 if position(needle in definition)=0 then raise exception 'TRANSFER_CANCELLATION_PREPARE_PATCH';end if;
 execute replace(definition,needle,needle||' if not(v.new_terms->''financial''?''transferCancellation'') then raise exception ''CONTRACT_TRANSFER_CANCELLATION_REQUIRED'';end if;');
end $$;
revoke all on function public.contract_transfer_cancellation_validate(jsonb),public.contract_transfer_cancellation_quote(jsonb,text,jsonb),
 public.contract_validate_before_transfer_cancellation(jsonb),public.contract_validate_terms(jsonb) from public,anon,authenticated,service_role;
commit;
