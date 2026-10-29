-- UNFINISHED: not an executable release migration. Adapt to constructor v2 first.
begin;
alter table public.organization_contract_versions
 add column offered_by uuid references public.profiles(id),
 add column offered_ownership_revision bigint;
alter table public.organization_contract_versions drop constraint organization_contract_versions_status_check;
alter table public.organization_contract_versions add constraint organization_contract_versions_status_check
 check(status in('draft','offered','cancelled','rejected','superseded','signed'));

create table public.contract_agreements(
 contract_id uuid not null,
 revision integer not null,
 organization_signer uuid not null references public.profiles(id),
 player_signer uuid not null references public.profiles(id),
 ownership_revision bigint not null,
 signed_at timestamptz not null,
 effective_at timestamptz not null,
 ended_at timestamptz,
 end_reason text,
 primary key(contract_id,revision),
 foreign key(contract_id,revision) references public.organization_contract_versions(contract_id,revision),
 check(effective_at>=signed_at)
);
create index contract_agreements_effective on public.contract_agreements(effective_at,contract_id);
create table public.contract_termination_requests(
 id uuid primary key,
 contract_id uuid not null,
 revision integer not null,
 initiated_by uuid not null references public.profiles(id),
 side text not null check(side in('player','organization')),
 mode text not null check(mode in('compensated','mutual')),
 status text not null default 'pending' check(status in('pending','completed','cancelled','superseded')),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 foreign key(contract_id,revision) references public.contract_agreements(contract_id,revision)
);
create unique index contract_termination_pending on public.contract_termination_requests(contract_id) where status='pending';
alter table public.contract_agreements enable row level security;
alter table public.contract_termination_requests enable row level security;
revoke all on public.contract_agreements,public.contract_termination_requests from public,anon,authenticated;
grant select,insert,update on public.contract_agreements,public.contract_termination_requests to service_role;

create function public.contract_agreement_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if new.contract_id<>old.contract_id or new.revision<>old.revision or new.organization_signer<>old.organization_signer
 or new.player_signer<>old.player_signer or new.signed_at<>old.signed_at or new.effective_at<>old.effective_at
 or new.ownership_revision<>old.ownership_revision or (old.ended_at is not null and (new.ended_at is null or new.ended_at>old.ended_at)) then raise exception 'CONTRACT_IMMUTABLE';end if;
 return new;
end $$;
create trigger contract_agreement_immutable before update on public.contract_agreements for each row execute function public.contract_agreement_guard();

-- Facts are derived from the current confirmed publication, so correcting a
-- result cannot count the same game/session/tournament twice.
create function public.contract_participation(p_contract uuid)
returns table(session_id uuid,event_id uuid,game_id uuid,event_type text,starts_at timestamptz,game_number integer)
language sql stable security definer set search_path=public as $$
 select distinct s.id,e.id,(r->>'gameId')::uuid,e.type,s.start_time,g.game_number
 from public.organization_contracts c join public.competition_publications cp on cp.first_published_at is not null
 join public.event_sessions s on s.id=cp.session_id and s.status<>'cancelled'
 join public.events e on e.id=s.event_id and e.cancelled_at is null
 cross join lateral jsonb_array_elements(coalesce(cp.published->'rows','[]')) r
 cross join lateral jsonb_array_elements(coalesce(r->'players','[]')) p
 join public.event_games g on g.id=(r->>'gameId')::uuid and g.session_id=s.id
 where c.id=p_contract and (r->>'teamId')::uuid=c.organization_id and r->>'played'='true'
 and p->>'played'='true' and (p->>'userId')::uuid=c.player_id
 and exists(select 1 from public.contract_agreements a join public.organization_contract_versions v on v.contract_id=a.contract_id and v.revision=a.revision
   where a.contract_id=c.id and a.effective_at<=least(s.start_time,cp.first_published_at)
   and (a.ended_at is null or a.ended_at>least(s.start_time,cp.first_published_at))
   and (v.terms->>'endsAt' is null or (v.terms->>'endsAt')::timestamptz>least(s.start_time,cp.first_published_at)))
$$;

