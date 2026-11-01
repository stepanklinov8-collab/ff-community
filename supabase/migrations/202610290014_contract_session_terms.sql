-- Signed-version history and immutable session inputs. No public signing or
-- settlement endpoint is enabled by this migration.
begin;
create table public.contract_agreements(
 contract_id uuid not null,revision integer not null,
 organization_signer uuid not null references public.profiles(id),
 player_signer uuid not null references public.profiles(id),
 ownership_revision bigint not null check(ownership_revision>=0),
 signed_at timestamptz not null check(isfinite(signed_at)),
 effective_at timestamptz not null check(isfinite(effective_at) and effective_at>=signed_at),
 ended_at timestamptz check(ended_at is null or(isfinite(ended_at) and ended_at>=signed_at)),
 end_reason text,
 primary key(contract_id,revision),
 foreign key(contract_id,revision) references public.organization_contract_versions(contract_id,revision)
);
create index contract_agreements_effective on public.contract_agreements(contract_id,effective_at);
create function public.contract_agreement_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then raise exception 'CONTRACT_IMMUTABLE';end if;
 if tg_op='INSERT' then
   if not exists(select 1 from public.organization_contracts where id=new.contract_id and player_id=new.player_signer) then raise exception 'CONTRACT_PARTIES';end if;
 else
   if new.contract_id<>old.contract_id or new.revision<>old.revision or new.organization_signer<>old.organization_signer
   or new.player_signer<>old.player_signer or new.signed_at<>old.signed_at or new.effective_at<>old.effective_at
   or new.ownership_revision<>old.ownership_revision or (old.ended_at is not null and(new.ended_at is null or new.ended_at>old.ended_at))
   or(new.end_reason is distinct from old.end_reason and new.ended_at is not distinct from old.ended_at)
   then raise exception 'CONTRACT_IMMUTABLE';end if;
   if new.ended_at is distinct from old.ended_at and new.ended_at<statement_timestamp() then raise exception 'CONTRACT_BACKDATED_END';end if;
 end if;
 return new;
end $$;
create trigger contract_agreement_immutable before insert or update or delete on public.contract_agreements for each row execute function public.contract_agreement_guard();

create table public.contract_session_frames(
 session_id uuid primary key references public.event_sessions(id),
 event_id uuid not null references public.events(id),
 event_type text not null,
 cutoff_at timestamptz not null,
 captured_at timestamptz not null default clock_timestamp(),
 games jsonb not null check(jsonb_typeof(games)='array'),
 registrations jsonb not null check(jsonb_typeof(registrations)='array')
);
create table public.contract_session_terms(
 session_id uuid not null references public.contract_session_frames(session_id),
 contract_id uuid not null,revision integer not null,
 organization_id uuid not null references public.teams(id),
 player_id uuid not null references public.profiles(id),
 kind text not null check(kind in('main','guest')),
 terms jsonb not null,conditions jsonb not null,
 primary key(session_id,contract_id),
 foreign key(contract_id,revision) references public.contract_agreements(contract_id,revision)
);
create function public.contract_frozen_guard() returns trigger language plpgsql set search_path=public as $$
begin raise exception 'CONTRACT_IMMUTABLE';end $$;
create trigger contract_session_frame_immutable before update or delete on public.contract_session_frames for each row execute function public.contract_frozen_guard();
create trigger contract_session_terms_immutable before update or delete on public.contract_session_terms for each row execute function public.contract_frozen_guard();
alter table public.contract_agreements enable row level security;
alter table public.contract_session_frames enable row level security;
alter table public.contract_session_terms enable row level security;
revoke all on public.contract_agreements,public.contract_session_frames,public.contract_session_terms from public,anon,authenticated,service_role;

