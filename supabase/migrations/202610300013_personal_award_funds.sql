-- Personal awards have their own organizer-funded reserve. A tournament has
-- ONE such reserve across its stages; training has one per session. This
-- migration deliberately does not expose a payout endpoint before settlement
-- and correction/recovery have been installed.
begin;
alter table public.events add column personal_prizes jsonb not null default '{"mvp":0,"maxKills":0}';
create table public.personal_award_funds(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id),
 session_id uuid unique references public.event_sessions(id),
 account_id uuid not null references public.coin_accounts(id),
 plan jsonb not null,total bigint not null check(total>0),
 held bigint not null check(held>=0 and held<=total),
 cancelled_at timestamptz,
 created_at timestamptz not null default clock_timestamp()
);
create unique index personal_award_tournament_fund on public.personal_award_funds(event_id) where session_id is null;
alter table public.personal_award_funds enable row level security;
revoke all on public.personal_award_funds from public,anon,authenticated,service_role;

create function public.personal_award_validate(p_plan jsonb) returns bigint
language plpgsql immutable set search_path=public as $$
begin
 perform public.contract_assert_object(p_plan,array['mvp','maxKills'],array['mvp','maxKills']);
 perform public.contract_assert_uint(p_plan->'mvp',1000000000000);
 perform public.contract_assert_uint(p_plan->'maxKills',1000000000000);
 return (p_plan->>'mvp')::bigint+(p_plan->>'maxKills')::bigint;
end $$;

create function public.personal_award_reserve(p_event uuid,p_session uuid default null) returns void
language plpgsql security definer set search_path=public as $$
declare e public.events%rowtype;s public.event_sessions%rowtype;f public.personal_award_funds%rowtype;
 total_amount bigint;account uuid;wallet public.coin_accounts%rowtype;op uuid;cutoff timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into strict e from public.events where id=p_event;
 total_amount:=public.personal_award_validate(e.personal_prizes);
 if e.cancelled_at is not null then return;end if;
 if e.type='training' then
   select * into strict s from public.event_sessions where id=p_session and event_id=e.id;
   if s.status='cancelled' then return;end if;cutoff:=s.start_time;
 elsif e.type='tournament' and p_session is null then
   select min(start_time) into cutoff from public.event_sessions where event_id=e.id and status<>'cancelled';
 else
   if total_amount=0 then return;end if;
   raise exception 'Личные денежные награды доступны сессии тренировки или целому турниру';
 end if;
 select * into f from public.personal_award_funds where event_id=e.id and session_id is not distinct from p_session for update;
 if found then
   -- Already promised scopes never silently take a new plan from a template.
   -- A future training template only changes subsequently created sessions.
   if e.type='tournament' and f.plan is distinct from e.personal_prizes then
     raise exception 'Призы уже зарезервированного турнира нельзя менять';
   end if;
   return;
 end if;
 if total_amount=0 then return;end if;
 if cutoff is null or cutoff<=clock_timestamp() or exists(
   select 1 from public.event_sessions x join public.competition_publications cp on cp.session_id=x.id
   where x.event_id=e.id and(p_session is null or x.id=p_session) and cp.first_published_at is not null
 ) then raise exception 'Личный приз нужно резервировать до начала выступления';end if;
 if e.organizer_user_id is null then raise exception 'Укажите организатора личных призов';end if;
 account:=public.u6_coin_account('player',e.organizer_user_id);
 select * into strict wallet from public.coin_accounts where id=account for update;
 if wallet.balance-wallet.reserved<total_amount then
   raise exception using errcode='P6001',message=format('Недостаточно монет для личных призов: требуется %s, доступно %s',total_amount,greatest(0,wallet.balance-wallet.reserved));
 end if;
 op:=gen_random_uuid();
 insert into public.coin_operations(id,actor_id,action,input,description)
 values(op,e.organizer_user_id,'personal_award_reserve',jsonb_build_object('eventId',e.id,'sessionId',p_session),'Резерв личных наград: '||e.title);
 perform public.u6_coin_entry(op,account,0,total_amount);
 insert into public.personal_award_funds(event_id,session_id,account_id,plan,total,held)
 values(e.id,p_session,account,e.personal_prizes,total_amount,total_amount);
