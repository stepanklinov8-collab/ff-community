import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { ApiAuthError, authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const paramsSchema = z.object({ id: z.string().uuid() });
const gameSchema = z.object({
  action: z.literal("game"),
  gameId: z.string().uuid(),
  teamId: z.string().uuid(),
  place: z.number().int().min(1).max(100),
  kills: z.number().int().min(0).max(1000),
  points: z.number().min(0).max(1_000_000),
});
const finalizeSchema = z.object({ action: z.literal("finalize"), sessionId: z.string().uuid() });
const roundSchema = z.object({
  action: z.literal("round"),
  teamAId: z.string().uuid(), teamBId: z.string().uuid(),
  teamAScore: z.number().int().min(0).max(7), teamBScore: z.number().int().min(0).max(7),
  teamAKills: z.number().int().min(0).max(1000), teamBKills: z.number().int().min(0).max(1000),
}).refine((value) => value.teamAId !== value.teamBId &&
  ((value.teamAScore === 7 && value.teamBScore <= 6) || (value.teamBScore === 7 && value.teamAScore <= 6)),
  "БО играется до семи выигранных раундов");
const actionSchema = z.discriminatedUnion("action", [gameSchema, finalizeSchema, roundSchema]);

async function authorize(request: Request, eventId: string) {
  const auth = await requireUser(request);
  const supabase = createAdminClient();
  const { data: event, error } = await supabase.from("events")
    .select("id,title,type,organizer_user_id").eq("id", eventId).single();
  if (error || !event) throw error ?? new Error("Мероприятие не найдено");
  const isFullAdmin = auth.roles.some((role) => role === "admin" || role === "superadmin");
  if (!isFullAdmin && event.organizer_user_id !== auth.user.id) {
    throw new ApiAuthError("Результаты доступны организатору или администрации", 403);
  }
  return { auth, event, supabase };
}

function rosterSnapshot(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const { event, supabase } = await authorize(request, id);
    const [{ data: sessions }, { data: games }, { data: registrations }, { data: gameResults }, { data: roundResults }] = await Promise.all([
      supabase.from("event_sessions").select("id,start_time").eq("event_id", id).order("start_time"),
      supabase.from("event_games").select("id,session_id,game_number,map_name,status").eq("event_id", id).order("game_number"),
      supabase.from("event_registrations").select("id,session_id,team_id,roster_json,status").eq("event_id", id).neq("status", "cancelled"),
      supabase.from("event_game_results").select("id,game_id,team_id,place,kills,points,status").in("game_id",
        (await supabase.from("event_games").select("id").eq("event_id", id)).data?.map((row) => row.id) ?? ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("round_match_results").select("*").eq("event_id", id).maybeSingle(),
    ]);
    const teamIds = [...new Set((registrations ?? []).map((row) => row.team_id).filter(Boolean))] as string[];
    const { data: teams } = teamIds.length ? await supabase.from("teams").select("id,name,type").in("id", teamIds) : { data: [] };
    return Response.json({ event, sessions: sessions ?? [], games: games ?? [], registrations: registrations ?? [], teams: teams ?? [], gameResults: gameResults ?? [], roundResult: roundResults ?? null });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Некорректные данные" }, { status: 400 });
    return authErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const payload = actionSchema.parse(await request.json());
    const { auth, event, supabase } = await authorize(request, id);
    const { data: registrations } = await supabase.from("event_registrations")
      .select("session_id,team_id,roster_json,status").eq("event_id", id).neq("status", "cancelled");
    const registeredTeamIds = new Set((registrations ?? []).map((row) => row.team_id).filter(Boolean) as string[]);

    if (payload.action === "game") {
      if (!registeredTeamIds.has(payload.teamId)) return Response.json({ error: "Команда не зарегистрирована" }, { status: 400 });
      const [{ data: game }, { data: team }] = await Promise.all([
        supabase.from("event_games").select("id,session_id").eq("id", payload.gameId).eq("event_id", id).single(),
        supabase.from("teams").select("id,name").eq("id", payload.teamId).single(),
      ]);
      if (!game || !team) return Response.json({ error: "Игра или команда не найдена" }, { status: 404 });
      const registration = (registrations ?? []).find((row) => row.team_id === team.id && row.session_id === game.session_id);
      const { error } = await supabase.from("event_game_results").upsert({
        game_id: game.id, team_id: team.id, team_name_snapshot: team.name,
        roster_snapshot: rosterSnapshot(registration?.roster_json),
        place: payload.place, kills: payload.kills, points: payload.points,
        status: "confirmed", confirmed_by: auth.user.id, confirmed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "game_id,team_id" });
      if (error) throw error;
      return Response.json({ success: true });
    }

    if (payload.action === "finalize") {
      if (!["tournament", "training"].includes(event.type)) return Response.json({ error: "Сессии доступны турнирам и тренировкам" }, { status: 400 });
      const { data: existing } = await supabase.from("organization_participation_history")
        .select("id").eq("event_id", id).eq("session_id", payload.sessionId).limit(1);
      if (existing?.length) return Response.json({ error: "История этой сессии уже зафиксирована" }, { status: 409 });
      const [{ data: session }, { data: games }] = await Promise.all([
        supabase.from("event_sessions").select("id,start_time").eq("id", payload.sessionId).eq("event_id", id).single(),
        supabase.from("event_games").select("id").eq("session_id", payload.sessionId),
      ]);
      if (!session || !games?.length) return Response.json({ error: "В сессии нет игр" }, { status: 400 });
      const { data: results } = await supabase.from("event_game_results").select("team_id,kills,points")
        .in("game_id", games.map((game) => game.id)).eq("status", "confirmed");
      const totals = new Map<string, { kills: number; points: number }>();
      for (const row of results ?? []) {
        const current = totals.get(row.team_id) ?? { kills: 0, points: 0 };
        totals.set(row.team_id, { kills: current.kills + row.kills, points: current.points + Number(row.points) });
      }
      const ranked = [...totals.entries()].sort((a, b) => b[1].points - a[1].points || b[1].kills - a[1].kills);
      const teamIds = ranked.map(([teamId]) => teamId);
      const { data: teams } = teamIds.length ? await supabase.from("teams").select("id,name,type").in("id", teamIds) : { data: [] };
      const teamById = new Map((teams ?? []).map((team) => [team.id, team]));
      const historyRows = ranked.flatMap(([teamId, total], index) => {
        const team = teamById.get(teamId);
        const registration = (registrations ?? []).find((row) => row.team_id === teamId && row.session_id === payload.sessionId);
        return team ? [{
          organization_id: team.id, organization_name: team.name, organization_type: team.type,
          mode: event.type, event_id: id, session_id: payload.sessionId, event_title: event.title,
          occurred_at: session.start_time, roster_snapshot: rosterSnapshot(registration?.roster_json),
          place: index + 1, kills: total.kills, points: total.points, result_status: "completed",
          recorded_by: auth.user.id,
        }] : [];
      });
      if (!historyRows.length) return Response.json({ error: "Сначала внесите результаты игр" }, { status: 400 });
      const { error } = await supabase.from("organization_participation_history").insert(historyRows);
      if (error) throw error;
      await supabase.from("event_games").update({ status: "completed", updated_at: new Date().toISOString() }).eq("session_id", payload.sessionId);
      return Response.json({ success: true });
    }

    if (event.type !== "bo") return Response.json({ error: "Раундовый результат доступен только для БО" }, { status: 400 });
    if (!registeredTeamIds.has(payload.teamAId) || !registeredTeamIds.has(payload.teamBId)) {
      return Response.json({ error: "Обе команды должны быть зарегистрированы" }, { status: 400 });
    }
    const { data: teams } = await supabase.from("teams").select("id,name,type").in("id", [payload.teamAId, payload.teamBId]);
    const teamById = new Map((teams ?? []).map((team) => [team.id, team]));
    const teamA = teamById.get(payload.teamAId); const teamB = teamById.get(payload.teamBId);
    if (!teamA || !teamB) return Response.json({ error: "Команды не найдены" }, { status: 404 });
    const { error: resultError } = await supabase.from("round_match_results").insert({
      event_id: id, team_a_id: teamA.id, team_b_id: teamB.id,
      team_a_name_snapshot: teamA.name, team_b_name_snapshot: teamB.name,
      team_a_score: payload.teamAScore, team_b_score: payload.teamBScore,
      team_a_kills: payload.teamAKills, team_b_kills: payload.teamBKills,
      status: "confirmed", confirmed_by: auth.user.id, confirmed_at: new Date().toISOString(),
    });
    if (resultError) throw resultError;
    const { data: session } = await supabase.from("event_sessions").select("id,start_time").eq("event_id", id).order("start_time").limit(1).maybeSingle();
    const history = [
      { team: teamA, score: payload.teamAScore + ":" + payload.teamBScore, kills: payload.teamAKills },
      { team: teamB, score: payload.teamBScore + ":" + payload.teamAScore, kills: payload.teamBKills },
    ].map((item) => ({
      organization_id: item.team.id, organization_name: item.team.name, organization_type: item.team.type,
      mode: "bo", event_id: id, session_id: session?.id ?? null, event_title: event.title,
      occurred_at: session?.start_time ?? new Date().toISOString(),
      roster_snapshot: rosterSnapshot((registrations ?? []).find((row) => row.team_id === item.team.id)?.roster_json),
      kills: item.kills, score: item.score, result_status: "completed", recorded_by: auth.user.id,
    }));
    const { error: historyError } = await supabase.from("organization_participation_history").insert(history);
    if (historyError) throw historyError;

    const { data: markets } = await supabase.from("betting_markets")
      .select("id,subject_team_id,market_type,selection_value,line").eq("event_id", id).in("status", ["open", "locked"]);
    for (const market of markets ?? []) {
      const subjectA = market.subject_team_id === teamA.id;
      const ownScore = subjectA ? payload.teamAScore : payload.teamBScore;
      const rivalScore = subjectA ? payload.teamBScore : payload.teamAScore;
      const kills = subjectA ? payload.teamAKills : payload.teamBKills;
      const won = market.market_type === "win" ? ownScore === 7
        : market.market_type === "loss" ? ownScore < rivalScore
        : market.market_type === "kills_over" ? kills > Number(market.line)
        : market.market_type === "kills_under" ? kills < Number(market.line)
        : market.market_type === "exact_score" ? market.selection_value === ownScore + ":" + rivalScore
        : false;
      await supabase.rpc("settle_betting_market", { p_market_id: market.id, p_outcome: won ? "won" : "lost", p_actor: auth.user.id });
    }
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || "Проверьте результат" }, { status: 400 });
    return authErrorResponse(error);
  }
}
