export type CompetitionMode = "main" | "solo" | "bo" | "kv";
export interface StatisticsSummary {
  mode: CompetitionMode; rating: number; games: number; kills: number; wins: number;
  series: number; deaths: number | null; assists: number | null; legacyRows: number; ranked: boolean;
}
export interface HistoryItem {
  id: string; mode: string; event_id: string | null; session_id: string | null; clan_war_id: string | null;
  title: string; occurred_at: string; name_snapshot: string | null; kills: number; games: number | null;
  place: number | null; wins: number | null; deaths: number | null; assists: number | null; source: string;
}
export interface PublicStatistics {
  summaries: StatisticsSummary[]; history: HistoryItem[]; hasMore: boolean; goldOrganizer: boolean;
}
export async function getPublicStatistics(id: string, type = "player", mode = "main", offset = 0, signal?: AbortSignal): Promise<PublicStatistics> {
  const response = await fetch(`/api/competition/statistics?${new URLSearchParams({id, type, mode, offset: String(offset)})}`, {signal});
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Не удалось загрузить статистику");
  return body;
}
