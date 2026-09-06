import { z } from "zod";
import {
  type BettingMarketType,
  calculateFixedOdds,
  QUOTE_LIFETIME_SECONDS,
  suggestedKillsLine,
} from "@/lib/betting-odds";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const marketTypes = ["kills_over", "kills_under", "exact_place", "win", "loss", "exact_score"] as const;

const quoteSchema = z.object({
  action: z.literal("quote"),
  sourceId: z.string().uuid(),
  gameId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid(),
  marketType: z.enum(marketTypes),
  selectionValue: z.string().trim().max(30).optional().default(""),
  line: z.number().min(0).max(500).nullable().optional(),
});

const confirmSchema = z.object({
  action: z.literal("confirm"),
  quoteId: z.string().uuid(),
  stake: z.number().int().positive(),
});

const payloadSchema = z.discriminatedUnion("action", [quoteSchema, confirmSchema]);

interface SelectionInput {
  sourceId: string;
  gameId?: string | null;
  teamId: string;
  marketType: BettingMarketType;
  selectionValue: string;
  line?: number | null;
}

interface SelectionEvaluation {
  sourceId: string;
  eventId: string | null;
  gameId: string | null;
  clanWarId: string | null;
  teamId: string;
  teamName: string;
  mode: "tournament" | "training" | "bo" | "kv";
  marketType: BettingMarketType;
  selectionValue: string;
  line: number | null;
  locksAt: string;
  quote: ReturnType<typeof calculateFixedOdds>;
  modelSnapshot: Record<string, number>;
}

interface CatalogTeam {
  id: string;
  name: string;
  type: string;
  main_rating: number | null;
  sessionIds?: string[];
}

interface CatalogGame {
  id: string;
  event_id: string;
  session_id: string;
  game_number: number;
  map_name: string;
}

interface CatalogSource {
  id: string;
  kind: "event" | "war";
  sourceId: string;
  title: string;
  mode: SelectionEvaluation["mode"];
  locksAt: string;
  games: CatalogGame[];
  teams: CatalogTeam[];
}

const unavailableMessage = "Коэффициент ниже 1,10. Ставка на этот исход недоступна";

function average(values: number[], fallback: number) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function validateSelection(mode: SelectionEvaluation["mode"], input: SelectionInput) {
  const isClassic = mode === "tournament" || mode === "training";
  if (isClassic && !["kills_over", "kills_under", "exact_place"].includes(input.marketType)) {
    throw new Error("Для турниров и тренировок доступны места и убийства");
  }
  if (!isClassic && !["win", "loss", "kills_over", "kills_under", "exact_score"].includes(input.marketType)) {
    throw new Error("Для КВ и БО доступны победа, поражение, убийства и точный счёт");
  }
  if (isClassic && !input.gameId) throw new Error("Выберите игру");
  if (!isClassic && input.gameId) throw new Error("Для этого режима отдельная игра не выбирается");
  if (["kills_over", "kills_under"].includes(input.marketType)) {
    if (input.line == null || !Number.isInteger(input.line * 2) || Number.isInteger(input.line)) {
      throw new Error("Линия убийств должна оканчиваться на ,5");
    }
  }
  if (input.marketType === "exact_place") {
    const place = Number(input.selectionValue);
    if (!Number.isInteger(place) || place < 1 || place > 100) throw new Error("Укажите допустимое место");
  }
  if (input.marketType === "exact_score" && !/^(7:[0-6]|[0-6]:7)$/.test(input.selectionValue)) {
    throw new Error("Допустимый счёт: от 7:0 до 7:6 в пользу одной стороны");
  }
}

