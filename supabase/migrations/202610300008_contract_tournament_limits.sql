-- Count an entire tournament once, using its pre-start signed agreement.
-- A player's qualifying appearance survives elimination before the final.
begin;
alter function public.contract_limit_progress(uuid,integer) rename to contract_limit_session_progress;
alter function public.contract_tournament_accrual_plan(uuid,uuid) rename to contract_tournament_raw_accrual_plan;

-- Do not silently omit an earlier registered tournament merely because its
-- results have never been entered and the daily worker has not visited it.
create function public.contract_tournament_limit_freeze_due(p_event uuid) returns void
language plpgsql security definer set search_path=public as $$
declare item record;
begin
 for item in
   with relevant as (
     select t.contract_id,t.revision,t.organization_id from public.contract_tournament_terms t
       where t.event_id=p_event and t.terms->'limit'->>'unit'='tournaments'
     union
     select t.contract_id,t.revision,t.organization_id from public.contract_session_terms t
       join public.contract_session_frames f on f.session_id=t.session_id
       where f.event_id=p_event and t.terms->'limit'->>'unit'='tournaments'
   )
   select distinct s.id,s.start_time from relevant r join public.contract_agreements a on a.contract_id=r.contract_id and a.revision=r.revision
     join public.event_registrations reg on reg.team_id=r.organization_id and reg.status='confirmed'
     join public.event_sessions s on s.id=reg.session_id
     join public.events e on e.id=s.event_id and e.cancelled_at is null
   where s.start_time<=clock_timestamp() and s.status<>'cancelled'
     and a.signed_at<=s.start_time and a.effective_at<=s.start_time
     and(public.contract_effective_end(a.contract_id,a.revision) is null or public.contract_effective_end(a.contract_id,a.revision)>s.start_time)
     and not exists(select 1 from public.contract_session_frames f where f.session_id=s.id)
   order by s.start_time,s.id
 loop perform public.contract_session_freeze(item.id);end loop;
end $$;

create function public.contract_limit_progress(p_contract uuid,p_revision integer) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare policy jsonb;item record;plan jsonb;fact jsonb;session record;rows_json jsonb:='[]';events_json jsonb:='[]';
 used integer:=0;before_used integer;consumed integer;uncertain boolean:=false;has_pending boolean:=false;
 included boolean;ready boolean;reason text;ending timestamptz;reached_at timestamptz;terminal uuid;
