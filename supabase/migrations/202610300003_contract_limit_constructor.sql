-- Explicit limit completion policy and frozen session end time. Monetary
-- execution remains guarded until salary/expiry reconciliation is connected.
begin;
alter table public.contract_session_frames add column ends_at timestamptz check(ends_at is null or isfinite(ends_at));
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_session_freeze_at(uuid,timestamptz)'::regprocedure);
 needle:='insert into public.contract_session_frames(session_id,event_id,event_type,cutoff_at,games,registrations)';
 if position(needle in d)=0 then raise exception 'CONTRACT_END_SNAPSHOT_COLUMNS_PATCH';end if;
 d:=replace(d,needle,'insert into public.contract_session_frames(session_id,event_id,event_type,cutoff_at,games,registrations,ends_at)');
 needle:='values(s.id,e.id,e.type,cutoff,game_rows,registration_rows);';
 if position(needle in d)=0 then raise exception 'CONTRACT_END_SNAPSHOT_VALUE_PATCH';end if;
 execute replace(d,needle,'values(s.id,e.id,e.type,cutoff,game_rows,registration_rows,s.end_time);');
end $$;

-- Read-only counter for one signed revision. This consumes only confirmed
-- actual participation; it does not authorize transfers or close payroll.
-- When monetary execution is added, its raw accrual reader must remain
-- separate from this counter to avoid a recursive eligibility calculation.
create function public.contract_limit_progress(p_contract uuid,p_revision integer) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare policy jsonb;entry record;plan jsonb;registered boolean;played integer;used integer:=0;before_used integer;consumed integer;
 uncertain boolean:=false;has_pending boolean:=false;reached_at timestamptz;rows_json jsonb:='[]';fact jsonb;
begin
 if p_contract is null or p_revision is null or p_revision<1 then raise exception 'CONTRACT_INPUT';end if;
 select terms->'limit' into policy from public.organization_contract_versions where contract_id=p_contract and revision=p_revision;
 if not found then raise exception 'CONTRACT_NOT_FOUND';end if;
 if policy is null or policy='null'::jsonb then return jsonb_build_object('ready',true,'unlimited',true);end if;
 if policy->>'unit'='tournaments' then return jsonb_build_object('ready',false,'reason','tournament_completion_required');end if;
 for entry in select f.*,t.organization_id,t.player_id from public.contract_session_terms t join public.contract_session_frames f on f.session_id=t.session_id
   where t.contract_id=p_contract and t.revision=p_revision order by f.cutoff_at,f.session_id
 loop
   plan:=public.contract_session_accrual_plan(entry.session_id,p_contract);
   select exists(select 1 from jsonb_array_elements(entry.registrations) r cross join lateral jsonb_array_elements(coalesce(r->'roster','[]')) p
     where r->>'organizationId'=entry.organization_id::text
       and case when jsonb_typeof(p)='string' then p#>>'{}' when p?'userId' then p->>'userId' else p->>'id' end=entry.player_id::text) into registered;
   if not registered and coalesce((plan->>'playedGames')::integer,0)=0 then continue;end if;
   if entry.ends_at is null then return jsonb_build_object('ready',false,'reason','session_end_snapshot_missing');end if;
   played:=case when plan->>'ready'='true' then coalesce((plan->>'playedGames')::integer,0) else null end;
   before_used:=used;
   if plan->>'cancelled'='true' then
     fact:=jsonb_build_object('ready',true,'included',false,'consumed',0,'reason','cancelled');
   elsif used>=(policy->>'count')::integer then
     fact:=jsonb_build_object('ready',true,'included',false,'consumed',0,'reason','limit_reached');
   elsif uncertain or played is null then
     has_pending:=true;
     if policy->>'unit'<>'trainings' or entry.event_type='training' then uncertain:=true;end if;
     fact:=jsonb_build_object('ready',false,'included',false,'consumed',0,'reason','pending_prior_results');
   else
     consumed:=case when played=0 then 0 when policy->>'unit'='games' then played
       when policy->>'unit'='trainings' and entry.event_type<>'training' then 0 else 1 end;
     used:=used+consumed;
     if used>=(policy->>'count')::integer then reached_at:=entry.ends_at;end if;
     fact:=jsonb_build_object('ready',true,'included',true,'consumed',consumed,'reason',null);
   end if;
   rows_json:=rows_json||jsonb_build_array(fact||jsonb_build_object('sessionId',entry.session_id,'usedBefore',before_used,'usedAfter',used));
 end loop;
 return jsonb_build_object('ready',not has_pending,'unit',policy->>'unit','maximum',(policy->>'count')::integer,'used',used,
   'remaining',greatest(0,(policy->>'count')::integer-used),'reachedAt',reached_at,
   'contractEndsAt',case when coalesce(policy->>'completion','contract')='contract' then reached_at else null end,'sessions',rows_json);
end $$;

alter function public.contract_validate_terms(jsonb) rename to contract_validate_terms_before_limit_policy;
create function public.contract_validate_terms(p_terms jsonb) returns void
language plpgsql set search_path=public as $$
declare policy jsonb;sanitized jsonb:=p_terms;
begin
 policy:=p_terms->'limit';
 if policy is not null and policy<>'null'::jsonb then
   perform public.contract_assert_object(policy,array['unit','count'],array['unit','count','completion']);
   if jsonb_typeof(policy->'unit') is distinct from 'string' or policy->>'unit' not in('sessions','games','trainings','tournaments') then raise exception 'CONTRACT_LIMIT';end if;
   perform public.contract_assert_uint(policy->'count',1000000);
   if (policy->>'count')::integer<1 then raise exception 'CONTRACT_LIMIT';end if;
   if policy?'completion' and(jsonb_typeof(policy->'completion') is distinct from 'string' or policy->>'completion' not in('contract','event_payments')) then raise exception 'CONTRACT_LIMIT';end if;
   policy:=policy-'completion';
   if policy->>'unit'='sessions' then policy:=jsonb_set(policy,'{unit}','"trainings"');end if;
   sanitized:=jsonb_set(sanitized,'{limit}',policy);
 end if;
 perform public.contract_validate_terms_before_limit_policy(sanitized);
end $$;

-- Offered limits may be prepared and reviewed, but no incomplete expiry
-- implementation may activate a salary or monetary obligations.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_mutate(uuid,jsonb)'::regprocedure);
 needle:='elsif action=''accept'' then'||E'\n     if c.player_id<>p_actor then raise exception ''CONTRACT_FORBIDDEN'';end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_LIMIT_ACTIVATION_GUARD_PATCH';end if;
 execute replace(d,needle,needle||' if v.terms->''limit'' is not null and v.terms->''limit''<>''null''::jsonb then raise exception ''CONTRACT_LIMIT_EXECUTION_PENDING'';end if;');
end $$;
revoke all on function public.contract_validate_terms(jsonb),public.contract_validate_terms_before_limit_policy(jsonb),public.contract_limit_progress(uuid,integer) from public,anon,authenticated,service_role;
commit;
