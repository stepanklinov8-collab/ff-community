begin;
create function public.contract_validate_no_show_penalty(v jsonb) returns void
language plpgsql immutable set search_path=public as $$
declare keys text[];
begin
 if jsonb_typeof(v) is distinct from 'object' or coalesce(v->>'kind','') not in('none','fixed','percent','combined') then raise exception 'CONTRACT_INPUT';end if;
 keys:=case v->>'kind' when 'none' then array['kind'] when 'fixed' then array['kind','amount'] when 'percent' then array['kind','basisPoints'] else array['kind','amount','basisPoints','selection'] end;
 perform public.contract_assert_object(v,keys,keys);
 if v->>'kind' in('fixed','combined') then perform public.contract_assert_uint(v->'amount',1000000000000);end if;
 if v->>'kind' in('percent','combined') then perform public.contract_assert_uint(v->'basisPoints',10000);end if;
 if v->>'kind'='combined' and coalesce(v->>'selection','') not in('maximum','minimum') then raise exception 'CONTRACT_INPUT';end if;
end $$;
alter function public.contract_validate_terms(jsonb) rename to contract_validate_terms_before_no_show;
create function public.contract_validate_terms(p_terms jsonb) returns void
language plpgsql set search_path=public as $$
begin
 if (p_terms->'financial')?'noShowPenalty' then
   perform public.contract_validate_no_show_penalty(p_terms->'financial'->'noShowPenalty');
 end if;
 perform public.contract_validate_terms_before_no_show(p_terms#-'{financial,noShowPenalty}');
end $$;

create function public.contract_no_show_amount(p_rule jsonb,p_value bigint) returns bigint
language plpgsql immutable set search_path=public as $$
declare percentage bigint;
begin
 perform public.contract_validate_no_show_penalty(p_rule);
 if p_value is null or p_value not between 0 and 1000000000000 then raise exception 'CONTRACT_INPUT';end if;
 if p_rule->>'kind'='none' then return 0;end if;
 if p_rule->>'kind'='fixed' then return (p_rule->>'amount')::bigint;end if;
 percentage:=floor(p_value::numeric*(p_rule->>'basisPoints')::numeric/10000)::bigint;
 if p_rule->>'kind'='percent' then return percentage;end if;
 return case when p_rule->>'selection'='maximum' then greatest(percentage,(p_rule->>'amount')::bigint) else least(percentage,(p_rule->>'amount')::bigint) end;
end $$;

-- Internal assessment only. The eventual issuance transaction must obtain and
-- persist its own valuation and implement owner cancellation/player debt.
create function public.contract_session_no_show_assessment(p_session uuid,p_contract uuid,p_player_value bigint) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare t public.contract_session_terms%rowtype;f public.contract_session_frames%rowtype;plan jsonb;registration jsonb;registered boolean;rule jsonb;
begin
 plan:=public.contract_session_accrual_plan(p_session,p_contract);
 if plan->>'ready'<>'true' then return jsonb_build_object('ready',false,'applies',false,'amount',0,'reason',plan->'reason');end if;
 if plan->>'cancelled'='true' or coalesce((plan->>'playedGames')::integer,0)>0 then return jsonb_build_object('ready',true,'applies',false,'amount',0);end if;
 select * into strict t from public.contract_session_terms where session_id=p_session and contract_id=p_contract;
 select * into strict f from public.contract_session_frames where session_id=p_session;
 rule:=coalesce(t.terms->'financial'->'noShowPenalty','{"kind":"none"}'::jsonb);
 if rule->>'kind'='none' then return jsonb_build_object('ready',true,'applies',false,'amount',0);end if;
 select r into registration from jsonb_array_elements(f.registrations) r where r->>'organizationId'=t.organization_id::text;
 select exists(select 1 from jsonb_array_elements(coalesce(registration->'roster','[]')) r where
   (jsonb_typeof(r)='string' and r#>>'{}'=t.player_id::text) or
   (jsonb_typeof(r)='object' and (case when r?'userId' then r->>'userId' else r->>'id' end)=t.player_id::text)) into registered;
 if not registered then return jsonb_build_object('ready',true,'applies',false,'amount',0);end if;
 -- A technical failure is not proof of failing to attend. Do not turn it into
 -- an automatic no-show fine, even when the appearance count happens to be zero.
 if exists(select 1 from public.competition_publications cp cross join lateral jsonb_array_elements(cp.published->'rows') r
   where cp.session_id=p_session and r->>'registrationId'=registration->>'id' and r->>'played'='false' and r->>'reason'='technical')
 then return jsonb_build_object('ready',true,'applies',false,'amount',0,'reason','technical_absence');end if;
 return jsonb_build_object('ready',true,'applies',true,'amount',public.contract_no_show_amount(rule,p_player_value),'playerValue',p_player_value);
end $$;
revoke all on function public.contract_validate_no_show_penalty(jsonb),public.contract_validate_terms_before_no_show(jsonb),public.contract_validate_terms(jsonb),
 public.contract_no_show_amount(jsonb,bigint),public.contract_session_no_show_assessment(uuid,uuid,bigint) from public,anon,authenticated,service_role;
commit;
