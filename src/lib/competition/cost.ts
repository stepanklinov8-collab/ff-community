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

export interface CompetitionOrganizationCostInput {
  memberCosts: number[];
  rating: number | null | undefined;
  results: number | null | undefined;
  achievements: number | null | undefined;
  reputation: number | null | undefined;
  memberRatings?: number[];
  memberReputations?: number[];
  weightedSessions?: number | null;
  winRate?: number | null;
}

const bounded = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const bounded01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Calculates a public value in rubles. Games and kills describe utility but do
 * not form an ever-growing price base; confidence grows by weighted sessions
 * with diminishing returns and a small logarithmic experience premium has no
 * hard upper ceiling. The database uses the same coefficients per session.
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
  const experiencePremium = 1 + 0.25 * Math.log1p(weightedSessions);
  return Math.max(0, Math.round(1000 * score * experiencePremium) / 100);
}

export function competitionOrganizationCost(input: CompetitionOrganizationCostInput) {
  const normalized = (value: number | null | undefined, fallback: number) => bounded01(Number(value ?? fallback) / 100);
  const memberCosts = input.memberCosts.map((value) => Math.max(0, Number(value) || 0));
  const memberCost = memberCosts.reduce((sum, value) => sum + value, 0);
  const memberCountFactor = bounded01(memberCosts.length / 4);
  const memberRating = (input.memberRatings ?? []).length
    ? (input.memberRatings ?? []).reduce((sum, value) => sum + normalized(value, 1), 0) / (input.memberRatings ?? []).length
    : 0;
  const memberReputation = (input.memberReputations ?? []).length
    ? (input.memberReputations ?? []).reduce((sum, value) => sum + normalized(value, 50), 0) / (input.memberReputations ?? []).length
    : 0;
  const quality = bounded01(
    0.25 * normalized(input.rating, 1)
    + 0.15 * normalized(input.results, 1)
    + 0.15 * normalized(input.achievements, 1)
    + 0.15 * normalized(input.reputation, 50)
    + 0.15 * memberRating
    + 0.10 * memberReputation
    + 0.10 * bounded01(Number(input.winRate ?? 0)),
  );
  const weightedSessions = Math.max(0, Number(input.weightedSessions ?? 0));
  const confidence = 1 - Math.exp(-weightedSessions / 4.5);
  const organizationPremium = 1500 * (0.50 + quality) * (0.60 + 0.40 * confidence) * (1 + 0.20 * Math.log1p(weightedSessions));
  const rosterMultiplier = 1.75 + 0.60 * quality + 0.20 * memberCountFactor;
  return Math.max(0, Math.round((memberCost * rosterMultiplier + organizationPremium) * 100) / 100);
}
