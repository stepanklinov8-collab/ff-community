import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const placeSchema = z.object({
  marketId: z.string().uuid(),
  stake: z.number().int().positive(),
});

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const supabase = createAdminClient();
    const now = new Date().toISOString();
    await supabase.from("betting_markets").update({ status: "locked" })
      .eq("status", "open").lte("locks_at", now);

    const [{ data: wallet, error: walletError }, { data: markets, error: marketsError }, { data: bets, error: betsError }] =
      await Promise.all([
        supabase.from("site_wallets").select("balance").eq("user_id", user.id).maybeSingle(),
        supabase.from("betting_markets")
          .select("id,event_id,game_id,clan_war_id,subject_team_id,subject_team_name,mode,market_type,selection_value,line,odds,locks_at,status")
          .in("status", ["open", "locked"]).order("locks_at", { ascending: true }),
        supabase.from("site_bets")
          .select("id,market_id,stake,odds,potential_payout,status,payout,placed_at")
          .eq("user_id", user.id).order("placed_at", { ascending: false }).limit(100),
      ]);
    if (walletError || marketsError || betsError) throw walletError ?? marketsError ?? betsError;
    return Response.json({ balance: wallet?.balance ?? 0, markets: markets ?? [], bets: bets ?? [] });
  } catch (error) {
    return authErrorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const payload = placeSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("place_site_bet_for", {
      p_user_id: user.id,
      p_market_id: payload.marketId,
      p_stake: payload.stake,
    });
    if (error) {
      const message = error.message.includes("own organization")
        ? "Нельзя ставить на собственную команду или гильдию"
        : error.message.includes("Insufficient")
          ? "Недостаточно монет"
          : error.message.includes("limits")
            ? "Сумма вне разрешённых лимитов"
            : error.message.includes("closed")
              ? "Приём ставок уже закрыт"
              : "Не удалось принять ставку";
      return Response.json({ error: message }, { status: 400 });
    }
    return Response.json({ success: true, betId: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте сумму ставки" }, { status: 400 });
    return authErrorResponse(error);
  }
}
