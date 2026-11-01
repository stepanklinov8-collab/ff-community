-- Temporary performance contracts never add a permanent team_members row.
-- Every home team/guild agreement is inspected; a prohibition requires an
-- explicit event-specific exception from that organization's financial signer.
begin;
create table public.contract_guest_scopes(
 contract_id uuid not null,revision integer not null,event_id uuid not null references public.events(id),
 session_ids uuid[] not null,starts_at timestamptz not null,ends_at timestamptz not null,
 primary key(contract_id,revision),foreign key(contract_id,revision) references public.organization_contract_versions(contract_id,revision)
);
create table public.contract_guest_requirements(
 contract_id uuid not null,revision integer not null,home_contract_id uuid not null,home_revision integer not null,
 organization_id uuid not null references public.teams(id),policy text not null,compensation jsonb not null,
 primary key(contract_id,revision,home_contract_id),
 foreign key(contract_id,revision) references public.contract_guest_scopes(contract_id,revision),
 foreign key(home_contract_id,home_revision) references public.contract_agreements(contract_id,revision)
);
create table public.contract_guest_consents(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null,revision integer not null,home_contract_id uuid not null,
 signer_id uuid not null references public.profiles(id),ownership_revision bigint not null,approved boolean not null,
 signed_at timestamptz not null default clock_timestamp(),
 foreign key(contract_id,revision,home_contract_id) references public.contract_guest_requirements(contract_id,revision,home_contract_id)
);
create index contract_guest_consents_latest on public.contract_guest_consents(contract_id,revision,home_contract_id,signed_at desc,id);
create table public.contract_guest_activations(
 contract_id uuid not null,revision integer not null,activated_at timestamptz not null default clock_timestamp(),
 primary key(contract_id,revision),foreign key(contract_id,revision) references public.contract_agreements(contract_id,revision)
);
create table public.contract_guest_escrows(
 contract_id uuid not null,revision integer not null,home_contract_id uuid not null,amount bigint not null check(amount>0),
 held bigint not null check(held>=0),paid bigint not null default 0 check(paid>=0),
 primary key(contract_id,revision,home_contract_id),check(held+paid<=amount),
 foreign key(contract_id,revision,home_contract_id) references public.contract_guest_requirements(contract_id,revision,home_contract_id)
);
alter table public.contract_guest_scopes enable row level security;
alter table public.contract_guest_requirements enable row level security;
alter table public.contract_guest_consents enable row level security;
alter table public.contract_guest_activations enable row level security;
alter table public.contract_guest_escrows enable row level security;
revoke all on public.contract_guest_scopes,public.contract_guest_requirements,public.contract_guest_consents,public.contract_guest_activations,public.contract_guest_escrows from public,anon,authenticated,service_role;
create trigger contract_guest_scope_immutable before update or delete on public.contract_guest_scopes for each row execute function public.contract_frozen_guard();
create trigger contract_guest_requirement_immutable before update or delete on public.contract_guest_requirements for each row execute function public.contract_frozen_guard();
create trigger contract_guest_consent_immutable before update or delete on public.contract_guest_consents for each row execute function public.contract_frozen_guard();
create trigger contract_guest_activation_immutable before update or delete on public.contract_guest_activations for each row execute function public.contract_frozen_guard();

create function public.contract_guest_home_terms(p_player uuid,p_host uuid,p_start timestamptz) returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('contractId',c.id,'revision',a.revision,'organizationId',c.organization_id,
   'policy',v.terms->>'guestPolicy','compensation',v.terms->'guestCompensation') order by c.id,a.revision),'[]')
 from public.contract_agreements a join public.organization_contracts c on c.id=a.contract_id
 join public.organization_contract_versions v on v.contract_id=a.contract_id and v.revision=a.revision
 where c.kind='main' and c.player_id=p_player and c.organization_id<>p_host and a.effective_at<=p_start
   and(public.contract_effective_end(a.contract_id,a.revision) is null or public.contract_effective_end(a.contract_id,a.revision)>p_start)
$$;