end $$;

create function public.personal_award_cancel(p_fund uuid) returns void
language plpgsql security definer set search_path=public as $$
declare f public.personal_award_funds%rowtype;op uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into f from public.personal_award_funds where id=p_fund for update;
 if not found or f.cancelled_at is not null then return;end if;
 if f.held>0 then
   op:=gen_random_uuid();
   insert into public.coin_operations(id,action,input,description)
   values(op,'personal_award_release',jsonb_build_object('fundId',f.id),'Возврат резерва личных наград отменённого выступления');
   perform public.u6_coin_entry(op,f.account_id,0,-f.held);
 end if;
 update public.personal_award_funds set held=0,cancelled_at=clock_timestamp() where id=f.id;
end $$;

create function public.personal_award_after_cancel() returns trigger
language plpgsql security definer set search_path=public as $$
declare item record;
begin
 if tg_table_name='events' then
   if new.cancelled_at is null then return new;end if;
   for item in select id from public.personal_award_funds where event_id=new.id and cancelled_at is null loop
     perform public.personal_award_cancel(item.id);
   end loop;
 else
   if new.status<>'cancelled' then return new;end if;
   for item in select id from public.personal_award_funds where session_id=new.id and cancelled_at is null loop
     perform public.personal_award_cancel(item.id);
   end loop;
   -- Losing one qualifying stage does not cancel the whole tournament prize.
   -- Losing ALL stages does.
   if not exists(select 1 from public.event_sessions where event_id=new.event_id and status<>'cancelled') then
     for item in select id from public.personal_award_funds where event_id=new.event_id and session_id is null and cancelled_at is null loop
       perform public.personal_award_cancel(item.id);
     end loop;
   end if;
 end if;
 return new;
end $$;
create trigger personal_award_cancel_event after update of cancelled_at on public.events for each row execute function public.personal_award_after_cancel();
create trigger personal_award_cancel_session after update of status on public.event_sessions for each row execute function public.personal_award_after_cancel();

-- Returns factual candidates, including anonymous guests. It NEVER pays a
-- lower-ranked registered player in place of an anonymous winner.
create function public.personal_award_candidates(p_event uuid,p_session uuid default null) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare e public.events%rowtype;s record;cp public.competition_publications%rowtype;
 completion jsonb;final_id uuid;session_ids uuid[];row jsonb;player jsonb;key_value text;
 players jsonb:='{}';entry jsonb;candidates jsonb;row_keys text[];seen_players text[];seen_game_players text[];
 kill_total bigint;best_place integer;max_kills bigint;best_mvp_place integer;row_key text;
