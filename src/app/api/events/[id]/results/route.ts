import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, ApiAuthError, requireUser } from "@/utils/supabase/server-auth";

const paramsSchema = z.object({ id: z.string().uuid() });
const resultsSchema = z.object({
  results: z.array(z.object({
    teamId: z.string().uuid(),
    score: z.number().int().min(0).max(1_000_000),
    isWinner: z.boolean(),
    mvpUserId: z.string().uuid().nullable().optional(),
  })).max(1000),
});

interface LegacyResult {
  id: string;
  event_id: string;
  winner_team_id: string;
  score: string | null;
  mvp_user_id: string | null;
}

async function enrichResults(rows: Array<{
  id: string;
  event_id: string;
  team_id: string;
  score: number;
  is_winner: boolean;
  mvp_user_id: string | null;
}>) {
  const supabase = createAdminClient();
  const teamIds = [...new Set(rows.map((row) => row.team_id))];
  const playerIds = [...new Set(rows.map((row) => row.mvp_user_id).filter((id): id is string => Boolean(id)))];
  const [{ data: teams }, { data: profiles }] = await Promise.all([
    teamIds.length ? supabase.from("teams").select("id, name").in("id", teamIds) : Promise.resolve({ data: [] }),
    playerIds.length ? supabase.from("profiles").select("id, nickname").in("id", playerIds) : Promise.resolve({ data: [] }),
  ]);
  const teamNames = new Map((teams ?? []).map((team) => [team.id, team.name]));
  const playerNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));
  return rows.map((row) => ({
    ...row,
    team_name: teamNames.get(row.team_id) ?? "Команда",
    mvp_nickname: row.mvp_user_id ? playerNames.get(row.mvp_user_id) ?? "Игрок" : "",
  }));
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const supabase = createAdminClient();
    const normalized = await supabase
      .from("event_team_results")
      .select("id, event_id, team_id, score, is_winner, mvp_user_id")
      .eq("event_id", id)
      .order("score", { ascending: false });

    if (!normalized.error) {
      return Response.json({ results: await enrichResults(normalized.data ?? []) });
    }

    const { data: legacy, error: legacyError } = await supabase
      .from("event_results")
      .select("id, event_id, winner_team_id, score, mvp_user_id")
      .eq("event_id", id);
    if (legacyError) throw legacyError;
    const rows = ((legacy ?? []) as LegacyResult[]).map((row) => ({
      id: row.id,
      event_id: row.event_id,
      team_id: row.winner_team_id,
      score: Number.parseInt(row.score ?? "0", 10) || 0,
      is_winner: true,
      mvp_user_id: row.mvp_user_id,
    }));
    return Response.json({ results: await enrichResults(rows), legacy: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Некорректный ID мероприятия" }, { status: 400 });
    return authErrorResponse(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const auth = await requireUser(request);
    const payload = resultsSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("organizer_user_id")
      .eq("id", id)
      .single();
    if (eventError) throw eventError;
    if (!auth.roles.length && event.organizer_user_id !== auth.user.id) {
      throw new ApiAuthError("Управлять результатами может организатор или администратор", 403);
    }

    const winners = payload.results.filter((result) => result.isWinner);
    if (winners.length > 1) return Response.json({ error: "Можно выбрать только одного победителя" }, { status: 400 });
    const { error } = await supabase.from("event_team_results").upsert(
      payload.results.map((result) => ({
        event_id: id,
        team_id: result.teamId,
        score: result.score,
        is_winner: result.isWinner,
        mvp_user_id: result.mvpUserId ?? null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "event_id,team_id" },
    );
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте результаты" }, { status: 400 });
    return authErrorResponse(error);
  }
}
