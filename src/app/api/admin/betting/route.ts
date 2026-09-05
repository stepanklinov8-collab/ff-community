import { z } from "zod";
import { calculateFixedOdds } from "@/lib/betting-odds";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin, requireSuperadmin } from "@/utils/supabase/server-auth";

const marketSchema = z.object({
  action: z.literal("create"),
  eventId: z.string().uuid().nullable().optional(),
  clanWarId: z.string().uuid().nullable().optional(),
  gameId: z.string().uuid().nullable().optional(),
  subjectTeamId: z.string().uuid(),
  marketType: z.enum(["kills_over", "kills_under", "exact_place", "win", "loss", "exact_score"]),
  selectionValue: z.string().trim().min(1).max(30),
  line: z.number().min(0).max(500).nullable().optional(),
});

const settleSchema = z.object({
  action: z.literal("settle"),
  marketId: z.string().uuid(),
  outcome: z.enum(["won", "lost", "void"]),
});

const settingsSchema = z.object({
  action: z.literal("settings"),
  currencyName: z.string().trim().min(2).max(40),
  startingBalance: z.number().int().min(0).max(1_000_000),
  minimumStake: z.number().int().min(1).max(100_000),
  maximumStake: z.number().int().min(1).max(1_000_000),
  maximumOdds: z.number().min(1.01).max(100),
}).refine((value) => value.maximumStake >= value.minimumStake, "Максимум должен быть не меньше минимума");

