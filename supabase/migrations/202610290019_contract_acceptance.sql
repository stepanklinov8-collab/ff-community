-- Bilateral acceptance of a specific immutable main-contract revision.
-- Guest approvals remain a separate, explicitly gated flow.
begin;
create table public.contract_signatures(
 contract_id uuid not null,
 revision integer not null,
 party text not null check(party in('organization','player')),
 signed_by uuid not null references public.profiles(id),
 ownership_revision bigint not null check(ownership_revision>=0),
 signed_at timestamptz not null default clock_timestamp() check(isfinite(signed_at)),
 primary key(contract_id,revision,party),
 foreign key(contract_id,revision) references public.organization_contract_versions(contract_id,revision)
);
create function public.contract_signature_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op<>'INSERT' then raise exception 'CONTRACT_IMMUTABLE';end if;
 return new;
end $$;
create trigger contract_signature_immutable before update or delete on public.contract_signatures
 for each row execute function public.contract_signature_guard();
alter table public.contract_signatures enable row level security;
revoke all on public.contract_signatures from public,anon,authenticated,service_role;

-- Offering a version is the organization's recorded signature. It is taken
-- from the authenticated sender, never from caller-supplied JSON.
do $$ declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_mutate(uuid,jsonb)'::regprocedure);
 needle:='c public.organization_contracts%rowtype; v public.organization_contract_versions%rowtype;';
 if position(needle in d)=0 then raise exception 'CONTRACT_ACCEPT_DECLARATION_PATCH';end if;
 d:=replace(d,needle,needle||' sig public.contract_signatures%rowtype; effective_value timestamptz; signed_value timestamptz; old_schedule record;');
 needle:='update public.organization_contract_versions set status=''offered'',offered_at=clock_timestamp() where contract_id=c.id and revision=c.current_revision;';
 if position(needle in d)=0 then raise exception 'CONTRACT_OFFER_SIGNATURE_PATCH';end if;
 d:=replace(d,needle,needle||E'\n     insert into public.contract_signatures(contract_id,revision,party,signed_by,ownership_revision)\n       select c.id,c.current_revision,''organization'',p_actor,t.ownership_revision from public.teams t where t.id=c.organization_id;');
 needle:='if not public.can_manage_organization_contracts(c.organization_id,p_actor) then raise exception ''CONTRACT_FORBIDDEN'';end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_SIGNED_CANCEL_PATCH';end if;
 d:=replace(d,needle,needle||E'\n     if exists(select 1 from public.contract_agreements where contract_id=c.id and revision=c.current_revision) then raise exception ''CONTRACT_STATE'';end if;');
 needle:='if c.player_id<>p_actor then raise exception ''CONTRACT_FORBIDDEN'';end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_ACCEPT_PATCH';end if;
 d:=replace(d,needle,needle||E'\n     if exists(select 1 from public.contract_agreements where contract_id=c.id and revision=c.current_revision) then raise exception ''CONTRACT_STATE'';end if;');
 needle:='elsif action=''reject'' then';
 if position(needle in d)=0 then raise exception 'CONTRACT_ACCEPT_BRANCH_PATCH';end if;
 execute replace(d,needle,$branch$elsif action='accept' then
     if c.player_id<>p_actor then raise exception 'CONTRACT_FORBIDDEN';end if;
     if v.status<>'offered' then raise exception 'CONTRACT_STATE';end if;
     -- The first release supports ordinary roster contracts. A guest agreement
     -- also needs an independent home-organization approval and event roster
     -- admission; never let acceptance here silently bypass either check.
     if c.kind='guest' then raise exception 'CONTRACT_GUEST_FLOW';end if;
     if not exists(select 1 from public.team_members where team_id=c.organization_id and user_id=c.player_id) then raise exception 'CONTRACT_MEMBER';end if;
     if exists(select 1 from public.contract_agreements a join public.organization_contracts oldc on oldc.id=a.contract_id
       join public.organization_contract_versions oldv on oldv.contract_id=a.contract_id and oldv.revision=a.revision
       where oldc.id<>c.id and oldc.organization_id=c.organization_id and oldc.player_id=c.player_id
         and oldc.kind='main' and (a.ended_at is null or a.ended_at>greatest(clock_timestamp(),(v.terms->>'startsAt')::timestamptz))
         and (oldv.terms->>'endsAt' is null or (oldv.terms->>'endsAt')::timestamptz>greatest(clock_timestamp(),(v.terms->>'startsAt')::timestamptz))
         and a.effective_at<coalesce((v.terms->>'endsAt')::timestamptz,'infinity'::timestamptz)) then raise exception 'CONTRACT_ALREADY_ACTIVE';end if;
     select * into sig from public.contract_signatures where contract_id=c.id and revision=c.current_revision and party='organization';
     if sig.contract_id is null or sig.ownership_revision<>(select ownership_revision from public.teams where id=c.organization_id)
       or not public.organization_can_spend(c.organization_id,sig.signed_by) then raise exception 'CONTRACT_SIGNATURE_STALE';end if;
     effective_value:=greatest(clock_timestamp(),(v.terms->>'startsAt')::timestamptz);
     if (v.terms->>'endsAt')::timestamptz<=effective_value then raise exception 'CONTRACT_DATES';end if;
     insert into public.contract_signatures(contract_id,revision,party,signed_by,ownership_revision)
       values(c.id,c.current_revision,'player',p_actor,sig.ownership_revision);
     signed_value:=greatest(sig.signed_at,clock_timestamp());
     effective_value:=greatest(effective_value,signed_value);
     for old_schedule in
       select distinct oldc.id contract_id,ss.revision from public.contract_agreements a
       join public.organization_contracts oldc on oldc.id=a.contract_id
       join public.contract_salary_schedules ss on ss.contract_id=a.contract_id and ss.revision=a.revision
       join public.organization_contract_versions oldv on oldv.contract_id=a.contract_id and oldv.revision=a.revision
       where oldc.organization_id=c.organization_id and oldc.player_id=c.player_id and oldc.kind='main'
         and (oldc.id<>c.id or a.revision<>c.current_revision)
         and (a.ended_at is null or a.ended_at>effective_value)
         and (oldv.terms->>'endsAt' is null or (oldv.terms->>'endsAt')::timestamptz>effective_value)
     loop
       perform public.contract_salary_schedule_close(old_schedule.contract_id,old_schedule.revision,effective_value,'Обновление договора');
     end loop;
     update public.contract_agreements a set ended_at=effective_value,end_reason='Обновление договора'
       from public.organization_contracts oldc where oldc.id=a.contract_id and oldc.organization_id=c.organization_id
       and oldc.player_id=c.player_id and oldc.kind='main' and (a.ended_at is null or a.ended_at>effective_value)
       and (oldc.id<>c.id or a.revision<>c.current_revision);
     insert into public.contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at)
       values(c.id,c.current_revision,sig.signed_by,p_actor,sig.ownership_revision,signed_value,effective_value);
     perform public.contract_financial_start(c.id,c.current_revision,effective_value);
     response:=jsonb_build_object('contractId',c.id,'revision',c.current_revision,'status','signed','effectiveAt',effective_value);
   $branch$||needle);
