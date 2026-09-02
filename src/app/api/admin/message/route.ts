import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin } from "@/utils/supabase/server-auth";

const messageSchema = z.object({
  toUserId: z.string().uuid(),
  subject: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(5000),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const payload = messageSchema.parse(await request.json());
    const supabase = createAdminClient();

    const { error } = await supabase.from("messages").insert({
      to_user_id: payload.toUserId,
      from_user_id: auth.user.id,
      subject: payload.subject,
      body: payload.body,
    });
    if (error) throw error;

    await supabase.from("notifications").insert({
      user_id: payload.toUserId,
      type: "message",
      title: "Новое сообщение",
      body: `У вас новое сообщение: ${payload.subject}`,
      link: "/messages",
    });

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Заполните тему и текст сообщения" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
