import "server-only";
import { createAdminClient } from "@/utils/supabase/admin";
import { allRows } from "@/lib/competition/server";
import { cachePublicRead, PUBLIC_COMPETITION_TAG } from "@/lib/public-data/cache";

export const getPublicSchedule = cachePublicRead(async () => {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const events = await allRows((from, to) => db.from("events")
    .select("id,title,type,cost,organizer,description,rules_text,image_url,max_teams,created_at,archive_end_time,final_session_id,frozen_at")
    .eq("moderation_status", "approved").is("cancelled_at", null)
    .or(`is_published.eq.true,publish_at.lte.${now}`)
    .order("created_at", { ascending: false }).order("id").range(from, to));

  const sessions: Array<{
    id: string; event_id: string; start_time: string; end_time: string | null;
    registration_open_time: string | null; registration_close_time: string | null;
    max_teams: number | null; public_number: number;
  }> = [];
  for (let i = 0; i < events.length; i += 100) {
    const ids = events.slice(i, i + 100).map(event => event.id);
    sessions.push(...await allRows((from, to) => db.from("event_sessions")
      .select("id,event_id,start_time,end_time,registration_open_time,registration_close_time,max_teams,public_number")
      .in("event_id", ids).neq("status", "cancelled").order("start_time").order("id").range(from, to)));
  }

  const registeredBySession = new Map<string, number>();
  const publicationsBySession = new Map<string, Array<{name: string; place: number}>>();
  for (let i = 0; i < sessions.length; i += 100) {
    const ids = sessions.slice(i, i + 100).map(session => session.id);
    const [registrations, publications] = await Promise.all([
      allRows((from, to) => db.from("event_registrations").select("session_id")
        .in("session_id", ids).eq("status", "confirmed").order("id").range(from, to)),
      allRows((from, to) => db.from("competition_publications").select("session_id,standings:published->standings")
        .in("session_id", ids).not("first_published_at", "is", null).order("session_id").range(from, to)),
    ]);
    for (const row of registrations) {
      if (row.session_id) registeredBySession.set(row.session_id, (registeredBySession.get(row.session_id) ?? 0) + 1);
    }
    for (const row of publications) {
      const standings = Array.isArray(row.standings) ? row.standings as Array<{name: string; place: number}> : [];
      publicationsBySession.set(row.session_id, standings.slice(0, 3).map(({ name, place }) => ({ name, place })));
    }
  }
  return {
    events,
    sessions: sessions.map(session => ({
      ...session,
      registered_count: registeredBySession.get(session.id) ?? 0,
      published: publicationsBySession.has(session.id),
      summary: publicationsBySession.get(session.id) ?? [],
    })),
    generatedAt: Date.now(),
  };
}, "public-schedule-v1", PUBLIC_COMPETITION_TAG);
