import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin } from "@/utils/supabase/server-auth";

const visibilitySchema = z.object({
  id: z.string().uuid(),
  isHidden: z.boolean(),
});

function inputErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return Response.json({ error: "Некорректные данные КВ" }, { status: 400 });
  }
  return authErrorResponse(error);
}

async function writeAuditLog(
  supabase: ReturnType<typeof createAdminClient>,
  actorUserId: string,
  action: string,
  details: Record<string, unknown>,
) {
  const { error } = await supabase.from("admin_action_logs").insert({
    actor_user_id: actorUserId,
    action,
    details,
  });
  if (error) console.error("Clan war audit log error", error);
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = createAdminClient();
    const { data: wars, error } = await supabase
      .from("clan_wars")
      .select("id, creator_team_id, opponent_team_id, created_by, title, format, challenge_kind, status, scheduled_at, completed_at, cancelled_at, created_at, updated_at, is_hidden, hidden_at, hidden_by")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const teamIds = [...new Set((wars ?? [])
      .flatMap((war) => [war.creator_team_id, war.opponent_team_id])
      .filter(Boolean))] as string[];
    const { data: teams, error: teamsError } = teamIds.length
      ? await supabase.from("teams").select("id, name, type, avatar_url").in("id", teamIds)
      : { data: [], error: null };
    if (teamsError) throw teamsError;
    const teamById = new Map((teams ?? []).map((team) => [team.id, team]));

    return Response.json({
      clanWars: (wars ?? []).map((war) => ({
        ...war,
        creator_team: teamById.get(war.creator_team_id) ?? null,
        opponent_team: war.opponent_team_id ? teamById.get(war.opponent_team_id) ?? null : null,
        can_delete: war.status !== "completed",
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireAdmin(request);
    const payload = visibilitySchema.parse(await request.json());
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const { data: war, error } = await supabase
      .from("clan_wars")
      .update({
        is_hidden: payload.isHidden,
        hidden_at: payload.isHidden ? now : null,
        hidden_by: payload.isHidden ? user.id : null,
      })
      .eq("id", payload.id)
      .select("id, title, is_hidden, hidden_at")
      .single();
    if (error) throw error;

    await writeAuditLog(supabase, user.id, payload.isHidden ? "clan_war_hide" : "clan_war_show", {
      clanWarId: war.id,
      title: war.title,
    });
    return Response.json({ success: true, clanWar: war });
  } catch (error) {
    return inputErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireAdmin(request);
    const clanWarId = z.string().uuid().parse(new URL(request.url).searchParams.get("id"));
    const supabase = createAdminClient();
    const { data: war, error: warError } = await supabase
      .from("clan_wars")
      .select("id, title, status")
      .eq("id", clanWarId)
      .single();
    if (warError || !war) {
      return Response.json({ error: "КВ не найдено" }, { status: 404 });
    }
    if (war.status === "completed") {
      return Response.json({
        error: "Завершённое КВ нельзя удалить: скройте его, чтобы сохранить статистику и рейтинг",
      }, { status: 409 });
    }

    const { error } = await supabase.from("clan_wars").delete().eq("id", clanWarId);
    if (error) {
      if (error.code === "23503") {
        return Response.json({
          error: "КВ связано со статистикой и не может быть удалено. Его можно скрыть",
        }, { status: 409 });
      }
      throw error;
    }

    await writeAuditLog(supabase, user.id, "clan_war_delete", {
      clanWarId: war.id,
      title: war.title,
      status: war.status,
    });
    return Response.json({ success: true });
  } catch (error) {
    return inputErrorResponse(error);
  }
}
