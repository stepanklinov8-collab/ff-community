-- Ranking clauses are frozen by the signed revision active when their period
-- began. A renewal may continue coverage, but never replay the same bonus ID.
begin;
create table public.contract_ranking_runs(
 id uuid primary key default gen_random_uuid(),contract_id uuid not null,bonus_id uuid not null,revision integer not null,
 rule jsonb not null,status text not null check(status in('earned','not_earned','history_missing','late_signature')),
 assessment jsonb not null,obligation_id uuid references public.contract_obligations(id),
 evaluated_at timestamptz not null default clock_timestamp(),unique(contract_id,bonus_id),
 foreign key(contract_id,revision) references public.contract_agreements(contract_id,revision)
);
alter table public.contract_ranking_runs enable row level security;
revoke all on public.contract_ranking_runs from public,anon,authenticated,service_role;
create trigger contract_ranking_run_immutable before update or delete on public.contract_ranking_runs for each row execute function public.contract_frozen_guard();

create function public.contract_ranking_assess(p_organization uuid,p_rule jsonb) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare first_row public.contract_ranking_history%rowtype;last_row public.contract_ranking_history%rowtype;
 starts timestamptz;ends timestamptz;ranking text;mode_value text;top_value bigint;best bigint;worst bigint;missing boolean;position_value bigint;qualified boolean;observations bigint;
begin
 perform public.contract_assert_object(p_rule,array['id','ranking','mode','top','startsAt','endsAt','amount'],array['id','ranking','mode','top','startsAt','endsAt','amount']);
 perform public.contract_assert_timestamp(p_rule->'startsAt');perform public.contract_assert_timestamp(p_rule->'endsAt');
 perform public.contract_assert_uint(p_rule->'top',1000000);perform public.contract_assert_uint(p_rule->'amount',1000000000000);
 starts:=(p_rule->>'startsAt')::timestamptz;ends:=(p_rule->>'endsAt')::timestamptz;ranking:=p_rule->>'ranking';mode_value:=p_rule->>'mode';top_value:=(p_rule->>'top')::bigint;
 if ends<=starts or top_value=0 or coalesce(ranking,'') not in('organizations','teams','guilds') or coalesce(mode_value,'') not in('at_end','best','throughout') then raise exception 'CONTRACT_INPUT';end if;
 if ends>clock_timestamp() then return jsonb_build_object('status','pending','reason','period_open');end if;
 select * into first_row from public.contract_ranking_history where observed_at<=starts order by observed_at desc,id desc limit 1;
 select * into last_row from public.contract_ranking_history where observed_at<=ends order by observed_at desc,id desc limit 1;
 if last_row.id is null then return jsonb_build_object('status','history_missing','reason','no_period_coverage');end if;
 select min(position),max(position),bool_or(position is null),count(*) into best,worst,missing,observations from(
   select (board->ranking->>p_organization::text)::bigint position from public.contract_ranking_history
   where id=first_row.id or observed_at>starts and observed_at<=ends
 ) positions;
 position_value:=(last_row.board->ranking->>p_organization::text)::bigint;
 qualified:=case mode_value when 'at_end' then coalesce(position_value<=top_value,false)
   when 'best' then coalesce(best<=top_value,false)
   else not coalesce(missing,true) and coalesce(worst<=top_value,false) end;
 -- The final place needs only an end observation. A documented top entry is
 -- sufficient proof for "best" even when older observations are unavailable.
 -- Otherwise incomplete coverage cannot prove best/throughout attainment.
 if first_row.id is null and mode_value<>'at_end'
   and not(mode_value='best' and qualified)
   and not(mode_value='throughout' and (coalesce(missing,false) or coalesce(worst>top_value,false))) then
   return jsonb_build_object('status','history_missing','reason','no_period_coverage');
 end if;
 return jsonb_build_object('status',case when qualified then 'earned' else 'not_earned' end,
   'firstSnapshotId',first_row.id,'lastSnapshotId',last_row.id,'bestPosition',best,'worstPosition',worst,
   'endPosition',position_value,'missingOrganization',missing,'observations',observations,'completePeriodHistory',first_row.id is not null);
