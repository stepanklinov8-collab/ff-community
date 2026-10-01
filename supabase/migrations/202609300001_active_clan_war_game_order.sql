begin;
-- Removed games keep their IDs and history. Only active positions must be unique.
-- Migration 023 removed the original constraint but left this second full index.
drop index if exists public.clan_war_games_war_game_unique;
create unique index if not exists clan_war_active_game_order
  on public.clan_war_games(clan_war_id,game_number) where is_active;
commit;
