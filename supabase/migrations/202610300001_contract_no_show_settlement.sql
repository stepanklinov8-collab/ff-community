-- Contractual absence fines use server snapshots, unreserved player funds,
-- durable debt and auditable correction/refund records.
begin;
create table public.contract_session_valuations(
 session_id uuid not null references public.contract_session_frames(session_id),
 player_id uuid not null references public.profiles(id),
 value bigint not null check(value between 0 and 1000000000000),
 captured_at timestamptz not null default clock_timestamp(),
 primary key(session_id,player_id)
);
alter table public.contract_session_valuations enable row level security;
revoke all on public.contract_session_valuations from public,anon,authenticated,service_role;
create trigger contract_session_valuation_immutable before update or delete on public.contract_session_valuations
 for each row execute function public.contract_frozen_guard();

create function public.contract_session_freeze_at(p_session uuid,p_publication timestamptz) returns void
language plpgsql security definer set search_path=public as $$
declare s public.event_sessions%rowtype;e public.events%rowtype;cutoff timestamptz;game_rows jsonb;registration_rows jsonb;candidate record;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if exists(select 1 from public.contract_session_frames where session_id=p_session) then return;end if;
 if p_publication is not null and(not isfinite(p_publication) or p_publication>clock_timestamp()) then raise exception 'CONTRACT_DATES';end if;
 select * into s from public.event_sessions where id=p_session for update;
 if not found then raise exception 'CONTRACT_EVENT';end if;
 select * into strict e from public.events where id=s.event_id;
 if s.status='cancelled' or e.cancelled_at is not null then raise exception 'CONTRACT_EVENT';end if;
 select least(s.start_time,first_published_at,p_publication) into cutoff from public.competition_publications where session_id=p_session;
 cutoff:=coalesce(cutoff,least(s.start_time,p_publication));
 if cutoff is null or not isfinite(cutoff) or cutoff>clock_timestamp() then raise exception 'CONTRACT_SESSION_NOT_STARTED';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'groupId',g.group_id,'map',g.map_name,'number',g.game_number) order by g.group_id,g.game_number,g.id),'[]') into game_rows
 from public.event_games g join public.event_groups q on q.id=g.group_id and q.session_id=g.session_id
 where g.session_id=s.id and g.status<>'cancelled' and q.is_active;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'organizationId',r.team_id,'groupId',r.group_id,'roster',coalesce(r.roster_snapshot,r.roster_json)) order by r.id),'[]') into registration_rows
 from public.event_registrations r where r.session_id=s.id and r.status='confirmed';
 insert into public.contract_session_frames(session_id,event_id,event_type,cutoff_at,games,registrations)
 values(s.id,e.id,e.type,cutoff,game_rows,registration_rows);
 insert into public.contract_session_valuations(session_id,player_id,value)
 select s.id,roster.player_id,round(public.u2_cost_for_target('player',roster.player_id,'main'))::bigint from(
   select distinct profile.id player_id
   from jsonb_array_elements(registration_rows) r cross join lateral jsonb_array_elements(coalesce(r->'roster','[]')) p
   join public.profiles profile on profile.id::text=case when jsonb_typeof(p)='string' then p#>>'{}' when p?'userId' then p->>'userId' else p->>'id' end
 ) roster where roster.player_id is not null;
 for candidate in
   with active as(
     select c.id,c.organization_id,c.player_id,c.kind,c.event_id,c.session_id,a.revision,v.terms
     from public.contract_agreements a join public.organization_contracts c on c.id=a.contract_id
     join public.organization_contract_versions v on v.contract_id=a.contract_id and v.revision=a.revision
     where a.signed_at<=cutoff and a.effective_at<=cutoff and(a.ended_at is null or a.ended_at>cutoff)
       and(v.terms->>'endsAt' is null or(v.terms->>'endsAt')::timestamptz>cutoff)
       and(c.kind='main' or(c.event_id=e.id and(c.session_id is null or c.session_id=s.id)))
   ), relevant as(
     select distinct a.player_id from active a where a.kind='guest' or exists(
       select 1 from jsonb_array_elements(registration_rows) r where(r->>'organizationId')::uuid=a.organization_id)
   )select a.* from active a join relevant r on r.player_id=a.player_id order by a.id,a.revision
 loop
   if exists(select 1 from public.contract_session_terms where session_id=s.id and contract_id=candidate.id) then raise exception 'CONTRACT_AMBIGUOUS_VERSION';end if;
   insert into public.contract_session_terms(session_id,contract_id,revision,organization_id,player_id,kind,terms,conditions)
   values(s.id,candidate.id,candidate.revision,candidate.organization_id,candidate.player_id,candidate.kind,candidate.terms,public.contract_event_conditions(candidate.terms,e.id));
 end loop;
