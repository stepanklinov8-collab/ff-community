-- Connect verified contract calculations to the confirmed results lifecycle
-- and a bounded maintenance worker.
begin;
create function public.contract_session_publish_settle(p_session uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare publication public.competition_publications%rowtype;row record;result jsonb;summary jsonb:='[]'::jsonb;count_applied integer:=0;
begin
 if p_session is null then raise exception 'CONTRACT_EVENT';end if;
 select * into publication from public.competition_publications where session_id=p_session;
 if publication.session_id is null or publication.first_published_at is null or publication.published is null then
   return jsonb_build_object('ready',false,'reason','unpublished','settled',0,'details','[]'::jsonb);
 end if;
 perform public.contract_session_freeze(p_session);
 for row in select contract_id from public.contract_session_terms where session_id=p_session order by contract_id loop
   result:=public.contract_session_settle(p_session,row.contract_id);
   summary:=summary||jsonb_build_array(jsonb_build_object('contractId',row.contract_id,'result',result));
   if coalesce((result->>'applied')::boolean,false) then count_applied:=count_applied+1;end if;
 end loop;
 return jsonb_build_object('ready',true,'settled',count_applied,'details',summary);
end $$;

-- Draft saves and unconfirmed internal plans never cause payments.
do $$ declare d text;needle text;begin
 d:=pg_get_functiondef('public.u2_save_results(uuid,uuid,integer,integer,uuid,text,jsonb,jsonb,boolean,jsonb,uuid[])'::regprocedure);
 needle:='insert into public.competition_action_log(actor_id,scope_id,action,revision) values(';
 if position(needle in d)=0 then raise exception 'CONTRACT_PUBLICATION_HOOK_PATCH';end if;
 d:=replace(d,needle,'if p_published is not null then perform public.contract_session_publish_settle(p_session);end if; '||needle);
 execute d;
end $$;

-- Salary periods keep their original deadlines; sessions are frozen exactly
-- once. Both loops are bounded so a delayed invocation can resume next time.
create function public.contract_maintenance_run() returns jsonb
language plpgsql security definer set search_path=public as $$
declare session_row record;contract_row record;frozen integer:=0;processed integer:=0;more boolean:=false;outcome jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 for session_row in select es.id from public.event_sessions es join public.events e on e.id=es.event_id
   where es.start_time<=clock_timestamp() and es.status<>'cancelled' and e.cancelled_at is null
     and not exists(select 1 from public.contract_session_frames f where f.session_id=es.id)
   order by es.start_time,es.id limit 500
 loop
   perform public.contract_session_freeze(session_row.id);frozen:=frozen+1;
 end loop;
 for contract_row in select distinct payroll.contract_id from public.contract_salary_schedules payroll
   join public.contract_agreements agreement on agreement.contract_id=payroll.contract_id and agreement.revision=payroll.revision
   where not payroll.finished and agreement.signed_at<=clock_timestamp()
   order by payroll.contract_id limit 500
 loop
   outcome:=public.contract_salary_process(contract_row.contract_id);
   processed:=processed+coalesce((outcome->>'processed')::integer,0);
   more:=more or coalesce((outcome->>'hasMore')::boolean,false);
 end loop;
 return jsonb_build_object('frozenSessions',frozen,'processedSalaryPeriods',processed,'moreSalaryPeriods',more,'checkedAt',clock_timestamp());
end $$;
revoke all on function public.contract_session_publish_settle(uuid),public.contract_maintenance_run() from public,anon,authenticated,service_role;
grant execute on function public.contract_maintenance_run() to service_role;
commit;
