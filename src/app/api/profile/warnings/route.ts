import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

export async function GET(request: Request) {
  try {
  const auth = await requireUser(request);
  const { searchParams } = new URL(request.url);
  const requestedUserId = searchParams.get("userId");
  const isAdmin = auth.roles.includes("moderator") || auth.roles.includes("superadmin");
  const targetUserId = requestedUserId && isAdmin ? requestedUserId : auth.user.id;
  const supabaseAdmin = createAdminClient();

  // Получаем активные преды (не истекшие)
  const { data: activeWarnings, error: warnError } = await supabaseAdmin
    .from("warnings")
    .select("id, level, reason, created_at, expires_at")
    .eq("target_type", "player")
    .eq("target_id", targetUserId)
    .or(`expires_at.is.null,expires_at.gt.NOW()`);

  if (warnError) {
    throw warnError;
  }

  // Получаем историю предов (все)
  const { data: history, error: historyError } = await supabaseAdmin
    .from("warnings")
    .select("id, level, reason, created_at, expires_at")
    .eq("target_type", "player")
    .eq("target_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (historyError) {
    throw historyError;
  }

  // Проверяем, есть ли активный бан
  const { data: activeBan } = await supabaseAdmin
    .from("bans")
    .select("id, reason, created_at")
    .eq("target_type", "player")
    .eq("target_id", targetUserId)
    .eq("is_active", true)
    .maybeSingle();

  return Response.json({
    activeWarnings: activeWarnings || [],
    warningCount: (activeWarnings || []).length,
    history: history || [],
    activeBan: activeBan || null,
  });
  } catch (error) {
    return authErrorResponse(error);
  }
}
