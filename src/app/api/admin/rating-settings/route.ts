import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin } from "@/utils/supabase/server-auth";

const schema = z.object({
  eventId: z.string().uuid(),
  category: z.enum(["training", "amateur", "regional", "official", "season_final"]),
  coefficient: z.number().min(0.01).max(5).optional(),
});
const hiddenDefaults = { training: 0.2, amateur: 0.7, regional: 0.85, official: 1, season_final: 1.2 };

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const isOwner = auth.roles.includes("superadmin");
    const supabase = createAdminClient();
    const [{ data: events, error: eventsError }, { data: settings, error: settingsError }] = await Promise.all([
      supabase.from("events").select("id,title,type").in("type", ["training", "tournament"]).order("created_at", { ascending: false }),
      supabase.from("rating_event_settings").select("event_id,category,hidden_coefficient,updated_at"),
    ]);
    if (eventsError || settingsError) throw eventsError ?? settingsError;
    return Response.json({
      isOwner,
      events: events ?? [],
      settings: (settings ?? []).map((setting) => isOwner ? setting : {
        event_id: setting.event_id, category: setting.category, updated_at: setting.updated_at,
      }),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const payload = schema.parse(await request.json());
    const isOwner = auth.roles.includes("superadmin");
    const coefficient = isOwner && payload.coefficient != null
      ? payload.coefficient
      : hiddenDefaults[payload.category];
    const supabase = createAdminClient();
    const { error } = await supabase.from("rating_event_settings").upsert({
      event_id: payload.eventId,
      category: payload.category,
      hidden_coefficient: coefficient,
      changed_by: auth.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "event_id" });
    if (error) throw error;
    const [{ data: playerRows }, { data: organizationRows }] = await Promise.all([
      supabase.from("player_stats").select("user_id").eq("event_id", payload.eventId).eq("status", "approved"),
      supabase.from("organization_participation_history").select("organization_id").eq("event_id", payload.eventId),
    ]);
    const playerIds = [...new Set((playerRows ?? []).map((row) => row.user_id).filter(Boolean))];
    const organizationIds = [...new Set((organizationRows ?? []).map((row) => row.organization_id).filter(Boolean))];
    const recalculations = await Promise.all([
      ...playerIds.map((userId) => supabase.rpc("recalculate_player_rating", { p_user_id: userId })),
      ...organizationIds.map((teamId) => supabase.rpc("recalculate_organization_results", { p_team_id: teamId })),
    ]);
    const recalculationError = recalculations.find((result) => result.error)?.error;
    if (recalculationError) throw recalculationError;
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте категорию мероприятия" }, { status: 400 });
    return authErrorResponse(error);
  }
}