async function evaluateSelection(
  supabase: ReturnType<typeof createAdminClient>,
  input: SelectionInput,
): Promise<SelectionEvaluation> {
  const { data: source, error: sourceError } = await supabase
    .from("betting_sources")
    .select("id,event_id,clan_war_id,enabled")
    .eq("id", input.sourceId)
    .maybeSingle();
  if (sourceError) throw sourceError;
  if (!source?.enabled) throw new Error("Ставки на это событие отключены");

  const eventId: string | null = source.event_id;
  const clanWarId: string | null = source.clan_war_id;
  let gameId: string | null = null;
  let mode: SelectionEvaluation["mode"];
  let locksAt: string | null = null;
  let participantTeamIds: string[] = [];

  if (eventId) {
    const [{ data: event, error: eventError }, { data: firstSession, error: sessionError }] = await Promise.all([
      supabase.from("events").select("id,type,is_published").eq("id", eventId).maybeSingle(),
      supabase.from("event_sessions").select("start_time").eq("event_id", eventId)
        .order("start_time", { ascending: true }).limit(1).maybeSingle(),
    ]);
    if (eventError || sessionError) throw eventError ?? sessionError;
    if (!event?.is_published || !["tournament", "training", "bo"].includes(event.type)) {
      throw new Error("Мероприятие недоступно для ставок");
    }
    mode = event.type as SelectionEvaluation["mode"];
    locksAt = firstSession?.start_time ?? null;
    validateSelection(mode, input);

    let sessionId: string | null = null;
    if (input.gameId) {
      const { data: game, error: gameError } = await supabase.from("event_games")
        .select("id,session_id").eq("id", input.gameId).eq("event_id", eventId).maybeSingle();
      if (gameError) throw gameError;
      if (!game) throw new Error("Игра не относится к выбранному мероприятию");
      gameId = game.id;
      sessionId = game.session_id;
    }
    let registrationsQuery = supabase.from("event_registrations")
      .select("team_id").eq("event_id", eventId).eq("status", "confirmed")
      .not("team_id", "is", null);
    if (sessionId) registrationsQuery = registrationsQuery.eq("session_id", sessionId);
    const { data: registrations, error: registrationsError } = await registrationsQuery;
    if (registrationsError) throw registrationsError;
    participantTeamIds = [...new Set((registrations ?? []).map((row) => row.team_id).filter(Boolean))] as string[];
  } else if (clanWarId) {
    const { data: war, error: warError } = await supabase.from("clan_wars")
      .select("id,status,scheduled_at,creator_team_id,opponent_team_id")
      .eq("id", clanWarId).maybeSingle();
    if (warError) throw warError;
    if (!war || !["agreed", "completed"].includes(war.status) || !war.opponent_team_id) {
      throw new Error("КВ ещё не согласовано");
    }
    mode = "kv";
    locksAt = war.scheduled_at;
    participantTeamIds = [war.creator_team_id, war.opponent_team_id];
    validateSelection(mode, input);
  } else {
    throw new Error("Источник ставок не найден");
  }

  if (!locksAt || new Date(locksAt) <= new Date()) throw new Error("Приём ставок уже закрыт");
  if (!participantTeamIds.includes(input.teamId)) throw new Error("Команда не участвует в выбранной игре");
  if (input.marketType === "exact_place" && Number(input.selectionValue) > participantTeamIds.length) {
    throw new Error("Указанное место превышает число участников игры");
  }

  const [{ data: teams, error: teamsError }, { data: history, error: historyError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("teams").select("id,name,main_rating").in("id", participantTeamIds),
    supabase.from("event_game_results").select("kills,place").eq("team_id", input.teamId)
      .eq("status", "confirmed").order("created_at", { ascending: false }).limit(20),
    supabase.from("economy_settings").select("maximum_odds").eq("singleton", true).maybeSingle(),
  ]);
  if (teamsError || historyError || settingsError) throw teamsError ?? historyError ?? settingsError;
  const team = (teams ?? []).find((row) => row.id === input.teamId);
  if (!team) throw new Error("Команда не найдена");

  const sampleSize = history?.length ?? 0;
  const averageKills = average((history ?? []).map((row) => Number(row.kills)), 6);
  const averagePlace = average((history ?? []).map((row) => Number(row.place)), 6.5);
  const otherRatings = (teams ?? []).filter((row) => row.id !== team.id).map((row) => Number(row.main_rating ?? 1));
  const fieldRatings = (teams ?? []).map((row) => Number(row.main_rating ?? 1));
  const selectionValue = input.marketType === "win" || input.marketType === "loss"
    ? input.marketType
    : input.marketType.startsWith("kills_")
      ? input.marketType === "kills_over" ? "over" : "under"
      : input.selectionValue;
  const line = input.marketType.startsWith("kills_") ? input.line ?? null : null;
  const modelSnapshot = {
    teamRating: Number(team.main_rating ?? 1),
    opponentRating: average(otherRatings, 50),
    fieldAverageRating: average(fieldRatings, 50),
    fieldSize: participantTeamIds.length,
    averageKills: Number(averageKills.toFixed(4)),
    averagePlace: Number(averagePlace.toFixed(4)),
    sampleSize,
  };
  const quote = calculateFixedOdds({
    marketType: input.marketType,
    line,
    selectionValue,
    ...modelSnapshot,
    maximumOdds: Number(settings?.maximum_odds ?? 15),
  });

  return {
    sourceId: source.id,
    eventId,
    gameId,
    clanWarId,
    teamId: team.id,
    teamName: team.name,
    mode,
    marketType: input.marketType,
    selectionValue,
    line,
    locksAt,
    quote,
    modelSnapshot,
  };
}

