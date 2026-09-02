import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { ApiAuthError, authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const paramsSchema = z.object({ id: z.string().uuid() });
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("visibility"), showRegistrations: z.boolean() }),
  z.object({ action: z.literal("responsible"), sessionId: z.string().uuid(), userId: z.string().uuid() }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const auth = await requireUser(request);
    const payload = actionSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("organizer_user_id")
      .eq("id", id)
      .single();
    if (eventError) throw eventError;
    if (!auth.roles.length && event.organizer_user_id !== auth.user.id) {
      throw new ApiAuthError("Управлять мероприятием может организатор или администратор", 403);
    }

    if (payload.action === "visibility") {
      const { error } = await supabase.from("events").update({ show_registrations: payload.showRegistrations }).eq("id", id);
      if (error) throw error;
    } else {
      const { data: profile } = await supabase.from("profiles").select("id").eq("id", payload.userId).maybeSingle();
      if (!profile) return Response.json({ error: "Пользователь не найден" }, { status: 404 });
      const { error } = await supabase
        .from("event_sessions")
        .update({ responsible_user_id: payload.userId })
        .eq("id", payload.sessionId)
        .eq("event_id", id);
      if (error) throw error;
    }
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте параметры действия" }, { status: 400 });
    return authErrorResponse(error);
  }
}
