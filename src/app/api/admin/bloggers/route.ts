import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin } from "@/utils/supabase/server-auth";

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
});

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = createAdminClient();
    const { data: bloggers, error } = await supabase.from("bloggers").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    const userIds = [...new Set((bloggers ?? []).map((blogger) => blogger.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, nickname").in("id", userIds)
      : { data: [] };
    const nicknameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));
    return Response.json({ bloggers: (bloggers ?? []).map((blogger) => ({ ...blogger, nickname: nicknameById.get(blogger.user_id) ?? "—" })) });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const payload = statusSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: blogger, error } = await supabase.from("bloggers").update({ status: payload.status }).eq("id", payload.id).select("user_id").single();
    if (error) throw error;
    await supabase.from("notifications").insert({
      user_id: blogger.user_id,
      type: "blogger_status",
      title: payload.status === "approved" ? "Статус блогера подтверждён" : "Заявка блогера отклонена",
      body: payload.status === "approved" ? "Профиль появился на витрине блогеров" : "Свяжитесь с администрацией для уточнения причины",
      link: "/bloggers",
    });
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Некорректная заявка" }, { status: 400 });
    return authErrorResponse(error);
  }
}
