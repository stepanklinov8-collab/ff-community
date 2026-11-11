-- Ratings already live in competition_ratings. Persist their derived prices
-- too: opening a profile/catalog must not execute sporting-history formulas.
begin;
create table public.economy_value_cache (
 target_type text not null check(target_type in('player','team')),
 target_id uuid not null,
 exact_value numeric not null check(exact_value>=0),
 calculated_at timestamptz not null default clock_timestamp(),
 primary key(target_type,target_id)
);
create table public.economy_value_refresh_queue (
 transaction_id bigint primary key,
 all_players boolean not null default false,
 all_organizations boolean not null default false,
 player_ids uuid[] not null default '{}',
 organization_ids uuid[] not null default '{}'
);
alter table public.economy_value_cache enable row level security;
alter table public.economy_value_refresh_queue enable row level security;
revoke all on public.economy_value_cache,public.economy_value_refresh_queue from public,anon,authenticated,service_role;

-- Preserve the approved formulas without editing their mathematics. The
-- organization calculator now consumes the already refreshed exact player
-- values (not rounded display prices), avoiding repeated nested calculations.
alter function public.u5_player_value_exact(uuid) rename to u8_calculate_player_value;
alter function public.u5_organization_value_exact(uuid) rename to u8_calculate_organization_value;
create function public.u5_player_value_exact(p_user uuid) returns numeric
language sql stable security definer set search_path=public as $$
 select coalesce((select exact_value from public.economy_value_cache where target_type='player' and target_id=p_user),0)
$$;
create function public.u5_organization_value_exact(p_team uuid) returns numeric
language sql stable security definer set search_path=public as $$
 select coalesce((select exact_value from public.economy_value_cache where target_type='team' and target_id=p_team),0)
$$;

create function public.u8_queue_economy_values(p_all_players boolean default false,p_all_organizations boolean default false,p_players uuid[] default '{}',p_organizations uuid[] default '{}') returns void
language plpgsql security definer set search_path=public as $$
begin
 insert into public.economy_value_refresh_queue(transaction_id,all_players,all_organizations,player_ids,organization_ids)
 values(txid_current(),p_all_players,p_all_organizations,p_players,p_organizations)
 on conflict(transaction_id) do update set
  all_players=economy_value_refresh_queue.all_players or excluded.all_players,
  all_organizations=economy_value_refresh_queue.all_organizations or excluded.all_organizations,
  player_ids=case when economy_value_refresh_queue.all_players or excluded.all_players then '{}'::uuid[] else array(select distinct x from unnest(economy_value_refresh_queue.player_ids||excluded.player_ids) x where x is not null) end,
  organization_ids=case when economy_value_refresh_queue.all_organizations or excluded.all_organizations then '{}'::uuid[] else array(select distinct x from unnest(economy_value_refresh_queue.organization_ids||excluded.organization_ids) x where x is not null) end;
end $$;

create function public.u8_refresh_economy_values(p_all_players boolean,p_all_organizations boolean,p_players uuid[],p_organizations uuid[]) returns void
language plpgsql security definer set search_path=public as $$
declare entity uuid;affected uuid[]:=coalesce(p_organizations,'{}');
begin
 perform pg_advisory_xact_lock(hashtextextended('stored-economy-values',0));
 delete from public.economy_value_cache c where
  (c.target_type='player' and not exists(select 1 from public.profiles p where p.id=c.target_id))
  or(c.target_type='team' and not exists(select 1 from public.teams t where t.id=c.target_id));
 for entity in select p.id from public.profiles p where p_all_players or p.id=any(coalesce(p_players,'{}')) order by p.id loop
  insert into public.economy_value_cache(target_type,target_id,exact_value)
  values('player',entity,public.u8_calculate_player_value(entity))
  on conflict(target_type,target_id) do update set exact_value=excluded.exact_value,calculated_at=clock_timestamp();
 end loop;
 if not p_all_organizations then
  select array_agg(distinct x) into affected from (
   select unnest(affected) x union select tm.team_id from public.team_members tm where p_all_players or tm.user_id=any(coalesce(p_players,'{}'))
  ) organizations;
 end if;
 for entity in select t.id from public.teams t where p_all_organizations or t.id=any(coalesce(affected,'{}')) order by t.id loop
  insert into public.economy_value_cache(target_type,target_id,exact_value)
  values('team',entity,public.u8_calculate_organization_value(entity))
  on conflict(target_type,target_id) do update set exact_value=excluded.exact_value,calculated_at=clock_timestamp();
 end loop;
end $$;

create function public.u8_flush_economy_values() returns trigger
language plpgsql security definer set search_path=public as $$
declare pending public.economy_value_refresh_queue%rowtype;
begin
 -- Once per transaction, after all changed facts, ratings and rosters. A
 -- calculation error rolls back the write and its prices together.
 select * into pending from public.economy_value_refresh_queue where transaction_id=new.transaction_id;
 if not found then return null;end if;
 perform public.u8_refresh_economy_values(pending.all_players,pending.all_organizations,pending.player_ids,pending.organization_ids);
 delete from public.economy_value_refresh_queue where transaction_id=new.transaction_id;
 return null;
end $$;
create constraint trigger stored_economy_values_flush after insert on public.economy_value_refresh_queue
deferrable initially deferred for each row execute function public.u8_flush_economy_values();

