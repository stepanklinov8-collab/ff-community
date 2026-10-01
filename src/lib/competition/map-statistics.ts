export interface MapStatisticRow { map: string; played: boolean; place: number | null; landingLocation: string | null; teamId: string | null }

export interface MapStatistic {
  map: string;
  games: number;
  firstPlaces: number;
  winPercent: number;
  averagePlace: number;
  locationGames: number;
  favoriteLocations: Array<{ location: string; games: number; percent: number }>;
}

export function calculateMapStatistics(rows: MapStatisticRow[]) {
  const byMap = new Map<string, { games: number; firstPlaces: number; placeSum: number; locations: Map<string, number> }>();
  for (const row of rows) {
    if (row.teamId === null || !row.played || row.place === null) continue;
    const value = byMap.get(row.map) ?? { games: 0, firstPlaces: 0, placeSum: 0, locations: new Map<string, number>() };
    value.games += 1;
    value.firstPlaces += row.place === 1 ? 1 : 0;
    value.placeSum += row.place;
    if (row.landingLocation) value.locations.set(row.landingLocation, (value.locations.get(row.landingLocation) ?? 0) + 1);
    byMap.set(row.map, value);
  }
  return [...byMap.entries()].map(([map, value]) => {
    const max = Math.max(0, ...value.locations.values());
    const locationGames = [...value.locations.values()].reduce((sum, count) => sum + count, 0);
    return {
      map, games: value.games, firstPlaces: value.firstPlaces,
      winPercent: Number((value.firstPlaces / value.games * 100).toFixed(2)),
      averagePlace: Number((value.placeSum / value.games).toFixed(2)), locationGames,
      favoriteLocations: [...value.locations.entries()].filter(([, count]) => count === max).map(([location, games]) => ({ location, games, percent: Number((games / locationGames * 100).toFixed(2)) })),
    } satisfies MapStatistic;
  }).sort((a, b) => a.map.localeCompare(b.map));
}