create function public.contract_limit_reached(p_contract uuid,p_terms jsonb) returns boolean
language plpgsql stable security definer set search_path=public as $$
declare unit text:=p_terms->'limit'->>'unit'; maximum integer:=(p_terms->'limit'->>'count')::integer; used integer;
begin
 if unit is null then return false;end if;
 if unit='games' then select count(distinct game_id) into used from public.contract_participation(p_contract);
 elsif unit='trainings' then select count(distinct session_id) into used from public.contract_participation(p_contract) where event_type='training';
 else
   select count(distinct event_id) into used from public.contract_participation(p_contract) where event_type='tournament';
   if used>=maximum and exists(
     select 1 from (select event_id,min(starts_at) first_start from public.contract_participation(p_contract) where event_type='tournament' group by event_id order by first_start,event_id limit maximum) e
     join public.event_sessions s on s.event_id=e.event_id and s.status<>'cancelled'
     where not exists(select 1 from public.competition_publications cp where cp.session_id=s.id and cp.first_published_at is not null)
   ) then return false;end if;
 end if;
 return used>=maximum;
end $$;
create function public.contract_is_binding(p_contract uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.contract_agreements a join public.organization_contract_versions v on v.contract_id=a.contract_id and v.revision=a.revision
 where a.contract_id=p_contract and (a.ended_at is null or a.ended_at>now())
 and (v.terms->>'endsAt' is null or (v.terms->>'endsAt')::timestamptz>now())
 and not public.contract_limit_reached(p_contract,v.terms));
$$;

create function public.contract_membership_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and new.team_id=old.team_id and new.user_id=old.user_id then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if exists(select 1 from public.organization_contracts c where c.organization_id=old.team_id and c.player_id=old.user_id and c.kind='main' and public.contract_is_binding(c.id)) then
   raise exception 'Сначала расторгните действующий контракт с оплатой компенсации или по согласию сторон';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger contract_membership_guard before delete or update on public.team_members for each row execute function public.contract_membership_guard();
create function public.contract_dissolution_guard() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and (new.dissolved_at is null or old.dissolved_at is not null) then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if exists(select 1 from public.organization_contracts c where c.organization_id=old.id and public.contract_is_binding(c.id)) then raise exception 'Сначала урегулируйте действующие контракты организации';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger contract_dissolution_guard before delete or update of dissolved_at on public.teams for each row execute function public.contract_dissolution_guard();

alter function public.contract_mutate(uuid,jsonb) rename to contract_proposal_mutate;
revoke all on function public.contract_proposal_mutate(uuid,jsonb) from public,anon,authenticated,service_role;
do $$ declare d text;begin
 d:=pg_get_functiondef('public.contract_proposal_mutate(uuid,jsonb)'::regprocedure);
 if position('v.status not in(''draft'',''offered'',''rejected'')' in d)=0 then raise exception 'CONTRACT_SIGNING_PATCH';end if;
 d:=replace(d,'v.status not in(''draft'',''offered'',''rejected'')','v.status not in(''draft'',''offered'',''rejected'',''signed'')');
 execute d;
end $$;

