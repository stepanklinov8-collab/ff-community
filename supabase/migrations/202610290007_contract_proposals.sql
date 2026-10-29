-- Immutable contract proposals. Activation and payment are intentionally
-- separate operations and are added by the settlement integration migration.
begin;
create table public.organization_contracts(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.teams(id) on delete restrict,
 player_id uuid not null references public.profiles(id) on delete restrict,
 kind text not null check(kind in('main','guest')),
 event_id uuid references public.events(id) on delete restrict,
 session_id uuid references public.event_sessions(id) on delete restrict,
 current_revision integer not null default 1 check(current_revision>0),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 check((kind='main' and event_id is null and session_id is null) or (kind='guest' and event_id is not null))
);
create index organization_contracts_player_idx on public.organization_contracts(player_id,created_at desc,id);
create index organization_contracts_org_idx on public.organization_contracts(organization_id,created_at desc,id);

create table public.organization_contract_versions(
 contract_id uuid not null references public.organization_contracts(id) on delete restrict,
 revision integer not null check(revision>0),
 terms jsonb not null check(jsonb_typeof(terms)='object'),
 status text not null default 'draft' check(status in('draft','offered','cancelled','rejected','superseded')),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 offered_at timestamptz,
 responded_at timestamptz,
 primary key(contract_id,revision)
);
create table public.contract_operations(
 id uuid primary key,
 actor_id uuid not null references auth.users(id) on delete restrict,
 input jsonb not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.organization_contracts enable row level security;
alter table public.organization_contract_versions enable row level security;
alter table public.contract_operations enable row level security;
revoke all on public.organization_contracts,public.organization_contract_versions,public.contract_operations from public,anon,authenticated;
grant select,insert,update on public.organization_contracts,public.organization_contract_versions,public.contract_operations to service_role;

create function public.contract_immutable_version() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.terms is distinct from old.terms or new.contract_id<>old.contract_id or new.revision<>old.revision
   or new.created_by<>old.created_by or new.created_at<>old.created_at then
   raise exception 'CONTRACT_IMMUTABLE';
 end if;
 return new;
end $$;
create trigger contract_version_immutable before update on public.organization_contract_versions
for each row execute function public.contract_immutable_version();

create function public.contract_validate_terms(p_terms jsonb) returns void
language plpgsql set search_path=public as $$
declare key text; value jsonb; starts timestamptz; ends timestamptz;
begin
 if jsonb_typeof(p_terms) is distinct from 'object' then raise exception 'CONTRACT_INPUT';end if;
 if not p_terms ?& array['startsAt','endsAt','limit','trainingShareBps','tournamentShareBps','personalShareBps',
   'participation','transfer','transferRequiresConsent','playerExit','organizationTermination','guestPolicy','guestCompensation','note'] then raise exception 'CONTRACT_INPUT';end if;
 if exists(select 1 from jsonb_object_keys(p_terms) k where k not in('startsAt','endsAt','limit','trainingShareBps','tournamentShareBps','personalShareBps',
   'participation','transfer','transferRequiresConsent','playerExit','organizationTermination','guestPolicy','guestCompensation','note')) then raise exception 'CONTRACT_INPUT';end if;
 starts:=(p_terms->>'startsAt')::timestamptz;ends:=(p_terms->>'endsAt')::timestamptz;
 if starts is null or not isfinite(starts) or (ends is not null and (not isfinite(ends) or ends<=starts)) then raise exception 'CONTRACT_DATES';end if;
 foreach key in array array['trainingShareBps','tournamentShareBps','personalShareBps'] loop
   if jsonb_typeof(p_terms->key) is distinct from 'number' or (p_terms->>key)!~'^\d+$' or (p_terms->>key)::numeric not between 0 and 10000 then raise exception 'CONTRACT_SHARE';end if;
 end loop;
 if p_terms->'limit'<>'null'::jsonb then
   value:=p_terms->'limit';
   if jsonb_typeof(value) is distinct from 'object' or not value ?& array['unit','count']
     or value->>'unit' not in('games','trainings','tournaments') or (value->>'count')!~'^\d+$'
     or (value->>'count')::numeric not between 1 and 1000000 then raise exception 'CONTRACT_LIMIT';end if;
 end if;
 value:=p_terms->'participation';
 if jsonb_typeof(value) is distinct from 'object' or not value?'mode' or value->>'mode' not in('any','proportional','minimum') then raise exception 'CONTRACT_INPUT';end if;
 if value->>'mode'='minimum' and (not value?'games' or (value->>'games')!~'^\d+$' or (value->>'games')::numeric not between 1 and 10000) then raise exception 'CONTRACT_INPUT';end if;
 foreach key in array array['transfer','playerExit','organizationTermination','guestCompensation'] loop
   value:=p_terms->key;
   if jsonb_typeof(value) is distinct from 'object' or not value?'kind' or value->>'kind' not in('none','fixed','percent') then raise exception 'CONTRACT_INPUT';end if;
   if value->>'kind'='fixed' and (not value?'amount' or (value->>'amount')!~'^\d+$' or (value->>'amount')::numeric not between 0 and 1000000000000) then raise exception 'CONTRACT_INPUT';end if;
   if value->>'kind'='percent' and (not value?'basisPoints' or (value->>'basisPoints')!~'^\d+$' or (value->>'basisPoints')::numeric not between 0 and 10000) then raise exception 'CONTRACT_SHARE';end if;
 end loop;
 if jsonb_typeof(p_terms->'transferRequiresConsent') is distinct from 'boolean'
   or p_terms->>'guestPolicy' not in('forbidden','allowed','consent')
   or jsonb_typeof(p_terms->'guestPolicy') is distinct from 'string'
   or jsonb_typeof(p_terms->'note') is distinct from 'string' or length(p_terms->>'note')>4000 then raise exception 'CONTRACT_INPUT';end if;
 if p_terms->>'guestPolicy'='forbidden' and p_terms->'guestCompensation'->>'kind'<>'none' then raise exception 'CONTRACT_GUEST_FORBIDDEN';end if;
end $$;

create function public.contract_mutate(p_actor uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare request_id uuid; contract_id_value uuid; action text; existing public.contract_operations%rowtype;
 c public.organization_contracts%rowtype; v public.organization_contract_versions%rowtype;
 next_revision integer; response jsonb; organization_id_value uuid; player_id_value uuid; event_id_value uuid; session_id_value uuid;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'CONTRACT_AUTH';end if;
 request_id:=(p_input->>'requestId')::uuid;contract_id_value:=(p_input->>'contractId')::uuid;action:=p_input->>'action';
 if request_id is null or contract_id_value is null or action is null then raise exception 'CONTRACT_INPUT';end if;
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into existing from public.contract_operations where id=request_id;
 if found then
   if existing.actor_id<>p_actor or existing.input<>p_input then raise exception 'CONTRACT_CONFLICT';end if;
   -- Revoked representatives must not read even a cached operation response.
   if not exists(select 1 from public.organization_contracts x where x.id=contract_id_value and (x.player_id=p_actor or public.can_manage_organization_contracts(x.organization_id,p_actor))) then raise exception 'CONTRACT_FORBIDDEN';end if;
   return existing.result;
 end if;
 select * into c from public.organization_contracts where id=contract_id_value for update;
 if action='save' then
   organization_id_value:=(p_input->>'organizationId')::uuid;player_id_value:=(p_input->>'playerId')::uuid;
   event_id_value:=(p_input->>'eventId')::uuid;session_id_value:=(p_input->>'sessionId')::uuid;
   if not coalesce(public.can_manage_organization_contracts(organization_id_value,p_actor),false) then raise exception 'CONTRACT_FORBIDDEN';end if;
   if p_input->>'kind' is null or p_input->>'kind' not in('main','guest') or not exists(select 1 from public.profiles where id=player_id_value) then raise exception 'CONTRACT_INPUT';end if;
   perform public.contract_validate_terms(p_input->'terms');
   if p_input->>'kind'='main' then
     if event_id_value is not null or session_id_value is not null then raise exception 'CONTRACT_INPUT';end if;
     if not exists(select 1 from public.team_members where team_id=organization_id_value and user_id=player_id_value) then raise exception 'CONTRACT_MEMBER';end if;
   else
     if not exists(select 1 from public.events where id=event_id_value and cancelled_at is null) then raise exception 'CONTRACT_EVENT';end if;
     if session_id_value is not null and not exists(select 1 from public.event_sessions where id=session_id_value and event_id=event_id_value and status<>'cancelled') then raise exception 'CONTRACT_EVENT';end if;
   end if;
   if c.id is null then
     if (p_input->>'expectedRevision')::integer is distinct from 0 then raise exception 'CONTRACT_CONFLICT';end if;
     insert into public.organization_contracts(id,organization_id,player_id,kind,event_id,session_id,created_by)
     values(contract_id_value,organization_id_value,player_id_value,p_input->>'kind',event_id_value,session_id_value,p_actor) returning * into c;
     next_revision:=1;
   else
     if c.organization_id<>organization_id_value or c.player_id<>player_id_value or c.kind<>p_input->>'kind'
       or c.event_id is distinct from event_id_value or c.session_id is distinct from session_id_value then raise exception 'CONTRACT_PARTIES';end if;
     if (p_input->>'expectedRevision')::integer is distinct from c.current_revision then raise exception 'CONTRACT_CONFLICT';end if;
     select * into v from public.organization_contract_versions where contract_id=c.id and revision=c.current_revision;
     if v.status not in('draft','offered','rejected') then raise exception 'CONTRACT_STATE';end if;
     next_revision:=c.current_revision+1;
     -- Old offered terms remain available in history; never overwrite them.
     update public.organization_contract_versions set status='superseded' where contract_id=c.id and revision=c.current_revision;
     update public.organization_contracts set current_revision=next_revision where id=c.id;
   end if;
   insert into public.organization_contract_versions(contract_id,revision,terms,created_by)
   values(c.id,next_revision,p_input->'terms',p_actor);
   response:=jsonb_build_object('contractId',c.id,'revision',next_revision,'status','draft');
 else
   if c.id is null then raise exception 'CONTRACT_NOT_FOUND';end if;
   if (p_input->>'revision')::integer is distinct from c.current_revision then raise exception 'CONTRACT_CONFLICT';end if;
   select * into v from public.organization_contract_versions where contract_id=c.id and revision=c.current_revision for update;
   if action='offer' then
     if not public.organization_can_spend(c.organization_id,p_actor) then raise exception 'CONTRACT_FINANCE';end if;
     if v.status<>'draft' then raise exception 'CONTRACT_STATE';end if;
     if c.kind='main' and not exists(select 1 from public.team_members where team_id=c.organization_id and user_id=c.player_id) then raise exception 'CONTRACT_MEMBER';end if;
     if (v.terms->>'endsAt')::timestamptz<=now() then raise exception 'CONTRACT_DATES';end if;
     update public.organization_contract_versions set status='offered',offered_at=clock_timestamp() where contract_id=c.id and revision=c.current_revision;
     insert into public.notifications(user_id,type,title,body,link) values(c.player_id,'contract_offer','Предложение контракта',
       'Организация направила условия договора. Ознакомьтесь с ними в разделе контрактов.', '/contracts?contractId='||c.id::text);
     response:=jsonb_build_object('contractId',c.id,'revision',c.current_revision,'status','offered');
   elsif action='reject' then
     if c.player_id<>p_actor then raise exception 'CONTRACT_FORBIDDEN';end if;
     if v.status<>'offered' then raise exception 'CONTRACT_STATE';end if;
     update public.organization_contract_versions set status='rejected',responded_at=clock_timestamp() where contract_id=c.id and revision=c.current_revision;
     response:=jsonb_build_object('contractId',c.id,'revision',c.current_revision,'status','rejected');
   elsif action='cancel' then
     if not public.can_manage_organization_contracts(c.organization_id,p_actor) then raise exception 'CONTRACT_FORBIDDEN';end if;
     if v.status not in('draft','offered') then raise exception 'CONTRACT_STATE';end if;
     update public.organization_contract_versions set status='cancelled',responded_at=clock_timestamp() where contract_id=c.id and revision=c.current_revision;
     response:=jsonb_build_object('contractId',c.id,'revision',c.current_revision,'status','cancelled');
   else raise exception 'CONTRACT_INPUT';end if;
 end if;
 insert into public.contract_operations(id,actor_id,input,result) values(request_id,p_actor,p_input,response);
 return response;
end $$;

create function public.contract_query(p_actor uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; contract_id_value uuid; org uuid; search_value text; offset_value integer;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'CONTRACT_AUTH';end if;
 contract_id_value:=(p_input->>'contractId')::uuid;org:=(p_input->>'organizationId')::uuid;
 offset_value:=coalesce((p_input->>'offset')::integer,0);
 if offset_value not between 0 and 1000000 then raise exception 'CONTRACT_INPUT';end if;
 if org is not null and not public.can_manage_organization_contracts(org,p_actor) then raise exception 'CONTRACT_FORBIDDEN';end if;
 if p_input?'search' then
   search_value:=replace(replace(replace(left(trim(p_input->>'search'),80),'%',''),'_',''),'\','');
   if length(search_value)<2 then return jsonb_build_object('items','[]'::jsonb);end if;
   if org is null then raise exception 'CONTRACT_FORBIDDEN';end if;
   if p_input->>'searchKind'='events' then
     select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from(
       select id,title from public.events where cancelled_at is null and is_published and title ilike '%'||search_value||'%' order by title,id limit 20
     ) x;
   else
     select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from(
       select id,nickname from public.profiles where nickname ilike '%'||search_value||'%' order by nickname,id limit 20
     ) x;
   end if;
   return jsonb_build_object('items',result);
 end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select c.id,c.organization_id as "organizationId",t.name as "organizationName",c.player_id as "playerId",p.nickname as "playerName",
     c.kind,c.event_id as "eventId",c.session_id as "sessionId",e.title as "eventTitle",v.revision,v.status,v.terms,c.created_at as "createdAt",
     public.can_manage_organization_contracts(c.organization_id,p_actor) as "canEdit",
     public.organization_can_spend(c.organization_id,p_actor) as "canOffer",c.player_id=p_actor as "isPlayer"
   from public.organization_contracts c join public.teams t on t.id=c.organization_id join public.profiles p on p.id=c.player_id
   join public.organization_contract_versions v on v.contract_id=c.id and v.revision=c.current_revision
   left join public.events e on e.id=c.event_id
   where (contract_id_value is null or c.id=contract_id_value) and (org is null or c.organization_id=org)
     and (public.can_manage_organization_contracts(c.organization_id,p_actor) or (c.player_id=p_actor and v.status<>'draft'))
   order by c.created_at desc,c.id limit 31 offset offset_value
 ) x;
 if contract_id_value is not null and jsonb_array_length(result)=0 then raise exception 'CONTRACT_NOT_FOUND';end if;
 return jsonb_build_object('contracts',coalesce((select jsonb_agg(value) from jsonb_array_elements(result) with ordinality a(value,n) where n<=30),'[]'::jsonb),
   'hasMore',jsonb_array_length(result)>30,'organizations',coalesce((
     select jsonb_agg(to_jsonb(t)) from(select id,name,type,public.organization_can_spend(id,p_actor) as "canOffer" from public.teams
       where public.can_manage_organization_contracts(id,p_actor) order by name,id limit 200) t
   ),'[]'::jsonb));
end $$;
revoke all on function public.contract_mutate(uuid,jsonb),public.contract_query(uuid,jsonb),public.contract_validate_terms(jsonb) from public,anon,authenticated;
grant execute on function public.contract_mutate(uuid,jsonb),public.contract_query(uuid,jsonb) to service_role;
commit;
