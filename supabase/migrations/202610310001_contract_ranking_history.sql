-- Record observed public ranks. Never reconstruct an old board from today's
-- corrected results. One final board per changed transaction, not per player.
begin;
create table public.contract_ranking_history(
 id bigint generated always as identity primary key,
 observed_at timestamptz not null default clock_timestamp(),board jsonb not null
);
create index contract_ranking_history_time on public.contract_ranking_history(observed_at desc,id desc);
alter table public.contract_ranking_history enable row level security;
revoke all on public.contract_ranking_history from public,anon,authenticated,service_role;
create trigger contract_rank_history_immutable before update or delete on public.contract_ranking_history
 for each row execute function public.contract_frozen_guard();

create function public.contract_ranking_current() returns jsonb
language sql stable security definer set search_path=public as $$
 with history as (
   select * from public.competition_public_history where target_type='team' and source<>'legacy_unassigned' and mode in('tournament','training')
 ), totals as (
   select target_id,coalesce(sum(games),0)::integer games from history group by target_id
 ), eligible as (
   select target_id,row_number() over(partition by session_id order by id) n from history
   where wins=1 and public.u2_session_has_single_group(session_id)
 ), winners as (
   select target_id,count(*)::integer wins from eligible where n=1 group by target_id
 ), entities as (
   select t.id,t.type,r.exact_rating,case when h.target_id is not null then coalesce(w.wins,0) else coalesce(r.wins,0) end wins,coalesce(h.games,r.games,0) games
   from public.teams t join public.competition_ratings r on r.target_id=t.id and r.target_type='team' and r.mode='main'
   left join totals h on h.target_id=t.id left join winners w on w.target_id=t.id
   where t.dissolved_at is null and coalesce(t.verified,true)
 ), ranked as (
   select e.id,k.ranking,rank() over(partition by k.ranking order by e.exact_rating desc,e.wins desc,e.games desc) position
   from entities e cross join(values('organizations'),('teams'),('guilds')) k(ranking)
   where k.ranking='organizations' or k.ranking=case e.type when 'team' then 'teams' else 'guilds' end
 ), boards as (
   select ranking,jsonb_object_agg(id::text,position) board from ranked group by ranking
 ) select jsonb_build_object('organizations',coalesce((select board from boards where ranking='organizations'),'{}'),
   'teams',coalesce((select board from boards where ranking='teams'),'{}'),
   'guilds',coalesce((select board from boards where ranking='guilds'),'{}'))
$$;

create function public.contract_ranking_capture() returns void
language plpgsql security definer set search_path=public as $$
declare current_board jsonb;previous_board jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('contract-ranking-history',0));
 current_board:=public.contract_ranking_current();
 select board into previous_board from public.contract_ranking_history order by observed_at desc,id desc limit 1;
 if previous_board is distinct from current_board then insert into public.contract_ranking_history(board) values(current_board);end if;
 perform set_config('omcite.rank_dirty','off',true);
end $$;
create function public.contract_ranking_dirty() returns trigger
language plpgsql set search_path=public as $$
begin perform set_config('omcite.rank_dirty','on',true);return null;end $$;
create function public.contract_ranking_changed() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if TG_TABLE_NAME='teams' and TG_OP='UPDATE' then
   if (old.type,old.verified,old.dissolved_at) is not distinct from (new.type,new.verified,new.dissolved_at) then return null;end if;
 end if;
 if TG_TABLE_NAME='competition_ratings' then
   if TG_OP='DELETE' then
     if old.target_type<>'team' or old.mode<>'main' then return null;end if;
   elsif TG_OP='INSERT' then
     if new.target_type<>'team' or new.mode<>'main' then return null;end if;
   else
     if not(old.target_type='team' and old.mode='main' or new.target_type='team' and new.mode='main') then return null;end if;
     if (old.target_type,old.target_id,old.mode,old.exact_rating,old.wins,old.games) is not distinct from (new.target_type,new.target_id,new.mode,new.exact_rating,new.wins,new.games) then return null;end if;
   end if;
 end if;
 if current_setting('omcite.rank_dirty',true)='on' then perform public.contract_ranking_capture();end if;
 return null;
end $$;
do $$declare relation text;begin
 foreach relation in array array['competition_ratings','teams','competition_team_facts','organization_participation_history','competition_publications','event_groups'] loop
   execute format('create trigger contract_rank_dirty before insert or update or delete on public.%I for each statement execute function public.contract_ranking_dirty()',relation);
   execute format('create constraint trigger contract_rank_final after insert or update or delete on public.%I deferrable initially deferred for each row execute function public.contract_ranking_changed()',relation);
 end loop;
end $$;
-- Coverage begins now, including an empty board if no organizations qualify.
select public.contract_ranking_capture();
revoke all on function public.contract_ranking_current(),public.contract_ranking_capture(),public.contract_ranking_dirty(),public.contract_ranking_changed() from public,anon,authenticated,service_role;
commit;