const payloadSchema = z.discriminatedUnion("action", [marketSchema, settleSchema, settingsSchema]);

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const supabase = createAdminClient();
    const [{ data: markets, error: marketsError }, { data: events }, { data: wars }, { data: teams }, { data: settings }] =
      await Promise.all([
        supabase.from("betting_markets").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("events").select("id,title,type").in("type", ["tournament", "training", "bo"]).order("created_at", { ascending: false }).limit(100),
        supabase.from("clan_wars").select("id,title,creator_team_id,opponent_team_id,status,scheduled_at").in("status", ["agreed", "completed"]).order("created_at", { ascending: false }).limit(100),
        supabase.from("teams").select("id,name,type,main_rating").order("name"),
        auth.roles.includes("superadmin") ? supabase.from("economy_settings").select("*").eq("singleton", true).maybeSingle() : Promise.resolve({ data: null }),
      ]);
    if (marketsError) throw marketsError;
    const eventIds = (events ?? []).map((event) => event.id);
    const { data: games } = eventIds.length
      ? await supabase.from("event_games").select("id,event_id,session_id,game_number,map_name").in("event_id", eventIds).order("game_number")
      : { data: [] };
    return Response.json({
      markets: markets ?? [],
      events: events ?? [],
      wars: wars ?? [],
      teams: teams ?? [],
      games: games ?? [],
      settings: settings ?? null,
      isOwner: auth.roles.includes("superadmin"),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const payload = payloadSchema.parse(raw);
    const auth = payload.action === "settings" ? await requireSuperadmin(request) : await requireAdmin(request);
    const supabase = createAdminClient();

    if (payload.action === "settle") {
      const { error } = await supabase.rpc("settle_betting_market", {
        p_market_id: payload.marketId,
        p_outcome: payload.outcome,
        p_actor: auth.user.id,
      });
      if (error) throw error;
      return Response.json({ success: true });
    }

    if (payload.action === "settings") {
      const { error } = await supabase.from("economy_settings").update({
        currency_name: payload.currencyName,
        starting_balance: payload.startingBalance,
        minimum_stake: payload.minimumStake,
        maximum_stake: payload.maximumStake,
        maximum_odds: payload.maximumOdds,
        changed_by: auth.user.id,
        updated_at: new Date().toISOString(),
      }).eq("singleton", true);
      if (error) throw error;
      return Response.json({ success: true });
    }

    if (Boolean(payload.eventId) === Boolean(payload.clanWarId)) {
      return Response.json({ error: "Выберите одно мероприятие или одно КВ" }, { status: 400 });
    }

    let mode: "tournament" | "training" | "bo" | "kv";
    let locksAt: string | null = null;
    if (payload.eventId) {
      const [{ data: event }, { data: firstSession }] = await Promise.all([
        supabase.from("events").select("id,type").eq("id", payload.eventId).single(),
        supabase.from("event_sessions").select("start_time").eq("event_id", payload.eventId)
          .order("start_time", { ascending: true }).limit(1).maybeSingle(),
      ]);
      if (!event || !["tournament", "training", "bo"].includes(event.type)) {
        return Response.json({ error: "Для этого типа мероприятия ставки недоступны" }, { status: 400 });
      }
      mode = event.type as typeof mode;
      locksAt = firstSession?.start_time ?? null;
      if ((mode === "tournament" || mode === "training") && !payload.gameId) {
        return Response.json({ error: "Для турнира или тренировки выберите игру" }, { status: 400 });
      }
      if (mode === "bo" && !["win", "loss", "kills_over", "kills_under", "exact_score"].includes(payload.marketType)) {
        return Response.json({ error: "Для БО доступен только результат матча, убийства и счёт" }, { status: 400 });
      }
    } else {
      const { data: war } = await supabase.from("clan_wars").select("scheduled_at").eq("id", payload.clanWarId!).single();
      mode = "kv";
      locksAt = war?.scheduled_at ?? null;
      if (!["win", "loss", "kills_over", "kills_under", "exact_score"].includes(payload.marketType)) {
        return Response.json({ error: "Для КВ доступен только результат матча, убийства и счёт" }, { status: 400 });
      }
    }

    if (!locksAt || new Date(locksAt) <= new Date()) {
      return Response.json({ error: "Нужно указать будущее время начала мероприятия" }, { status: 400 });
    }
    if (payload.marketType === "exact_score" && !/^(7:[0-6]|[0-6]:7)$/.test(payload.selectionValue)) {
      return Response.json({ error: "Допустимый счёт: от 7:0 до 7:6 в пользу одной стороны" }, { status: 400 });
    }
    if ((payload.marketType === "kills_over" || payload.marketType === "kills_under") &&
      (payload.line == null || payload.line % 1 !== 0.5)) {
      return Response.json({ error: "Линия убийств должна оканчиваться на ,5" }, { status: 400 });
    }

    const [{ data: team, error: teamError }, { data: history, error: historyError }] = await Promise.all([
      supabase.from("teams").select("id,name,main_rating").eq("id", payload.subjectTeamId).single(),
      supabase.from("event_game_results").select("kills,place").eq("team_id", payload.subjectTeamId)
        .eq("status", "confirmed").order("created_at", { ascending: false }).limit(20),
    ]);
    if (teamError || !team) throw teamError ?? new Error("Команда не найдена");
    if (historyError) throw historyError;
    const sampleSize = history?.length ?? 0;
    const averageKills = sampleSize ? history!.reduce((sum, item) => sum + item.kills, 0) / sampleSize : 6;
    const averagePlace = sampleSize ? history!.reduce((sum, item) => sum + item.place, 0) / sampleSize : 6.5;
    const odds = calculateFixedOdds({
      marketType: payload.marketType,
      line: payload.line,
      selectionValue: payload.selectionValue,
      teamRating: Number(team.main_rating ?? 1),
      averageKills,
      averagePlace,
      sampleSize,
    });

    const { data: market, error } = await supabase.from("betting_markets").insert({
      event_id: payload.eventId ?? null,
      game_id: payload.gameId ?? null,
      clan_war_id: payload.clanWarId ?? null,
      subject_team_id: team.id,
      subject_team_name: team.name,
      mode,
      market_type: payload.marketType,
      selection_value: payload.selectionValue,
      line: payload.line ?? null,
      odds,
      locks_at: locksAt,
      status: "open",
      created_by: auth.user.id,
      model_snapshot: {
        teamRating: Number(team.main_rating ?? 1),
        averageKills: Number(averageKills.toFixed(2)),
        averagePlace: Number(averagePlace.toFixed(2)),
        sampleSize,
      },
    }).select("id,odds").single();
    if (error) throw error;
    return Response.json({ success: true, market }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте параметры рынка" }, { status: 400 });
    return authErrorResponse(error);
  }
}
