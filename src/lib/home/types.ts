export interface HomeActivity {
  id: string;
  activity_type: string | null;
  description: string | null;
  message_key: string | null;
  message_params: Record<string, string> | null;
  created_at: string;
  event_id: string | null;
  team_id: string | null;
}

export interface HomeSummary {
  activities: HomeActivity[];
  upcomingEvents: Array<{ eventId: string; sessionId: string; title: string; type: string; startTime: string }>;
  stats: { teams: number; players: number; sessions: number };
}
