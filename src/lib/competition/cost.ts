/** The legacy player/organization value formula used by the public statistics pages. */
export function competitionCost(kills: number | null | undefined, games: number | null | undefined) {
  return Math.round(Math.max(0, Number(kills ?? 0)) * 10 + Math.max(0, Number(games ?? 0)) * 5);
}