end $$;

-- The successful bilateral signature is reflected in the private list query.
do $$ declare d text;needle text;begin
 d:=pg_get_functiondef('public.contract_query(uuid,jsonb)'::regprocedure);
 needle:='c.kind,c.event_id as "eventId",c.session_id as "sessionId",e.title as "eventTitle",v.revision,v.status,v.terms,c.created_at as "createdAt",';
 if position(needle in d)=0 then raise exception 'CONTRACT_SIGNED_QUERY_PATCH';end if;
 execute replace(d,needle,'c.kind,c.event_id as "eventId",c.session_id as "sessionId",e.title as "eventTitle",v.revision,'||
   'case when exists(select 1 from public.contract_agreements a where a.contract_id=c.id and a.revision=v.revision) then ''signed'' else v.status end as status,v.terms,c.created_at as "createdAt",');
 d:=pg_get_functiondef('public.contract_history(uuid,uuid,integer)'::regprocedure);
 needle:='select revision,status,terms,created_at as "createdAt",offered_at as "offeredAt",responded_at as "respondedAt"';
 if position(needle in d)=0 then raise exception 'CONTRACT_SIGNED_HISTORY_PATCH';end if;
 execute replace(d,needle,'select revision,case when exists(select 1 from public.contract_agreements a where a.contract_id=public.organization_contract_versions.contract_id and a.revision=public.organization_contract_versions.revision) then ''signed'' else status end as status,terms,created_at as "createdAt",offered_at as "offeredAt",responded_at as "respondedAt"');
end $$;
revoke all on function public.contract_signature_guard() from public,anon,authenticated,service_role;
commit;
