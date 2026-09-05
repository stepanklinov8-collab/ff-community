import { z } from "zod";
import {
  ClanWarRequestError,
  notifyOrganizationManagers,
  requireManagedOrganization,
} from "@/lib/clan-wars";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const responseSchema = z.object({
  teamId: z.string().uuid(),
  message: z.string().trim().max(2000),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser(request);
    const { id } = await context.params;
    const clanWarId = z.string().uuid().parse(id);
    const payload = responseSchema.parse(await request.json());
    const supabase = createAdminClient();
    const organization = await requireManagedOrganization(supabase, user.id, payload.teamId);

    const { data: clanWar, error: clanWarError } = await supabase
      .from("clan_wars")
      .select("id, title, creator_team_id, opponent_team_id, challenge_kind, status")
      .eq("id", clanWarId)
      .single();
    if (clanWarError || !clanWar) throw clanWarError ?? new ClanWarRequestError("КВ не найдено", 404);
    if (clanWar.challenge_kind !== "open" || clanWar.status !== "open" || clanWar.opponent_team_id) {
      throw new ClanWarRequestError("Этот вызов больше не принимает отклики", 409);
    }
    if (clanWar.creator_team_id === organization.id) {
      throw new ClanWarRequestError("Нельзя откликнуться собственной организацией");
    }

    const { data: creator, error: creatorError } = await supabase
      .from("teams")
      .select("id, name, type")
      .eq("id", clanWar.creator_team_id)
      .single();
    if (creatorError || !creator) throw creatorError ?? new ClanWarRequestError("Автор вызова не найден", 404);
    if (creator.type !== organization.type) {
      throw new ClanWarRequestError("Команда может играть только с командой, а гильдия — с гильдией");
    }

    const { data: existing, error: existingError } = await supabase
      .from("clan_war_responses")
      .select("id, status")
      .eq("clan_war_id", clanWarId)
      .eq("team_id", organization.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === "pending" || existing?.status === "accepted") {
      throw new ClanWarRequestError("Отклик этой организации уже отправлен", 409);
    }

    const responseValues = {
      created_by: user.id,
      message: payload.message || null,
      status: "pending",
      responded_at: null,
    };
    const { data: response, error: responseError } = existing
      ? await supabase.from("clan_war_responses").update(responseValues).eq("id", existing.id).select("id").single()
      : await supabase.from("clan_war_responses").insert({
        clan_war_id: clanWarId,
        team_id: organization.id,
        ...responseValues,
      }).select("id").single();
    if (responseError || !response) throw responseError ?? new Error("Не удалось отправить отклик");

    await notifyOrganizationManagers(supabase, creator.id, {
      type: "clan_war_response",
      title: "Новый отклик на КВ",
      body: `${organization.name} откликнулась на «${clanWar.title}»`,
      link: `/clan-wars/${clanWarId}`,
    }, user.id);

    return Response.json({ success: true, responseId: response.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Проверьте данные отклика" }, { status: 400 });
    }
    if (error instanceof ClanWarRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}
