export interface OddsInputs {
  marketType: "kills_over" | "kills_under" | "exact_place" | "win" | "loss" | "exact_score";
  line?: number | null;
  selectionValue: string;
  teamRating: number;
  averageKills: number;
  averagePlace: number;
  sampleSize: number;
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function logistic(value: number) {
  return 1 / (1 + Math.exp(-value));
}

export function calculateFixedOdds(input: OddsInputs) {
  const confidence = clamp(input.sampleSize / 20, 0, 1);
  const killsMean = input.averageKills * confidence + 6 * (1 - confidence);
  const placeMean = input.averagePlace * confidence + 6.5 * (1 - confidence);
  let probability = 0.5;

  if (input.marketType === "kills_over" || input.marketType === "kills_under") {
    const line = input.line ?? killsMean;
    const over = logistic((killsMean - line) / 2.4);
    probability = input.marketType === "kills_over" ? over : 1 - over;
  } else if (input.marketType === "exact_place") {
    const place = Number(input.selectionValue);
    const distance = Math.abs(place - placeMean);
    probability = clamp((0.20 * Math.exp(-distance / 2.2)) + input.teamRating / 2500, 0.035, 0.45);
  } else if (input.marketType === "win" || input.marketType === "loss") {
    const win = logistic((input.teamRating - 50) / 12);
    probability = input.marketType === "win" ? win : 1 - win;
  } else {
    const scoreMatch = input.selectionValue.match(/^(7):([0-6])$|^([0-6]):(7)$/);
    const losingRounds = scoreMatch ? Number(scoreMatch[2] ?? scoreMatch[3]) : 3;
    const closeness = 1 - Math.abs(losingRounds - 3) / 7;
    probability = clamp(0.035 + closeness * 0.08 + input.teamRating / 5000, 0.03, 0.18);
  }

  // A small virtual-economy margin controls inflation. The offered quote is public;
  // the model inputs stay server-side.
  const adjusted = clamp(probability, 0.03, 0.88);
  return Number(clamp(0.92 / adjusted, 1.05, 15).toFixed(2));
}
