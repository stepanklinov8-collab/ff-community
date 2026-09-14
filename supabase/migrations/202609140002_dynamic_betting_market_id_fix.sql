-- PostgreSQL resolves an unqualified PL/pgSQL variable against query columns.
-- Rename the local market id so the duplicate-bet check is unambiguous.

begin;

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
  resolved_market_id uuid;
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
  if q.confirmed_at is not null then
    select bet.id into bet_id
    from public.site_bets bet
    where bet.quote_id = q.id and bet.user_id = p_user_id
    limit 1;
    if bet_id is not null then return bet_id; end if;
    raise exception 'Quote already used';
  end if;
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
  if s.singleton is null then raise exception 'Betting settings unavailable'; end if;
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
  if wallet_balance is null then raise exception 'Wallet not found'; end if;
  if wallet_balance < p_stake then raise exception 'Insufficient balance'; end if;

  perform pg_advisory_xact_lock(hashtext(
    coalesce(q.event_id::text, '') || ':' || coalesce(q.game_id::text, '') || ':' ||
    coalesce(q.clan_war_id::text, '') || ':' || q.subject_team_id::text || ':' ||
    q.market_type || ':' || q.selection_value || ':' || coalesce(q.line::text, '')
  ));

  select market.id into resolved_market_id
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

  if resolved_market_id is null then
    insert into public.betting_markets(
      event_id, game_id, clan_war_id, subject_team_id, subject_team_name,
      mode, market_type, selection_value, line, odds, model_snapshot,
      locks_at, status
    ) values (
      q.event_id, q.game_id, q.clan_war_id, q.subject_team_id, q.subject_team_name,
      q.mode, q.market_type, q.selection_value, q.line, q.offered_odds,
      q.model_snapshot, actual_locks_at, 'open'
    ) returning id into resolved_market_id;
  else
    update public.betting_markets
    set odds = q.offered_odds,
        model_snapshot = q.model_snapshot,
        locks_at = actual_locks_at,
        status = 'open',
        updated_at = now()
    where id = resolved_market_id;
  end if;

  if exists(
    select 1 from public.site_bets bet
    where bet.user_id = p_user_id and bet.market_id = resolved_market_id
  ) then raise exception 'Bet already exists'; end if;

  payout := floor(p_stake * least(q.offered_odds, s.maximum_odds));
  insert into public.site_bets(user_id, market_id, quote_id, stake, odds, potential_payout)
  values(p_user_id, resolved_market_id, q.id, p_stake, q.offered_odds, payout)
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

notify pgrst, 'reload schema';

commit;
