import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  authErrorResponse,
  requireAdmin,
  requireSuperadmin,
} from "@/utils/supabase/server-auth";

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["blogger", "moderator", "superadmin"]),
  action: z.enum(["add", "remove"]),
});

export async function POST(request: Request) {
  try {
    const payload = roleSchema.parse(await request.json());
    if (payload.role === "superadmin" || payload.role === "moderator") {
      await requireSuperadmin(request);
    } else {
      await requireAdmin(request);
    }

    const supabase = createAdminClient();
    let result;
    if (payload.role === "blogger") {
      result = payload.action === "add"
        ? await supabase.from("bloggers").upsert({ user_id: payload.userId })
        : await supabase.from("bloggers").delete().eq("user_id", payload.userId);
    } else {
      result = payload.action === "add"
        ? await supabase.from("user_roles").upsert({
            user_id: payload.userId,
            role: payload.role,
          })
        : await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", payload.userId)
            .eq("role", payload.role);
    }

    if (result.error) throw result.error;
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Некорректные данные роли" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
