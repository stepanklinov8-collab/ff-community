export interface CompetitionCostInput {
  kills: number | null | undefined;
  deaths?: number | null;
  games: number | null | undefined;
  wins: number | null | undefined;
  rating: number | null | undefined;
  reputation: number | null | undefined;
  /** Normalized useful performance from published sessions, 0..1. */
  utility?: number | null;
  /** Sum of event weights, counted once per session rather than per game. */
  weightedSessions?: number | null;
}

const bounded = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const bounded01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Calculates a bounded public value. Games and kills describe utility but do
 * not form an ever-growing base; confidence grows by weighted sessions with
 * diminishing returns. The database uses the same coefficients per session.
 */
export function competitionCost(input: CompetitionCostInput) {
  const kills = Math.max(0, Number(input.kills ?? 0));
  const deaths = input.deaths === null || input.deaths === undefined ? null : Math.max(0, Number(input.deaths));
  const games = Math.max(0, Number(input.games ?? 0));
  const wins = Math.max(0, Number(input.wins ?? 0));
  if (games <= 0 && kills <= 0) return 0;

  const usRatio = deaths === null ? kills / Math.max(1, games) : kills / Math.max(1, deaths);
  const killRateScore = bounded01((kills / Math.max(1, games)) / 8);
  const usScore = bounded01(usRatio / 2);
  const winScore = bounded01(wins / Math.max(1, games));
  const utility = bounded01(Number(input.utility ?? (0.65 * usScore + 0.35 * killRateScore) * 0.65 + winScore * 0.2 + 0.15));
  const ratingScore = bounded(Number(input.rating ?? 1)) / 100;
  const reputationScore = bounded(Number(input.reputation ?? 50)) / 100;
  const weightedSessions = Math.max(0, Number(input.weightedSessions ?? (games > 0 ? 1 : 0)));
  const confidence = 1 - Math.exp(-weightedSessions / 3.5);
  const score = (0.70 * utility + 0.20 * ratingScore + 0.10 * reputationScore) * confidence;
  return Math.max(0, Math.min(1000, Math.round(1000 * score)));
}