begin
 if p_contract is null or p_revision is null or p_revision<1 then raise exception 'CONTRACT_INPUT';end if;
 select terms->'limit' into policy from public.organization_contract_versions where contract_id=p_contract and revision=p_revision;
 if not found then raise exception 'CONTRACT_NOT_FOUND';end if;
 if policy->>'unit' is distinct from 'tournaments' then return public.contract_limit_session_progress(p_contract,p_revision);end if;
 -- Each event has one chronological position, independent of how many
 -- groups/stages the player entered. Non-tournament sessions consume zero.
 for item in
   select f.event_id,case when f.event_type='tournament' then f.event_id else f.session_id end as scope_id,
     coalesce(min(tf.cutoff_at) filter(where a.revision=p_revision),min(f.cutoff_at)) as cutoff_at,min(f.event_type) as event_type,
     bool_or(a.revision=p_revision) as anchored
   from public.contract_session_terms t join public.contract_session_frames f on f.session_id=t.session_id
   left join public.contract_tournament_terms a on a.event_id=f.event_id and a.contract_id=t.contract_id
   left join public.contract_tournament_frames tf on tf.event_id=a.event_id
   where t.contract_id=p_contract and t.revision=p_revision
   group by f.event_id,case when f.event_type='tournament' then f.event_id else f.session_id end
   order by coalesce(min(tf.cutoff_at) filter(where a.revision=p_revision),min(f.cutoff_at)),f.event_id,
     case when min(f.event_type)='tournament' then f.event_id else min(f.session_id::text)::uuid end
 loop
   before_used:=used;consumed:=0;reason:=null;ready:=true;included:=true;ending:=null;terminal:=null;
   if used>=(policy->>'count')::integer then included:=false;reason:='limit_reached';
   elsif uncertain then ready:=false;included:=false;reason:='pending_prior_results';has_pending:=true;
   elsif item.event_type='tournament' and coalesce(item.anchored,false) then
     plan:=public.contract_tournament_raw_accrual_plan(item.event_id,p_contract);
     if plan->>'cancelled'='true' then included:=false;reason:='cancelled';
     elsif plan->>'ready' is distinct from 'true' then
       -- The first unfinished event can pay its already confirmed stages,
       -- but cannot consume the cap or authorize a later tournament yet.
       uncertain:=true;has_pending:=true;reason:='tournament_in_progress';
     else
       consumed:=case when plan->>'eligible'='true' then 1 else 0 end;
       terminal:=(plan->>'finalSessionId')::uuid;
       select max(f.ends_at) into ending from public.contract_session_frames f
         where f.event_id=item.event_id and exists(select 1 from public.event_sessions s where s.id=f.session_id and s.status<>'cancelled');
       if ending is null then return jsonb_build_object('ready',false,'reason','session_end_snapshot_missing');end if;
       used:=used+consumed;
       if used>=(policy->>'count')::integer then reached_at:=ending;end if;
     end if;
   end if;
   fact:=jsonb_build_object('eventId',item.event_id,'ready',ready,'included',included,'consumed',consumed,
     'usedBefore',before_used,'usedAfter',used,'reason',reason,'terminalSessionId',terminal);
   events_json:=events_json||jsonb_build_array(fact);
   for session in select t.session_id from public.contract_session_terms t join public.contract_session_frames f on f.session_id=t.session_id
     where t.contract_id=p_contract and t.revision=p_revision and f.event_id=item.event_id
       and(item.event_type='tournament' or t.session_id=item.scope_id) order by f.cutoff_at,t.session_id
   loop
     rows_json:=rows_json||jsonb_build_array(fact||jsonb_build_object('sessionId',session.session_id));
   end loop;
 end loop;
 return jsonb_build_object('ready',not has_pending,'unit','tournaments','maximum',(policy->>'count')::integer,'used',used,
   'remaining',greatest(0,(policy->>'count')::integer-used),'reachedAt',reached_at,
   'contractEndsAt',case when coalesce(policy->>'completion','contract')='contract' then reached_at else null end,
   'events',events_json,'sessions',rows_json);
end $$;

