import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { assertCanManageUserTarget, authErrorResponse, requireModerator } from "@/utils/supabase/server-auth";

const warningSchema = z.object({
  targetType: z.enum(["player", "team"]),
  targetId: z.string().uuid(),
  level: z.number().int().min(1).max(2).optional(),
  reason: z.string().trim().min(2).max(1000),
  expiresAt: z.string().datetime().nullable().optional(),
  isBan: z.boolean().default(false),
  eventId: z.string().uuid().nullable().optional(),
});

const unbanSchema = z.object({
  targetType: z.enum(["player", "team"]),
  targetId: z.string().uuid(),
});

async function notifyTarget(
  supabase: ReturnType<typeof createAdminClient>,
  targetType: "player" | "team",
  targetId: string,
  title: string,
  body: string,
) {
  const userIds = targetType === "player"
    ? [targetId]
    : (await supabase.from("team_members").select("user_id").eq("team_id", targetId)).data?.map((row) => row.user_id) ?? [];
  if (!userIds.length) return;
  await supabase.from("notifications").insert([...new Set(userIds)].map((userId) => ({
    user_id: userId,
    type: "moderation",
    title,
    body,
    link: targetType === "player" ? `/profile/${targetId}` : `/teams/${targetId}`,
  })));
}

export async function POST(request: Request) {
  try {
    const auth = await requireModerator(request);
    const payload = warningSchema.parse(await request.json());
    if (payload.targetType === "player") await assertCanManageUserTarget(auth, payload.targetId);
    const supabase = createAdminClient();

    if (payload.isBan) {
      const { error } = await supabase.from("bans").insert({
        target_type: payload.targetType,
        target_id: payload.targetId,
        reason: payload.reason,
        is_active: true,
        created_by: auth.user.id,
      });
      if (error) throw error;
      await notifyTarget(supabase, payload.targetType, payload.targetId, "Выдана блокировка", payload.reason);
      return Response.json({ success: true });
    }

    return Response.json({error:"Для предупреждения укажите категорию, срок и снижение репутации в новом разделе модерации.",url:"/admin/competition-moderation"},{status:410});
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Некорректные данные предупреждения" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireModerator(request);
    const payload = unbanSchema.parse(await request.json());
    if (payload.targetType === "player") await assertCanManageUserTarget(auth, payload.targetId);
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("bans")
      .update({ is_active: false })
      .eq("target_type", payload.targetType)
      .eq("target_id", payload.targetId)
      .eq("is_active", true);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Некорректные данные блокировки" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
