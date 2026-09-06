import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin, requireSuperadmin } from "@/utils/supabase/server-auth";

const toggleSchema = z.object({
  action: z.literal("toggle"),
  sourceKind: z.enum(["event", "war"]),
  sourceId: z.string().uuid(),
  enabled: z.boolean(),
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
  maximumOdds: z.number().min(1.1).max(100),
}).refine((value) => value.maximumStake >= value.minimumStake, "Максимум должен быть не меньше минимума");

const payloadSchema = z.discriminatedUnion("action", [toggleSchema, settleSchema, settingsSchema]);

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const supabase = createAdminClient();
    const [{ data: markets, error: marketsError }, { data: events, error: eventsError }, { data: wars, error: warsError }, { data: sources, error: sourcesError }, { data: settings }] =
      await Promise.all([
        supabase.from("betting_markets").select("id,event_id,game_id,clan_war_id,subject_team_name,mode,market_type,selection_value,line,odds,status,locks_at,outcome,created_at").order("created_at", { ascending: false }).limit(300),
        supabase.from("events").select("id,title,type,is_published").in("type", ["tournament", "training", "bo"]).order("created_at", { ascending: false }).limit(200),
        supabase.from("clan_wars").select("id,title,creator_team_id,opponent_team_id,status,scheduled_at").in("status", ["agreed", "completed", "cancelled"]).order("created_at", { ascending: false }).limit(200),
        supabase.from("betting_sources").select("id,event_id,clan_war_id,enabled,updated_at"),
        auth.roles.includes("superadmin")
          ? supabase.from("economy_settings").select("*").eq("singleton", true).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
    if (marketsError || eventsError || warsError || sourcesError) {
      throw marketsError ?? eventsError ?? warsError ?? sourcesError;
    }
    const eventIds = (events ?? []).map((event) => event.id);
    const { data: sessions, error: sessionsError } = eventIds.length
      ? await supabase.from("event_sessions").select("event_id,start_time").in("event_id", eventIds).order("start_time")
      : { data: [], error: null };
    if (sessionsError) throw sessionsError;
    const firstStartByEvent = new Map<string, string>();
    for (const session of sessions ?? []) {
      if (!firstStartByEvent.has(session.event_id)) firstStartByEvent.set(session.event_id, session.start_time);
    }
    return Response.json({
      markets: markets ?? [],
      sources: sources ?? [],
      events: (events ?? []).map((event) => ({ ...event, locks_at: firstStartByEvent.get(event.id) ?? null })),
      wars: wars ?? [],
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

    let eventId: string | null = null;
    let clanWarId: string | null = null;
    let locksAt: string | null = null;
    if (payload.sourceKind === "event") {
      const [{ data: event, error: eventError }, { data: session, error: sessionError }] = await Promise.all([
        supabase.from("events").select("id,type,is_published").eq("id", payload.sourceId).maybeSingle(),
        supabase.from("event_sessions").select("start_time").eq("event_id", payload.sourceId).order("start_time").limit(1).maybeSingle(),
      ]);
      if (eventError || sessionError) throw eventError ?? sessionError;
      if (!event || !["tournament", "training", "bo"].includes(event.type)) {
        return Response.json({ error: "Этот тип мероприятия не поддерживает ставки" }, { status: 400 });
      }
      if (!event.is_published) return Response.json({ error: "Сначала опубликуйте мероприятие" }, { status: 400 });
      eventId = event.id;
      locksAt = session?.start_time ?? null;
    } else {
      const { data: war, error: warError } = await supabase.from("clan_wars")
        .select("id,status,scheduled_at,opponent_team_id").eq("id", payload.sourceId).maybeSingle();
      if (warError) throw warError;
      if (!war || war.status !== "agreed" || !war.opponent_team_id) {
        return Response.json({ error: "Можно включить только согласованное КВ с соперником" }, { status: 400 });
      }
      clanWarId = war.id;
      locksAt = war.scheduled_at;
    }
    if (payload.enabled && (!locksAt || new Date(locksAt) <= new Date())) {
      return Response.json({ error: "Для ставок требуется будущее время начала" }, { status: 400 });
    }

    const existingQuery = supabase.from("betting_sources").select("id")
      .eq(payload.sourceKind === "event" ? "event_id" : "clan_war_id", payload.sourceId)
      .maybeSingle();
    const { data: existing, error: existingError } = await existingQuery;
    if (existingError) throw existingError;
    const sourceValues = {
      event_id: eventId,
      clan_war_id: clanWarId,
      enabled: payload.enabled,
      enabled_by: auth.user.id,
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = existing
      ? await supabase.from("betting_sources").update(sourceValues).eq("id", existing.id)
      : await supabase.from("betting_sources").insert(sourceValues);
    if (saveError) throw saveError;

    if (!payload.enabled) {
      let marketsQuery = supabase.from("betting_markets").update({ status: "locked", updated_at: new Date().toISOString() }).eq("status", "open");
      marketsQuery = payload.sourceKind === "event"
        ? marketsQuery.eq("event_id", payload.sourceId)
        : marketsQuery.eq("clan_war_id", payload.sourceId);
      const { error: lockError } = await marketsQuery;
      if (lockError) throw lockError;
    }
    return Response.json({ success: true, enabled: payload.enabled });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте параметры" }, { status: 400 });
    return authErrorResponse(error);
  }
}
