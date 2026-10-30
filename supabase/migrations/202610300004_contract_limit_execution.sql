-- Finalized count-based expiry is immutable: result corrections can adjust
-- sporting payments but never reopen an already finished agreement/payroll.
begin;
create table public.contract_limit_closures(
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null,revision integer not null,
 session_id uuid not null references public.contract_session_frames(session_id),
 ends_at timestamptz not null check(isfinite(ends_at)),
 progress jsonb not null,confirmed_at timestamptz not null default clock_timestamp(),
 unique(contract_id,revision),
 foreign key(contract_id,revision) references public.contract_agreements(contract_id,revision)
);
create table public.contract_limit_salary_adjustments(
 contract_id uuid not null,revision integer not null,period_index integer not null,
 closure_id uuid not null references public.contract_limit_closures(id),
 original_obligation uuid references public.contract_obligations(id),
 replacement_obligation uuid references public.contract_obligations(id),
 expected_amount bigint not null check(expected_amount>=0),expected_due_at timestamptz not null,
 owner_waived boolean not null,created_at timestamptz not null default clock_timestamp(),
 primary key(contract_id,revision,period_index),
 foreign key(contract_id,revision,period_index) references public.contract_salary_periods(contract_id,revision,period_index)
);
create table public.contract_limit_runtime_cache(
 transaction_id bigint not null,contract_id uuid not null,revision integer not null,progress jsonb not null,
 primary key(transaction_id,contract_id,revision)
);
create index contract_session_terms_by_agreement on public.contract_session_terms(contract_id,revision,session_id);
alter table public.contract_limit_closures enable row level security;
alter table public.contract_limit_salary_adjustments enable row level security;
alter table public.contract_limit_runtime_cache enable row level security;
revoke all on public.contract_limit_closures,public.contract_limit_salary_adjustments,public.contract_limit_runtime_cache from public,anon,authenticated,service_role;
create trigger contract_limit_closure_immutable before update or delete on public.contract_limit_closures
 for each row execute function public.contract_frozen_guard();
create trigger contract_limit_salary_adjustment_immutable before update or delete on public.contract_limit_salary_adjustments
 for each row execute function public.contract_frozen_guard();

create function public.contract_effective_end(p_contract uuid,p_revision integer) returns timestamptz
language sql stable security definer set search_path=public as $$
 select least(a.ended_at,(v.terms->>'endsAt')::timestamptz,c.ends_at)
 from public.contract_agreements a join public.organization_contract_versions v on v.contract_id=a.contract_id and v.revision=a.revision
 left join public.contract_limit_closures c on c.contract_id=a.contract_id and c.revision=a.revision
 where a.contract_id=p_contract and a.revision=p_revision
$$;

-- Preserve the raw sporting reader for the counter. Eligibility calls the
-- counter; the counter must never call eligibility recursively.
alter function public.contract_session_accrual_plan(uuid,uuid) rename to contract_session_raw_accrual_plan;
do $$declare d text;begin
 d:=pg_get_functiondef('public.contract_limit_progress(uuid,integer)'::regprocedure);
 execute replace(d,'public.contract_session_accrual_plan(','public.contract_session_raw_accrual_plan(');