create function public.contract_guest_capture(p_contract uuid,p_revision integer) returns void
language plpgsql security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;e public.events%rowtype;terms jsonb;first_start timestamptz;last_end timestamptz;ids uuid[];homes jsonb;home jsonb;
begin
 select * into strict c from public.organization_contracts where id=p_contract;
 select * into strict e from public.events where id=c.event_id;
 select v.terms into strict terms from public.organization_contract_versions v where v.contract_id=p_contract and v.revision=p_revision;
 if e.cancelled_at is not null or e.frozen_at is not null or e.is_published is distinct from true or e.moderation_status is distinct from 'approved' or e.type not in('training','tournament') or(e.type='training' and c.session_id is null) then raise exception 'CONTRACT_GUEST_SESSION';end if;
 select array_agg(s.id order by s.start_time,s.id),min(s.start_time),max(s.end_time) into ids,first_start,last_end
 from public.event_sessions s where s.event_id=e.id and s.status<>'cancelled' and(c.session_id is null or s.id=c.session_id);
 if cardinality(ids) is null or first_start<=clock_timestamp() or last_end is null or last_end<first_start
   or(terms->>'startsAt')::timestamptz>first_start or(terms->>'endsAt')::timestamptz is distinct from last_end
   or exists(select 1 from public.event_sessions where id=any(ids) and(end_time is null or end_time<start_time)) then raise exception 'CONTRACT_GUEST_DATES';end if;
 if exists(select 1 from public.competition_publications where session_id=any(ids) and first_published_at is not null) then raise exception 'CONTRACT_GUEST_DATES';end if;
 if exists(select 1 from public.organization_contracts mc join public.contract_agreements a on a.contract_id=mc.id
   where mc.player_id=c.player_id and mc.organization_id=c.organization_id and mc.kind='main' and a.effective_at<last_end
     and(public.contract_effective_end(a.contract_id,a.revision) is null or public.contract_effective_end(a.contract_id,a.revision)>first_start)) then raise exception 'CONTRACT_ALREADY_ACTIVE';end if;
 homes:=public.contract_guest_home_terms(c.player_id,c.organization_id,first_start);
 if (select count(*) from jsonb_array_elements(homes))<>(select count(distinct value->>'organizationId') from jsonb_array_elements(homes)) then raise exception 'CONTRACT_AMBIGUOUS_VERSION';end if;
 if coalesce((select sum((value->'compensation'->>'basisPoints')::integer) from jsonb_array_elements(homes) where value->'compensation'->>'kind'='percent'),0)>10000 then raise exception 'CONTRACT_GUEST_TOTAL_SHARE';end if;
 insert into public.contract_guest_scopes(contract_id,revision,event_id,session_ids,starts_at,ends_at) values(c.id,p_revision,e.id,ids,first_start,last_end);
 for home in select value from jsonb_array_elements(homes) loop
   insert into public.contract_guest_requirements(contract_id,revision,home_contract_id,home_revision,organization_id,policy,compensation)
     values(c.id,p_revision,(home->>'contractId')::uuid,(home->>'revision')::integer,(home->>'organizationId')::uuid,home->>'policy',home->'compensation');
   if home->>'policy' in('consent','forbidden') then
     insert into public.notifications(user_id,type,title,body,link)
       select distinct p.id,'contract_guest','Согласование гостевого выступления','Требуется согласие вашей организации на выступление игрока.','/contracts'
       from (select ultimate_owner_user_id as id from public.teams where id=(home->>'organizationId')::uuid
         union select leader_id from public.teams where id=(home->>'organizationId')::uuid) p
       where p.id is not null and public.organization_can_spend((home->>'organizationId')::uuid,p.id);
   end if;
 end loop;
end $$;