end $$;
create or replace function public.contract_session_freeze(p_session uuid) returns void
language sql security definer set search_path=public as $$select public.contract_session_freeze_at(p_session,null)$$;

-- Preserve the pre-change value for every already-started contractual session.
-- If no valuation source changed since its start, that value is still current.
create function public.contract_freeze_due_values(p_limit integer default null) returns integer
language plpgsql security definer set search_path=public as $$
declare due_session record;captured integer:=0;
begin
 if p_limit is not null and p_limit not between 1 and 5000 then raise exception 'CONTRACT_INPUT';end if;
 for due_session in select es.id from public.event_sessions es join public.events e on e.id=es.event_id
   where es.start_time<=clock_timestamp() and es.status<>'cancelled' and e.cancelled_at is null
     and not exists(select 1 from public.contract_session_frames f where f.session_id=es.id)
     and exists(select 1 from public.event_registrations r join public.organization_contracts c on c.organization_id=r.team_id
       join public.contract_agreements a on a.contract_id=c.id
       join public.organization_contract_versions v on v.contract_id=a.contract_id and v.revision=a.revision
       where r.session_id=es.id and r.status='confirmed' and a.signed_at<=es.start_time and a.effective_at<=es.start_time
         and(a.ended_at is null or a.ended_at>es.start_time)
         and(v.terms->>'endsAt' is null or(v.terms->>'endsAt')::timestamptz>es.start_time)
         and(c.kind='main' or(c.event_id=e.id and(c.session_id is null or c.session_id=es.id))))
   order by es.start_time,es.id limit p_limit
 loop perform public.contract_session_freeze(due_session.id);captured:=captured+1;end loop;
 return captured;
end $$;

create or replace function public.contract_maintenance_run() returns jsonb
language plpgsql security definer set search_path=public as $$
declare contract_row record;frozen integer;processed integer:=0;more boolean:=false;outcome jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 -- Historical sessions without effective signed agreements need no financial
 -- snapshot. Bound scheduled catch-up while value changes freeze all relevant
 -- sessions before they can observe a different valuation.
 frozen:=public.contract_freeze_due_values(500);
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
create function public.contract_freeze_before_value_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_table_name='competition_publications' then
   if new.first_published_at is null or new.published is null then return new;end if;
   if tg_op='UPDATE' and new.published is not distinct from old.published then return new;end if;
   perform public.contract_freeze_due_values();
   perform public.contract_session_freeze_at(new.session_id,least(clock_timestamp(),new.first_published_at));
 else perform public.contract_freeze_due_values();end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger contract_publication_freeze before insert or update on public.competition_publications
 for each row execute function public.contract_freeze_before_value_change();
create trigger contract_rating_value_freeze before insert or update or delete on public.competition_ratings
 for each statement execute function public.contract_freeze_before_value_change();
create trigger contract_award_value_freeze before insert or update or delete on public.competition_award_entries
 for each statement execute function public.contract_freeze_before_value_change();
create trigger contract_weight_value_freeze before insert or update or delete on public.rating_event_settings
 for each statement execute function public.contract_freeze_before_value_change();

