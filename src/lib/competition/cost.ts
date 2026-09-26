export interface CompetitionCostInput {
  kills: number | null | undefined;
  deaths?: number | null;
  games: number | null | undefined;
  wins: number | null | undefined;
  rating: number | null | undefined;
  reputation: number | null | undefined;
}

const bounded = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

/**
 * Calculates the public player/team value from performance and trust signals.
 * The multiplier combines K/D, rating, reputation, win percentage, win count
 * and match volume while bounding every component.
 */
export function competitionCost(input: CompetitionCostInput) {
  const kills = Math.max(0, Number(input.kills ?? 0));
  const deaths = input.deaths === null || input.deaths === undefined ? null : Math.max(0, Number(input.deaths));
  const games = Math.max(0, Number(input.games ?? 0));
  const wins = Math.max(0, Number(input.wins ?? 0));
  if (games <= 0 && kills <= 0) return 0;

  const base = kills * 10 + games * 5;
  const usRatio = deaths === null ? kills / Math.max(1, games) : kills / Math.max(1, deaths);
  const usScore = bounded(usRatio * 10);
  const ratingScore = bounded(Number(input.rating ?? 1));
  const reputationScore = bounded(Number(input.reputation ?? 50));
  const winPercent = bounded((wins / Math.max(1, games)) * 100);
  const winCount = bounded(wins * 10);
  const matchVolume = bounded(games * 2);
  const quality = 0.30 * usScore + 0.20 * ratingScore + 0.15 * reputationScore + 0.15 * winPercent + 0.10 * winCount + 0.10 * matchVolume;
  return Math.max(0, Math.round(base * (0.5 + quality / 100)));
}