create function public.contract_guest_query(p_actor uuid,p_contract uuid default null) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;scope public.contract_guest_scopes%rowtype;requirements jsonb;inbox jsonb;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'CONTRACT_AUTH';end if;
 if p_contract is null then
   select coalesce(jsonb_agg(row_data),'[]') into inbox from(
     select r.contract_id as "contractId",r.revision,r.home_contract_id as "homeContractId",r.organization_id as "organizationId",h.name as "homeName",host.name as "hostName",p.nickname as "playerName",e.title as "eventTitle",r.policy,r.compensation,
       s.starts_at as "startsAt",s.ends_at as "endsAt"
     from public.contract_guest_requirements r join public.organization_contracts gc on gc.id=r.contract_id
       join public.organization_contract_versions v on v.contract_id=r.contract_id and v.revision=r.revision
       join public.contract_guest_scopes s on s.contract_id=r.contract_id and s.revision=r.revision
       join public.teams h on h.id=r.organization_id join public.teams host on host.id=gc.organization_id join public.profiles p on p.id=gc.player_id join public.events e on e.id=gc.event_id
     where v.status='offered' and gc.current_revision=r.revision and r.policy in('consent','forbidden') and s.starts_at>clock_timestamp()
       and public.organization_can_spend(r.organization_id,p_actor)
       and not exists(select 1 from public.contract_agreements a where a.contract_id=r.contract_id and a.revision=r.revision)
     order by s.starts_at,r.contract_id limit 100
   ) row_data;
   return jsonb_build_object('items',inbox);
 end if;
 select * into c from public.organization_contracts where id=p_contract;
 if c.id is null or c.kind<>'guest' or not(c.player_id=p_actor or public.can_manage_organization_contracts(c.organization_id,p_actor)) then raise exception 'CONTRACT_NOT_FOUND';end if;
 select * into scope from public.contract_guest_scopes where contract_id=p_contract and revision=c.current_revision;
 select coalesce(jsonb_agg(jsonb_build_object('organizationName',org.name,'policy',r.policy,'compensation',r.compensation,
   'approved',case when r.policy='allowed' then true else coalesce((select consent.approved from public.contract_guest_consents consent
     where consent.contract_id=r.contract_id and consent.revision=r.revision and consent.home_contract_id=r.home_contract_id
       and consent.ownership_revision=org.ownership_revision and public.organization_can_spend(org.id,consent.signer_id)
     order by consent.signed_at desc,consent.id desc limit 1),false) end) order by org.name),'[]') into requirements
 from public.contract_guest_requirements r join public.teams org on org.id=r.organization_id where r.contract_id=p_contract and r.revision=c.current_revision;
 return jsonb_build_object('captured',scope.contract_id is not null,'requirements',requirements,'startsAt',scope.starts_at,'endsAt',scope.ends_at);
end $$;

create function public.contract_guest_consent(p_actor uuid,p_request uuid,p_contract uuid,p_revision integer,p_home uuid,p_approve boolean) returns jsonb
language plpgsql security definer set search_path=public as $$
declare r public.contract_guest_requirements%rowtype;c public.organization_contracts%rowtype;old public.contract_operations%rowtype;payload jsonb;response jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into r from public.contract_guest_requirements where contract_id=p_contract and revision=p_revision and home_contract_id=p_home;
 if not found or not coalesce(public.organization_can_spend(r.organization_id,p_actor),false) then raise exception 'CONTRACT_FORBIDDEN';end if;
 payload:=jsonb_build_object('action','guest_consent','contractId',p_contract,'revision',p_revision,'homeContractId',p_home,'approve',p_approve);
 select * into old from public.contract_operations where id=p_request;
 if found then if old.actor_id<>p_actor or old.input<>payload then raise exception 'CONTRACT_CONFLICT';end if;return old.result;end if;
 select * into strict c from public.organization_contracts where id=p_contract;
 if p_request is null or p_approve is null or c.current_revision<>p_revision or not exists(select 1 from public.organization_contract_versions where contract_id=p_contract and revision=p_revision and status='offered')
   or exists(select 1 from public.contract_agreements where contract_id=p_contract and revision=p_revision)
   or exists(select 1 from public.contract_guest_scopes where contract_id=p_contract and revision=p_revision and starts_at<=clock_timestamp()) then raise exception 'CONTRACT_STATE';end if;
 insert into public.contract_guest_consents(contract_id,revision,home_contract_id,signer_id,ownership_revision,approved)
   select p_contract,p_revision,p_home,p_actor,ownership_revision,p_approve from public.teams where id=r.organization_id;
 response:=jsonb_build_object('success',true,'approved',p_approve);
 insert into public.contract_operations(id,actor_id,input,result) values(p_request,p_actor,payload,response);
 insert into public.notifications(user_id,type,title,body,link) values(c.player_id,'contract_guest','Решение по гостевому выступлению',case when p_approve then 'Основная организация согласовала выступление.' else 'Основная организация отклонила выступление.' end,'/contracts?contractId='||c.id);
 return response;
end $$;