alter table public.contract_player_claims alter column obligation_id drop not null,
 add column kind text not null default 'return' check(kind in('return','no_show')),
 add column contract_id uuid references public.organization_contracts(id),
 add column revision integer,add column session_id uuid references public.contract_session_frames(session_id),
 add column generation integer not null default 1 check(generation>0),
 add column player_value bigint check(player_value between 0 and 1000000000000),
 add column cancelled_at timestamptz,add column cancelled_by uuid references public.profiles(id),add column cancellation_reason text,
 add constraint contract_claim_source check((kind='return' and obligation_id is not null and session_id is null)
   or(kind='no_show' and obligation_id is null and contract_id is not null and revision is not null and session_id is not null and player_value is not null)),
 add foreign key(contract_id,revision) references public.organization_contract_versions(contract_id,revision),
 add unique(session_id,contract_id,generation);

create function public.contract_player_claim_guard() returns trigger
language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then raise exception 'CONTRACT_IMMUTABLE';end if;
 if row(new.id,new.obligation_id,new.player_id,new.organization_id,new.amount,new.created_at,new.kind,new.contract_id,new.revision,new.session_id,new.generation,new.player_value)
   is distinct from row(old.id,old.obligation_id,old.player_id,old.organization_id,old.amount,old.created_at,old.kind,old.contract_id,old.revision,old.session_id,old.generation,old.player_value)
   or new.recovered<old.recovered then raise exception 'CONTRACT_IMMUTABLE';end if;
 if old.cancelled_at is not null and row(new.cancelled_at,new.cancelled_by,new.cancellation_reason,new.recovered)
   is distinct from row(old.cancelled_at,old.cancelled_by,old.cancellation_reason,old.recovered) then raise exception 'CONTRACT_IMMUTABLE';end if;
 return new;
end $$;
create trigger contract_player_claim_immutable before update or delete on public.contract_player_claims
 for each row execute function public.contract_player_claim_guard();

create or replace function public.contract_player_has_debt(p_player uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.contract_player_claims where player_id=p_player and recovered<amount and cancelled_at is null)
$$;
do $$declare d text;begin
 d:=pg_get_functiondef('public.contract_recover_player_claims(uuid)'::regprocedure);
 d:=replace(d,'where player_id=p_player and recovered<amount order by','where player_id=p_player and recovered<amount and cancelled_at is null order by');
 d:=replace(d,'''Возврат отменённой выплаты организации''','case when c.kind=''no_show'' then ''Погашение штрафа за неявку'' else ''Возврат отменённой выплаты организации'' end');
 execute d;
 d:=pg_get_functiondef('public.contract_player_debt_summary(uuid)'::regprocedure);
 execute replace(d,'where player_id=p_actor;','where player_id=p_actor and cancelled_at is null;');
end $$;

alter table public.contract_obligations drop constraint contract_obligations_kind_check;
alter table public.contract_obligations add constraint contract_obligations_kind_check
 check(kind in('signing','salary','appearance','kill','mvp','ranking','termination','fine_refund'));
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_obligation_create(uuid,integer,text,text,bigint,timestamptz,boolean)'::regprocedure);
 needle:='''signing'',''salary'',''appearance'',''kill'',''mvp'',''ranking'',''termination''';
 if position(needle in d)=0 then raise exception 'CONTRACT_FINE_KIND_PATCH';end if;
 execute replace(d,needle,needle||',''fine_refund''');
 d:=pg_get_functiondef('public.contract_obligation_cancel_internal(uuid,uuid,uuid,text)'::regprocedure);
 needle:='payload:=jsonb_build_object(''obligationId'',p_obligation,''reason'',trim(p_reason));';
 if position(needle in d)=0 then raise exception 'CONTRACT_FINE_REFUND_PATCH';end if;
 execute replace(d,needle,'if o.kind=''fine_refund'' then raise exception ''CONTRACT_SYSTEM_REFUND'';end if; '||needle);
end $$;

