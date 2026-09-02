import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin } from "@/utils/supabase/server-auth";

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  nickname: z.string().trim().min(2).max(32),
  gameId: z.string().trim().min(2).max(32),
});

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = createAdminClient();
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) throw error;
    return Response.json({ users: data.users });
  } catch (error) {
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