end $$;
create function public.contract_session_accrual_plan(p_session uuid,p_contract uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare plan jsonb;t public.contract_session_terms%rowtype;progress jsonb;entry jsonb;closure public.contract_limit_closures%rowtype;
begin
 plan:=public.contract_session_raw_accrual_plan(p_session,p_contract);
 if plan->>'ready' is distinct from 'true' then return plan;end if;
 select * into strict t from public.contract_session_terms where session_id=p_session and contract_id=p_contract;
 if t.terms->'limit' is null or t.terms->'limit'='null'::jsonb then return plan;end if;
 if t.terms->'limit'->>'unit'='tournaments' then return plan||jsonb_build_object('ready',false,'reason','tournament_completion_required','entries','[]'::jsonb);end if;
 select * into closure from public.contract_limit_closures where contract_id=p_contract and revision=t.revision;
 if closure.id is not null then progress:=closure.progress;
 else
   select cached.progress into progress from public.contract_limit_runtime_cache cached where cached.transaction_id=txid_current() and cached.contract_id=p_contract and cached.revision=t.revision;
   if not found then progress:=public.contract_limit_progress(p_contract,t.revision);end if;
 end if;
 select value into entry from jsonb_array_elements(coalesce(progress->'sessions','[]')) where value->>'sessionId'=p_session::text;
 if entry is null then return plan||jsonb_build_object('eligible',false,'limitIncluded',false,'entries','[]'::jsonb,'limitReason','outside_limit_scope');end if;
 if entry->>'ready' is distinct from 'true' then return plan||jsonb_build_object('ready',false,'reason','pending_prior_results','entries','[]'::jsonb);end if;
 if entry->>'included' is distinct from 'true' then return plan||jsonb_build_object('eligible',false,'limitIncluded',false,'entries','[]'::jsonb,'limitReason',entry->'reason');end if;
 return plan||jsonb_build_object('limitIncluded',true,'limitUsedBefore',entry->'usedBefore','limitUsedAfter',entry->'usedAfter');
end $$;

-- Reuse the already audited unearned-reserve adjustment. Processed periods
-- remain immutable and are corrected by separate obligations below.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_salary_schedule_close(uuid,integer,timestamptz,text)'::regprocedure);
 d:=replace(d,'public.contract_salary_schedule_close(','public.contract_salary_limit_close_unearned(');
 needle:='if exists(select 1 from public.contract_salary_periods where contract_id=p_contract and revision=p_revision and processed_at is not null and due_at>closing)'||E'\n then raise exception ''CONTRACT_PAYROLL_ALREADY_POSTED'';end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_LIMIT_PAYROLL_CLOSE_PATCH';end if;
 execute replace(d,needle,'');
end $$;

create function public.contract_salary_close_for_limit(p_closure uuid) returns void
language plpgsql security definer set search_path=public as $$
declare closure public.contract_limit_closures%rowtype;s public.contract_salary_schedules%rowtype;p public.contract_salary_periods%rowtype;
 old_obligation public.contract_obligations%rowtype;expected bigint;replacement uuid;closing timestamptz;org uuid;funded boolean;waived boolean;
 account public.coin_accounts%rowtype;restored bigint;reserve_operation uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into strict closure from public.contract_limit_closures where id=p_closure;
 select * into s from public.contract_salary_schedules where contract_id=closure.contract_id and revision=closure.revision for update;
 if not found then return;end if;
 closing:=greatest(s.starts_at,least(closure.ends_at,s.ends_at));
 select organization_id into org from public.organization_contracts where id=closure.contract_id;
 perform public.contract_salary_limit_close_unearned(closure.contract_id,closure.revision,closing,'Окончание договора по лимиту выступлений');
 for p in select * from public.contract_salary_periods where contract_id=s.contract_id and revision=s.revision
   and processed_at is not null and due_at>closing order by period_index for update
 loop
   if exists(select 1 from public.contract_limit_salary_adjustments where contract_id=p.contract_id and revision=p.revision and period_index=p.period_index) then continue;end if;
   expected:=case when p.starts_at>=closing then 0 else floor(s.amount::numeric*extract(epoch from(closing-p.starts_at))/(s.period_days::numeric*86400))::bigint end;
   replacement:=null;waived:=false;
   select * into old_obligation from public.contract_obligations where id=p.obligation_id for update;
   if old_obligation.id is not null then
     waived:=old_obligation.cancelled_by is not null;
     if old_obligation.cancelled_at is null then
       perform public.contract_obligation_cancel_internal(null,gen_random_uuid(),old_obligation.id,'Завершение договора по лимиту: корректировка зарплаты');
       if expected>0 then
         -- A correction must not turn a formerly unfunded salary debt into
         -- an automatic payment from a later top-up. Restore only funding
         -- already authorized/paid for this original period.
         funded:=old_obligation.paid+old_obligation.held>=expected and exists(select 1 from public.coin_accounts where team_id=org and balance-reserved>=expected);
         replacement:=public.contract_obligation_create(s.contract_id,s.revision,'salary','limit-period:'||s.revision||':'||p.period_index,expected,closing,funded);
         if funded then perform public.contract_obligation_pay(null,gen_random_uuid(),replacement,expected,true);
         else
           select * into strict account from public.coin_accounts where team_id=org for update;
           restored:=least(expected,old_obligation.paid+old_obligation.held,greatest(0,account.balance-account.reserved));
           if restored>0 then
             reserve_operation:=gen_random_uuid();
             insert into public.coin_operations(id,action,input,description) values(reserve_operation,'contract_limit_salary_reserve',jsonb_build_object('obligationId',replacement,'originalObligationId',old_obligation.id),'Восстановление ранее обеспеченной части зарплаты');
             perform public.u6_coin_entry(reserve_operation,account.id,0,restored);
             update public.contract_obligations set held=restored where id=replacement;
             insert into public.contract_obligation_movements(operation_id,obligation_id,held_change) values(reserve_operation,replacement,restored);
             perform public.contract_obligation_pay(null,gen_random_uuid(),replacement,restored,true);
           end if;
         end if;
       end if;
     end if;
   end if;
   insert into public.contract_limit_salary_adjustments(contract_id,revision,period_index,closure_id,original_obligation,replacement_obligation,expected_amount,expected_due_at,owner_waived)
   values(s.contract_id,s.revision,p.period_index,closure.id,old_obligation.id,replacement,expected,closing,waived);
 end loop;
 perform public.contract_salary_process(s.contract_id);
end $$;

create function public.contract_limit_finalize(p_contract uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare terms jsonb;progress jsonb;terminal jsonb;closure public.contract_limit_closures%rowtype;ending timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into closure from public.contract_limit_closures where contract_id=p_contract and revision=p_revision;
 if found then return jsonb_build_object('ready',true,'closed',true,'unchanged',true,'endsAt',closure.ends_at);end if;
 select v.terms into terms from public.contract_agreements a join public.organization_contract_versions v on v.contract_id=a.contract_id and v.revision=a.revision
 where a.contract_id=p_contract and a.revision=p_revision;
 if not found then raise exception 'CONTRACT_NOT_FOUND';end if;
 if terms->'limit' is null or terms->'limit'='null'::jsonb then return jsonb_build_object('ready',true,'closed',false);end if;
 select cached.progress into progress from public.contract_limit_runtime_cache cached where cached.transaction_id=txid_current() and cached.contract_id=p_contract and cached.revision=p_revision;
 if not found then progress:=public.contract_limit_progress(p_contract,p_revision);end if;
 if progress->>'ready' is distinct from 'true' then return progress||jsonb_build_object('closed',false);end if;
 if coalesce(terms->'limit'->>'completion','contract')<>'contract' or(progress->>'remaining')::integer>0 then return progress||jsonb_build_object('closed',false);end if;
 ending:=(progress->>'reachedAt')::timestamptz;
 if ending is null then return jsonb_build_object('ready',false,'closed',false,'reason','session_end_snapshot_missing');end if;
 select value into terminal from jsonb_array_elements(progress->'sessions') where value->>'included'='true'
   and(value->>'usedBefore')::integer<(progress->>'maximum')::integer and(value->>'usedAfter')::integer>=(progress->>'maximum')::integer limit 1;
 if terminal is null then raise exception 'CONTRACT_LIMIT';end if;
 insert into public.contract_limit_closures(contract_id,revision,session_id,ends_at,progress)
 values(p_contract,p_revision,(terminal->>'sessionId')::uuid,ending,progress) returning * into closure;
 perform public.contract_salary_close_for_limit(closure.id);
 return progress||jsonb_build_object('closed',true,'endsAt',ending);
end $$;

-- Connect eligibility to money only now, after count and payroll correction
-- share one transaction. Whole-tournament limits remain explicitly gated.
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_session_settle(uuid,uuid)'::regprocedure);
 needle:='if t.terms->''limit'' is not null and t.terms->''limit''<>''null''::jsonb then'||E'\n   return jsonb_build_object(''ready'',false,''applied'',false,''reason'',''participation_limit_pending'');\n end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_LIMIT_SETTLEMENT_GATE_PATCH';end if;
 execute replace(d,needle,'');
 d:=pg_get_functiondef('public.contract_session_fine_settle(uuid,uuid)'::regprocedure);
 needle:='if t.terms->''limit'' is not null and t.terms->''limit''<>''null''::jsonb then return jsonb_build_object(''ready'',false,''reason'',''participation_limit_pending'');end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_LIMIT_FINE_GATE_PATCH';end if;
 execute replace(d,needle,'');
 d:=pg_get_functiondef('public.contract_session_no_show_assessment(uuid,uuid,bigint)'::regprocedure);
 d:=replace(d,'declare answer jsonb;','declare answer jsonb;eligibility jsonb;');
 needle:='answer:=public.contract_no_show_assessment_before_complete(p_session,p_contract,p_player_value);';
 if position(needle in d)=0 then raise exception 'CONTRACT_LIMIT_FINE_ELIGIBILITY_PATCH';end if;
 execute replace(d,needle,'eligibility:=public.contract_session_accrual_plan(p_session,p_contract); if eligibility->>''limitIncluded''=''false'' then return jsonb_build_object(''ready'',true,''applies'',false,''amount'',0,''reason'',''limit_reached'');end if; '||needle);
 d:=pg_get_functiondef('public.contract_mutate(uuid,jsonb)'::regprocedure);
 needle:='if v.terms->''limit'' is not null and v.terms->''limit''<>''null''::jsonb then raise exception ''CONTRACT_LIMIT_EXECUTION_PENDING'';end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_LIMIT_ACCEPTANCE_GATE_PATCH';end if;
 d:=replace(d,needle,'if v.terms->''limit''->>''unit''=''tournaments'' then raise exception ''CONTRACT_LIMIT_EXECUTION_PENDING'';end if;');
 needle:='and oldc.kind=''main'' and (a.ended_at is null or a.ended_at>greatest(clock_timestamp(),(v.terms->>''startsAt'')::timestamptz))';
 if position(needle in d)=0 then raise exception 'CONTRACT_LIMIT_OVERLAP_PATCH';end if;
 d:=replace(d,needle,needle||' and (public.contract_effective_end(a.contract_id,a.revision) is null or public.contract_effective_end(a.contract_id,a.revision)>greatest(clock_timestamp(),(v.terms->>''startsAt'')::timestamptz))');
 execute d;
 d:=pg_get_functiondef('public.contract_session_freeze_at(uuid,timestamptz)'::regprocedure);
 needle:='(a.ended_at is null or a.ended_at>cutoff)';
 if position(needle in d)=0 then raise exception 'CONTRACT_LIMIT_FREEZE_PATCH';end if;
 execute replace(d,needle,needle||' and not exists(select 1 from public.contract_limit_closures lc where lc.contract_id=a.contract_id and lc.revision=a.revision and lc.ends_at<=cutoff)');
 d:=pg_get_functiondef('public.contract_freeze_due_values(integer)'::regprocedure);
 needle:='(a.ended_at is null or a.ended_at>es.start_time)';
 if position(needle in d)=0 then raise exception 'CONTRACT_LIMIT_DUE_FREEZE_PATCH';end if;
 execute replace(d,needle,needle||' and not exists(select 1 from public.contract_limit_closures lc where lc.contract_id=a.contract_id and lc.revision=a.revision and lc.ends_at<=es.start_time)');
end $$;

create or replace function public.contract_session_publish_settle(p_session uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare publication public.competition_publications%rowtype;context record;affected record;result jsonb;fine_result jsonb;cached_progress jsonb;summary jsonb:='[]';count_applied integer:=0;
begin
 if p_session is null then raise exception 'CONTRACT_EVENT';end if;
 select * into publication from public.competition_publications where session_id=p_session;
 if publication.session_id is null or publication.first_published_at is null or publication.published is null then return jsonb_build_object('ready',false,'reason','unpublished','settled',0,'details','[]'::jsonb);end if;
 perform public.contract_session_freeze(p_session);
 for context in select t.contract_id,t.revision,t.terms,f.cutoff_at from public.contract_session_terms t
   join public.contract_session_frames f on f.session_id=t.session_id where t.session_id=p_session order by t.contract_id
 loop
   if context.terms->'limit' is not null and context.terms->'limit'<>'null'::jsonb then
     select lc.progress into cached_progress from public.contract_limit_closures lc where lc.contract_id=context.contract_id and lc.revision=context.revision;
     if not found then cached_progress:=public.contract_limit_progress(context.contract_id,context.revision);end if;
     insert into public.contract_limit_runtime_cache(transaction_id,contract_id,revision,progress) values(txid_current(),context.contract_id,context.revision,cached_progress)
       on conflict(transaction_id,contract_id,revision) do update set progress=excluded.progress;
   end if;
   perform public.contract_limit_finalize(context.contract_id,context.revision);
   for affected in select t.session_id from public.contract_session_terms t join public.contract_session_frames f on f.session_id=t.session_id
     join public.competition_publications cp on cp.session_id=t.session_id and cp.first_published_at is not null and cp.published is not null
     where t.contract_id=context.contract_id and t.revision=context.revision and
       (t.session_id=p_session or(context.terms->'limit' is not null and context.terms->'limit'<>'null'::jsonb and(f.cutoff_at,f.session_id)>=(context.cutoff_at,p_session)))
     order by f.cutoff_at,t.session_id
   loop
     result:=public.contract_session_settle(affected.session_id,context.contract_id);
     fine_result:=public.contract_session_fine_settle(affected.session_id,context.contract_id);
     summary:=summary||jsonb_build_array(jsonb_build_object('sessionId',affected.session_id,'contractId',context.contract_id,'result',result,'fine',fine_result));
     if coalesce((result->>'applied')::boolean,false) then count_applied:=count_applied+1;end if;
   end loop;
   delete from public.contract_limit_runtime_cache where transaction_id=txid_current() and contract_id=context.contract_id and revision=context.revision;
 end loop;
 return jsonb_build_object('ready',true,'settled',count_applied,'details',summary);
end $$;

do $$declare d text;needle text;replacement text;begin
 d:=pg_get_functiondef('public.contract_query(uuid,jsonb)'::regprocedure);
 needle:='case when exists(select 1 from public.contract_agreements a where a.contract_id=c.id and a.revision=v.revision) then ''signed'' else v.status end as status';
 replacement:='case when public.contract_effective_end(c.id,v.revision)<=clock_timestamp() then ''completed'' when exists(select 1 from public.contract_agreements a where a.contract_id=c.id and a.revision=v.revision) then ''signed'' else v.status end as status';
 if position(needle in d)=0 then raise exception 'CONTRACT_LIMIT_STATUS_PATCH';end if;
 d:=replace(d,needle,replacement);
 needle:='c.created_at as "createdAt",';
 d:=replace(d,needle,needle||' public.contract_effective_end(c.id,v.revision) as "effectiveEndsAt",');
 execute d;
 d:=pg_get_functiondef('public.contract_history(uuid,uuid,integer)'::regprocedure);
 needle:='case when exists(select 1 from public.contract_agreements a where a.contract_id=public.organization_contract_versions.contract_id and a.revision=public.organization_contract_versions.revision) then ''signed'' else status end as status';
 if position(needle in d)=0 then raise exception 'CONTRACT_LIMIT_HISTORY_STATUS_PATCH';end if;
 execute replace(d,needle,'case when public.contract_effective_end(public.organization_contract_versions.contract_id,public.organization_contract_versions.revision)<=clock_timestamp() then ''completed'' when exists(select 1 from public.contract_agreements a where a.contract_id=public.organization_contract_versions.contract_id and a.revision=public.organization_contract_versions.revision) then ''signed'' else status end as status');
end $$;

revoke all on function public.contract_effective_end(uuid,integer),public.contract_session_raw_accrual_plan(uuid,uuid),public.contract_session_accrual_plan(uuid,uuid),
 public.contract_salary_limit_close_unearned(uuid,integer,timestamptz,text),public.contract_salary_close_for_limit(uuid),public.contract_limit_finalize(uuid,integer)
 from public,anon,authenticated,service_role;
commit;
