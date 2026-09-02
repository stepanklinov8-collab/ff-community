import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin } from "@/utils/supabase/server-auth";

const moderationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  kills: z.number().int().min(0).max(10000).optional(),
  matches: z.number().int().min(1).max(1000).optional(),
  note: z.string().trim().max(1000).optional(),
});

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = createAdminClient();
    const eventId = new URL(request.url).searchParams.get("eventId");
    let query = supabase.from("player_stats").select("*").order("created_at", { ascending: false });
    if (eventId) query = query.eq("event_id", z.string().uuid().parse(eventId));
    const { data: stats, error } = await query;
    if (error) throw error;
    const userIds = [...new Set((stats ?? []).map((stat) => stat.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, nickname, game_id").in("id", userIds)
      : { data: [] };
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    return Response.json({
      stats: (stats ?? []).map((stat) => ({
        ...stat,
        nickname: profileById.get(stat.user_id)?.nickname ?? "—",
        game_id: profileById.get(stat.user_id)?.game_id ?? "—",
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Некорректное мероприятие" }, { status: 400 });
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireAdmin(request);
    const payload = moderationSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: before, error: beforeError } = await supabase.from("player_stats").select("*").eq("id", payload.id).single();
    if (beforeError) throw beforeError;
    const updates = {
      status: payload.status,
      kills: payload.kills ?? before.kills,
      matches_played: payload.matches ?? before.matches_played,
      moderator_id: user.id,
      corrected_by: payload.kills !== undefined || payload.matches !== undefined ? user.id : null,
      correction_note: payload.note || null,
      updated_at: new Date().toISOString(),
    };
    const { data: after, error } = await supabase.from("player_stats").update(updates).eq("id", payload.id).select("*").single();
    if (error) throw error;
    await supabase.from("stats_change_logs").insert({
      player_stat_id: payload.id,
      user_id: before.user_id,
      event_id: before.event_id,
      session_id: before.session_id,
      changed_by: user.id,
      change_type: payload.status === "approved" ? "approve" : "reject",
      before_values: before,
      after_values: after,
      note: payload.note || null,
    });
    await supabase.from("notifications").insert({
      user_id: before.user_id,
      type: "stats_moderation",
      title: payload.status === "approved" ? "Статистика подтверждена" : "Статистика отклонена",
      body: payload.note || (payload.status === "approved" ? "Результат добавлен в профиль" : "Проверьте данные и доказательства"),
      link: before.event_id ? `/tournaments/${before.event_id}` : "/profile/stats",
    });
    return Response.json({ success: true, stat: after });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте данные модерации" }, { status: 400 });
    return authErrorResponse(error);
  }
}
