import { getManagedOrganizations } from "@/lib/clan-wars";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const supabase = createAdminClient();
    const [{ data: organizations, error }, managedOrganizations] = await Promise.all([
      supabase.from("teams").select("id, name, type, avatar_url").order("name"),
      getManagedOrganizations(supabase, user.id),
    ]);
    if (error) throw error;

    return Response.json({
      organizations: organizations ?? [],
      managedOrganizations,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