begin
 select * into e from public.events where id=p_event;
 if not found then raise exception 'CONTRACT_EVENT';end if;
 if e.cancelled_at is not null then return jsonb_build_object('ready',true,'cancelled',true,'players','[]'::jsonb);end if;
 if e.type='training' and p_session is not null then
   if not exists(select 1 from public.event_sessions where id=p_session and event_id=e.id) then raise exception 'CONTRACT_EVENT';end if;
   final_id:=p_session;session_ids:=array[p_session];
 elsif e.type='tournament' and p_session is null then
   completion:=public.contract_tournament_completion(e.id);
   if completion->>'ready' is distinct from 'true' then return completion;end if;
   if completion->>'cancelled'='true' then return completion||jsonb_build_object('players','[]'::jsonb);end if;
   select array_agg(value::uuid) into session_ids from jsonb_array_elements_text(completion->'sessionIds');
   final_id:=(completion->>'finalSessionId')::uuid;
 else raise exception 'CONTRACT_EVENT';end if;
 for s in select * from public.event_sessions where id=any(session_ids) order by start_time,id loop
   if s.status='cancelled' then continue;end if;
   if s.end_time is null or s.end_time>clock_timestamp() then return jsonb_build_object('ready',false,'reason','sessions_not_finished');end if;
   select * into cp from public.competition_publications where session_id=s.id;
   if cp.first_published_at is null or cp.published is null then return jsonb_build_object('ready',false,'reason','unpublished_sessions');end if;
   if jsonb_typeof(cp.published->'rows') is distinct from 'array' then return jsonb_build_object('ready',false,'reason','incomplete_player_statistics');end if;
   row_keys:='{}';seen_game_players:='{}';
   -- Missing rows cannot make another participant the apparent kill leader.
   if exists(
     select 1 from public.event_games gm join public.event_groups grp on grp.id=gm.group_id
     join public.event_registrations reg on reg.group_id=grp.id and reg.session_id=s.id and reg.status='confirmed'
     where gm.session_id=s.id and gm.status<>'cancelled' and grp.is_active
     and not exists(select 1 from jsonb_array_elements(cp.published->'rows') r where r->>'gameId'=gm.id::text and r->>'registrationId'=reg.id::text)
   ) then return jsonb_build_object('ready',false,'reason','incomplete_player_statistics');end if;
   for row in select value from jsonb_array_elements(cp.published->'rows') loop
     row_key:=(row->>'gameId')||':'||(row->>'registrationId');
     if row_key is null or row_key=any(row_keys) or not exists(
       select 1 from public.event_games gm join public.event_registrations reg on reg.session_id=gm.session_id and reg.group_id=gm.group_id
       where gm.id=(row->>'gameId')::uuid and gm.session_id=s.id and reg.id=(row->>'registrationId')::uuid and reg.team_id=(row->>'teamId')::uuid
     ) then return jsonb_build_object('ready',false,'reason','invalid_result_identity');end if;
     row_keys:=array_append(row_keys,row_key);
     if row->>'played' is distinct from 'true' then continue;end if;
     if row->>'reason'='technical' and not exists(select 1 from jsonb_array_elements(coalesce(row->'players','[]')) p where p->>'played'='true') then continue;end if;
     if row->>'detail' is distinct from 'players' or jsonb_typeof(row->'players') is distinct from 'array' then return jsonb_build_object('ready',false,'reason','incomplete_player_statistics');end if;
     if exists(
       select 1 from public.event_registrations reg cross join lateral jsonb_array_elements(coalesce(reg.roster_snapshot,reg.roster_json,'[]')) rp
       where reg.id=(row->>'registrationId')::uuid and not exists(
         select 1 from jsonb_array_elements(row->'players') stat where stat->>'userId'=
           case when jsonb_typeof(rp)='string' then rp#>>'{}' when rp?'userId' then rp->>'userId' else rp->>'id' end
       )
     ) then return jsonb_build_object('ready',false,'reason','incomplete_player_statistics');end if;
     kill_total:=0;seen_players:='{}';
     select min((st->>'place')::integer) into best_place
     from public.competition_publications fp cross join lateral jsonb_array_elements(fp.published->'standings') st
     where fp.session_id=final_id and st->>'teamId'=row->>'teamId' and(st->>'gamesPlayed')::integer>0;
     best_place:=coalesce(best_place,2147483647);
     for player in select value from jsonb_array_elements(row->'players') loop
       if jsonb_typeof(player->'played') is distinct from 'boolean' then return jsonb_build_object('ready',false,'reason','incomplete_player_statistics');end if;
       if player->>'played'<>'true' then continue;end if;
       key_value:=case when player->>'userId' is not null then 'user:'||(player->>'userId') else 'guest:'||(player->>'id') end;
       if key_value is null or key_value=any(seen_players) or ((row->>'gameId')||':'||key_value)=any(seen_game_players) then return jsonb_build_object('ready',false,'reason','duplicate_player_statistics');end if;
       seen_players:=array_append(seen_players,key_value);seen_game_players:=array_append(seen_game_players,(row->>'gameId')||':'||key_value);
       if player->'kills' is null or player->'kills'='null'::jsonb then return jsonb_build_object('ready',false,'reason','incomplete_player_statistics');end if;
       perform public.contract_assert_uint(player->'kills',1000000);
       kill_total:=kill_total+(player->>'kills')::bigint;
       entry:=coalesce(players->key_value,jsonb_build_object('key',key_value,'userId',player->'userId','nickname',player->>'nickname','kills',0,'games',0,'teamPlace',best_place,'organizationIds','[]'::jsonb));
       if not(entry->'organizationIds' @> jsonb_build_array(row->>'teamId')) then entry:=entry||jsonb_build_object('organizationIds',(entry->'organizationIds')||jsonb_build_array(row->>'teamId'));end if;
       entry:=entry||jsonb_build_object('kills',(entry->>'kills')::bigint+(player->>'kills')::bigint,'games',(entry->>'games')::integer+1,'teamPlace',least((entry->>'teamPlace')::integer,best_place));
       players:=jsonb_set(players,array[key_value],entry);
     end loop;
     if row->'kills' is null or row->'kills'='null'::jsonb or kill_total<>(row->>'kills')::bigint then return jsonb_build_object('ready',false,'reason','incomplete_player_statistics');end if;
   end loop;
 end loop;
 select max((value->>'kills')::bigint) into max_kills from jsonb_each(players);
 select min((value->>'teamPlace')::integer) into best_mvp_place from jsonb_each(players) where(value->>'kills')::bigint=max_kills;
 select coalesce(jsonb_agg(value||jsonb_build_object('maxKillsCandidate',max_kills>0 and(value->>'kills')::bigint=max_kills,
   'mvpCandidate',max_kills>0 and(value->>'kills')::bigint=max_kills and(value->>'teamPlace')::integer=best_mvp_place)
   order by(value->>'kills')::bigint desc,(value->>'teamPlace')::integer,key),'[]') into candidates from jsonb_each(players);
 return jsonb_build_object('ready',true,'cancelled',false,'players',candidates,'finalSessionId',final_id);
