-- Deterministic accrual plan from frozen contract terms and a confirmed
-- publication. This is not a client-supplied payout and does not move coins.
begin;
create function public.contract_accrual_line(p_kind text,p_source text,p_amount numeric) returns jsonb
language plpgsql immutable set search_path=public as $$
begin
 if p_amount is null or p_amount<0 or p_amount>1000000000000 or p_amount<>floor(p_amount) then raise exception 'CONTRACT_ACCRUAL_AMOUNT';end if;
 if p_amount=0 then return '[]'::jsonb;end if;
 return jsonb_build_array(jsonb_build_object('kind',p_kind,'source',p_source,'amount',p_amount::bigint));
end $$;

create function public.contract_session_accrual_plan(p_session uuid,p_contract uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare f public.contract_session_frames%rowtype;t public.contract_session_terms%rowtype;publication public.competition_publications%rowtype;
 registrations jsonb;registration jsonb;game_ids uuid[];seen uuid[]:='{}';row jsonb;p jsonb;players jsonb;facts jsonb:='[]';fact jsonb;
 total integer;played integer:=0;kills bigint:=0;has_mvp boolean:=false;eligible boolean;failed boolean;amount numeric;
 entries jsonb:='[]';source text:='session:'||p_session;rate jsonb;game uuid;mode text;
begin
 select * into f from public.contract_session_frames where session_id=p_session;
 select * into t from public.contract_session_terms where session_id=p_session and contract_id=p_contract;
 if f.session_id is null or t.contract_id is null then raise exception 'CONTRACT_NOT_FOUND';end if;
 if exists(select 1 from public.event_sessions s join public.events e on e.id=s.event_id where s.id=p_session and(s.status='cancelled' or e.cancelled_at is not null))
 then return jsonb_build_object('ready',true,'cancelled',true,'entries','[]'::jsonb,'participationFailed',false);end if;
 select * into publication from public.competition_publications where session_id=p_session;
 if publication.first_published_at is null or publication.published is null then return jsonb_build_object('ready',false,'reason','unpublished','entries','[]'::jsonb);end if;
 select coalesce(jsonb_agg(r),'[]') into registrations from jsonb_array_elements(f.registrations) r where (r->>'organizationId')::uuid=t.organization_id;
 if jsonb_array_length(registrations)=0 then return jsonb_build_object('ready',true,'eligible',false,'participationFailed',false,'entries','[]'::jsonb);end if;
 if jsonb_array_length(registrations)<>1 then raise exception 'CONTRACT_RESULT_AMBIGUOUS';end if;
 registration:=registrations->0;
 select array_agg((g->>'id')::uuid order by g->>'id') into game_ids from jsonb_array_elements(f.games) g where g->>'groupId'=registration->>'groupId';
 total:=coalesce(cardinality(game_ids),0);
 if total=0 then return jsonb_build_object('ready',false,'reason','missing_games','entries','[]'::jsonb);end if;
 if jsonb_typeof(publication.published->'rows') is distinct from 'array' then raise exception 'CONTRACT_RESULT_INPUT';end if;
 for row in select value from jsonb_array_elements(publication.published->'rows') where value->>'registrationId'=registration->>'id' loop
   game:=(row->>'gameId')::uuid;
   if game is null or not game=any(game_ids) or row->>'teamId' is distinct from t.organization_id::text or row->>'groupId' is distinct from registration->>'groupId'
   then return jsonb_build_object('ready',false,'reason','game_configuration_changed','entries','[]'::jsonb);end if;
   if game=any(seen) then raise exception 'CONTRACT_RESULT_AMBIGUOUS';end if;seen:=array_append(seen,game);
   if jsonb_typeof(row->'played') is distinct from 'boolean' then raise exception 'CONTRACT_RESULT_INPUT';end if;
   if row->>'played'='false' then continue;end if;
   if row->>'detail' is distinct from 'players' or jsonb_typeof(row->'players') is distinct from 'array'
   then return jsonb_build_object('ready',false,'reason','incomplete_player_statistics','entries','[]'::jsonb);end if;
   select coalesce(jsonb_agg(value),'[]') into players from jsonb_array_elements(row->'players') where value->>'userId'=t.player_id::text;
   if jsonb_array_length(players)>1 then raise exception 'CONTRACT_RESULT_AMBIGUOUS';end if;
   if jsonb_array_length(players)=0 then continue;end if;
   p:=players->0;
   if jsonb_typeof(p->'played') is distinct from 'boolean' then raise exception 'CONTRACT_RESULT_INPUT';end if;
   if p->>'played'='false' then continue;end if;
   if p->'kills' is null or p->'kills'='null'::jsonb then return jsonb_build_object('ready',false,'reason','incomplete_player_statistics','entries','[]'::jsonb);end if;
   perform public.contract_assert_uint(p->'kills',1000000);
   -- One player's game cannot belong to two organizations in the same result.
   if (select count(*) from jsonb_array_elements(publication.published->'rows') r cross join lateral jsonb_array_elements(r->'players') u
     where r->>'gameId'=game::text and r->>'played'='true' and u->>'userId'=t.player_id::text and u->>'played'='true')<>1 then raise exception 'CONTRACT_RESULT_AMBIGUOUS';end if;
   played:=played+1;kills:=kills+(p->>'kills')::bigint;
   facts:=facts||jsonb_build_array(jsonb_build_object('gameId',game,'kills',p->'kills'));
 end loop;
 if cardinality(seen)<>total then return jsonb_build_object('ready',false,'reason','incomplete_games','entries','[]'::jsonb);end if;
 mode:=t.terms->'participation'->>'mode';
 failed:=mode='minimum' and played<(t.terms->'participation'->>'games')::integer;
 eligible:=played>0 and not failed;
 has_mvp:=coalesce(publication.published->'mvps','[]'::jsonb)?t.player_id::text;
 rate:=t.conditions;
 if eligible then
   for fact in select value from jsonb_array_elements(facts) loop
     entries:=entries||public.contract_accrual_line('appearance',source||':game:'||(fact->>'gameId'),(rate->>'perGame')::numeric);
     entries:=entries||public.contract_accrual_line('kill',source||':game:'||(fact->>'gameId'),(rate->>'perKill')::numeric*(fact->>'kills')::numeric);
   end loop;
   amount:=(rate->>'perSession')::numeric;
   if mode='proportional' then amount:=floor(amount*played/total);end if;
   entries:=entries||public.contract_accrual_line('appearance',source||':session',amount);
   if has_mvp then entries:=entries||public.contract_accrual_line('mvp',source||':mvp',(rate->>'perMvp')::numeric);end if;
 end if;
 -- perTournament is deliberately NOT repeated per session/qualifying group.
 -- A separate whole-event calculation must confirm the tournament is complete.
 -- A minimum-participation penalty also requires its explicit contract clause;
 -- this flag is an outcome, never permission to invent a fine or debit money.
 return jsonb_build_object('ready',true,'eligible',eligible,'participationFailed',failed,'playedGames',played,'totalGames',total,
   'kills',kills,'mvp',has_mvp,'revision',t.revision,'publicationRevision',publication.revision,'entries',entries);
end $$;
revoke all on function public.contract_accrual_line(text,text,numeric),public.contract_session_accrual_plan(uuid,uuid) from public,anon,authenticated,service_role;
commit;
