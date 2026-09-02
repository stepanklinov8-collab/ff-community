import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from("player_stats")
      .select("id, event_id, session_id, event_title, kills, matches_played, status, correction_note, updated_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const sessionIds = [...new Set((rows ?? []).map((row) => row.session_id).filter(Boolean))];
    const { data: sessions, error: sessionsError } = sessionIds.length
      ? await supabase.from("event_sessions").select("id, start_time").in("id", sessionIds)
      : { data: [], error: null };
    if (sessionsError) throw sessionsError;

    const startBySession = new Map((sessions ?? []).map((session) => [session.id, session.start_time]));
    return Response.json({
      stats: (rows ?? []).map((row) => ({
        ...row,
        session_start: row.session_id ? startBySession.get(row.session_id) ?? null : null,
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