end $$;

-- A deterministic distribution preview from frozen signed clauses. Execution
-- must persist this plan with its ledger operation, never trust caller amounts.
create function public.personal_award_distribution(p_fund uuid,p_kind text,p_winner text default null) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare f public.personal_award_funds%rowtype;candidates jsonb;winner jsonb;candidate_count integer;
 anchor record;matches integer;participation jsonb;amount bigint;player_amount bigint;organization_amount bigint:=0;
 player_net bigint;home_amount bigint;home record;home_entries jsonb:='[]';
begin
 if p_kind is null or p_kind not in('mvp','maxKills') then raise exception 'CONTRACT_INPUT';end if;
 select null::uuid as contract_id,null::integer as revision,null::uuid as organization_id,null::jsonb as terms,null::jsonb as conditions into anchor;
 select * into f from public.personal_award_funds where id=p_fund;
 if not found then raise exception 'CONTRACT_NOT_FOUND';end if;
 if f.cancelled_at is not null then return jsonb_build_object('ready',true,'cancelled',true,'amount',0);end if;
 amount:=(f.plan->>p_kind)::bigint;
 if amount=0 then return jsonb_build_object('ready',true,'amount',0);end if;
 candidates:=public.personal_award_candidates(f.event_id,f.session_id);
 if candidates->>'ready' is distinct from 'true' or candidates->>'cancelled'='true' then return candidates;end if;
 select count(*) into candidate_count from jsonb_array_elements(candidates->'players') p
 where p->>(case when p_kind='mvp' then 'mvpCandidate' else 'maxKillsCandidate' end)='true';
 if candidate_count=0 then return jsonb_build_object('ready',false,'reason','no_eligible_winner');end if;
 if p_winner is null and candidate_count<>1 then return jsonb_build_object('ready',false,'reason','winner_choice_required');end if;
 select p into winner from jsonb_array_elements(candidates->'players') p
 where p->>(case when p_kind='mvp' then 'mvpCandidate' else 'maxKillsCandidate' end)='true'
 and(p_winner is null or p->>'key'=p_winner);
 if winner is null then raise exception 'PERSONAL_AWARD_WINNER';end if;
 if winner->>'userId' is null then return jsonb_build_object('ready',false,'reason','winner_account_missing','winner',winner);end if;
 select count(*) into matches from (
   select t.contract_id from public.contract_session_terms t
   where f.session_id is not null and t.session_id=f.session_id and t.player_id=(winner->>'userId')::uuid
     and winner->'organizationIds' @> jsonb_build_array(t.organization_id::text)
   union all
   select t.contract_id from public.contract_tournament_terms t
   where f.session_id is null and t.event_id=f.event_id and t.player_id=(winner->>'userId')::uuid
     and winner->'organizationIds' @> jsonb_build_array(t.organization_id::text)
 ) matching;
 if matches>1 then return jsonb_build_object('ready',false,'reason','ambiguous_award_contract','winner',winner);end if;
 player_amount:=amount;
 if matches=1 then
   select t.contract_id,t.revision,t.organization_id,t.terms,t.conditions into anchor from public.contract_session_terms t
   where f.session_id is not null and t.session_id=f.session_id and t.player_id=(winner->>'userId')::uuid
     and winner->'organizationIds' @> jsonb_build_array(t.organization_id::text)
   union all
   select t.contract_id,t.revision,t.organization_id,t.terms,t.conditions from public.contract_tournament_terms t
   where f.session_id is null and t.event_id=f.event_id and t.player_id=(winner->>'userId')::uuid
     and winner->'organizationIds' @> jsonb_build_array(t.organization_id::text);
   if f.session_id is null then participation:=public.contract_tournament_accrual_plan(f.event_id,anchor.contract_id);
   else participation:=public.contract_session_accrual_plan(f.session_id,anchor.contract_id);end if;
   if participation->>'ready' is distinct from 'true' then return participation;end if;
   player_amount:=floor(amount::numeric*(anchor.conditions->>'personalShareBps')::integer/10000)::bigint;
   if participation->>'eligible' is distinct from 'true' or participation->>'limitIncluded'='false' then player_amount:=0;
   elsif anchor.terms->'participation'->>'mode'='proportional' then
     player_amount:=floor(player_amount::numeric*(participation->>'playedGames')::integer/nullif((participation->>'totalGames')::integer,0))::bigint;
   end if;
   organization_amount:=amount-player_amount;
 end if;
 player_net:=player_amount;
 if matches=1 then
   for home in select r.* from public.contract_guest_requirements r
     join public.contract_guest_activations a on a.contract_id=r.contract_id and a.revision=r.revision
     where r.contract_id=anchor.contract_id and r.revision=anchor.revision and r.compensation->>'kind'='percent' order by r.home_contract_id
   loop
     home_amount:=floor(player_amount::numeric*(home.compensation->>'basisPoints')::integer/10000)::bigint;
     player_net:=player_net-home_amount;
     if home_amount>0 then home_entries:=home_entries||jsonb_build_array(jsonb_build_object('organizationId',home.organization_id,'amount',home_amount));end if;
   end loop;
 end if;
 if player_net<0 then raise exception 'CONTRACT_PRIZE_SHARES';end if;
 return jsonb_build_object('ready',true,'fundId',f.id,'kind',p_kind,'amount',amount,'winner',winner,
   'contractId',case when matches=1 then anchor.contract_id else null end,'revision',case when matches=1 then anchor.revision else null end,
   'organizationId',case when matches=1 then anchor.organization_id else null end,'organizationAmount',organization_amount,
   'playerGross',player_amount,'playerAmount',player_net,'homeShares',home_entries);
