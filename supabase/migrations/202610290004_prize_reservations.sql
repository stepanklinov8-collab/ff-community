begin;
alter table public.events add column prize_plan jsonb, add column prize_funding_error text;
create table public.event_prize_funds(
 session_id uuid primary key references public.event_sessions(id) on delete restrict,
 account_id uuid not null references public.coin_accounts(id),
 plan jsonb not null,
 total bigint not null check(total>0), held bigint not null check(held>=0),
 awards jsonb not null default '[]',
 cancelled boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table event_prize_funds enable row level security;
revoke all on event_prize_funds from anon,authenticated;
grant all on event_prize_funds to service_role;

create function public.u6_validate_prize_plan(p_plan jsonb) returns bigint
language plpgsql immutable set search_path=public as $$
declare value jsonb;total bigint:=0;
begin
 if jsonb_typeof(p_plan) is distinct from 'array' or jsonb_array_length(p_plan)>3 then raise exception 'Проверьте призы за первые три места';end if;
 for value in select * from jsonb_array_elements(p_plan) loop
   if jsonb_typeof(value)<>'number' or value::text!~'^\d+$' or (value::numeric)>1000000000000 then raise exception 'Приз должен быть целым неотрицательным числом';end if;
   total:=total+(value::text)::bigint;
 end loop;
 return total;
end $$;
create function public.u6_reserve_session_prizes(p_session uuid) returns void
language plpgsql security definer set search_path=public as $$
declare e events%rowtype;s event_sessions%rowtype;plan jsonb;total bigint;account_id uuid;a coin_accounts%rowtype;op uuid:=gen_random_uuid();
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 if exists(select 1 from event_prize_funds where session_id=p_session) then return;end if;
 select * into strict s from event_sessions where id=p_session;
 select * into strict e from events where id=s.event_id;
 if s.status='cancelled' or exists(select 1 from competition_publications where session_id=p_session and first_published_at is not null) then return;end if;
 plan:=coalesce(e.prize_plan,case when e.type='training' then '[250,150,100]'::jsonb else '[]'::jsonb end);
 total:=public.u6_validate_prize_plan(plan);
 if total=0 then return;end if;
 if e.type not in('training','tournament') or not public.u5_session_prizes_allowed(p_session)
 or (select count(*) from event_groups where session_id=p_session and is_active)<>1 then
   raise exception 'Денежные призы доступны обычной сессии с одной общей таблицей результатов';end if;
 if e.organizer_user_id is null then raise exception 'Укажите организатора для резервирования призов';end if;
 account_id:=public.u6_coin_account('player',e.organizer_user_id); select * into strict a from coin_accounts where id=account_id for update;
 if a.balance-a.reserved<total then
   raise exception using errcode='P6001',message=format('Недостаточно монет для призов: требуется %s, доступно %s, не хватает %s 🪙',total,greatest(0,a.balance-a.reserved),total-greatest(0,a.balance-a.reserved));
 end if;
 insert into coin_operations(id,actor_id,action,input,description)
 values(op,e.organizer_user_id,'prize_reserve',jsonb_build_object('sessionId',p_session),'Резерв призового фонда: '||e.title);
 perform public.u6_coin_entry(op,a.id,0,total);
 insert into event_prize_funds(session_id,account_id,plan,total,held) values(p_session,a.id,plan,total,total);
end $$;

create function public.u6_calculate_prizes(p_session uuid,p_published jsonb) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare f event_prize_funds%rowtype;row jsonb;prizes jsonb:='[]';place integer;seen integer[]:='{}';team_ids uuid[]:='{}';
begin
 select * into f from event_prize_funds where session_id=p_session;
 if not found then return coalesce(p_published->'prizes','[]');end if;
 if f.cancelled then return '[]';end if;
 for row in select * from jsonb_array_elements(p_published->'standings') loop
   if coalesce((row->>'gamesPlayed')::integer,0)<=0 then continue;end if;
   place:=(row->>'place')::integer;
   if place between 1 and jsonb_array_length(f.plan) and (f.plan->>(place-1))::bigint>0 then
     if place=any(seen) then raise exception 'Перед выплатой определите единственное место каждого призёра';end if;
     if row->>'teamId' is null or (row->>'teamId')::uuid=any(team_ids) or not exists(
       select 1 from event_registrations where id=(row->>'registrationId')::uuid and session_id=p_session and team_id=(row->>'teamId')::uuid
     ) then raise exception 'Проверьте организацию получателя приза';end if;
     seen:=array_append(seen,place);team_ids:=array_append(team_ids,(row->>'teamId')::uuid);
     prizes:=prizes||jsonb_build_array(jsonb_build_object('registrationId',row->>'registrationId','amount',(f.plan->>(place-1))::bigint));
   end if;
 end loop;
 return prizes;
end $$;

create function public.u6_settle_session_prizes(p_session uuid,p_awards jsonb,p_actor uuid,p_cancel boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare f event_prize_funds%rowtype;award jsonb;op uuid;target uuid;old_total bigint;new_total bigint;delta bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('main-coin-wallets',0));
 select * into f from event_prize_funds where session_id=p_session for update;
 if not found or f.cancelled then return;end if;
 if f.awards=p_awards and not p_cancel then return;end if;
 select coalesce(sum((x->>'amount')::bigint),0) into old_total from jsonb_array_elements(f.awards) x;
 select coalesce(sum((x->>'amount')::bigint),0) into new_total from jsonb_array_elements(p_awards) x;
 if new_total>f.total then raise exception 'Призы превышают зарезервированный фонд';end if;
 -- Reverse the old distribution inside this transaction, including spent
 -- funds. Recipients may have debt; no newly minted funds are used.
 if old_total>0 then
   op:=gen_random_uuid();
   insert into coin_operations(id,actor_id,action,input,description)
   values(op,p_actor,'prize_reversal',jsonb_build_object('sessionId',p_session),'Отмена прежнего распределения призов');
   for award in select * from jsonb_array_elements(f.awards) loop
     target:=public.u6_coin_account('organization',(award->>'teamId')::uuid);
     perform public.u6_coin_entry(op,target,-(award->>'amount')::bigint);
   end loop;
   perform public.u6_coin_entry(op,f.account_id,old_total,old_total);
 end if;
 if new_total>0 then
   op:=gen_random_uuid();
   insert into coin_operations(id,actor_id,action,input,description)
   values(op,p_actor,'prize_payout',jsonb_build_object('sessionId',p_session),'Призовые за итоговое место сессии');
   perform public.u6_coin_entry(op,f.account_id,-new_total,-new_total);
   for award in select * from jsonb_array_elements(p_awards) loop
     target:=public.u6_coin_account('organization',(award->>'teamId')::uuid);
     perform public.u6_coin_entry(op,target,(award->>'amount')::bigint);
   end loop;
 end if;
 delta:=f.total-new_total;
 if p_cancel and delta>0 then
   op:=gen_random_uuid();
   insert into coin_operations(id,actor_id,action,input,description)
   values(op,p_actor,'prize_release',jsonb_build_object('sessionId',p_session),'Освобождение фонда отменённой сессии');
   perform public.u6_coin_entry(op,f.account_id,0,-delta);
   delta:=0;
 end if;
 update event_prize_funds set awards=p_awards,held=delta,cancelled=p_cancel,updated_at=now() where session_id=p_session;
end $$;

create function public.u6_publication_prizes() returns trigger
language plpgsql security definer set search_path=public as $$
declare prizes jsonb;awards jsonb;
begin
 if new.first_published_at is null or new.published is null or not exists(select 1 from event_prize_funds where session_id=new.session_id) then return new;end if;
 if tg_op='UPDATE' and new.published is not distinct from old.published then return new;end if;
 if tg_when='BEFORE' then
   prizes:=public.u6_calculate_prizes(new.session_id,new.published);
   new.published:=jsonb_set(new.published,'{prizes}',prizes);
   new.draft:=jsonb_set(new.draft,'{prizes}',prizes);
 else
   select coalesce(jsonb_agg(jsonb_build_object('teamId',r.team_id,'amount',(p->>'amount')::bigint) order by r.team_id),'[]') into awards
   from jsonb_array_elements(new.published->'prizes') p join event_registrations r on r.id=(p->>'registrationId')::uuid and r.session_id=new.session_id;
   perform public.u6_settle_session_prizes(new.session_id,awards,new.updated_by);
 end if;
 return new;
end $$;
create trigger u6_prizes_before before insert or update on competition_publications for each row execute function u6_publication_prizes();
create trigger u6_prizes_after after insert or update on competition_publications for each row execute function u6_publication_prizes();
create function public.u6_cancel_session_prizes() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.status='cancelled' and old.status is distinct from new.status then
   perform public.u6_settle_session_prizes(new.id,'[]',null,true);
 end if;return new;
end $$;
create trigger u6_prize_cancel after update of status on event_sessions for each row execute function u6_cancel_session_prizes();

alter function public.u2_event_configuration(uuid,uuid,integer,jsonb,boolean,jsonb) rename to u6_event_configuration_base;
revoke all on function public.u6_event_configuration_base(uuid,uuid,integer,jsonb,boolean,jsonb) from public,anon,authenticated,service_role;
create function public.u2_event_configuration(p_actor uuid,p_event uuid,p_expected integer,p_config jsonb,p_approve boolean default false,p_recalculations jsonb default '[]')
returns jsonb language plpgsql security definer set search_path=public as $$
declare answer jsonb;event_id_value uuid;plan jsonb;s record;
begin
 perform pg_advisory_xact_lock(hashtextextended('competition-publication',0));
 plan:=coalesce(p_config->'prizePlan',case when p_config->>'type'='training' then '[250,150,100]'::jsonb else '[]'::jsonb end);
 perform public.u6_validate_prize_plan(plan);
 answer:=public.u6_event_configuration_base(p_actor,p_event,p_expected,p_config,p_approve,p_recalculations);
 event_id_value:=(answer->>'eventId')::uuid;
 if p_event is null or not (answer->>'pending')::boolean then
   if p_event is not null and exists(select 1 from events where id=event_id_value and organizer_user_id<>p_actor
     and coalesce(prize_plan,case when type='training' then '[250,150,100]'::jsonb else '[]'::jsonb end) is distinct from plan)
     and not public.u6_coin_admin(p_actor) then raise exception 'Нет прав менять обязательства чужого кошелька';end if;
   update events set prize_plan=plan,prize_funding_error=null where id=event_id_value;
   for s in select id from event_sessions where event_id=event_id_value and status<>'cancelled' and start_time>now() order by start_time,id loop
     if public.u6_validate_prize_plan(plan)>0 and not exists(select 1 from event_prize_funds where session_id=s.id)
       and exists(select 1 from events where id=event_id_value and organizer_user_id<>p_actor)
       and not public.u6_coin_admin(p_actor) then raise exception 'Резерв чужого баланса подтверждает организатор или администратор с доступом к монетам';end if;
     perform public.u6_reserve_session_prizes(s.id);
   end loop;
 end if;
 return answer;
end $$;

-- Each automatically created session and its reserve are one subtransaction.
-- Lack of funds keeps earlier successful dates and leaves generation retryable.
do $$
declare d text;
begin
 d:=pg_get_functiondef('public.u3_extend_training_schedules(timestamptz)'::regprocedure);
 if position('new_session:=gen_random_uuid();' in d)=0 or position('rotation_position:=rotation_position+1;' in d)=0 then raise exception 'Unsupported training scheduler';end if;
 d:=replace(d,'rotation_position integer;', 'funding_failed boolean:=false; funding_errors jsonb:=''[]''; funding_message text; rotation_position integer;');
 d:=replace(d,'event_added:=0;', 'event_added:=0; funding_failed:=false; update public.events set prize_funding_error=null where id=e.id;');
 d:=replace(d,'new_session:=gen_random_uuid();', 'begin new_session:=gen_random_uuid();');
 d:=replace(d,'event_added:=event_added+1;', 'perform public.u6_reserve_session_prizes(new_session); event_added:=event_added+1;');
 d:=replace(d,'rotation_position:=rotation_position+1;', $patch$
 rotation_position:=rotation_position+1;
 exception when sqlstate 'P6001' then
   get stacked diagnostics funding_message=MESSAGE_TEXT;
   funding_failed:=true;
   update public.events set prize_funding_error=funding_message where id=e.id;
   funding_errors:=funding_errors||jsonb_build_array(jsonb_build_object('eventId',e.id,'date',next_day,'error',funding_message));
   perform public.u2_notify_target('player',e.organizer_user_id,'training-funds:'||e.id||':'||next_day,'Не хватает монет на призы',funding_message,'/tournaments/'||e.id||'/edit');
   exit;
 end;
 $patch$);
 d:=replace(d,'training_generated_through=through_day,','training_generated_through=case when funding_failed then training_generated_through else through_day end,');
 d:=replace(d,'''sessions'',added,''through'',through_day)', '''sessions'',added,''through'',through_day,''fundingErrors'',funding_errors)');
 execute d;
end $$;
do $$ declare f record;begin
 for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace and proname like 'u6_%' loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;
end $$;
grant execute on function public.u6_coin_action(uuid,uuid,text,jsonb),public.u6_coin_admin(uuid),public.u6_calculate_prizes(uuid,jsonb) to service_role;
revoke all on function public.u2_event_configuration(uuid,uuid,integer,jsonb,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.u2_event_configuration(uuid,uuid,integer,jsonb,boolean,jsonb) to service_role;
notify pgrst, 'reload schema';
commit;
