-- Fixed tournament fees use the signed clause effective BEFORE the whole
-- tournament begins, even if that agreement is renewed between stages.
begin;
create table public.contract_tournament_frames(
 event_id uuid primary key references public.events(id),cutoff_at timestamptz not null,
 captured_at timestamptz not null default clock_timestamp()
);
create table public.contract_tournament_terms(
 event_id uuid not null references public.contract_tournament_frames(event_id),
 contract_id uuid not null,revision integer not null,
 organization_id uuid not null references public.teams(id),player_id uuid not null references public.profiles(id),
 terms jsonb not null,conditions jsonb not null,
 primary key(event_id,contract_id),foreign key(contract_id,revision) references public.contract_agreements(contract_id,revision)
);
create table public.contract_tournament_payment_runs(
 id uuid primary key default gen_random_uuid(),event_id uuid not null,contract_id uuid not null,plan jsonb not null,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(event_id,contract_id) references public.contract_tournament_terms(event_id,contract_id)
);
create index contract_tournament_runs_latest on public.contract_tournament_payment_runs(event_id,contract_id,created_at desc,id);
create table public.contract_tournament_charges(
 event_id uuid not null,contract_id uuid not null,generation integer not null check(generation>0),
 obligation_id uuid not null unique references public.contract_obligations(id),run_id uuid not null references public.contract_tournament_payment_runs(id),
 primary key(event_id,contract_id,generation),foreign key(event_id,contract_id) references public.contract_tournament_terms(event_id,contract_id)
);
create table public.contract_tournament_jobs(
 event_id uuid primary key references public.contract_tournament_frames(event_id),checked_at timestamptz
);
alter table public.contract_tournament_frames enable row level security;
alter table public.contract_tournament_terms enable row level security;
alter table public.contract_tournament_payment_runs enable row level security;
alter table public.contract_tournament_charges enable row level security;
alter table public.contract_tournament_jobs enable row level security;
revoke all on public.contract_tournament_frames,public.contract_tournament_terms,public.contract_tournament_payment_runs,public.contract_tournament_charges,public.contract_tournament_jobs from public,anon,authenticated,service_role;
create trigger contract_tournament_frame_immutable before update or delete on public.contract_tournament_frames for each row execute function public.contract_frozen_guard();
create trigger contract_tournament_terms_immutable before update or delete on public.contract_tournament_terms for each row execute function public.contract_frozen_guard();
create trigger contract_tournament_run_immutable before update or delete on public.contract_tournament_payment_runs for each row execute function public.contract_frozen_guard();
create trigger contract_tournament_charge_immutable before update or delete on public.contract_tournament_charges for each row execute function public.contract_frozen_guard();

create function public.contract_tournament_freeze(p_event uuid) returns void
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype;cutoff timestamptz;candidate record;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into e from public.events where id=p_event;
 if e.id is null or e.type<>'tournament' or e.cancelled_at is not null then return;end if;
 select cutoff_at into cutoff from public.contract_tournament_frames where event_id=e.id;
 if not found then
   select least(min(s.start_time),min(cp.first_published_at)) into cutoff from public.event_sessions s
     left join public.competition_publications cp on cp.session_id=s.id where s.event_id=e.id and s.status<>'cancelled';
   if cutoff is null or cutoff>clock_timestamp() then return;end if;
   insert into public.contract_tournament_frames(event_id,cutoff_at) values(e.id,cutoff);
   insert into public.contract_tournament_jobs(event_id) values(e.id);
 end if;
 -- Later entrants may be inspected later, but their terms must already have
 -- been bilaterally signed and effective at the original tournament cutoff.
 for candidate in select c.id,c.organization_id,c.player_id,a.revision,v.terms from public.contract_agreements a
   join public.organization_contracts c on c.id=a.contract_id join public.organization_contract_versions v on v.contract_id=a.contract_id and v.revision=a.revision
   where c.kind='main' and a.signed_at<=cutoff and a.effective_at<=cutoff
     and(public.contract_effective_end(a.contract_id,a.revision) is null or public.contract_effective_end(a.contract_id,a.revision)>cutoff)
     and exists(select 1 from public.event_registrations r where r.event_id=e.id and r.team_id=c.organization_id and r.status='confirmed')
   order by c.id,a.revision
 loop
   if exists(select 1 from public.contract_tournament_terms t where t.event_id=e.id and t.contract_id=candidate.id and t.revision<>candidate.revision) then raise exception 'CONTRACT_AMBIGUOUS_VERSION';end if;
   insert into public.contract_tournament_terms(event_id,contract_id,revision,organization_id,player_id,terms,conditions)
   values(e.id,candidate.id,candidate.revision,candidate.organization_id,candidate.player_id,candidate.terms,public.contract_event_conditions(candidate.terms,e.id)) on conflict do nothing;
 end loop;
