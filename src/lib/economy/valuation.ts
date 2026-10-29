const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
const logistic = (level: number) => 1 / (1 + Math.exp(-0.04 * (level - 302.0118626182226)));
const low = logistic(0), high = logistic(500);

export function utilityPrice(level: number, maximum = 93_737_550): number {
  return maximum * (logistic(clamp(level, 500)) - low) / (high - low);
}

function wholeBonusPrice(level: number): number {
  if (level === 0) return 0;
  if (level === 1) return 100;
  if (level === 2) return 101;
  if (level === 3) return 102.1;
  if (level === 499) return 6_262_450;
  const q = 1.0229029653718915;
  return 104 + 1.9 * q * (Math.pow(q, level - 4) - 1) / (q - 1);
}

export function bonusPrice(points: number, maximum = 6_262_450): number {
  const value = clamp(points, 499), floor = Math.floor(value), fraction = value - floor;
  const price = fraction === 0 ? wholeBonusPrice(floor)
    : wholeBonusPrice(floor) * (1 - fraction) + wholeBonusPrice(floor + 1) * fraction;
  return maximum * price / 6_262_450;
}

export function prizePrice(prizes: number): number {
  return 4000 * (Math.sqrt(1 + Math.max(0, prizes) / 10000) - 1);
}

export function playerValue(utility: number, bonus: number, weightedPrizes: number): number {
  return utilityPrice(utility) + bonusPrice(bonus) + prizePrice(weightedPrizes);
}

export function organizationValue(input: {
  memberValues: number[]; base: number; bonus: number; rating: number; totalRating: number; prizes: number;
}): number {
  const market = input.totalRating > 0 ? 1 + input.rating / input.totalRating : 1;
  return input.memberValues.reduce((sum, value) => sum + value, 0)
    + market * (utilityPrice(input.base, 700_000_000) + bonusPrice(input.bonus, 300_000_000))
    + prizePrice(input.prizes);
}