alter function public.contract_mutate(uuid,jsonb) rename to contract_mutate_before_guests;
create function public.contract_mutate(p_actor uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;v public.organization_contract_versions%rowtype;scope public.contract_guest_scopes%rowtype;sig public.contract_signatures%rowtype;
 old public.contract_operations%rowtype;requirements jsonb;current_homes jsonb;answer jsonb;item record;old_guest record;effective timestamptz;signed_time timestamptz;source uuid;op uuid;amount bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into c from public.organization_contracts where id=(p_input->>'contractId')::uuid;
 select * into old from public.contract_operations where id=(p_input->>'requestId')::uuid;
 if c.kind='main' and p_input->>'action'='accept' and old.id is null then
   select * into strict v from public.organization_contract_versions where contract_id=c.id and revision=c.current_revision;
   if exists(select 1 from public.contract_guest_activations a join public.organization_contracts gc on gc.id=a.contract_id
     join public.contract_guest_scopes s on s.contract_id=a.contract_id and s.revision=a.revision
     where gc.player_id=c.player_id and gc.organization_id=c.organization_id
       and public.contract_effective_end(a.contract_id,a.revision)>greatest(clock_timestamp(),(v.terms->>'startsAt')::timestamptz)
       and s.starts_at<coalesce((v.terms->>'endsAt')::timestamptz,'infinity'::timestamptz)) then raise exception 'CONTRACT_GUEST_OVERLAP';end if;
 end if;
 if c.kind is distinct from 'guest' or p_input->>'action'<>'accept' then
   answer:=public.contract_mutate_before_guests(p_actor,p_input);
   if c.kind='guest' and p_input->>'action'='offer' and old.id is null then perform public.contract_guest_capture(c.id,c.current_revision);end if;
   return answer;
 end if;
 if c.player_id is distinct from p_actor then raise exception 'CONTRACT_FORBIDDEN';end if;
 if old.id is not null then if old.actor_id<>p_actor or old.input<>p_input then raise exception 'CONTRACT_CONFLICT';end if;return old.result;end if;
 if c.current_revision is distinct from (p_input->>'revision')::integer then raise exception 'CONTRACT_CONFLICT';end if;
 select * into strict v from public.organization_contract_versions where contract_id=c.id and revision=c.current_revision;
 select * into scope from public.contract_guest_scopes where contract_id=c.id and revision=c.current_revision;
 if v.status<>'offered' or scope.contract_id is null or scope.starts_at<=clock_timestamp() then raise exception 'CONTRACT_GUEST_DATES';end if;
 if (select array_agg(s.id order by s.start_time,s.id) from public.event_sessions s where s.event_id=c.event_id and s.status<>'cancelled' and(c.session_id is null or s.id=c.session_id)) is distinct from scope.session_ids
   or exists(select 1 from public.event_sessions s join public.events e on e.id=s.event_id where s.id=any(scope.session_ids) and(s.status='cancelled' or e.cancelled_at is not null or e.frozen_at is not null or e.is_published is distinct from true or e.moderation_status is distinct from 'approved' or s.start_time<scope.starts_at or s.end_time>scope.ends_at)) then raise exception 'CONTRACT_CONFLICT';end if;
 if exists(select 1 from public.organization_contracts mc join public.contract_agreements a on a.contract_id=mc.id
   where mc.player_id=c.player_id and mc.organization_id=c.organization_id and mc.kind='main' and a.effective_at<scope.ends_at
     and(public.contract_effective_end(a.contract_id,a.revision) is null or public.contract_effective_end(a.contract_id,a.revision)>scope.starts_at)) then raise exception 'CONTRACT_ALREADY_ACTIVE';end if;
 select * into sig from public.contract_signatures where contract_id=c.id and revision=c.current_revision and party='organization';
 if sig.contract_id is null or sig.ownership_revision<>(select ownership_revision from public.teams where id=c.organization_id) or not public.organization_can_spend(c.organization_id,sig.signed_by) then raise exception 'CONTRACT_SIGNATURE_STALE';end if;
 current_homes:=public.contract_guest_home_terms(c.player_id,c.organization_id,scope.starts_at);
 select coalesce(jsonb_agg(jsonb_build_object('contractId',r.home_contract_id,'revision',r.home_revision,'organizationId',r.organization_id,'policy',r.policy,'compensation',r.compensation) order by r.home_contract_id,r.home_revision),'[]') into requirements
 from public.contract_guest_requirements r where r.contract_id=c.id and r.revision=c.current_revision;
 if requirements<>current_homes then raise exception 'CONTRACT_GUEST_CHANGED';end if;
 answer:=public.contract_guest_query(p_actor,c.id);
 if exists(select 1 from jsonb_array_elements(answer->'requirements') r where r->>'approved' is distinct from 'true') then raise exception 'CONTRACT_GUEST_CONSENT';end if;
 if exists(select 1 from public.contract_guest_activations ga join public.organization_contracts gc on gc.id=ga.contract_id join public.contract_guest_scopes gs on gs.contract_id=ga.contract_id and gs.revision=ga.revision
   where gc.player_id=c.player_id and gc.id<>c.id
     and public.contract_effective_end(ga.contract_id,ga.revision)>scope.starts_at and gs.starts_at<scope.ends_at) then raise exception 'CONTRACT_GUEST_OVERLAP';end if;
 signed_time:=clock_timestamp();effective:=greatest(signed_time,(v.terms->>'startsAt')::timestamptz);
 for old_guest in select revision from public.contract_agreements where contract_id=c.id and(ended_at is null or ended_at>effective) order by revision loop
   perform public.contract_salary_schedule_close(c.id,old_guest.revision,effective,'Обновление гостевого договора');
   update public.contract_agreements set ended_at=effective,end_reason='Обновление гостевого договора' where contract_id=c.id and revision=old_guest.revision;
   perform public.contract_guest_settle(c.id,old_guest.revision);
 end loop;
 insert into public.contract_signatures(contract_id,revision,party,signed_by,ownership_revision) values(c.id,c.current_revision,'player',p_actor,sig.ownership_revision);
 insert into public.contract_agreements(contract_id,revision,organization_signer,player_signer,ownership_revision,signed_at,effective_at)
   values(c.id,c.current_revision,sig.signed_by,p_actor,sig.ownership_revision,signed_time,effective);
 source:=public.u6_coin_account('organization',c.organization_id);
 for item in select * from public.contract_guest_requirements where contract_id=c.id and revision=c.current_revision and compensation->>'kind'='fixed' order by home_contract_id loop
   amount:=(item.compensation->>'amount')::bigint;
   if amount=0 then continue;end if;
   if not exists(select 1 from public.coin_accounts where id=source and balance-reserved>=amount) then raise exception 'CONTRACT_FUNDS';end if;
   op:=gen_random_uuid();insert into public.coin_operations(id,actor_id,action,input,description) values(op,p_actor,'contract_guest_reserve',jsonb_build_object('contractId',c.id,'homeContractId',item.home_contract_id),'Резерв фиксированной гостевой компенсации');
   perform public.u6_coin_entry(op,source,0,amount);
   insert into public.contract_guest_escrows(contract_id,revision,home_contract_id,amount,held) values(c.id,c.current_revision,item.home_contract_id,amount,amount);
 end loop;
 insert into public.contract_guest_activations(contract_id,revision) values(c.id,c.current_revision);
 perform public.contract_financial_start(c.id,c.current_revision,effective);
 answer:=jsonb_build_object('contractId',c.id,'revision',c.current_revision,'status','signed','effectiveAt',effective);
 insert into public.contract_operations(id,actor_id,input,result) values((p_input->>'requestId')::uuid,p_actor,p_input,answer);
 return answer;
end $$;

create function public.contract_guest_can_play(p_organization uuid,p_player uuid,p_session uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.contract_guest_activations a join public.organization_contracts c on c.id=a.contract_id
   join public.contract_guest_scopes s on s.contract_id=a.contract_id and s.revision=a.revision
   join public.contract_agreements ag on ag.contract_id=a.contract_id and ag.revision=a.revision
   join public.event_sessions es on es.id=p_session join public.events e on e.id=es.event_id
   where c.organization_id=p_organization and c.player_id=p_player and p_session=any(s.session_ids) and es.event_id=s.event_id
     and es.start_time>=s.starts_at and es.end_time<=s.ends_at and es.status<>'cancelled' and e.cancelled_at is null
     and ag.effective_at<=es.start_time and public.contract_effective_end(a.contract_id,a.revision)>=es.end_time)
$$;
create function public.contract_available_guests(p_team uuid,p_session uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null or not coalesce(public.can_manage_team(p_team,auth.uid()),false) then raise exception 'CONTRACT_FORBIDDEN';end if;
 return coalesce((select jsonb_agg(row_data order by nickname,id) from(
   select distinct p.id,p.nickname from public.contract_guest_activations a join public.organization_contracts c on c.id=a.contract_id join public.profiles p on p.id=c.player_id
   where c.organization_id=p_team and public.contract_guest_can_play(p_team,p.id,p_session)
 )row_data),'[]');
end $$;
create function public.contract_guest_sessions(p_actor uuid,p_event uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare event_type text;sessions jsonb;
begin
 if p_actor is null or not exists(select 1 from public.profiles where id=p_actor) then raise exception 'CONTRACT_AUTH';end if;
 select type into event_type from public.events where id=p_event and cancelled_at is null and is_published and moderation_status='approved';
 if event_type not in('training','tournament') or event_type is null then raise exception 'CONTRACT_EVENT';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'startsAt',start_time,'endsAt',end_time) order by start_time,id),'[]') into sessions
   from public.event_sessions where event_id=p_event and status<>'cancelled' and start_time>clock_timestamp() and end_time is not null and end_time>=start_time;
 return jsonb_build_object('eventType',event_type,'sessions',sessions);