end $$;
create function public.contract_tournament_freeze_before_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op<>'INSERT' then perform public.contract_tournament_freeze(old.event_id);end if;
 if tg_op<>'DELETE' then perform public.contract_tournament_freeze(new.event_id);return new;end if;
 return old;
end $$;
create trigger contract_tournament_schedule_freeze before insert or update or delete on public.event_sessions
 for each row execute function public.contract_tournament_freeze_before_change();
create trigger contract_tournament_roster_freeze before insert or update or delete on public.event_registrations
 for each row execute function public.contract_tournament_freeze_before_change();
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_session_freeze_at(uuid,timestamptz)'::regprocedure);
 needle:='select * into strict e from public.events where id=s.event_id;';
 if position(needle in d)=0 then raise exception 'CONTRACT_TOURNAMENT_FRAME_HOOK_PATCH';end if;
 execute replace(d,needle,needle||' perform public.contract_tournament_freeze(e.id);');
end $$;

create function public.contract_tournament_accrual_plan(p_event uuid,p_contract uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare anchor public.contract_tournament_terms%rowtype;completion jsonb;entry record;plan jsonb;registered boolean;
 played integer:=0;total integer:=0;mode text;eligible boolean;amount bigint:=0;rate bigint;
begin
 select * into anchor from public.contract_tournament_terms where event_id=p_event and contract_id=p_contract;
 if not found then raise exception 'CONTRACT_NOT_FOUND';end if;
 completion:=public.contract_tournament_completion(p_event);
 if completion->>'ready' is distinct from 'true' then return completion;end if;
 if completion->>'cancelled'='true' then return jsonb_build_object('ready',true,'cancelled',true,'amount',0,'revision',anchor.revision);end if;
 for entry in select f.*,t.terms from public.contract_session_terms t join public.contract_session_frames f on f.session_id=t.session_id
   where f.event_id=p_event and t.contract_id=p_contract order by f.cutoff_at,f.session_id
 loop
   if entry.terms->'limit'->>'unit'='tournaments' then plan:=public.contract_session_raw_accrual_plan(entry.session_id,p_contract);
   else plan:=public.contract_session_accrual_plan(entry.session_id,p_contract);end if;
   if plan->>'cancelled'='true' then continue;end if;
   select exists(select 1 from jsonb_array_elements(entry.registrations) r cross join lateral jsonb_array_elements(coalesce(r->'roster','[]')) p
     where r->>'organizationId'=anchor.organization_id::text
       and case when jsonb_typeof(p)='string' then p#>>'{}' when p?'userId' then p->>'userId' else p->>'id' end=anchor.player_id::text) into registered;
   if not registered and coalesce((plan->>'playedGames')::integer,0)=0 then continue;end if;
   if plan->>'ready' is distinct from 'true' then return jsonb_build_object('ready',false,'reason',coalesce(plan->>'reason','incomplete_player_statistics'));end if;
   if plan->>'limitIncluded'='false' then continue;end if;
   played:=played+coalesce((plan->>'playedGames')::integer,0);total:=total+coalesce((plan->>'totalGames')::integer,0);
 end loop;
 mode:=anchor.terms->'participation'->>'mode';
 eligible:=played>0 and not(mode='minimum' and played<(anchor.terms->'participation'->>'games')::integer);
 rate:=(anchor.conditions->>'perTournament')::bigint;
 if eligible then amount:=case when mode='proportional' then floor(rate::numeric*played/nullif(total,0))::bigint else rate end;end if;
 return jsonb_build_object('ready',true,'cancelled',false,'eventId',p_event,'contractId',p_contract,'revision',anchor.revision,'eligible',eligible,
   'amount',amount,'playedGames',played,'totalGames',total,'rate',rate,'endsAt',completion->'endsAt','finalSessionId',completion->'finalSessionId');
end $$;

create function public.contract_tournament_settle(p_event uuid,p_contract uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare anchor public.contract_tournament_terms%rowtype;plan jsonb;previous public.contract_tournament_payment_runs%rowtype;
 expected bigint;active_total bigint;due timestamptz;original_due timestamptz;obligation public.contract_obligations%rowtype;run uuid;created uuid;generation integer;funded boolean;delta bigint;
 decreasing boolean:=false;previous_funding bigint:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 plan:=public.contract_tournament_accrual_plan(p_event,p_contract);
 if plan->>'ready' is distinct from 'true' then return plan||jsonb_build_object('applied',false);end if;
 select * into strict anchor from public.contract_tournament_terms where event_id=p_event and contract_id=p_contract;
 select * into previous from public.contract_tournament_payment_runs where event_id=p_event and contract_id=p_contract order by created_at desc,id desc limit 1;
 if previous.id is not null and previous.plan=plan then return jsonb_build_object('ready',true,'applied',true,'unchanged',true);end if;
 expected:=(plan->>'amount')::bigint;due:=clock_timestamp();
 insert into public.contract_tournament_payment_runs(event_id,contract_id,plan) values(p_event,p_contract,plan) returning id into run;
 if exists(select 1 from public.contract_tournament_charges charge join public.contract_obligations o on o.id=charge.obligation_id
   where charge.event_id=p_event and charge.contract_id=p_contract and o.cancelled_by is not null) then return jsonb_build_object('ready',true,'applied',true,'ownerCancelled',true);end if;
 select coalesce(sum(o.amount),0),min(o.due_at) into active_total,original_due from public.contract_tournament_charges charge join public.contract_obligations o on o.id=charge.obligation_id
 where charge.event_id=p_event and charge.contract_id=p_contract and o.cancelled_at is null;
 if active_total>expected then
   decreasing:=true;
   for obligation in select o.* from public.contract_tournament_charges charge join public.contract_obligations o on o.id=charge.obligation_id
     where charge.event_id=p_event and charge.contract_id=p_contract and o.cancelled_at is null order by charge.generation desc for update of o
   loop
     exit when active_total<=expected;
     perform public.contract_obligation_cancel_internal(null,gen_random_uuid(),obligation.id,'Исправление подтверждённого участия в турнире');
     previous_funding:=previous_funding+obligation.paid+obligation.held;
     active_total:=active_total-obligation.amount;
   end loop;
   due:=coalesce(original_due,due);
 end if;
 delta:=expected-active_total;
 if delta<=0 then return jsonb_build_object('ready',true,'applied',true,'created',0);end if;
 select coalesce(max(charge.generation),0)+1 into generation from public.contract_tournament_charges charge where charge.event_id=p_event and charge.contract_id=p_contract;
 funded:=(not decreasing or previous_funding>=delta) and exists(select 1 from public.coin_accounts where team_id=anchor.organization_id and balance-reserved>=delta);
 created:=public.contract_obligation_create(p_contract,anchor.revision,'appearance','tournament:'||p_event||':generation:'||generation,delta,due,funded);
 insert into public.contract_tournament_charges(event_id,contract_id,generation,obligation_id,run_id) values(p_event,p_contract,generation,created,run);
 if funded then perform public.contract_obligation_pay(null,gen_random_uuid(),created,delta,true);end if;
 return jsonb_build_object('ready',true,'applied',true,'created',1,'paid',case when funded then delta else 0 end,'amount',expected);
end $$;

create function public.contract_tournament_settle_all(p_event uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare participant record;result jsonb;applied integer:=0;
begin
 perform public.contract_tournament_freeze(p_event);
 for participant in select contract_id from public.contract_tournament_terms where event_id=p_event order by contract_id loop
   result:=public.contract_tournament_settle(p_event,participant.contract_id);
   if result->>'applied'='true' then applied:=applied+1;end if;
 end loop;
 update public.contract_tournament_jobs set checked_at=clock_timestamp() where event_id=p_event;
 return jsonb_build_object('processed',applied);
end $$;
alter function public.contract_session_publish_settle(uuid) rename to contract_session_settle_before_tournament;
create function public.contract_session_publish_settle(p_session uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;event_id_value uuid;
begin
 result:=public.contract_session_settle_before_tournament(p_session);
 select event_id into event_id_value from public.event_sessions where id=p_session;
 if event_id_value is not null then result:=result||jsonb_build_object('tournament',public.contract_tournament_settle_all(event_id_value));end if;
 return result;
end $$;
alter function public.contract_maintenance_run() rename to contract_maintenance_before_tournament;
create function public.contract_maintenance_run() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;job record;processed integer:=0;
begin
 result:=public.contract_maintenance_before_tournament();
 for job in select event_id from public.contract_tournament_jobs order by checked_at nulls first,event_id limit 100 for update loop
   perform public.contract_tournament_settle_all(job.event_id);processed:=processed+1;
 end loop;
 return result||jsonb_build_object('checkedTournaments',processed);
end $$;
do $$declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_obligation_query(uuid,uuid,integer)'::regprocedure);
 needle:='o.id,o.revision,o.kind,o.amount,o.paid,o.held,';
 if position(needle in d)=0 then raise exception 'CONTRACT_TOURNAMENT_PAYMENT_LABEL_PATCH';end if;
 execute replace(d,needle,'o.id,o.revision,o.kind,case when o.kind=''appearance'' and o.source_key like ''tournament:%'' then ''tournament'' else null end as scope,o.amount,o.paid,o.held,');
end $$;
revoke all on function public.contract_tournament_freeze(uuid),public.contract_tournament_freeze_before_change(),public.contract_tournament_accrual_plan(uuid,uuid),
 public.contract_tournament_settle(uuid,uuid),public.contract_tournament_settle_all(uuid),public.contract_session_settle_before_tournament(uuid),
 public.contract_session_publish_settle(uuid),public.contract_maintenance_before_tournament(),public.contract_maintenance_run()
 from public,anon,authenticated,service_role;
grant execute on function public.contract_maintenance_run() to service_role;
commit;
