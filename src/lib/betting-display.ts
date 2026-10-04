export interface BetDisplayAmounts {
  status: string;
  payout: number;
  potentialPayout: number;
}

export function displayedBetPayout({ status, payout, potentialPayout }: BetDisplayAmounts) {
  return status === "open" || status === "pending" ? Number(potentialPayout) : Number(payout);
}