create function public.contract_mutate(p_actor uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;v public.organization_contract_versions%rowtype;a public.contract_agreements%rowtype;
 t public.teams%rowtype;previous public.contract_operations%rowtype;request_id uuid:=(p_input->>'requestId')::uuid;
 result jsonb;effective timestamptz;finish timestamptz;check_time timestamptz;shares record;stamp timestamptz;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'CONTRACT_AUTH';end if;
 if request_id is null then raise exception 'CONTRACT_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into c from public.organization_contracts where id=(p_input->>'contractId')::uuid;
 select * into previous from public.contract_operations where id=request_id;
 if found then
   if previous.actor_id<>p_actor or previous.input<>p_input then raise exception 'CONTRACT_CONFLICT';end if;
   if not(c.player_id=p_actor or public.can_manage_organization_contracts(c.organization_id,p_actor)) then raise exception 'CONTRACT_FORBIDDEN';end if;
   return previous.result;
 end if;
 if p_input->>'action'<>'accept' then
   result:=public.contract_proposal_mutate(p_actor,p_input);
   if p_input->>'action'='offer' then
     update public.organization_contract_versions set offered_by=p_actor,offered_ownership_revision=(select ownership_revision from public.teams where id=c.organization_id)
     where contract_id=c.id and revision=(p_input->>'revision')::integer;
   end if;
   return result;
 end if;
 if c.id is null then raise exception 'CONTRACT_NOT_FOUND';end if;
 if c.player_id<>p_actor then raise exception 'CONTRACT_FORBIDDEN';end if;
 if c.kind<>'main' then raise exception 'CONTRACT_GUEST_PENDING';end if;
 if (p_input->>'revision')::integer is distinct from c.current_revision then raise exception 'CONTRACT_CONFLICT';end if;
 select * into v from public.organization_contract_versions where contract_id=c.id and revision=c.current_revision for update;
 if v.status<>'offered' then raise exception 'CONTRACT_STATE';end if;
 select * into t from public.teams where id=c.organization_id for update;
 if v.offered_by is null or v.offered_ownership_revision is distinct from t.ownership_revision or not public.organization_can_spend(c.organization_id,v.offered_by) then raise exception 'CONTRACT_APPROVAL_EXPIRED';end if;
 if not exists(select 1 from public.team_members where team_id=c.organization_id and user_id=c.player_id) then raise exception 'CONTRACT_MEMBER';end if;
 perform public.contract_validate_terms(v.terms);
 stamp:=clock_timestamp();effective:=greatest(stamp,(v.terms->>'startsAt')::timestamptz);finish:=(v.terms->>'endsAt')::timestamptz;
 if finish<=effective then raise exception 'CONTRACT_DATES';end if;
 if exists(select 1 from public.organization_contracts x where x.id<>c.id and x.organization_id=c.organization_id and x.player_id=c.player_id and x.kind='main' and public.contract_is_binding(x.id)) then raise exception 'CONTRACT_DUPLICATE_ACTIVE';end if;
 if public.contract_limit_reached(c.id,v.terms) then raise exception 'CONTRACT_LIMIT_EXHAUSTED';end if;
 -- Validate the maximum combined share at every start boundary inside the new
 -- interval; participation rules never silently scale an oversubscribed prize.
 for check_time in
   select effective union select a.effective_at from public.contract_agreements a join public.organization_contracts x on x.id=a.contract_id
   where x.organization_id=c.organization_id and x.id<>c.id and a.ended_at is null and a.effective_at>=effective and (finish is null or a.effective_at<finish)
 loop
   select coalesce(sum((z.terms->>'trainingShareBps')::integer),0) training,coalesce(sum((z.terms->>'tournamentShareBps')::integer),0) tournament into shares
   from public.contract_agreements a join public.organization_contracts x on x.id=a.contract_id join public.organization_contract_versions z on z.contract_id=a.contract_id and z.revision=a.revision
   where x.organization_id=c.organization_id and x.id<>c.id and a.ended_at is null and a.effective_at<=check_time
   and (z.terms->>'endsAt' is null or (z.terms->>'endsAt')::timestamptz>check_time) and public.contract_is_binding(x.id);
   if shares.training+(v.terms->>'trainingShareBps')::integer>10000 or shares.tournament+(v.terms->>'tournamentShareBps')::integer>10000 then raise exception 'CONTRACT_TOTAL_SHARE';end if;
 end loop;
 -- Amendments end the old agreement only at the new effective date.
 update public.contract_agreements set ended_at=effective,end_reason='amended' where contract_id=c.id and (ended_at is null or ended_at>effective);
 insert into public.contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at)
 values(c.id,v.revision,v.offered_by,p_actor,t.ownership_revision,stamp,effective);
 update public.organization_contract_versions set status='signed',responded_at=stamp where contract_id=c.id and revision=v.revision;
 update public.contract_termination_requests set status='superseded',resolved_at=stamp where contract_id=c.id and status='pending';
 insert into public.notifications(user_id,type,title,body,link) values(v.offered_by,'contract_signed','Договор подписан','Игрок подтвердил предложенную версию условий.','/contracts?contractId='||c.id);
 result:=jsonb_build_object('contractId',c.id,'revision',v.revision,'status','signed');
 insert into public.contract_operations(id,actor_id,input,result) values(request_id,p_actor,p_input,result);
 return result;
end $$;
revoke all on function public.contract_mutate(uuid,jsonb),public.contract_participation(uuid),public.contract_limit_reached(uuid,jsonb),public.contract_is_binding(uuid) from public,anon,authenticated;
grant execute on function public.contract_mutate(uuid,jsonb) to service_role;
commit;
