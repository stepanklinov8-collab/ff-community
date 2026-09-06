export const MINIMUM_BETTING_ODDS = 1.1;
export const QUOTE_LIFETIME_SECONDS = 60;

export type BettingMarketType =
  | "kills_over"
  | "kills_under"
  | "exact_place"
  | "win"
  | "loss"
  | "exact_score";

export interface OddsInputs {
  marketType: BettingMarketType;
  line?: number | null;
  selectionValue: string;
  teamRating: number;
  opponentRating?: number | null;
  fieldAverageRating?: number | null;
  fieldSize?: number | null;
  averageKills: number;
  averagePlace: number;
  sampleSize: number;
  maximumOdds?: number;
}

export interface FixedOddsQuote {
  rawOdds: number;
  offeredOdds: number | null;
  eligible: boolean;
  confidence: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function logistic(value: number) {
  return 1 / (1 + Math.exp(-value));
}

/**
 * Positive decimal rounding with ROUND_HALF_UP semantics. The value is first
 * normalized to twelve decimal places and then rounded as integer cents.
 */
export function roundHalfUpToHundredths(value: number) {
  if (!Number.isFinite(value) || value < 0) throw new Error("Некорректный коэффициент");
  const normalized = value.toFixed(12);
  const [whole, fraction = ""] = normalized.split(".");
  const padded = fraction.padEnd(3, "0");
  let cents = Number(whole) * 100 + Number(padded.slice(0, 2));
  if (Number(padded[2]) >= 5) cents += 1;
  return cents / 100;
}

export function isBettingOddsAvailable(rawOdds: number) {
  return Number.isFinite(rawOdds) && rawOdds >= MINIMUM_BETTING_ODDS;
}

export function suggestedKillsLine(averageKills: number) {
  const safeAverage = Number.isFinite(averageKills) ? Math.max(0, averageKills) : 6;
  return Math.floor(safeAverage) + 0.5;
}

export function calculateFixedOdds(input: OddsInputs): FixedOddsQuote {
  const confidence = clamp(input.sampleSize / 20, 0, 1);
  const teamRating = clamp(Number(input.teamRating) || 1, 1, 100);
  const killsMean = Math.max(0, input.averageKills * confidence + 6 * (1 - confidence));
  const placeMean = Math.max(1, input.averagePlace * confidence + 6.5 * (1 - confidence));
  let probability = 0.5;

  if (input.marketType === "kills_over" || input.marketType === "kills_under") {
    const line = input.line ?? suggestedKillsLine(killsMean);
    const over = logistic((killsMean - line) / 2.4);
    probability = input.marketType === "kills_over" ? over : 1 - over;
  } else if (input.marketType === "exact_place") {
    const place = Number(input.selectionValue);
    const fieldSize = clamp(Number(input.fieldSize) || 12, 2, 100);
    const fieldRating = clamp(Number(input.fieldAverageRating) || 50, 1, 100);
    const ratingAdvantage = (teamRating - fieldRating) / 100;
    const distance = Math.abs(place - placeMean);
    const baseProbability = (1 / fieldSize) * Math.exp(-distance / Math.max(1.8, fieldSize / 7));
    probability = clamp(baseProbability + ratingAdvantage * 0.12 + (1 - confidence) / fieldSize, 0.01, 0.86);
  } else if (input.marketType === "win" || input.marketType === "loss") {
    const opponentRating = clamp(Number(input.opponentRating) || 50, 1, 100);
    const win = logistic((teamRating - opponentRating) / 12);
    probability = input.marketType === "win" ? win : 1 - win;
  } else {
    const scoreMatch = input.selectionValue.match(/^(7):([0-6])$|^([0-6]):(7)$/);
    const subjectWins = Boolean(scoreMatch?.[1]);
    const losingRounds = scoreMatch ? Number(scoreMatch[2] ?? scoreMatch[3]) : 3;
    const opponentRating = clamp(Number(input.opponentRating) || 50, 1, 100);
    const winProbability = logistic((teamRating - opponentRating) / 12);
    const sideProbability = subjectWins ? winProbability : 1 - winProbability;
    const closeness = 1 - Math.abs(losingRounds - 3) / 7;
    probability = clamp(sideProbability * (0.055 + closeness * 0.085), 0.01, 0.40);
  }

  // A small virtual-economy margin controls inflation. Only the public quote
  // leaves the server; model inputs remain in protected server tables.
  const adjustedProbability = clamp(probability, 0.01, 0.98);
  const maximumOdds = clamp(Number(input.maximumOdds) || 15, MINIMUM_BETTING_ODDS, 100);
  const rawOdds = Math.min(maximumOdds, 0.92 / adjustedProbability);
  const eligible = isBettingOddsAvailable(rawOdds);

  return {
    rawOdds,
    offeredOdds: eligible ? roundHalfUpToHundredths(rawOdds) : null,
    eligible,
    confidence,
  };
}
