import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const profileSchema = z.object({
  nickname: z.string().trim().min(2).max(32),
  gameId: z.string().trim().min(3).max(32),
  bio: z.string().trim().max(500),
  phone: z.string().trim().max(32),
  locale: z.enum(["ru", "kk", "ky"]),
});

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nickname, avatar_url, game_id, bio, phone, locale, updated_at")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;
    return Response.json({
      profile: {
        id: user.id,
        nickname: data?.nickname || user.user_metadata?.nickname || "",
        avatarUrl: data?.avatar_url || "",
        gameId: data?.game_id || user.user_metadata?.game_id || "",
        bio: data?.bio || "",
        phone: data?.phone || "",
        locale: data?.locale || "ru",
      },
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { user } = await requireUser(request);
    const payload = profileSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: duplicate } = await supabase
      .from("profiles")
      .select("id")
      .eq("game_id", payload.gameId)
      .neq("id", user.id)
      .maybeSingle();
    if (duplicate) return Response.json({ error: "Этот игровой ID уже используется" }, { status: 409 });

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      nickname: payload.nickname,
      game_id: payload.gameId,
      bio: payload.bio || null,
      phone: payload.phone || null,
      locale: payload.locale,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    const { error: metadataError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        nickname: payload.nickname,
        game_id: payload.gameId,
        locale: payload.locale,
      },
    });
    if (metadataError) throw metadataError;
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте ник, игровой ID и контакты" }, { status: 400 });
    return authErrorResponse(error);
  }
}
