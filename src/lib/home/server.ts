import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnvironment } from "@/platform/server-environment";
import { cachePublicRead, PUBLIC_HOME_TAG } from "@/lib/public-data/cache";
import type { HomeSummary } from "./types";

export const getHomeSummary = cachePublicRead(async (): Promise<HomeSummary> => {
  serverEnvironment();
  // Deliberately anonymous: public cache must obey the same RLS as a guest.
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date().toISOString();
  const [activities, sessions, teams, players] = await Promise.all([
    db.from("activity_log").select("id,activity_type,description,message_key,message_params,created_at,event_id,team_id").order("created_at", { ascending: false }).limit(6),
    db.from("event_sessions").select("id,event_id,start_time,events!inner(title,type)", { count: "exact" })
      .or(`is_published.eq.true,publish_at.lte.${now}`, { referencedTable: "events" })
      .gte("start_time", now).order("start_time", { ascending: true }).limit(4),
    db.from("teams").select("id", { count: "exact", head: true }).eq("verified", true).is("dissolved_at", null),
    db.from("profiles").select("id", { count: "exact", head: true }),
  ]);
  for (const result of [activities, sessions, teams, players]) if (result.error) throw new Error(result.error.message);
  return {
    activities: activities.data ?? [],
    upcomingEvents: (sessions.data ?? []).map(row => {
      const event = row.events as unknown as { title: string; type: string };
      return { eventId: row.event_id, sessionId: row.id, title: event.title, type: event.type, startTime: row.start_time };
    }),
    stats: { teams: teams.count ?? 0, players: players.count ?? 0, sessions: sessions.count ?? 0 },
  };
}, "home-summary-v1", PUBLIC_HOME_TAG);
