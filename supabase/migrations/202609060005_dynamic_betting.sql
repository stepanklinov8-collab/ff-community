-- Dynamic event betting. Quotes are calculated server-side and confirmed
-- atomically; existing wallets, bets and manually created markets are kept.

begin;

create table if not exists public.betting_sources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  clan_war_id uuid references public.clan_wars(id) on delete cascade,
  enabled boolean not null default false,
  enabled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (event_id is not null and clan_war_id is null)
    or (event_id is null and clan_war_id is not null)
  )
);

create unique index if not exists betting_sources_event_unique
  on public.betting_sources(event_id) where event_id is not null;
create unique index if not exists betting_sources_clan_war_unique
  on public.betting_sources(clan_war_id) where clan_war_id is not null;
create index if not exists betting_sources_enabled_idx
  on public.betting_sources(enabled, updated_at desc);

create table if not exists public.betting_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.betting_sources(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  game_id uuid references public.event_games(id) on delete cascade,
  clan_war_id uuid references public.clan_wars(id) on delete cascade,
  subject_team_id uuid not null references public.teams(id) on delete restrict,
  subject_team_name text not null,
  mode text not null check(mode in('tournament','training','bo','kv')),
  market_type text not null check(market_type in('kills_over','kills_under','exact_place','win','loss','exact_score')),
  selection_value text not null,
  line numeric(8,2),
  raw_odds numeric(12,6) not null,
  offered_odds numeric(8,2) not null check(offered_odds between 1.10 and 100),
  model_snapshot jsonb not null default '{}'::jsonb,
  locks_at timestamptz not null,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (event_id is not null and clan_war_id is null)
    or (event_id is null and clan_war_id is not null)
  ),
  check(game_id is null or mode in('tournament','training')),
  check(clan_war_id is null or mode='kv')
);

create index if not exists betting_quotes_user_expiry_idx
  on public.betting_quotes(user_id, expires_at desc);