async function saveQuote(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  evaluation: SelectionEvaluation,
) {
  if (!evaluation.quote.eligible || evaluation.quote.offeredOdds == null) {
    return { available: false as const, message: unavailableMessage };
  }
  const expiresAt = new Date(Date.now() + QUOTE_LIFETIME_SECONDS * 1000).toISOString();
  const { data, error } = await supabase.from("betting_quotes").insert({
    user_id: userId,
    source_id: evaluation.sourceId,
    event_id: evaluation.eventId,
    game_id: evaluation.gameId,
    clan_war_id: evaluation.clanWarId,
    subject_team_id: evaluation.teamId,
    subject_team_name: evaluation.teamName,
    mode: evaluation.mode,
    market_type: evaluation.marketType,
    selection_value: evaluation.selectionValue,
    line: evaluation.line,
    raw_odds: Number(evaluation.quote.rawOdds.toFixed(6)),
    offered_odds: evaluation.quote.offeredOdds,
    model_snapshot: evaluation.modelSnapshot,
    locks_at: evaluation.locksAt,
    expires_at: expiresAt,
  }).select("id,offered_odds,expires_at").single();
  if (error) throw error;
  return {
    available: true as const,
    quoteId: data.id,
    odds: Number(data.offered_odds),
    expiresAt: data.expires_at,
  };
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    await Promise.all([
      supabase.from("betting_markets").update({ status: "locked" }).eq("status", "open").lte("locks_at", now),
      supabase.from("betting_quotes").delete().is("confirmed_at", null).lt("expires_at", new Date(Date.now() - 86_400_000).toISOString()),
    ]);

    const [{ data: sourceRows, error: sourcesError }, { data: wallet, error: walletError }, { data: settings }, { data: bets, error: betsError }] = await Promise.all([
      supabase.from("betting_sources").select("id,event_id,clan_war_id").eq("enabled", true),
      supabase.from("site_wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase.from("economy_settings").select("currency_name,minimum_stake,maximum_stake,maximum_odds").eq("singleton", true).maybeSingle(),
      supabase.from("site_bets")
        .select("id,market_id,stake,odds,potential_payout,status,payout,placed_at,betting_markets(subject_team_name,mode,market_type,selection_value,line,event_id,game_id,clan_war_id)")
        .eq("user_id", user.id).order("placed_at", { ascending: false }).limit(100),
    ]);
    if (sourcesError || walletError || betsError) throw sourcesError ?? walletError ?? betsError;

    const eventIds = (sourceRows ?? []).map((row) => row.event_id).filter(Boolean) as string[];
    const warIds = (sourceRows ?? []).map((row) => row.clan_war_id).filter(Boolean) as string[];
    const empty = Promise.resolve({ data: [], error: null });
    const [{ data: events }, { data: sessions }, { data: games }, { data: registrations }, { data: wars }] = await Promise.all([
      eventIds.length ? supabase.from("events").select("id,title,type,is_published").in("id", eventIds) : empty,
      eventIds.length ? supabase.from("event_sessions").select("id,event_id,start_time").in("event_id", eventIds).order("start_time") : empty,
      eventIds.length ? supabase.from("event_games").select("id,event_id,session_id,game_number,map_name").in("event_id", eventIds).order("game_number") : empty,
      eventIds.length ? supabase.from("event_registrations").select("event_id,session_id,team_id,status").in("event_id", eventIds).eq("status", "confirmed").not("team_id", "is", null) : empty,
      warIds.length ? supabase.from("clan_wars").select("id,title,status,scheduled_at,creator_team_id,opponent_team_id").in("id", warIds) : empty,
    ]);

    const participantIds = new Set<string>();
    for (const registration of registrations ?? []) if (registration.team_id) participantIds.add(registration.team_id);
    for (const war of wars ?? []) {
      if (war.creator_team_id) participantIds.add(war.creator_team_id);
      if (war.opponent_team_id) participantIds.add(war.opponent_team_id);
    }
    const teamIds = [...participantIds];
    const [{ data: teams }, { data: history }] = await Promise.all([
      teamIds.length ? supabase.from("teams").select("id,name,type,main_rating").in("id", teamIds) : empty,
      teamIds.length ? supabase.from("event_game_results").select("team_id,kills,place,created_at").in("team_id", teamIds).eq("status", "confirmed").order("created_at", { ascending: false }).limit(2000) : empty,
    ]);

    const teamById = new Map<string, CatalogTeam>(((teams ?? []) as CatalogTeam[]).map((team) => [team.id, team]));
    const eventById = new Map((events ?? []).map((event) => [event.id, event]));
    const warById = new Map((wars ?? []).map((war) => [war.id, war]));
    const historyByTeam = new Map<string, { kills: number; place: number }[]>();
    for (const row of history ?? []) {
      const current = historyByTeam.get(row.team_id) ?? [];
      if (current.length < 20) current.push({ kills: Number(row.kills), place: Number(row.place) });
      historyByTeam.set(row.team_id, current);
    }

    const sources: CatalogSource[] = [];
    for (const source of sourceRows ?? []) {
      if (source.event_id) {
        const event = eventById.get(source.event_id);
        const sourceSessions = (sessions ?? []).filter((session) => session.event_id === source.event_id);
        const locksAt = sourceSessions[0]?.start_time;
        if (!event?.is_published || !locksAt || new Date(locksAt) <= new Date()) continue;
        const sourceGames = (games ?? []).filter((game) => game.event_id === source.event_id) as CatalogGame[];
        const sourceRegistrations = (registrations ?? []).filter((registration) => registration.event_id === source.event_id);
        const sourceTeamIds = [...new Set(sourceRegistrations.map((row) => row.team_id).filter(Boolean))] as string[];
        sources.push({
          id: source.id,
          kind: "event",
          sourceId: source.event_id,
          title: event.title,
          mode: event.type as CatalogSource["mode"],
          locksAt,
          games: sourceGames,
          teams: sourceTeamIds.flatMap((teamId) => {
            const team = teamById.get(teamId);
            if (!team) return [];
            return [{ ...team, sessionIds: [...new Set(sourceRegistrations.filter((row) => row.team_id === teamId).map((row) => row.session_id).filter(Boolean))] }];
          }),
        });
        continue;
      }
      const war = source.clan_war_id ? warById.get(source.clan_war_id) : null;
      if (!war?.opponent_team_id || !war.scheduled_at || new Date(war.scheduled_at) <= new Date() || war.status !== "agreed") continue;
      const warTeams = [teamById.get(war.creator_team_id), teamById.get(war.opponent_team_id)].filter((team): team is CatalogTeam => Boolean(team));
      sources.push({
        id: source.id,
        kind: "war",
        sourceId: war.id,
        title: war.title,
        mode: "kv",
        locksAt: war.scheduled_at,
        games: [],
        teams: warTeams,
      });
    }

    const previews: Record<string, unknown>[] = [];
    for (const source of sources) {
      const previewTeams = source.games[0]
        ? source.teams.filter((team) => !team.sessionIds || team.sessionIds.includes(source.games[0].session_id))
        : source.teams;
      const fieldRatings = previewTeams.map((team) => Number(team?.main_rating ?? 1));
      for (const team of previewTeams.slice(0, 4)) {
        if (!team) continue;
        const recent = historyByTeam.get(team.id) ?? [];
        const averageKills = average(recent.map((row) => row.kills), 6);
        const averagePlace = average(recent.map((row) => row.place), 6.5);
        const marketType: BettingMarketType = source.mode === "tournament" || source.mode === "training" ? "kills_over" : "win";
        const line = marketType === "kills_over" ? suggestedKillsLine(averageKills) : null;
        const quote = calculateFixedOdds({
          marketType,
          line,
          selectionValue: marketType === "win" ? "win" : "over",
          teamRating: Number(team.main_rating ?? 1),
          opponentRating: average(fieldRatings.filter((_, index) => previewTeams[index]?.id !== team.id), 50),
          fieldAverageRating: average(fieldRatings, 50),
          fieldSize: previewTeams.length,
          averageKills,
          averagePlace,
          sampleSize: recent.length,
          maximumOdds: Number(settings?.maximum_odds ?? 15),
        });
        previews.push({
          sourceId: source.id,
          sourceTitle: source.title,
          teamId: team.id,
          teamName: team.name,
          gameId: source.games[0]?.id ?? null,
          marketType,
          line,
          available: quote.eligible,
          ...(quote.eligible ? { odds: quote.offeredOdds } : { message: unavailableMessage }),
        });
      }
    }

    return Response.json({
      balance: wallet?.balance ?? 0,
      currencyName: settings?.currency_name ?? "Монеты Арены",
      minimumStake: settings?.minimum_stake ?? 10,
      maximumStake: settings?.maximum_stake ?? 200,
      sources,
      previews: previews.slice(0, 24),
      bets: bets ?? [],
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const payload = payloadSchema.parse(await request.json());
    const supabase = createAdminClient();

    if (payload.action === "quote") {
      const evaluation = await evaluateSelection(supabase, payload);
      return Response.json(await saveQuote(supabase, user.id, evaluation));
    }

    const { data: storedQuote, error: quoteError } = await supabase.from("betting_quotes")
      .select("id,source_id,event_id,game_id,clan_war_id,subject_team_id,market_type,selection_value,line,offered_odds,expires_at,confirmed_at")
      .eq("id", payload.quoteId).eq("user_id", user.id).maybeSingle();
    if (quoteError) throw quoteError;
    if (!storedQuote) return Response.json({ error: "Котировка не найдена" }, { status: 404 });
    if (storedQuote.confirmed_at) return Response.json({ error: "Эта котировка уже использована" }, { status: 409 });
    if (new Date(storedQuote.expires_at) <= new Date()) {
      return Response.json({ error: "Котировка истекла. Рассчитайте коэффициент ещё раз", code: "QUOTE_EXPIRED" }, { status: 409 });
    }

    const current = await evaluateSelection(supabase, {
      sourceId: storedQuote.source_id,
      gameId: storedQuote.game_id,
      teamId: storedQuote.subject_team_id,
      marketType: storedQuote.market_type as BettingMarketType,
      selectionValue: storedQuote.selection_value,
      line: storedQuote.line == null ? null : Number(storedQuote.line),
    });
    if (!current.quote.eligible || current.quote.offeredOdds == null) {
      return Response.json({ error: unavailableMessage, code: "OUTCOME_UNAVAILABLE" }, { status: 409 });
    }
    if (current.quote.offeredOdds !== Number(storedQuote.offered_odds)) {
      const replacement = await saveQuote(supabase, user.id, current);
      return Response.json({
        error: "Коэффициент изменился. Подтвердите новую котировку",
        code: "QUOTE_CHANGED",
        quote: replacement,
      }, { status: 409 });
    }

    const { data, error } = await supabase.rpc("place_dynamic_site_bet_for", {
      p_user_id: user.id,
      p_quote_id: payload.quoteId,
      p_stake: payload.stake,
    });
    if (error) {
      const message = error.message.includes("own organization")
        ? "Нельзя ставить на себя или свою команду"
        : error.message.includes("Insufficient")
          ? "Недостаточно монет"
          : error.message.includes("limits")
            ? "Сумма вне разрешённых лимитов"
            : error.message.includes("expired")
              ? "Котировка истекла. Рассчитайте коэффициент ещё раз"
              : error.message.includes("already exists")
                ? "Вы уже поставили на этот исход"
                : error.message.includes("closed") || error.message.includes("disabled")
                  ? "Приём ставок уже закрыт"
                  : "Не удалось принять ставку";
      return Response.json({ error: message }, { status: 400 });
    }
    return Response.json({ success: true, betId: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте параметры ставки" }, { status: 400 });
    if (error instanceof Error && [
      "Для", "Выберите", "Линия", "Укажите", "Допустимый", "Ставки", "Мероприятие",
      "КВ", "Источник", "Приём", "Команда", "Указанное",
    ].some((prefix) => error.message.startsWith(prefix))) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
