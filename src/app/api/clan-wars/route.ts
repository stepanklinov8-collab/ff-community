import { z } from "zod";
import {
  ClanWarRequestError,
  notifyOrganizationManagers,
  requireManagedOrganization,
} from "@/lib/clan-wars";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const createClanWarSchema = z.object({
  creatorTeamId: z.string().uuid(),
  opponentTeamId: z.string().uuid().nullable(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(5000),
  rules: z.string().trim().max(5000),
  format: z.union([z.literal(4), z.literal(6)]),
  challengeKind: z.enum(["open", "direct"]),
  scheduledAt: z.string().datetime().nullable(),
});

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data: wars, error } = await supabase
      .from("clan_wars")
      .select("id, creator_team_id, opponent_team_id, title, description, rules, format, challenge_kind, status, scheduled_at, completed_at, cancelled_at, cancellation_reason, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const teamIds = [...new Set((wars ?? []).flatMap((war) => [war.creator_team_id, war.opponent_team_id]).filter(Boolean))] as string[];
    const warIds = (wars ?? []).map((war) => war.id);
    const [{ data: teams, error: teamsError }, { data: responses, error: responsesError }, { data: rosters, error: rostersError }] = await Promise.all([
      teamIds.length
        ? supabase.from("teams").select("id, name, type, avatar_url").in("id", teamIds)
        : Promise.resolve({ data: [], error: null }),
      warIds.length
        ? supabase.from("clan_war_responses").select("clan_war_id, status").in("clan_war_id", warIds)
        : Promise.resolve({ data: [], error: null }),
      warIds.length
        ? supabase.from("clan_war_rosters").select("clan_war_id, team_id").in("clan_war_id", warIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (teamsError) throw teamsError;
    if (responsesError) throw responsesError;
    if (rostersError) throw rostersError;

    const teamById = new Map((teams ?? []).map((team) => [team.id, team]));
    return Response.json({
      clanWars: (wars ?? []).map((war) => ({
        ...war,
        creator_team: teamById.get(war.creator_team_id) ?? null,
        opponent_team: war.opponent_team_id ? teamById.get(war.opponent_team_id) ?? null : null,
        responses_count: (responses ?? []).filter((response) => response.clan_war_id === war.id && response.status === "pending").length,
        rosters_count: new Set((rosters ?? [])
          .filter((roster) => roster.clan_war_id === war.id && [war.creator_team_id, war.opponent_team_id].includes(roster.team_id))
          .map((roster) => roster.team_id)).size,
      })),
    });
  } catch (error) {
    console.error("Clan wars list error", error);
    return Response.json({ error: "Не удалось загрузить КВ" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const payload = createClanWarSchema.parse(await request.json());
    const supabase = createAdminClient();
    const creator = await requireManagedOrganization(supabase, user.id, payload.creatorTeamId);

    if (payload.challengeKind === "direct" && !payload.opponentTeamId) {
      throw new ClanWarRequestError("Выберите соперника для адресного вызова");
    }
    if (payload.challengeKind === "open" && payload.opponentTeamId) {
      throw new ClanWarRequestError("Для открытого вызова соперник выбирается после отклика");
    }
    if (payload.opponentTeamId === payload.creatorTeamId) {
      throw new ClanWarRequestError("Нельзя вызвать собственную организацию");
    }

    let opponent: { id: string; name: string; type: string } | null = null;
    if (payload.opponentTeamId) {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, type")
        .eq("id", payload.opponentTeamId)
        .single();
      if (error || !data) throw error ?? new ClanWarRequestError("Соперник не найден", 404);
      opponent = data;
      if (opponent.type !== creator.type) {
        throw new ClanWarRequestError("Команда может вызвать только команду, а гильдия — гильдию");
      }
    }

    const { data: clanWar, error: createError } = await supabase.from("clan_wars").insert({
      creator_team_id: creator.id,
      opponent_team_id: opponent?.id ?? null,
      created_by: user.id,
      title: payload.title,
      description: payload.description || null,
      rules: payload.rules || null,
      format: payload.format,
      challenge_kind: payload.challengeKind,
      status: payload.challengeKind === "direct" ? "pending" : "open",
      scheduled_at: payload.scheduledAt,
    }).select("id").single();
    if (createError || !clanWar) throw createError ?? new Error("Не удалось создать КВ");

    if (opponent) {
      await notifyOrganizationManagers(supabase, opponent.id, {
        type: "clan_war_challenge",
        title: "Вам бросили вызов на КВ",
        body: `${creator.name} предлагает ${payload.format}×${payload.format}: «${payload.title}»`,
        link: `/clan-wars/${clanWar.id}`,
      }, user.id);
    }

    return Response.json({ success: true, clanWarId: clanWar.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Проверьте параметры КВ" }, { status: 400 });
    }
    if (error instanceof ClanWarRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}
