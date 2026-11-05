import { createAdminClient } from "@/utils/supabase/admin";
import {drainFinanceNotifications} from "@/lib/finance/notifications";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { data, error } = await createAdminClient().rpc("contract_maintenance_run");
    if (error) throw error;
    // Retention failure must not undo or misreport completed contract maintenance.
    try {
      const cleanup = await createAdminClient().rpc("analytics_cleanup");
      if (cleanup.error) console.error("Activity retention cleanup failed", cleanup.error.message);
    } catch (cleanupError) {
      console.error("Activity retention cleanup failed", cleanupError);
    }
    try { await drainFinanceNotifications(); }
    catch { console.error("Finance notification queue will retry"); }
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Contract maintenance failed", error);
    return Response.json({ error: "Не удалось обработать сроки договоров" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
