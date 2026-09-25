import { readFile } from "node:fs/promises";
const token = (await readFile("C:/Users/Lenovo/.supabase/access-token", "utf8")).trim();
const staging = JSON.parse(await readFile("tools/database-tests/artifacts/staging-private.json", "utf8"));
const query = `
create table if not exists public.event_results (
 id uuid primary key default gen_random_uuid(), event_id uuid references public.events(id) on delete cascade,
 winner_team_id uuid references public.teams(id) on delete set null, score text, mvp_user_id uuid references auth.users(id) on delete set null,
 created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.contacts (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade,
 name text, value text, type text, created_at timestamptz default now()
);
create table if not exists public.player_transfers (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), from_team_id uuid, to_team_id uuid, created_at timestamptz default now()
);
create table if not exists public.stats_change_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), event_id uuid, before_values jsonb, after_values jsonb, created_at timestamptz default now()
);
alter table public.activity_log add column if not exists created_at timestamptz default now();
alter table public.comments add column if not exists created_at timestamptz default now();
alter table public.player_transfers add column if not exists created_at timestamptz default now();
alter table public.stats_change_logs add column if not exists created_at timestamptz default now();
alter table public.clan_wars add column if not exists created_at timestamptz default now();
alter table public.clan_war_responses add column if not exists created_at timestamptz default now();
alter table public.clan_war_rosters add column if not exists created_at timestamptz default now();
alter table public.clan_war_comments add column if not exists created_at timestamptz default now();
alter table public.economy_settings add column if not exists currency_name text default 'Монеты Арены';
alter table public.economy_settings add column if not exists starting_balance bigint default 1000;
alter table public.economy_settings add column if not exists changed_by uuid references auth.users(id) on delete set null;
alter table public.economy_settings add column if not exists updated_at timestamptz default now();
alter table public.reputation_reviews add column if not exists event_id uuid;
alter table public.reputation_reviews add column if not exists reviewer_id uuid;
alter table public.reputation_reviews add column if not exists created_at timestamptz default now();
alter table public.reputation_ledger add column if not exists created_at timestamptz default now();
alter table public.organization_participation_history add column if not exists season text;
alter table public.organization_participation_history add column if not exists score text;
alter table public.organization_participation_history add column if not exists created_at timestamptz default now();
alter table public.organization_history_change_logs add column if not exists created_at timestamptz default now();
alter table public.event_games add column if not exists map_name text default 'bermuda';
alter table public.event_games add column if not exists created_at timestamptz default now();
alter table public.site_wallets add column if not exists created_at timestamptz default now();
alter table public.betting_markets add column if not exists created_by uuid;
alter table public.teams add column if not exists created_at timestamptz default now();
create table if not exists public.bloggers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text default 'pending',
  created_at timestamptz default now()
);
alter table public.profiles add column if not exists avatar_url text;
alter table public.teams add column if not exists avatar_url text;
`;
const response = await fetch(`https://api.supabase.com/v1/projects/${staging.project.ref}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }), signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(await response.text());
console.log("Legacy compatibility tables ensured");
