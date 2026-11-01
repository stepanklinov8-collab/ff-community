-- Internal monetary part of signing/renewal. The public signature workflow
-- must validate both consents before calling this in the SAME transaction.
begin;
create table public.contract_financial_starts(
 contract_id uuid not null,revision integer not null,
 effective_at timestamptz not null check(isfinite(effective_at)),
 recorded_at timestamptz not null default clock_timestamp(),
 signing_obligation_id uuid not null references public.contract_obligations(id),
 primary key(contract_id,revision),
 foreign key(contract_id,revision) references public.organization_contract_versions(contract_id,revision)
);
alter table public.contract_financial_starts enable row level security;
revoke all on public.contract_financial_starts from public,anon,authenticated,service_role;

create function public.contract_financial_start(p_contract uuid,p_revision integer,p_effective timestamptz)
returns uuid language plpgsql security definer set search_path=public as $$
declare t jsonb;prior public.contract_financial_starts%rowtype;s record;bonus uuid;original boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if p_effective is null or not isfinite(p_effective) then raise exception 'CONTRACT_DATES';end if;
 select * into prior from public.contract_financial_starts where contract_id=p_contract and revision=p_revision;
 if found then
   if prior.effective_at<>p_effective then raise exception 'CONTRACT_CONFLICT';end if;
   return prior.signing_obligation_id;
 end if;
 select terms into t from public.organization_contract_versions where contract_id=p_contract and revision=p_revision;
 if not found then raise exception 'CONTRACT_NOT_FOUND';end if;
 perform public.contract_validate_terms(t);
 if p_effective<(t->>'startsAt')::timestamptz or (t->>'endsAt')::timestamptz<=p_effective then raise exception 'CONTRACT_DATES';end if;
 select * into prior from public.contract_financial_starts where contract_id=p_contract order by revision desc limit 1;
 if found and (prior.revision>=p_revision or prior.effective_at>=p_effective) then raise exception 'CONTRACT_CONFLICT';end if;
 for s in select revision from public.contract_salary_schedules where contract_id=p_contract and (ends_at is null or ends_at>p_effective) order by revision loop
   perform public.contract_salary_schedule_close(p_contract,s.revision,p_effective,'new contract revision');
 end loop;
 original:=not exists(select 1 from public.contract_obligations where contract_id=p_contract and kind='signing');
 -- Record a zero bonus too: later changing 0 to 100 is NOT a new welcome bonus.
 bonus:=public.contract_obligation_create(p_contract,p_revision,'signing','initial',
   (t->'financial'->>'signingAmount')::bigint,clock_timestamp(),true);
 perform public.contract_salary_schedule_create(p_contract,p_revision,p_effective);
 -- Both reserves have succeeded. An error above rolls back releases, records,
 -- and reserves together, leaving the previous agreement completely intact.
 insert into public.contract_financial_starts(contract_id,revision,effective_at,signing_obligation_id)
 values(p_contract,p_revision,p_effective,bonus);
 if original and (t->'financial'->>'signingAmount')::bigint>0 then
   perform public.contract_obligation_pay(null,gen_random_uuid(),bonus,(t->'financial'->>'signingAmount')::bigint,true);
 end if;
 return bonus;
end $$;
revoke all on function public.contract_financial_start(uuid,integer,timestamptz) from public,anon,authenticated,service_role;
commit;