-- The raw tournament reader bypasses tournament cap eligibility, preventing
-- recursion between the event counter and the session eligibility reader.
create function public.contract_tournament_accrual_plan(p_event uuid,p_contract uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare plan jsonb;anchor public.contract_tournament_terms%rowtype;progress jsonb;entry jsonb;
begin
 plan:=public.contract_tournament_raw_accrual_plan(p_event,p_contract);
 if plan->>'ready' is distinct from 'true' then return plan;end if;
 select * into strict anchor from public.contract_tournament_terms where event_id=p_event and contract_id=p_contract;
 if anchor.terms->'limit'->>'unit' is distinct from 'tournaments' then return plan;end if;
 select c.progress into progress from public.contract_limit_closures c where c.contract_id=p_contract and c.revision=anchor.revision;
 if not found then
   select c.progress into progress from public.contract_limit_runtime_cache c where c.transaction_id=txid_current() and c.contract_id=p_contract and c.revision=anchor.revision;
   if not found then progress:=public.contract_limit_progress(p_contract,anchor.revision);end if;
 end if;
 select value into entry from jsonb_array_elements(coalesce(progress->'events','[]')) where value->>'eventId'=p_event::text;
 if entry is null or entry->>'included'='false' then
   if entry->>'ready'='false' then return plan||jsonb_build_object('ready',false,'reason','pending_prior_results');end if;
   return plan||jsonb_build_object('eligible',false,'amount',0,'limitIncluded',false);
 end if;
 return plan||jsonb_build_object('limitIncluded',true);
end $$;

do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_session_accrual_plan(uuid,uuid)'::regprocedure);
 needle:='if t.terms->''limit''->>''unit''=''tournaments'' then return plan||jsonb_build_object(''ready'',false,''reason'',''tournament_completion_required'',''entries'',''[]''::jsonb);end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_TOURNAMENT_SESSION_GATE_PATCH';end if;
 execute replace(d,needle,'');
 d:=pg_get_functiondef('public.contract_limit_finalize(uuid,integer)'::regprocedure);
 needle:='(terminal->>''sessionId'')::uuid,ending,progress';
 if position(needle in d)=0 then raise exception 'CONTRACT_TOURNAMENT_TERMINAL_PATCH';end if;
 execute replace(d,needle,'coalesce((terminal->>''terminalSessionId'')::uuid,(terminal->>''sessionId'')::uuid),ending,progress');
 d:=pg_get_functiondef('public.contract_mutate(uuid,jsonb)'::regprocedure);
 needle:='if v.terms->''limit''->>''unit''=''tournaments'' then raise exception ''CONTRACT_LIMIT_EXECUTION_PENDING'';end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_TOURNAMENT_ACCEPT_GATE_PATCH';end if;
 execute replace(d,needle,'');
end $$;

alter function public.contract_tournament_settle_all(uuid) rename to contract_tournament_settle_before_limits;
create function public.contract_tournament_settle_all(p_event uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare context record;affected record;progress jsonb;answer jsonb;
begin
 perform public.contract_tournament_freeze(p_event);
 perform public.contract_tournament_limit_freeze_due(p_event);
 -- Final publication may not contain the eliminated player's session terms.
 -- Inspect the original tournament anchors, not only the final's roster.
 for context in select t.contract_id,t.revision,f.cutoff_at from public.contract_tournament_terms t
   join public.contract_tournament_frames f on f.event_id=t.event_id
   where t.event_id=p_event and t.terms->'limit'->>'unit'='tournaments' order by t.contract_id
 loop
   select c.progress into progress from public.contract_limit_closures c where c.contract_id=context.contract_id and c.revision=context.revision;
   if not found then progress:=public.contract_limit_progress(context.contract_id,context.revision);end if;
   insert into public.contract_limit_runtime_cache(transaction_id,contract_id,revision,progress)
     values(txid_current(),context.contract_id,context.revision,progress)
     on conflict(transaction_id,contract_id,revision) do update set progress=excluded.progress;
   perform public.contract_limit_finalize(context.contract_id,context.revision);
   for affected in select t.session_id from public.contract_session_terms t join public.contract_session_frames f on f.session_id=t.session_id
     join public.competition_publications cp on cp.session_id=t.session_id and cp.published is not null and cp.first_published_at is not null
     where t.contract_id=context.contract_id and t.revision=context.revision and f.cutoff_at>=context.cutoff_at order by f.cutoff_at,t.session_id
   loop
     perform public.contract_session_settle(affected.session_id,context.contract_id);
     perform public.contract_session_fine_settle(affected.session_id,context.contract_id);
   end loop;
   -- Resolving an earlier event can unblock or revoke later event fees.
   for affected in select t.event_id from public.contract_tournament_terms t join public.contract_tournament_frames f on f.event_id=t.event_id
     where t.contract_id=context.contract_id and t.revision=context.revision and f.cutoff_at>=context.cutoff_at order by f.cutoff_at,t.event_id
   loop perform public.contract_tournament_settle(affected.event_id,context.contract_id);end loop;
   delete from public.contract_limit_runtime_cache where transaction_id=txid_current() and contract_id=context.contract_id and revision=context.revision;
 end loop;
 answer:=public.contract_tournament_settle_before_limits(p_event);
 return answer;
end $$;
alter function public.contract_session_publish_settle(uuid) rename to contract_session_publish_before_tournament_limits;
create function public.contract_session_publish_settle(p_session uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare event_value uuid;
begin
 if not exists(select 1 from public.competition_publications where session_id=p_session and first_published_at is not null and published is not null) then
   return public.contract_session_publish_before_tournament_limits(p_session);
 end if;
 perform public.contract_session_freeze(p_session);
 select event_id into event_value from public.contract_session_frames where session_id=p_session;
 if event_value is not null then perform public.contract_tournament_limit_freeze_due(event_value);end if;
 return public.contract_session_publish_before_tournament_limits(p_session);
end $$;
revoke all on function public.contract_limit_session_progress(uuid,integer),public.contract_limit_progress(uuid,integer),
 public.contract_tournament_raw_accrual_plan(uuid,uuid),public.contract_tournament_accrual_plan(uuid,uuid),
 public.contract_tournament_settle_before_limits(uuid),public.contract_tournament_settle_all(uuid),public.contract_tournament_limit_freeze_due(uuid),
 public.contract_session_publish_before_tournament_limits(uuid),public.contract_session_publish_settle(uuid)
 from public,anon,authenticated,service_role;
commit;