-- A missing personal result is not proof of absence. A team that played must
-- have a complete personal kill total before automatic fines are considered.
alter function public.contract_session_no_show_assessment(uuid,uuid,bigint) rename to contract_no_show_assessment_before_complete;
create function public.contract_session_no_show_assessment(p_session uuid,p_contract uuid,p_player_value bigint) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare answer jsonb;t public.contract_session_terms%rowtype;row jsonb;players jsonb;sum_kills numeric;
begin
 answer:=public.contract_no_show_assessment_before_complete(p_session,p_contract,p_player_value);
 if answer->>'applies' is distinct from 'true' then return answer;end if;
 select * into strict t from public.contract_session_terms where session_id=p_session and contract_id=p_contract;
 for row in select r from public.competition_publications cp cross join lateral jsonb_array_elements(cp.published->'rows') r
   where cp.session_id=p_session and r->>'teamId'=t.organization_id::text and r->>'played'='true'
 loop
   players:=row->'players';
   if jsonb_typeof(players) is distinct from 'array' or not exists(select 1 from jsonb_array_elements(players) p where p->>'played'='true')
     or exists(select 1 from jsonb_array_elements(players) p where p->>'played'='true' and(jsonb_typeof(p->'kills') is distinct from 'number' or(p->>'kills')!~'^\d+$'))
   then return jsonb_build_object('ready',false,'applies',false,'amount',0,'reason','incomplete_player_statistics');end if;
   select coalesce(sum((p->>'kills')::numeric),0) into sum_kills from jsonb_array_elements(players) p where p->>'played'='true';
   if jsonb_typeof(row->'kills') is distinct from 'number' or sum_kills<>(row->>'kills')::numeric then
     return jsonb_build_object('ready',false,'applies',false,'amount',0,'reason','incomplete_player_statistics');
   end if;
 end loop;
 return answer;
end $$;

