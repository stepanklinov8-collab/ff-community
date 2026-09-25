import { z } from "zod";
import {
  type BettingMarketType,
  calculateFixedOdds,
  QUOTE_LIFETIME_SECONDS,
  suggestedKillsLine,
} from "@/lib/betting-odds";
import { classifyBettingDatabaseError } from "@/lib/betting-errors";
import {loadBettingSources} from "@/lib/competition/betting";
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
  mode: "tournament" | "training" | "solo" | "bo" | "kv";
  targetType: "player" | "team";
  clanWarGameId: string | null;
  marketType: BettingMarketType;
  selectionValue: string;
  line: number | null;
  locksAt: string;
  quote: ReturnType<typeof calculateFixedOdds>;
  modelSnapshot: Record<string, number>;
}

const unavailableMessage = "Коэффициент ниже 1,10. Ставка на этот исход недоступна";
const noStoreHeaders = { "Cache-Control": "private, no-store, max-age=0" };
const betSelection = "id,market_id,stake,odds,potential_payout,status,payout,placed_at,betting_markets(subject_team_name,mode,market_type,selection_value,line,event_id,game_id,clan_war_id)";

function average(values: number[], fallback: number) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function validateSelection(mode: SelectionEvaluation["mode"], input: SelectionInput) {
  const isClassic = mode === "tournament" || mode === "training" || mode === "solo";
  if (isClassic && !["kills_over", "kills_under", "exact_place"].includes(input.marketType)) {
    throw new Error("Для турниров и тренировок доступны места и убийства");
  }
  if (!isClassic && !["win", "loss", "kills_over", "kills_under", "exact_score"].includes(input.marketType)) {
    throw new Error("Для КВ и БО доступны победа, поражение, убийства и точный счёт");
  }
  if (!input.gameId) throw new Error("Выберите игру");
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
  const source=(await loadBettingSources(supabase,input.sourceId))[0];
  if(!source)throw new Error("Ставки на это событие недоступны");
  const mode=source.mode;
  validateSelection(mode,input);
  const game=source.games.find(row=>row.id===input.gameId);
  if(!game)throw new Error("Игра недоступна для ставок");
  const locksAt=game.locksAt,eventId=source.kind==="event"?source.sourceId:null,clanWarId=source.kind==="war"?source.sourceId:null;
  const gameId=source.kind==="event"?game.id:null,clanWarGameId=source.kind==="war"?game.id:null;
  const teams=source.teams.filter(row=>row.gameIds.includes(game.id));
  const team=teams.find(row=>row.id===input.teamId);
  if(!team)throw new Error("Команда или игрок не участвует в выбранной игре");
  const participantTeamIds=teams.map(row=>row.id);
  if(input.marketType==="exact_place"&&Number(input.selectionValue)>teams.length)throw new Error("Указанное место превышает число участников игры");
  let historyQuery=supabase.from("competition_public_history").select("kills,place").eq("target_type",team.type).eq("target_id",team.id).eq("games",1).not("place","is",null).order("occurred_at",{ascending:false}).limit(20);
  historyQuery=["tournament","training"].includes(mode)?historyQuery.in("mode",["tournament","training"]):historyQuery.eq("mode",mode);
  const [{data:history,error:historyError},{data:settings,error:settingsError}]=await Promise.all([historyQuery,supabase.from("economy_settings").select("maximum_odds").eq("singleton",true).maybeSingle()]);
  if(historyError||settingsError)throw historyError??settingsError;
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
    targetType: team.type,
    clanWarGameId,
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
    subject_team_id: evaluation.targetType === "team" ? evaluation.teamId : null,
    subject_user_id: evaluation.targetType === "player" ? evaluation.teamId : null,
    clan_war_game_id: evaluation.clanWarGameId,
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

async function findBetByQuote(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  quoteId: string,
) {
  return supabase.from("site_bets")
    .select(betSelection)
    .eq("user_id", userId)
    .eq("quote_id", quoteId)
    .maybeSingle();
}

async function acceptedBetResponse(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  betId: string,
  status = 201,
) {
  const [{ data: wallet, error: walletError }, { data: bet, error: betError }] = await Promise.all([
    supabase.from("site_wallets").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.from("site_bets").select(betSelection).eq("id", betId).eq("user_id", userId).maybeSingle(),
  ]);

  // The transaction has already succeeded at this point. A secondary read
  // failure must not turn it into a false rejection in the interface.
  if (walletError || betError) {
    console.error("Bet accepted but refresh data could not be loaded", {
      userId,
      betId,
      walletError,
      betError,
    });
  }

  return Response.json({
    success: true,
    betId,
    balance: walletError ? null : wallet?.balance ?? null,
    bet: betError ? null : bet ?? null,
  }, { status, headers: noStoreHeaders });
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    const [{ error: lockMarketsError }, { error: cleanupQuotesError }] = await Promise.all([
      supabase.from("betting_markets").update({ status: "locked" }).eq("status", "open").lte("locks_at", now),
      supabase.from("betting_quotes").delete().is("confirmed_at", null).lt("expires_at", new Date(Date.now() - 86_400_000).toISOString()),
    ]);
    if (lockMarketsError || cleanupQuotesError) {
      console.error("Betting maintenance did not complete", { lockMarketsError, cleanupQuotesError });
    }

    const [{ data: wallet, error: walletError }, { data: settings, error: settingsError }, { data: bets, error: betsError }] = await Promise.all([
      supabase.from("site_wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase.from("economy_settings").select("currency_name,minimum_stake,maximum_stake,maximum_odds").eq("singleton", true).maybeSingle(),
      supabase.from("site_bets")
        .select(betSelection)
        .eq("user_id", user.id).order("placed_at", { ascending: false }).limit(100),
    ]);
    if (walletError || settingsError || betsError) throw walletError ?? settingsError ?? betsError;

    const sources=await loadBettingSources(supabase);
    const previews: Record<string,unknown>[]=[];
    for(const source of sources.slice(0,6)){
      const game=source.games[0],field=source.teams.filter(team=>team.gameIds.includes(game.id));
      for(const team of field.slice(0,4)){
        const marketType=source.mode==="bo"||source.mode==="kv"?"win":"kills_over";
        const line=marketType==="win"?null:suggestedKillsLine(6);
        const quote=calculateFixedOdds({marketType,line,selectionValue:marketType==="win"?"win":"over",teamRating:team.main_rating,
          opponentRating:average(field.filter(t=>t.id!==team.id).map(t=>t.main_rating),50),fieldAverageRating:average(field.map(t=>t.main_rating),50),
          fieldSize:field.length,averageKills:6,averagePlace:(field.length+1)/2,sampleSize:0,maximumOdds:Number(settings?.maximum_odds??15)});
        previews.push({sourceId:source.id,sourceTitle:source.title,teamId:team.id,teamName:team.name,gameId:game.id,marketType,line,available:quote.eligible,
          ...(quote.eligible?{odds:quote.offeredOdds}:{message:unavailableMessage})});
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
    }, { headers: noStoreHeaders });
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
      return Response.json(await saveQuote(supabase, user.id, evaluation), { headers: noStoreHeaders });
    }

    const { data: storedQuote, error: quoteError } = await supabase.from("betting_quotes")
      .select("id,source_id,event_id,game_id,clan_war_id,clan_war_game_id,subject_user_id,subject_team_id,market_type,selection_value,line,offered_odds,expires_at,confirmed_at")
      .eq("id", payload.quoteId).eq("user_id", user.id).maybeSingle();
    if (quoteError) throw quoteError;
    if (!storedQuote) return Response.json({ error: "Котировка не найдена", code: "QUOTE_NOT_FOUND" }, { status: 404, headers: noStoreHeaders });
    if (storedQuote.confirmed_at) {
      const { data: existingBet, error: existingBetError } = await findBetByQuote(supabase, user.id, storedQuote.id);
      if (existingBetError) throw existingBetError;
      if (existingBet) return acceptedBetResponse(supabase, user.id, existingBet.id, 200);
      return Response.json({ error: "Эта котировка уже использована", code: "QUOTE_USED" }, { status: 409, headers: noStoreHeaders });
    }
    if (new Date(storedQuote.expires_at) <= new Date()) {
      return Response.json({ error: "Котировка истекла. Рассчитайте коэффициент ещё раз", code: "QUOTE_EXPIRED" }, { status: 409, headers: noStoreHeaders });
    }

    const current = await evaluateSelection(supabase, {
      sourceId: storedQuote.source_id,
      gameId: storedQuote.game_id ?? storedQuote.clan_war_game_id,
      teamId: storedQuote.subject_team_id ?? storedQuote.subject_user_id,
      marketType: storedQuote.market_type as BettingMarketType,
      selectionValue: storedQuote.selection_value,
      line: storedQuote.line == null ? null : Number(storedQuote.line),
    });
    if (!current.quote.eligible || current.quote.offeredOdds == null) {
      return Response.json({ error: unavailableMessage, code: "OUTCOME_UNAVAILABLE" }, { status: 409, headers: noStoreHeaders });
    }
    if (current.quote.offeredOdds !== Number(storedQuote.offered_odds)) {
      const replacement = await saveQuote(supabase, user.id, current);
      return Response.json({
        error: "Коэффициент изменился. Подтвердите новую котировку",
        code: "QUOTE_CHANGED",
        quote: replacement,
      }, { status: 409, headers: noStoreHeaders });
    }

    const { data, error } = await supabase.rpc("place_dynamic_site_bet_for", {
      p_user_id: user.id,
      p_quote_id: payload.quoteId,
      p_stake: payload.stake,
    });
    if (error) {
      const failure = classifyBettingDatabaseError(error);
      if (failure.code === "QUOTE_USED") {
        const { data: existingBet, error: existingBetError } = await findBetByQuote(supabase, user.id, payload.quoteId);
        if (!existingBetError && existingBet) return acceptedBetResponse(supabase, user.id, existingBet.id, 200);
      }
      console.error("Bet confirmation rejected", {
        userId: user.id,
        quoteId: payload.quoteId,
        databaseCode: error.code,
        databaseMessage: error.message,
        databaseDetails: error.details,
        applicationCode: failure.code,
      });
      return Response.json({ error: failure.message, code: failure.code }, { status: failure.status, headers: noStoreHeaders });
    }
    return acceptedBetResponse(supabase, user.id, data, 201);
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте параметры ставки" }, { status: 400 });
    if (error instanceof Error && [
      "Для", "Выберите", "Линия", "Укажите", "Допустимый", "Ставки", "Мероприятие",
      "КВ", "Источник", "Приём", "Команда", "Указанное", "Игра",
    ].some((prefix) => error.message.startsWith(prefix))) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
