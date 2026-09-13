import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    return Response.json({
      canOpenAdmin: auth.roles.some((role) => ["moderator", "admin", "superadmin"].includes(role)),
      canManage: auth.roles.some((role) => role === "admin" || role === "superadmin"),
      isSuperadmin: auth.roles.includes("superadmin"),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
