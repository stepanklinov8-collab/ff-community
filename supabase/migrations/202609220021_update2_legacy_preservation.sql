begin;
-- Private diagnostics, not additional sports results or an archive of old revisions.
create table public.competition_migration_review(
 entity_type text not null,entity_id uuid not null,reason text not null,
 details jsonb not null default '{}',created_at timestamptz not null default now(),
 primary key(entity_type,entity_id,reason)
);
alter table public.competition_migration_review enable row level security;
revoke all on public.competition_migration_review from public,anon,authenticated;
grant select on public.competition_migration_review to service_role;

-- Prefer an existing historical result name. Missing names are captured now,
-- explicitly flagged, and never represented as verified historical names.
create temporary table u2_snapshot_sources on commit drop as
select r.id,coalesce(nullif(r.name_snapshot,''),nullif(h.name,''),nullif(to_jsonb(r)->>'team_name_override',''),t.name,p.nickname,'Участник') name,
 h.roster,h.name is not null historical_name,r.roster_json,r.participant_user_id
from public.event_registrations r left join public.teams t on t.id=r.team_id left join public.profiles p on p.id=r.participant_user_id
left join lateral(
 select name,roster from(
  select x.team_name_snapshot name,x.roster_snapshot roster,coalesce(x.confirmed_at,x.created_at) occurred_at
  from public.event_game_results x join public.event_games g on g.id=x.game_id where g.session_id=r.session_id and x.team_id=r.team_id and x.status='confirmed'
  union all
  select x.organization_name,x.roster_snapshot,x.occurred_at from public.organization_participation_history x
  where x.session_id=r.session_id and x.organization_id=r.team_id and x.result_status='completed'
 ) candidates order by occurred_at desc nulls last limit 1
) h on true where r.roster_snapshot is null or r.name_snapshot is null;

insert into public.competition_migration_review(entity_type,entity_id,reason)
select 'registration',id,'names_captured_at_migration' from u2_snapshot_sources
where not historical_name or roster is null or jsonb_typeof(roster)<>'array'
 or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(roster)='array' then roster else '[]' end) x where jsonb_typeof(x)<>'object' or x->>'nickname' is null);

update public.event_registrations r set name_snapshot=coalesce(r.name_snapshot,s.name),
 roster_snapshot=coalesce(r.roster_snapshot,(
 select coalesce(jsonb_agg(jsonb_build_object('id',member.id,'nickname',coalesce(nullif(h.person->>'nickname',''),p.nickname,'Игрок'),'gameId',coalesce(h.person->>'gameId',p.game_id)) order by member.ordinality),'[]')
 from jsonb_array_elements_text(case when s.participant_user_id is not null then jsonb_build_array(s.participant_user_id::text) when jsonb_typeof(s.roster_json)='array' then s.roster_json else '[]' end) with ordinality member(id,ordinality)
 left join public.profiles p on p.id::text=member.id
 left join lateral(select person from jsonb_array_elements(case when jsonb_typeof(s.roster)='array' then s.roster else '[]' end) person where jsonb_typeof(person)='object' and coalesce(person->>'id',person->>'userId')=member.id limit 1) h on true
 )) from u2_snapshot_sources s where r.id=s.id;

insert into public.competition_migration_review(entity_type,entity_id,reason,details)
select 'group',g.id,'legacy_group_over_capacity',jsonb_build_object('capacity',g.capacity,'confirmed',count(*))
from public.event_groups g join public.event_registrations r on r.group_id=g.id and r.status='confirmed' group by g.id having count(*)>g.capacity;
insert into public.competition_migration_review(entity_type,entity_id,reason,details)
select 'player_stats',id,case when session_id is null then 'legacy_personal_aggregate_without_session' else 'legacy_personal_aggregate_without_places' end,
 jsonb_build_object('eventId',event_id,'sessionId',session_id,'games',matches_played,'kills',kills) from public.player_stats where status='approved';
insert into public.competition_migration_review(entity_type,entity_id,reason)
select 'warning',id,'legacy_warning_without_explicit_penalty' from public.warnings where not update2;
insert into public.competition_migration_review(entity_type,entity_id,reason)
select 'event_team_result',id,'legacy_event_total_without_game_breakdown' from public.event_team_results;

-- Nonzero historical rating is retained as legacy_game_rating by migration 002.
-- No publication/fact/warning is invented, no bets are settled in migration.
commit;
