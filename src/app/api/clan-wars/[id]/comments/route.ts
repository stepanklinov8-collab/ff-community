import { z } from "zod";
import { ClanWarRequestError, getManagedOrganizations } from "@/lib/clan-wars";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const commentSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser(request);
    const { id } = await context.params;
    const clanWarId = z.string().uuid().parse(id);
    const payload = commentSchema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: clanWar, error } = await supabase
      .from("clan_wars")
      .select("id, creator_team_id, opponent_team_id")
      .eq("id", clanWarId)
      .single();
    if (error || !clanWar) throw new ClanWarRequestError("КВ не найдено", 404);

    const managedIds = (await getManagedOrganizations(supabase, user.id)).map((organization) => organization.id);
    const { data: responses, error: responsesError } = await supabase
      .from("clan_war_responses")
      .select("team_id")
      .eq("clan_war_id", clanWarId)
      .in("status", ["pending", "accepted"]);
    if (responsesError) throw responsesError;
    const participantIds = [clanWar.creator_team_id, clanWar.opponent_team_id, ...(responses ?? []).map((response) => response.team_id)].filter(Boolean);
    if (!managedIds.some((teamId) => participantIds.includes(teamId))) {
      throw new ClanWarRequestError("Переговоры доступны только руководству сторон", 403);
    }

    const { data: comment, error: commentError } = await supabase.from("clan_war_comments").insert({
      clan_war_id: clanWarId,
      author_id: user.id,
      body: payload.body,
    }).select("id").single();
    if (commentError || !comment) throw commentError ?? new Error("Не удалось отправить комментарий");
    return Response.json({ success: true, commentId: comment.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Комментарий должен содержать от 1 до 2000 символов" }, { status: 400 });
    }
    if (error instanceof ClanWarRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}