create function public.contract_event_conditions(p_terms jsonb,p_event uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare base jsonb;special jsonb;k text;
begin
 if p_event is null then raise exception 'CONTRACT_EVENT';end if;
 -- The signed version was validated at signing. Do not revalidate availability
 -- of OTHER override events: their later cancellation cannot void this session.
 if p_terms->>'schemaVersion' is distinct from '2' then raise exception 'CONTRACT_SCHEMA';end if;
 base:=jsonb_build_object('trainingShareBps',p_terms->'trainingShareBps','tournamentShareBps',p_terms->'tournamentShareBps',
   'personalShareBps',p_terms->'personalShareBps')||(p_terms->'financial'->'rates');
 if (select count(*) from jsonb_array_elements(p_terms->'financial'->'eventOverrides') where (value->>'eventId')::uuid=p_event)>1 then raise exception 'CONTRACT_INPUT';end if;
 select value->'values' into special from jsonb_array_elements(p_terms->'financial'->'eventOverrides') where (value->>'eventId')::uuid=p_event;
 base:=base||coalesce(special,'{}'::jsonb);
 perform public.contract_assert_object(base,array['trainingShareBps','tournamentShareBps','personalShareBps','perGame','perSession','perTournament','perKill','perMvp'],
   array['trainingShareBps','tournamentShareBps','personalShareBps','perGame','perSession','perTournament','perKill','perMvp']);
 for k in select jsonb_object_keys(base) loop
   perform public.contract_assert_uint(base->k,case when k in('trainingShareBps','tournamentShareBps','personalShareBps') then 10000 else 1000000000000 end);
 end loop;
 return base;
end $$;

create function public.contract_session_freeze(p_session uuid) returns void
language plpgsql security definer set search_path=public as $$
declare s public.event_sessions%rowtype;e public.events%rowtype;cutoff timestamptz;game_rows jsonb;registration_rows jsonb;candidate record;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if exists(select 1 from public.contract_session_frames where session_id=p_session) then return;end if;
 select * into s from public.event_sessions where id=p_session for update;
 if not found then raise exception 'CONTRACT_EVENT';end if;
 select * into strict e from public.events where id=s.event_id;
 if s.status='cancelled' or e.cancelled_at is not null then raise exception 'CONTRACT_EVENT';end if;
 -- Publication before the scheduled start is an earlier irreversible cutoff.
 select least(s.start_time,first_published_at) into cutoff from public.competition_publications where session_id=p_session;
 cutoff:=coalesce(cutoff,s.start_time);
 if cutoff is null or not isfinite(cutoff) or cutoff>clock_timestamp() then raise exception 'CONTRACT_SESSION_NOT_STARTED';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'groupId',g.group_id,'map',g.map_name,'number',g.game_number) order by g.group_id,g.game_number,g.id),'[]') into game_rows
 from public.event_games g join public.event_groups q on q.id=g.group_id and q.session_id=g.session_id
 where g.session_id=s.id and g.status<>'cancelled' and q.is_active;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'organizationId',r.team_id,'groupId',r.group_id,'roster',coalesce(r.roster_snapshot,r.roster_json)) order by r.id),'[]') into registration_rows
 from public.event_registrations r where r.session_id=s.id and r.status='confirmed';
 insert into public.contract_session_frames(session_id,event_id,event_type,cutoff_at,games,registrations)
 values(s.id,e.id,e.type,cutoff,game_rows,registration_rows);
 -- Include other main organizations of relevant players as well: a team and a
 -- guild may BOTH have terms governing a guest appearance. A merely offered
 -- version, an acceptance after cutoff, and other guest events are excluded.
 for candidate in
   with active as(
     select c.id,c.organization_id,c.player_id,c.kind,c.event_id,c.session_id,a.revision,v.terms
     from public.contract_agreements a join public.organization_contracts c on c.id=a.contract_id
     join public.organization_contract_versions v on v.contract_id=a.contract_id and v.revision=a.revision
     where a.signed_at<=cutoff and a.effective_at<=cutoff and (a.ended_at is null or a.ended_at>cutoff)
     and (v.terms->>'endsAt' is null or (v.terms->>'endsAt')::timestamptz>cutoff)
     and(c.kind='main' or(c.event_id=e.id and(c.session_id is null or c.session_id=s.id)))
   ), relevant as(
     select distinct a.player_id from active a where a.kind='guest' or exists(
       select 1 from jsonb_array_elements(registration_rows) r where (r->>'organizationId')::uuid=a.organization_id)
   )
   select a.* from active a join relevant r on r.player_id=a.player_id order by a.id,a.revision
 loop
   if exists(select 1 from public.contract_session_terms where session_id=s.id and contract_id=candidate.id) then raise exception 'CONTRACT_AMBIGUOUS_VERSION';end if;
   insert into public.contract_session_terms(session_id,contract_id,revision,organization_id,player_id,kind,terms,conditions)
   values(s.id,candidate.id,candidate.revision,candidate.organization_id,candidate.player_id,candidate.kind,candidate.terms,public.contract_event_conditions(candidate.terms,e.id));
 end loop;
end $$;
revoke all on function public.contract_agreement_guard(),public.contract_frozen_guard(),public.contract_event_conditions(jsonb,uuid),public.contract_session_freeze(uuid)
 from public,anon,authenticated,service_role;
commit;