end $$;

-- Preserve every existing ban, overlap, minimum-size, capacity and lock check.
-- Add the signed event-specific guest as the only membership alternative.
do $$declare d text;needle text;begin
 d:=replace(pg_get_functiondef('public.register_team_for_session(uuid,uuid,uuid[])'::regprocedure),E'\r\n',E'\n');
 needle:='where team_id = p_team_id and user_id = player_id'||E'\n    )';
 if position(needle in d)=0 then raise exception 'CONTRACT_GUEST_REGISTER_PATCH';end if;
 execute replace(d,needle,needle||' and not public.contract_guest_can_play(p_team_id,player_id,p_session_id)');
 d:=replace(pg_get_functiondef('public.update_team_registration_roster(uuid,uuid[])'::regprocedure),E'\r\n',E'\n');
 needle:='and membership.user_id = roster_player.player_id'||E'\n    )';
 if position(needle in d)=0 then raise exception 'CONTRACT_GUEST_EDIT_PATCH';end if;
 execute replace(d,needle,needle||' and not public.contract_guest_can_play(registration_row.team_id,roster_player.player_id,registration_row.session_id)');
 d:=replace(pg_get_functiondef('public.u2_registration_action(uuid,uuid,integer,jsonb,uuid)'::regprocedure),E'\r\n',E'\n');
 needle:='tm.team_id=target_id and tm.user_id=p.id)';
 if position(needle in d)=0 then raise exception 'CONTRACT_GUEST_MANAGER_PATCH';end if;
 execute replace(d,needle,needle||' and not public.contract_guest_can_play(target_id,p.id,p_session)');
 d:=replace(pg_get_functiondef('public.u5_reserve_eligible(uuid)'::regprocedure),E'\r\n',E'\n');
 needle:='tm.team_id=r.team_id and tm.user_id=player::uuid)';
 if position(needle in d)=0 then raise exception 'CONTRACT_GUEST_RESERVE_PATCH';end if;
 execute replace(d,needle,needle||' and not public.contract_guest_can_play(r.team_id,player::uuid,r.session_id)');
 d:=pg_get_functiondef('public.u2_registration_guard()'::regprocedure);
 needle:='if new.event_id<>s.event_id then raise exception ''Сессия другого мероприятия''; end if;';
 if position(needle in d)=0 then raise exception 'CONTRACT_GUEST_DIRECT_ROSTER_PATCH';end if;
 execute replace(d,needle,needle||' if not is_manager and new.team_id is not null and exists(select 1 from jsonb_array_elements_text(coalesce(new.roster_json,''[]'')) guest_player where not exists(select 1 from public.team_members tm where tm.team_id=new.team_id and tm.user_id=guest_player::uuid) and not public.contract_guest_can_play(new.team_id,guest_player::uuid,s.id)) then raise exception ''Игрок не состоит в организации и не имеет согласованного гостевого договора на эту сессию'';end if;');
end $$;
revoke all on function public.contract_guest_home_terms(uuid,uuid,timestamptz),public.contract_guest_capture(uuid,integer),public.contract_guest_query(uuid,uuid),public.contract_guest_consent(uuid,uuid,uuid,integer,uuid,boolean),
 public.contract_mutate_before_guests(uuid,jsonb),public.contract_mutate(uuid,jsonb),public.contract_guest_can_play(uuid,uuid,uuid),public.contract_available_guests(uuid,uuid),public.contract_guest_sessions(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.contract_guest_query(uuid,uuid),public.contract_guest_consent(uuid,uuid,uuid,integer,uuid,boolean),public.contract_mutate(uuid,jsonb),public.contract_guest_sessions(uuid,uuid) to service_role;
grant execute on function public.contract_available_guests(uuid,uuid) to authenticated;
commit;
