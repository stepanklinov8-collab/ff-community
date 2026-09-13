import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { data: events, error } = await supabase.from("events")
      .select("id,title,type,cost,organizer,description,image_url,max_teams,created_at")
      .or(`is_published.eq.true,publish_at.lte.${now}`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const eventIds = (events ?? []).map((event) => event.id);
    const { data: sessions, error: sessionsError } = eventIds.length
      ? await supabase.from("event_sessions")
          .select("id,event_id,start_time,end_time,registration_open_time,registration_close_time,max_teams")
          .in("event_id", eventIds)
          .order("start_time", { ascending: true })
      : { data: [], error: null };
    if (sessionsError) throw sessionsError;

    return Response.json({ events, sessions, generatedAt: Date.now() }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    console.error("Public events error", error);
    return Response.json({ error: "Не удалось загрузить мероприятия" }, { status: 500 });
  }
}