end $$;

create function public.contract_ranking_settle(p_contract uuid,p_bonus uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;candidate record;existing public.contract_ranking_runs%rowtype;
 assessment jsonb;coverage tstzmultirange;obligation uuid;row_value public.contract_obligations%rowtype;starts timestamptz;ends timestamptz;funded boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into existing from public.contract_ranking_runs where contract_id=p_contract and bonus_id=p_bonus;
 if found then return existing.assessment||jsonb_build_object('status',existing.status,'obligationId',existing.obligation_id,'repeated',true);end if;
 select * into c from public.organization_contracts where id=p_contract;
 if c.id is null then raise exception 'CONTRACT_NOT_FOUND';end if;
 -- The effective interval selects the signed revision active at period start.
 -- Later amendments cannot introduce retroactive earning or change its rate.
 select a.revision,a.signed_at,a.effective_at,rule,a.effective_at<=(rule->>'startsAt')::timestamptz as active_at_start into candidate from public.contract_agreements a
 join public.organization_contract_versions v using(contract_id,revision)
 cross join lateral jsonb_array_elements(coalesce(v.terms->'financial'->'rankingBonuses','[]')) rule
 where a.contract_id=p_contract and rule->>'id'=p_bonus::text
   and (a.effective_at>(rule->>'startsAt')::timestamptz or coalesce(public.contract_effective_end(a.contract_id,a.revision),'infinity')>(rule->>'startsAt')::timestamptz)
 order by active_at_start desc,(rule->>'startsAt')::timestamptz,a.revision desc limit 1;
 if not found then return jsonb_build_object('status','not_applicable','reason','no_agreement_at_start');end if;
 starts:=(candidate.rule->>'startsAt')::timestamptz;ends:=(candidate.rule->>'endsAt')::timestamptz;
 if ends>clock_timestamp() then return jsonb_build_object('status','pending','reason','period_open');end if;
 if candidate.signed_at>starts or candidate.effective_at>starts then assessment:=jsonb_build_object('status','late_signature','reason','signed_after_period_start');
 else
   select range_agg(tstzrange(greatest(a.effective_at,a.signed_at),coalesce(public.contract_effective_end(a.contract_id,a.revision),'infinity'),'[)')) into coverage
   from public.contract_agreements a where a.contract_id=p_contract
     and greatest(a.effective_at,a.signed_at)<coalesce(public.contract_effective_end(a.contract_id,a.revision),'infinity');
   if coverage is null or not(coverage @> tstzrange(starts,ends,'[)')) then
     assessment:=jsonb_build_object('status','not_earned','reason','contract_ended_before_period');
   else assessment:=public.contract_ranking_assess(c.organization_id,candidate.rule);end if;
 end if;
 if assessment->>'status'='earned' then
   funded:=exists(select 1 from public.coin_accounts where team_id=c.organization_id and balance-reserved>=(candidate.rule->>'amount')::bigint);
   obligation:=public.contract_obligation_create(p_contract,candidate.revision,'ranking','ranking:'||p_bonus::text,(candidate.rule->>'amount')::bigint,ends,funded);
   select * into strict row_value from public.contract_obligations where id=obligation;
   if row_value.cancelled_at is null and row_value.amount>row_value.paid and row_value.held>=row_value.amount-row_value.paid then
     perform public.contract_obligation_pay(null,gen_random_uuid(),obligation,row_value.amount-row_value.paid,true);
   end if;
 end if;
 insert into public.contract_ranking_runs(contract_id,bonus_id,revision,rule,status,assessment,obligation_id)
 values(p_contract,p_bonus,candidate.revision,candidate.rule,assessment->>'status',assessment,obligation);
 return assessment||jsonb_build_object('obligationId',obligation);
end $$;

create function public.contract_ranking_query(p_actor uuid,p_contract uuid,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare c public.organization_contracts%rowtype;rows_value jsonb;begin
 if p_actor is null then raise exception 'CONTRACT_AUTH';end if;
 select * into c from public.organization_contracts where id=p_contract;
 if c.id is null or not(coalesce(public.can_manage_organization_contracts(c.organization_id,p_actor),false)
   or c.player_id=p_actor and exists(select 1 from public.organization_contract_versions v where v.contract_id=c.id and v.offered_at is not null)) then raise exception 'CONTRACT_NOT_FOUND';end if;
 if p_offset is null or p_offset not between 0 and 1000000 then raise exception 'CONTRACT_INPUT';end if;
 select coalesce(jsonb_agg(to_jsonb(row_value) order by row_value."evaluatedAt" desc,row_value.id),'[]') into rows_value from(
   select r.id,r.revision,r.rule,r.status,r.assessment,r.obligation_id as "obligationId",r.evaluated_at as "evaluatedAt"
   from public.contract_ranking_runs r where r.contract_id=c.id order by r.evaluated_at desc,r.id limit 31 offset p_offset
 ) row_value;
 return jsonb_build_object('rows',coalesce((select jsonb_agg(value order by n) from jsonb_array_elements(rows_value) with ordinality x(value,n) where n<=30),'[]'),
   'hasMore',jsonb_array_length(rows_value)>30,'coverageSince',(select min(observed_at) from public.contract_ranking_history));
end $$;

alter function public.contract_maintenance_run() rename to contract_maintenance_before_rankings;
create function public.contract_maintenance_run() returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;job record;count_value integer:=0;previous text:=coalesce(current_setting('omcite.rental_defer',true),'off');
begin
 result:=public.contract_maintenance_before_rankings();
 -- A change-free board remains valid; a current capture never backdates it.
 perform public.contract_ranking_capture();
 perform set_config('omcite.rental_defer','on',true);
 for job in select distinct a.contract_id,(rule->>'id')::uuid bonus_id,(rule->>'endsAt')::timestamptz ends
   from public.contract_agreements a join public.organization_contract_versions v using(contract_id,revision)
   cross join lateral jsonb_array_elements(coalesce(v.terms->'financial'->'rankingBonuses','[]')) rule
   where (rule->>'endsAt')::timestamptz<=clock_timestamp()
     and (a.effective_at>(rule->>'startsAt')::timestamptz or coalesce(public.contract_effective_end(a.contract_id,a.revision),'infinity')>(rule->>'startsAt')::timestamptz)
     and not exists(select 1 from public.contract_ranking_runs r where r.contract_id=a.contract_id and r.bonus_id=(rule->>'id')::uuid)
   order by ends,a.contract_id,bonus_id limit 100
 loop perform public.contract_ranking_settle(job.contract_id,job.bonus_id);count_value:=count_value+1;end loop;
 perform set_config('omcite.rental_defer',previous,true);
 if previous<>'on' then
   for job in select distinct r.contract_id,r.revision from public.contract_ranking_runs r where r.evaluated_at>=transaction_timestamp() and r.status='earned' loop
     perform public.contract_rental_refresh(job.contract_id,job.revision);
   end loop;
 end if;
 return result||jsonb_build_object('rankingBonuses',count_value);
exception when others then perform set_config('omcite.rental_defer',previous,true);raise;
end $$;
revoke all on function public.contract_ranking_assess(uuid,jsonb),public.contract_ranking_settle(uuid,uuid),public.contract_ranking_query(uuid,uuid,integer),public.contract_maintenance_before_rankings(),public.contract_maintenance_run() from public,anon,authenticated,service_role;
grant execute on function public.contract_ranking_query(uuid,uuid,integer),public.contract_maintenance_run() to service_role;
commit;
