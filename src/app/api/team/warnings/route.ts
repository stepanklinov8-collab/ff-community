import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

export async function GET(request: Request) {
  try {
  const auth = await requireUser(request);
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId");
  if (!teamId) {
    return Response.json({ error: "teamId обязателен" }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const isAdmin = auth.roles.includes("moderator") || auth.roles.includes("superadmin");
  if (!isAdmin) {
    const { data: membership } = await supabaseAdmin
      .from("team_members")
      .select("role_in_team")
      .eq("team_id", teamId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!membership) {
      return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    }
  }

  // Активные предупреждения
  const { data: activeWarnings, error: warnError } = await supabaseAdmin
    .from("warnings")
    .select("id, level, reason, created_at, expires_at")
    .eq("target_type", "team")
    .eq("target_id", teamId)
    .or(`expires_at.is.null,expires_at.gt.NOW()`);

  if (warnError) throw warnError;

  // Активный бан
  const { data: activeBan } = await supabaseAdmin
    .from("bans")
    .select("id, reason, created_at")
    .eq("target_type", "team")
    .eq("target_id", teamId)
    .eq("is_active", true)
    .maybeSingle();

  return Response.json({
    activeWarnings: activeWarnings || [],
    warningCount: (activeWarnings || []).length,
    activeBan: activeBan || null,
  });
  } catch (error) {
    return authErrorResponse(error);
  }
}
