-- Standalone clan wars (КВ). Additive migration: legacy event rows stay intact.

begin;

create table if not exists public.clan_wars (
  id uuid primary key default gen_random_uuid(),
  creator_team_id uuid not null references public.teams(id) on delete cascade,
  opponent_team_id uuid references public.teams(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  description text,
  rules text,
  format integer not null check (format in (4, 6)),
  challenge_kind text not null default 'open' check (challenge_kind in ('open', 'direct')),
  status text not null default 'open' check (status in ('open', 'pending', 'agreed', 'completed', 'cancelled')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clan_wars_distinct_teams check (opponent_team_id is null or opponent_team_id <> creator_team_id),
  constraint clan_wars_direct_has_opponent check (challenge_kind = 'open' or opponent_team_id is not null)
);

create table if not exists public.clan_war_responses (
  id uuid primary key default gen_random_uuid(),
  clan_war_id uuid not null references public.clan_wars(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  message text check (message is null or char_length(message) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clan_war_id, team_id)
);

create table if not exists public.clan_war_rosters (
  id uuid primary key default gen_random_uuid(),
  clan_war_id uuid not null references public.clan_wars(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_ids uuid[] not null,
  submitted_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clan_war_id, team_id)
);

create table if not exists public.clan_war_comments (
  id uuid primary key default gen_random_uuid(),
  clan_war_id uuid not null references public.clan_wars(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  is_edited boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clan_wars_status_created_idx on public.clan_wars(status, created_at desc);
create index if not exists clan_wars_creator_idx on public.clan_wars(creator_team_id, created_at desc);
create index if not exists clan_wars_opponent_idx on public.clan_wars(opponent_team_id, created_at desc);
create index if not exists clan_war_responses_war_idx on public.clan_war_responses(clan_war_id, created_at);
create index if not exists clan_war_comments_war_idx on public.clan_war_comments(clan_war_id, created_at);

create or replace function public.touch_clan_war_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_clan_wars_updated_at on public.clan_wars;
create trigger touch_clan_wars_updated_at
before update on public.clan_wars
for each row execute function public.touch_clan_war_updated_at();

drop trigger if exists touch_clan_war_responses_updated_at on public.clan_war_responses;
create trigger touch_clan_war_responses_updated_at
before update on public.clan_war_responses
for each row execute function public.touch_clan_war_updated_at();

drop trigger if exists touch_clan_war_rosters_updated_at on public.clan_war_rosters;
create trigger touch_clan_war_rosters_updated_at
before update on public.clan_war_rosters
for each row execute function public.touch_clan_war_updated_at();

drop trigger if exists touch_clan_war_comments_updated_at on public.clan_war_comments;
create trigger touch_clan_war_comments_updated_at
before update on public.clan_war_comments
for each row execute function public.touch_clan_war_updated_at();

create or replace function public.enforce_clan_war_roster()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  required_size integer;
  valid_members integer;
  participant_allowed boolean;
begin
  select format into required_size
  from public.clan_wars
  where id = new.clan_war_id;

  if required_size is null then
    raise exception 'Clan war does not exist';
  end if;

  if cardinality(new.player_ids) <> required_size then
    raise exception 'Roster must contain exactly % players', required_size;
  end if;

  if cardinality(new.player_ids) <> (
    select count(distinct roster_player.player_id)
    from unnest(new.player_ids) as roster_player(player_id)
  ) then
    raise exception 'Roster contains duplicate players';
  end if;

  select (
    war.creator_team_id = new.team_id
    or war.opponent_team_id = new.team_id
    or exists (
      select 1 from public.clan_war_responses response
      where response.clan_war_id = new.clan_war_id
        and response.team_id = new.team_id
        and response.status in ('pending', 'accepted')
    )
  ) into participant_allowed
  from public.clan_wars war
  where war.id = new.clan_war_id;

  if not coalesce(participant_allowed, false) then
    raise exception 'Organization is not a participant of this clan war';
  end if;

  select count(*) into valid_members
  from public.team_members membership
  where membership.team_id = new.team_id
    and membership.user_id = any(new.player_ids);

  if valid_members <> required_size then
    raise exception 'Every roster player must belong to the organization';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_clan_war_roster_trigger on public.clan_war_rosters;
create trigger enforce_clan_war_roster_trigger
before insert or update of clan_war_id, team_id, player_ids on public.clan_war_rosters
for each row execute function public.enforce_clan_war_roster();

alter table public.clan_wars enable row level security;
alter table public.clan_war_responses enable row level security;
alter table public.clan_war_rosters enable row level security;
alter table public.clan_war_comments enable row level security;

drop policy if exists "clan wars are public" on public.clan_wars;
create policy "clan wars are public" on public.clan_wars for select using (true);

drop policy if exists "clan war responses are public" on public.clan_war_responses;
create policy "clan war responses are public" on public.clan_war_responses for select using (true);

drop policy if exists "clan war rosters are public" on public.clan_war_rosters;
create policy "clan war rosters are public" on public.clan_war_rosters for select using (true);

drop policy if exists "visible clan war comments are public" on public.clan_war_comments;
create policy "visible clan war comments are public" on public.clan_war_comments
for select using (not is_deleted or public.is_app_admin());

grant select on public.clan_wars to anon, authenticated;
grant select on public.clan_war_responses to anon, authenticated;
grant select on public.clan_war_rosters to anon, authenticated;
grant select on public.clan_war_comments to anon, authenticated;

commit;
