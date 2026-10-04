import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin, requireSuperadmin } from "@/utils/supabase/server-auth";
import { allRows } from "@/lib/competition/server";

const toggleSchema = z.object({
  action: z.literal("toggle"),
  sourceKind: z.enum(["event", "war"]),
  sourceId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
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
        supabase.from("events").select("id,title,type,is_published,publish_at,moderation_status,frozen_at,cancelled_at").in("type", ["tournament", "training", "solo", "bo", "kv"]).order("created_at", { ascending: false }).limit(200),
        supabase.from("clan_wars").select("id,title,creator_team_id,opponent_team_id,status,scheduled_at").in("status", ["agreed", "completed", "cancelled"]).order("created_at", { ascending: false }).limit(200),
        supabase.from("betting_sources").select("id,event_id,clan_war_id,enabled,updated_at"),
        auth.roles.includes("superadmin")
          ? supabase.from("economy_settings").select("*").eq("singleton", true).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
    if (marketsError || eventsError || warsError || sourcesError) {
      throw marketsError ?? eventsError ?? warsError ?? sourcesError;
    }
    const marketIds = (markets ?? []).map((market) => market.id);
    const bets = marketIds.length ? await allRows((a,b) => supabase.from("site_bets")
      .select("id,market_id,stake,potential_payout,payout,status,settled_at")
      .in("market_id",marketIds).order("placed_at",{ascending:false}).order("id").range(a,b)) : [];
    const eventIds = (events ?? []).map((event) => event.id);
    const sessions = eventIds.length ? await allRows((a,b) => supabase.from("event_sessions")
      .select("id,event_id,public_number,start_time,status,betting_enabled")
      .in("event_id",eventIds).order("start_time").order("id").range(a,b)) : [];
    const publications = eventIds.length ? await allRows((a,b) => supabase.from("competition_publications")
      .select("session_id,event_sessions!inner(event_id)").in("event_sessions.event_id",eventIds)
      .not("first_published_at","is",null).order("session_id").range(a,b)) : [];
    const publishedSessions = new Set(publications.map(row=>row.session_id));
    return Response.json({
      markets: (markets ?? []).map((market)=>({
        ...market,
        bets:bets.filter((bet)=>bet.market_id===market.id),
      })),
      sources: sources ?? [],
      events: (events ?? []).map((event) => ({ ...event, sessions: sessions.filter(session=>session.event_id===event.id)
        .map(session=>({...session,results_published:publishedSessions.has(session.id)})) })),
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
      return Response.json({error:"Ставки рассчитываются при публикации результатов. Для возврата используйте отмену мероприятия или КВ."},{status:410});
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

    if (payload.sourceKind === "event") {
      if (!payload.sessionId) return Response.json({error:"Выберите конкретную сессию"},{status:400});
      const { error } = await supabase.rpc("u2_set_session_betting",{
        p_actor:auth.user.id,p_event:payload.sourceId,p_session:payload.sessionId,p_enabled:payload.enabled,
      });
      if (error) return Response.json({error:error.message},{status:400});
      return Response.json({success:true,enabled:payload.enabled});
    }

    const { data: war, error: warError } = await supabase.from("clan_wars")
      .select("id,status,scheduled_at,opponent_team_id").eq("id", payload.sourceId).maybeSingle();
    if (warError) throw warError;
    if (!war || war.status !== "agreed" || !war.opponent_team_id) {
      return Response.json({ error: "Можно включить только согласованное КВ с соперником" }, { status: 400 });
    }
    const locksAt = war.scheduled_at;
    if (payload.enabled && (!locksAt || new Date(locksAt) <= new Date())) {
      return Response.json({ error: "Для ставок требуется будущее время начала" }, { status: 400 });
    }

    const existingQuery = supabase.from("betting_sources").select("id")
      .eq("clan_war_id", payload.sourceId)
      .maybeSingle();
    const { data: existing, error: existingError } = await existingQuery;
    if (existingError) throw existingError;
    const sourceValues = {
      event_id: null,
      clan_war_id: war.id,
      enabled: payload.enabled,
      enabled_by: auth.user.id,
      updated_at: new Date().toISOString(),
    };
    const { error: saveError } = existing
      ? await supabase.from("betting_sources").update(sourceValues).eq("id", existing.id)
      : await supabase.from("betting_sources").insert(sourceValues);
    if (saveError) throw saveError;

    if (!payload.enabled) {
      const marketsQuery = supabase.from("betting_markets").update({ status: "locked", updated_at: new Date().toISOString() }).eq("status", "open").eq("clan_war_id",payload.sourceId);
      const { error: lockError } = await marketsQuery;
      if (lockError) throw lockError;
    }
    return Response.json({ success: true, enabled: payload.enabled });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте параметры" }, { status: 400 });
    return authErrorResponse(error);
  }
}
