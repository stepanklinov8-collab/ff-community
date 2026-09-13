import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireSuperadmin } from "@/utils/supabase/server-auth";

export async function GET(request: Request) {
  try {
    await requireSuperadmin(request);
    if (new URL(request.url).searchParams.get("probe") === "1") {
      return Response.json({ allowed: true });
    }
    const supabase = createAdminClient();
    const [registrations, actions, conflicts] = await Promise.all([
      supabase.from("registration_attempt_logs").select("id,outcome,error_code,email_domain,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("admin_action_logs").select("id,actor_user_id,target_user_id,action,details,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("profile_identity_conflicts").select("conflict_kind,conflict_value,user_ids,detected_at,resolved_at").is("resolved_at", null).order("detected_at", { ascending: false }).limit(100),
    ]);
    if (registrations.error) throw registrations.error;
    if (actions.error) throw actions.error;
    if (conflicts.error) throw conflicts.error;
    return Response.json({ registrations: registrations.data, actions: actions.data, conflicts: conflicts.data });
  } catch (error) {
    return authErrorResponse(error);
  }
}