create or replace function public.place_dynamic_site_bet_for(
  p_user_id uuid,
  p_quote_id uuid,
  p_stake bigint
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  q public.betting_quotes%rowtype;
  s public.economy_settings%rowtype;
  market_id uuid;
  bet_id uuid;
  wallet_balance bigint;
  payout bigint;
  own_team boolean := false;
  source_enabled boolean := false;
  actual_locks_at timestamptz;
begin
  select * into q
  from public.betting_quotes
  where id = p_quote_id and user_id = p_user_id
  for update;

  if q.id is null then raise exception 'Quote not found'; end if;
  if q.confirmed_at is not null then raise exception 'Quote already used'; end if;
  if now() >= q.expires_at then raise exception 'Quote expired'; end if;
  if q.offered_odds < 1.10 or q.raw_odds < 1.10 then raise exception 'Outcome unavailable'; end if;

  select source.enabled into source_enabled
  from public.betting_sources source
  where source.id = q.source_id
    and source.event_id is not distinct from q.event_id
    and source.clan_war_id is not distinct from q.clan_war_id
  limit 1;
  if not coalesce(source_enabled, false) then raise exception 'Betting source disabled'; end if;

  if q.event_id is not null then
    select min(session.start_time) into actual_locks_at
    from public.event_sessions session where session.event_id = q.event_id;
  else
    select war.scheduled_at into actual_locks_at
    from public.clan_wars war where war.id = q.clan_war_id;
  end if;
  if actual_locks_at is null or now() >= actual_locks_at then raise exception 'Market is closed'; end if;

  select * into s from public.economy_settings where singleton;
  if p_stake < s.minimum_stake or p_stake > s.maximum_stake then
    raise exception 'Stake is outside allowed limits';
  end if;

  select exists(
    select 1 from public.team_members membership
      where membership.team_id = q.subject_team_id and membership.user_id = p_user_id
    union all
    select 1 from public.event_registrations registration
      where registration.event_id = q.event_id
        and registration.team_id = q.subject_team_id
        and (
          registration.participant_user_id = p_user_id
          or registration.roster_json ? p_user_id::text
        )
    union all
    select 1 from public.clan_war_rosters roster
      where roster.clan_war_id = q.clan_war_id
        and roster.team_id = q.subject_team_id
        and p_user_id = any(roster.player_ids)
  ) into own_team;
  if own_team then raise exception 'You cannot bet on your own organization'; end if;

  select wallet.balance into wallet_balance
  from public.site_wallets wallet
  where wallet.user_id = p_user_id
  for update;
  if wallet_balance is null or wallet_balance < p_stake then raise exception 'Insufficient balance'; end if;

  -- Serialize first creation of the same generated market. Individual bets
  -- keep their own quoted odds, while settlement stays shared by outcome.
  perform pg_advisory_xact_lock(hashtext(
    coalesce(q.event_id::text, '') || ':' || coalesce(q.game_id::text, '') || ':' ||
    coalesce(q.clan_war_id::text, '') || ':' || q.subject_team_id::text || ':' ||
    q.market_type || ':' || q.selection_value || ':' || coalesce(q.line::text, '')
  ));

  select market.id into market_id
  from public.betting_markets market
  where market.event_id is not distinct from q.event_id
    and market.game_id is not distinct from q.game_id
    and market.clan_war_id is not distinct from q.clan_war_id
    and market.subject_team_id = q.subject_team_id
    and market.market_type = q.market_type
    and market.selection_value = q.selection_value
    and market.line is not distinct from q.line
    and market.status in ('open','locked')
  order by market.created_at desc
  limit 1
  for update;

  if market_id is null then
    insert into public.betting_markets(
      event_id, game_id, clan_war_id, subject_team_id, subject_team_name,
      mode, market_type, selection_value, line, odds, model_snapshot,
      locks_at, status
    ) values (
      q.event_id, q.game_id, q.clan_war_id, q.subject_team_id, q.subject_team_name,
      q.mode, q.market_type, q.selection_value, q.line, q.offered_odds,
      q.model_snapshot, actual_locks_at, 'open'
    ) returning id into market_id;
  else
    update public.betting_markets
    set odds = q.offered_odds,
        model_snapshot = q.model_snapshot,
        locks_at = actual_locks_at,
        status = 'open',
        updated_at = now()
    where id = market_id;
  end if;

  if exists(
    select 1 from public.site_bets bet
    where bet.user_id = p_user_id and bet.market_id = market_id
  ) then raise exception 'Bet already exists'; end if;

  payout := floor(p_stake * least(q.offered_odds, s.maximum_odds));
  insert into public.site_bets(user_id, market_id, stake, odds, potential_payout)
  values(p_user_id, market_id, p_stake, q.offered_odds, payout)
  returning id into bet_id;

  update public.site_wallets
  set balance = balance - p_stake, updated_at = now()
  where user_id = p_user_id
  returning balance into wallet_balance;

  insert into public.currency_ledger(
    user_id, amount, balance_after, operation_type,
    reference_type, reference_id, description
  ) values (
    p_user_id, -p_stake, wallet_balance, 'stake',
    'bet', bet_id, 'Ставка принята'
  );

  update public.betting_quotes set confirmed_at = now() where id = q.id;
  return bet_id;
end;
$$;

revoke all on function public.place_dynamic_site_bet_for(uuid,uuid,bigint)
  from public, anon, authenticated;
grant execute on function public.place_dynamic_site_bet_for(uuid,uuid,bigint)
  to service_role;

alter table public.betting_sources enable row level security;
alter table public.betting_quotes enable row level security;

drop policy if exists "admins view betting sources" on public.betting_sources;
create policy "admins view betting sources" on public.betting_sources
  for select using(public.is_app_admin());
grant select on public.betting_sources to authenticated;

-- Animated GIF files remain untouched in Storage so their animation survives.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id = 'avatars';

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id = 'event-images';

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
where id = 'stats-screenshots';

commit;
