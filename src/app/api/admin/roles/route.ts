import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  assertCanManageUserTarget,
  authErrorResponse,
  requireAdmin,
  requireSuperadmin,
} from "@/utils/supabase/server-auth";

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["blogger", "moderator", "admin"]),
  action: z.enum(["add", "remove"]),
});

export async function POST(request: Request) {
  try {
    const payload = roleSchema.parse(await request.json());
    const actor = payload.role === "admin"
      ? await requireSuperadmin(request)
      : await requireAdmin(request);
    await assertCanManageUserTarget(actor, payload.userId);

    const supabase = createAdminClient();
    if (payload.role === "blogger") {
      const result = payload.action === "add"
        ? await supabase.from("profile_badges").upsert({
            user_id: payload.userId,
            badge: "blogger",
            granted_by: actor.user.id,
          }, { onConflict: "user_id,badge" })
        : await supabase
            .from("profile_badges")
            .delete()
            .eq("user_id", payload.userId)
            .eq("badge", "blogger");
      if (result.error) throw result.error;
    } else {
      const result = payload.action === "add"
        ? await supabase.from("user_roles").upsert({
            user_id: payload.userId,
            role: payload.role,
          }, { onConflict: "user_id" })
        : await supabase
            .from("user_roles")
            .delete()
            .eq("user_id", payload.userId)
            .eq("role", payload.role);
      if (result.error) throw result.error;
      const { error: auditError } = await supabase.from("role_change_logs").insert({
        target_user_id: payload.userId,
        changed_by: actor.user.id,
        role: payload.role,
        action: payload.action,
      });
      if (auditError) throw auditError;
    }

    const [{ error: actionLogError }, { error: notificationError }] = await Promise.all([
      supabase.from("admin_action_logs").insert({
        actor_user_id: actor.user.id,
        target_user_id: payload.userId,
        action: `${payload.action}_${payload.role}`,
        details: { role: payload.role, action: payload.action },
      }),
      supabase.from("notifications").insert({
        user_id: payload.userId,
        type: "role_changed",
        title: payload.action === "add" ? "Права профиля обновлены" : "Права профиля изменены",
        body: payload.role === "blogger"
          ? `Плашка «Блогер» ${payload.action === "add" ? "добавлена" : "отозвана"}`
          : `Роль ${payload.role === "admin" ? "администратора" : "модератора"} ${payload.action === "add" ? "назначена" : "снята"}`,
        link: "/profile",
      }),
    ]);
    if (actionLogError) console.error("Admin action audit error", actionLogError);
    if (notificationError) console.error("Role notification error", notificationError);

    const [{ data: roles, error: rolesError }, { data: badges, error: badgesError }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", payload.userId),
      supabase.from("profile_badges").select("badge").eq("user_id", payload.userId),
    ]);
    if (rolesError) throw rolesError;
    if (badgesError) throw badgesError;

    return Response.json({
      success: true,
      roles: (roles ?? []).map((row) => row.role),
      badges: (badges ?? []).map((row) => row.badge),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Некорректные данные роли" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