create function public.u8_economy_source_changed() returns trigger
language plpgsql security definer set search_path=public as $$
declare before_row jsonb;after_row jsonb;entity uuid;kind text;old_entity uuid;
begin
 if tg_op<>'INSERT' then before_row:=to_jsonb(old);end if;
 if tg_op<>'DELETE' then after_row:=to_jsonb(new);end if;
 if tg_op='UPDATE' and after_row is not distinct from before_row then return null;end if;
 if tg_table_name='profiles' then
  if tg_op='UPDATE' and (after_row->'main_rating',after_row->'reputation_score') is not distinct from (before_row->'main_rating',before_row->'reputation_score') then return null;end if;
  entity:=coalesce(after_row->>'id',before_row->>'id')::uuid;
  perform public.u8_queue_economy_values(false,false,array[entity]);
 elsif tg_table_name='teams' then
  if tg_op='UPDATE' and after_row->'main_rating' is not distinct from before_row->'main_rating' then return null;end if;
  entity:=coalesce(after_row->>'id',before_row->>'id')::uuid;
  perform public.u8_queue_economy_values(false,
   coalesce((after_row->>'main_rating')::numeric,0) is distinct from coalesce((before_row->>'main_rating')::numeric,0),'{}',array[entity]);
 elsif tg_table_name='team_members' then
  if tg_op='UPDATE' and (after_row->'team_id',after_row->'user_id') is not distinct from (before_row->'team_id',before_row->'user_id') then return null;end if;
  perform public.u8_queue_economy_values(false,false,'{}',array[(after_row->>'team_id')::uuid,(before_row->>'team_id')::uuid]);
 elsif tg_table_name='competition_ratings' then
  kind:=coalesce(after_row->>'target_type',before_row->>'target_type');
  if coalesce(after_row->>'mode',before_row->>'mode')<>'main' then return null;end if;
  if tg_op='UPDATE' and (after_row->'target_type',after_row->'target_id',after_row->'mode',after_row->'exact_rating') is not distinct from (before_row->'target_type',before_row->'target_id',before_row->'mode',before_row->'exact_rating') then return null;end if;
  entity:=coalesce(after_row->>'target_id',before_row->>'target_id')::uuid;old_entity:=(before_row->>'target_id')::uuid;
  perform public.u8_queue_economy_values(false,kind='team',case when kind='player' then array[entity,old_entity] else '{}'::uuid[] end,case when kind='team' then array[entity,old_entity] else '{}'::uuid[] end);
 elsif tg_table_name='competition_publications' then
  if tg_op='UPDATE' and (after_row->'published',after_row->'first_published_at') is not distinct from (before_row->'published',before_row->'first_published_at') then return null;end if;
  if coalesce(after_row->>'first_published_at',before_row->>'first_published_at') is null then return null;end if;
  perform public.u8_queue_economy_values(true,true);
 elsif tg_table_name='events' then
  if tg_op='INSERT' then return null;end if;
  if tg_op='UPDATE' and (after_row->'type',after_row->'competition_rules',after_row->'cancelled_at',after_row->'final_session_id') is not distinct from (before_row->'type',before_row->'competition_rules',before_row->'cancelled_at',before_row->'final_session_id') then return null;end if;
  perform public.u8_queue_economy_values(true,true);
 elsif tg_table_name='event_sessions' then
  -- Adding an intermediate stage can turn a formerly single-stage tournament
  -- into a multi-stage one and change the eligibility of its earlier prizes.
  if tg_op='INSERT' and not exists(select 1 from public.competition_publications cp join public.event_sessions s on s.id=cp.session_id where s.event_id=(after_row->>'event_id')::uuid and cp.first_published_at is not null) then return null;end if;
  if tg_op='UPDATE' and (after_row->'status',after_row->'start_time',after_row->'stage',after_row->'source_session_id') is not distinct from (before_row->'status',before_row->'start_time',before_row->'stage',before_row->'source_session_id') then return null;end if;
  perform public.u8_queue_economy_values(true,true);
 elsif tg_table_name='event_games' then
  if tg_op='INSERT' then return null;end if;
  if tg_op='UPDATE' and (after_row->'status',after_row->'map_name') is not distinct from (before_row->'status',before_row->'map_name') then return null;end if;
  perform public.u8_queue_economy_values(true,true);
 else
  perform public.u8_queue_economy_values(true,true);
 end if;
 return null;
end $$;
do $$declare table_name text;begin
 foreach table_name in array array['profiles','teams','team_members','competition_ratings','competition_publications',
  'competition_player_facts','competition_team_facts','player_stats','organization_participation_history',
  'competition_award_entries','competition_game_forecasts','rating_event_settings','events','event_sessions','event_games','economy_settings'] loop
  execute format('create trigger stored_economy_source after insert or update or delete on public.%I for each row execute function public.u8_economy_source_changed()',table_name);
 end loop;
end $$;

-- First migration only: calculate every exact value in the original order.
-- Readers never use a fallback which recalculates on page visits.
select public.u8_refresh_economy_values(true,true,'{}','{}');
revoke all on function public.u8_calculate_player_value(uuid),public.u8_calculate_organization_value(uuid),
 public.u8_queue_economy_values(boolean,boolean,uuid[],uuid[]),public.u8_refresh_economy_values(boolean,boolean,uuid[],uuid[]),
 public.u8_flush_economy_values(),public.u8_economy_source_changed(),public.u5_player_value_exact(uuid),public.u5_organization_value_exact(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.u5_player_value_exact(uuid),public.u5_organization_value_exact(uuid) to service_role;
notify pgrst,'reload schema';
commit;