create function public.contract_no_show_cancel_internal(p_actor uuid,p_request uuid,p_claim uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare claim public.contract_player_claims%rowtype;previous public.coin_operations%rowtype;payload jsonb;answer jsonb;refund uuid;funded boolean;paid bigint:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_request is null or p_reason is null or length(trim(p_reason)) not between 3 and 1000 then raise exception 'CONTRACT_INPUT';end if;
 select * into claim from public.contract_player_claims where id=p_claim and kind='no_show' for update;
 if not found then raise exception 'CONTRACT_NOT_FOUND';end if;
 if p_actor is not null and not coalesce(public.is_organization_owner(claim.organization_id,p_actor),false) then raise exception 'CONTRACT_OWNER';end if;
 payload:=jsonb_build_object('claimId',p_claim,'reason',trim(p_reason));
 select * into previous from public.coin_operations where id=p_request;
 if found then
   if previous.actor_id is distinct from p_actor or previous.action<>'contract_fine_cancel' or previous.input<>payload then raise exception 'CONTRACT_CONFLICT';end if;
   return previous.result;
 end if;
 if claim.cancelled_at is not null then raise exception 'CONTRACT_CANCELLED';end if;
 insert into public.coin_operations(id,actor_id,action,input,description) values(p_request,p_actor,'contract_fine_cancel',payload,'Отмена штрафа за неявку: '||trim(p_reason));
 update public.contract_player_claims set cancelled_at=clock_timestamp(),cancelled_by=p_actor,cancellation_reason=trim(p_reason) where id=claim.id;
 if claim.recovered>0 then
   funded:=exists(select 1 from public.coin_accounts where team_id=claim.organization_id and balance-reserved>=claim.recovered);
   refund:=public.contract_obligation_create(claim.contract_id,claim.revision,'fine_refund','fine-refund:'||claim.id,claim.recovered,clock_timestamp(),funded);
   if funded then
     perform public.contract_obligation_pay(null,gen_random_uuid(),refund,claim.recovered,true);paid:=claim.recovered;
   end if;
 end if;
 answer:=jsonb_build_object('success',true,'claimId',claim.id,'cancelledDebt',claim.amount-claim.recovered,'refundAmount',claim.recovered,'refunded',paid,'refundDebt',claim.recovered-paid);
 update public.coin_operations set result=answer where id=p_request;
 return answer;
end $$;
create function public.contract_no_show_cancel(p_actor uuid,p_request uuid,p_claim uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if p_actor is null then raise exception 'CONTRACT_AUTH';end if;
 return public.contract_no_show_cancel_internal(p_actor,p_request,p_claim,p_reason);
end $$;

create function public.contract_session_fine_settle(p_session uuid,p_contract uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare t public.contract_session_terms%rowtype;assessment jsonb;price bigint;expected bigint;claim public.contract_player_claims%rowtype;next_generation integer;claim_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into t from public.contract_session_terms where session_id=p_session and contract_id=p_contract;
 if not found then raise exception 'CONTRACT_NOT_FOUND';end if;
 if t.terms->'limit' is not null and t.terms->'limit'<>'null'::jsonb then return jsonb_build_object('ready',false,'reason','participation_limit_pending');end if;
 select value into price from public.contract_session_valuations where session_id=p_session and player_id=t.player_id;
 if price is null then return jsonb_build_object('ready',false,'reason','valuation_snapshot_missing');end if;
 assessment:=public.contract_session_no_show_assessment(p_session,p_contract,price);
 if assessment->>'ready' is distinct from 'true' then return assessment;end if;
 expected:=case when assessment->>'applies'='true' then(assessment->>'amount')::bigint else 0 end;
 if exists(select 1 from public.contract_player_claims where session_id=p_session and contract_id=p_contract and kind='no_show' and cancelled_by is not null)
 then return jsonb_build_object('ready',true,'ownerCancelled',true);end if;
 select * into claim from public.contract_player_claims where session_id=p_session and contract_id=p_contract and kind='no_show' and cancelled_at is null order by generation desc limit 1 for update;
 if claim.id is not null and claim.amount=expected then return jsonb_build_object('ready',true,'unchanged',true,'claimId',claim.id);end if;
 if claim.id is not null then perform public.contract_no_show_cancel_internal(null,gen_random_uuid(),claim.id,'Исправление опубликованных результатов сессии');end if;
 if expected=0 then return jsonb_build_object('ready',true,'amount',0);end if;
 select coalesce(max(generation),0)+1 into next_generation from public.contract_player_claims where session_id=p_session and contract_id=p_contract and kind='no_show';
 insert into public.contract_player_claims(player_id,organization_id,amount,kind,contract_id,revision,session_id,generation,player_value)
 values(t.player_id,t.organization_id,expected,'no_show',p_contract,t.revision,p_session,next_generation,price) returning id into claim_id;
 perform public.contract_recover_player_claims(t.player_id);
 return jsonb_build_object('ready',true,'amount',expected,'claimId',claim_id);
end $$;

create function public.contract_fine_query(p_actor uuid,p_contract uuid,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;rows_json jsonb;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'CONTRACT_AUTH';end if;
 if p_offset is null or p_offset not between 0 and 1000000 then raise exception 'CONTRACT_INPUT';end if;
 select * into c from public.organization_contracts where id=p_contract;
 if c.id is null or not(coalesce(public.can_manage_organization_contracts(c.organization_id,p_actor),false) or(c.player_id=p_actor and exists(
   select 1 from public.organization_contract_versions where contract_id=c.id and offered_at is not null))) then raise exception 'CONTRACT_NOT_FOUND';end if;
 select coalesce(jsonb_agg(to_jsonb(row_data)),'[]') into rows_json from(
   select claim.id,claim.revision,claim.amount,claim.recovered as paid,
     case when claim.cancelled_at is null then claim.amount-claim.recovered else 0 end remaining,
     claim.player_value as "playerValue",claim.created_at as "createdAt",claim.cancelled_at as "cancelledAt",claim.cancellation_reason as "cancellationReason",
     frame.event_id as "eventId",e.title as "eventTitle",frame.cutoff_at as "sessionStart",
     coalesce(refund.amount,0) as "refundAmount",coalesce(refund.paid,0) as refunded,
     coalesce(refund.amount-refund.paid,0) as "refundDebt"
   from public.contract_player_claims claim join public.contract_session_frames frame on frame.session_id=claim.session_id
   join public.events e on e.id=frame.event_id
   left join public.contract_obligations refund on refund.contract_id=claim.contract_id and refund.kind='fine_refund' and refund.source_key='fine-refund:'||claim.id
   where claim.contract_id=c.id and claim.kind='no_show' order by claim.created_at desc,claim.id desc limit 31 offset p_offset
 ) row_data;
 return jsonb_build_object('fines',coalesce((select jsonb_agg(value order by n) from jsonb_array_elements(rows_json) with ordinality a(value,n) where n<=30),'[]'::jsonb),
   'hasMore',jsonb_array_length(rows_json)>30,'canCancel',coalesce(public.is_organization_owner(c.organization_id,p_actor),false));
end $$;

create or replace function public.contract_session_publish_settle(p_session uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare publication public.competition_publications%rowtype;entry record;result jsonb;fine_result jsonb;summary jsonb:='[]';count_applied integer:=0;
begin
 if p_session is null then raise exception 'CONTRACT_EVENT';end if;
 select * into publication from public.competition_publications where session_id=p_session;
 if publication.session_id is null or publication.first_published_at is null or publication.published is null then
   return jsonb_build_object('ready',false,'reason','unpublished','settled',0,'details','[]'::jsonb);
 end if;
 perform public.contract_session_freeze(p_session);
 for entry in select contract_id from public.contract_session_terms where session_id=p_session order by contract_id loop
   result:=public.contract_session_settle(p_session,entry.contract_id);
   fine_result:=public.contract_session_fine_settle(p_session,entry.contract_id);
   summary:=summary||jsonb_build_array(jsonb_build_object('contractId',entry.contract_id,'result',result,'fine',fine_result));
   if coalesce((result->>'applied')::boolean,false) then count_applied:=count_applied+1;end if;
 end loop;
 return jsonb_build_object('ready',true,'settled',count_applied,'details',summary);
end $$;
create function public.contract_cancelled_event_settle() returns trigger
language plpgsql security definer set search_path=public as $$
declare frame record;
begin
 if tg_table_name='event_sessions' then
   if new.status='cancelled' and old.status is distinct from new.status and exists(select 1 from public.contract_session_frames where session_id=new.id) then
     perform public.contract_session_publish_settle(new.id);
   end if;
 elsif new.cancelled_at is not null and old.cancelled_at is null then
   for frame in select session_id from public.contract_session_frames where event_id=new.id order by session_id loop
     perform public.contract_session_publish_settle(frame.session_id);
   end loop;
 end if;
 return new;
end $$;
create trigger contract_cancelled_session_settle after update of status on public.event_sessions
 for each row execute function public.contract_cancelled_event_settle();
create trigger contract_cancelled_event_settle after update of cancelled_at on public.events
 for each row execute function public.contract_cancelled_event_settle();

revoke all on function public.contract_session_freeze_at(uuid,timestamptz),public.contract_freeze_due_values(integer),public.contract_freeze_before_value_change(),
 public.contract_no_show_cancel_internal(uuid,uuid,uuid,text),public.contract_no_show_cancel(uuid,uuid,uuid,text),
 public.contract_session_fine_settle(uuid,uuid),public.contract_fine_query(uuid,uuid,integer),public.contract_cancelled_event_settle(),public.contract_player_claim_guard()
 ,public.contract_session_no_show_assessment(uuid,uuid,bigint),public.contract_no_show_assessment_before_complete(uuid,uuid,bigint)
 from public,anon,authenticated,service_role;
grant execute on function public.contract_no_show_cancel(uuid,uuid,uuid,text),public.contract_fine_query(uuid,uuid,integer) to service_role;
commit;
