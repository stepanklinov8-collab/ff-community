import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin } from "@/utils/supabase/server-auth";

const rollbackSchema = z.object({
  importId: z.string().uuid(),
  userId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const payload = rollbackSchema.parse(await request.json());
    const supabase = createAdminClient();

    let query = supabase
      .from("stats_change_logs")
      .select("id, player_stat_id, user_id, change_type, before_values")
      .eq("import_id", payload.importId)
      .is("rolled_back_at", null)
      .order("created_at", { ascending: false });
    if (payload.userId) query = query.eq("user_id", payload.userId);
    const { data: changes, error: changesError } = await query;
    if (changesError) throw changesError;
    if (!changes?.length) return Response.json({ error: "Нет изменений для отката" }, { status: 404 });

    let rolledBack = 0;
    for (const change of changes) {
      if (!change.player_stat_id) continue;
      if (change.change_type === "insert") {
        const { error } = await supabase.from("player_stats").delete().eq("id", change.player_stat_id);
        if (error) throw error;
      } else if (change.before_values) {
        const before = change.before_values as Record<string, unknown>;
        const { error } = await supabase.from("player_stats").update({
          kills: before.kills,
          matches_played: before.matches_played,
          status: before.status,
          moderator_id: before.moderator_id,
          session_id: before.session_id,
          corrected_by: auth.user.id,
          correction_note: `Откат импорта ${payload.importId}`,
          updated_at: new Date().toISOString(),
        }).eq("id", change.player_stat_id);
        if (error) throw error;
      }

      await supabase.from("stats_change_logs").update({ rolled_back_at: new Date().toISOString() }).eq("id", change.id);
      rolledBack += 1;
    }

    if (!payload.userId) {
      await supabase.from("excel_import_logs").update({
        status: "rolled_back",
        rolled_back_at: new Date().toISOString(),
        rolled_back_by: auth.user.id,
      }).eq("id", payload.importId);
    }

    return Response.json({ success: true, rolledBack });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Некорректный запрос отката" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
