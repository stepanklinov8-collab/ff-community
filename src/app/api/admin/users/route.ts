import { z } from "zod";
import { storagePathFromPublicUrl } from "@/lib/uploads/avatar";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin, requireSuperadmin } from "@/utils/supabase/server-auth";

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  nickname: z.string().trim().min(2).max(32),
  gameId: z.string().trim().min(2).max(32),
});

const deleteUserSchema = z.object({
  userId: z.string().uuid(),
  confirmation: z.literal("УДАЛИТЬ"),
});

class UserDeletionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) throw error;
    return Response.json({
      users: data.users.filter((user) => !user.deleted_at),
      canDeleteUsers: auth.roles.includes("superadmin"),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSuperadmin(request);
    const payload = deleteUserSchema.parse(await request.json());
    if (payload.userId === auth.user.id) {
      throw new UserDeletionError("Нельзя удалить собственный аккаунт", 409);
    }

    const supabase = createAdminClient();
    const [{ data: target, error: targetError }, { data: roles, error: rolesError }, { data: ledTeam, error: teamError }] = await Promise.all([
      supabase.auth.admin.getUserById(payload.userId),
      supabase.from("user_roles").select("role").eq("user_id", payload.userId),
      supabase.from("teams").select("id, name, type").eq("leader_id", payload.userId).limit(1).maybeSingle(),
    ]);
    if (targetError || !target.user) throw new UserDeletionError("Пользователь не найден", 404);
    if (rolesError) throw rolesError;
    if (teamError) throw teamError;
    if ((roles ?? []).some((row) => row.role === "superadmin")) {
      throw new UserDeletionError("Сначала снимите с пользователя роль суперадминистратора", 409);
    }
    if (ledTeam) {
      const organization = ledTeam.type === "guild" ? "гильдии" : "команды";
      throw new UserDeletionError(`Сначала передайте руководство ${organization} «${ledTeam.name}»`, 409);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", payload.userId)
      .maybeSingle();
    if (profileError) throw profileError;

    // Soft deletion disables sign-in while retaining the Auth row needed by
    // immutable moderation and statistics audit logs.
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(payload.userId, true);
    if (deleteAuthError) throw deleteAuthError;

    const cleanupRequests = [
      supabase.from("team_members").delete().eq("user_id", payload.userId),
      supabase.from("team_invitations").delete().or(`user_id.eq.${payload.userId},invited_by.eq.${payload.userId}`),
      supabase.from("team_join_requests").delete().eq("user_id", payload.userId),
      supabase.from("player_stats").delete().eq("user_id", payload.userId),
      supabase.from("bloggers").delete().eq("user_id", payload.userId),
      supabase.from("comments").delete().eq("author_id", payload.userId),
      supabase.from("comment_reports").delete().eq("reported_by", payload.userId),
      supabase.from("messages").delete().or(`to_user_id.eq.${payload.userId},from_user_id.eq.${payload.userId}`),
      supabase.from("notifications").delete().eq("user_id", payload.userId),
      supabase.from("push_subscriptions").delete().eq("user_id", payload.userId),
      supabase.from("notification_preferences").delete().eq("user_id", payload.userId),
      supabase.from("warnings").delete().eq("target_type", "player").eq("target_id", payload.userId),
      supabase.from("bans").delete().eq("target_type", "player").eq("target_id", payload.userId),
      supabase.from("user_roles").delete().eq("user_id", payload.userId),
      supabase.from("profiles").delete().eq("id", payload.userId),
    ];
    const cleanupResults = await Promise.all(cleanupRequests);
    const cleanupError = cleanupResults.find((result) => result.error)?.error;
    if (cleanupError) throw cleanupError;

    const avatarPath = storagePathFromPublicUrl(profile?.avatar_url, "avatars");
    if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Для удаления введите УДАЛИТЬ" }, { status: 400 });
    }
    if (error instanceof UserDeletionError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const payload = updateUserSchema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
      payload.userId,
    );
    if (authError || !authUser.user) throw authError ?? new Error("Пользователь не найден");

    const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
      payload.userId,
      {
        user_metadata: {
          ...authUser.user.user_metadata,
          nickname: payload.nickname,
          game_id: payload.gameId,
        },
      },
    );
    if (updateAuthError) throw updateAuthError;

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: payload.userId,
      nickname: payload.nickname,
      game_id: payload.gameId,
    });
    if (profileError) throw profileError;

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Проверьте никнейм и игровой ID" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