end $$;

alter function public.u2_event_configuration(uuid,uuid,integer,jsonb,boolean,jsonb) rename to u6_event_configuration_before_personal_awards;
revoke all on function public.u6_event_configuration_before_personal_awards(uuid,uuid,integer,jsonb,boolean,jsonb) from public,anon,authenticated,service_role;
create function public.u2_event_configuration(p_actor uuid,p_event uuid,p_expected integer,p_config jsonb,p_approve boolean default false,p_recalculations jsonb default '[]')
returns jsonb language plpgsql security definer set search_path=public as $$
declare answer jsonb;event_id_value uuid;plan jsonb;item record;
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 plan:=coalesce(p_config->'personalPrizes','{"mvp":0,"maxKills":0}'::jsonb);
 perform public.personal_award_validate(plan);
 if p_event is not null and exists(select 1 from public.events e where e.id=p_event and e.type is distinct from p_config->>'type')
   and exists(select 1 from public.personal_award_funds where event_id=p_event and cancelled_at is null) then raise exception 'Нельзя менять формат мероприятия с зарезервированными личными призами';end if;
 if public.personal_award_validate(plan)>0 and p_config->>'type' not in('training','tournament') then raise exception 'Личные денежные награды доступны тренировкам и турнирам';end if;
 answer:=public.u6_event_configuration_before_personal_awards(p_actor,p_event,p_expected,p_config,p_approve,p_recalculations);
 event_id_value:=(answer->>'eventId')::uuid;
 if p_event is null or not(answer->>'pending')::boolean then
   if exists(select 1 from public.events where id=event_id_value and organizer_user_id is distinct from p_actor and personal_prizes is distinct from plan)
   and not public.u6_coin_admin(p_actor) then raise exception 'Нет прав менять обязательства чужого кошелька';end if;
   update public.events set personal_prizes=plan where id=event_id_value;
   if p_config->>'type'='tournament' then
     if public.personal_award_validate(plan)>0 and not exists(select 1 from public.personal_award_funds where event_id=event_id_value and session_id is null)
       and exists(select 1 from public.events where id=event_id_value and organizer_user_id is distinct from p_actor) and not public.u6_coin_admin(p_actor) then raise exception 'Резерв чужого баланса подтверждает организатор или администратор с доступом к монетам';end if;
     perform public.personal_award_reserve(event_id_value,null);
   elsif p_config->>'type'='training' then
     for item in select id from public.event_sessions where event_id=event_id_value and status<>'cancelled' and start_time>clock_timestamp() order by start_time,id loop
       if public.personal_award_validate(plan)>0 and not exists(select 1 from public.personal_award_funds where session_id=item.id)
         and exists(select 1 from public.events where id=event_id_value and organizer_user_id is distinct from p_actor) and not public.u6_coin_admin(p_actor) then raise exception 'Резерв чужого баланса подтверждает организатор или администратор с доступом к монетам';end if;
       perform public.personal_award_reserve(event_id_value,item.id);
     end loop;
   end if;
 end if;
 return answer;
end $$;

-- Preserve the scheduler's existing per-session exception block: a failed
-- personal reserve must roll back the new session AND its podium reserve.
do $$declare definition text;needle text;begin
 definition:=replace(pg_get_functiondef('public.u3_extend_training_schedules(timestamptz)'::regprocedure),E'\r\n',E'\n');
 needle:='perform public.u6_reserve_session_prizes(new_session);';
 if position(needle in definition)=0 then raise exception 'PERSONAL_AWARD_SCHEDULER_PATCH';end if;
 execute replace(definition,needle,needle||' perform public.personal_award_reserve(e.id,new_session);');
end $$;
revoke all on function public.personal_award_validate(jsonb),public.personal_award_reserve(uuid,uuid),public.personal_award_cancel(uuid),
 public.personal_award_after_cancel(),public.personal_award_candidates(uuid,uuid),public.personal_award_distribution(uuid,text,text),public.u2_event_configuration(uuid,uuid,integer,jsonb,boolean,jsonb)
 from public,anon,authenticated,service_role;
grant execute on function public.u2_event_configuration(uuid,uuid,integer,jsonb,boolean,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
