import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const proposalSchema = z.object({
  title: z.string().trim().min(2).max(160),
  type: z.enum(["training", "bo", "tournament", "solo"]),
  cost: z.number().int().min(0).max(10_000_000),
  organizer: z.string().trim().min(2).max(160),
  description: z.string().trim().max(10_000),
  sessions: z.array(z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime().nullable(),
    registrationOpenTime: z.string().datetime().nullable(),
  })).min(1).max(30),
});

export async function POST(request: Request) {
  let eventId: string | null = null;
  try {
    const { user } = await requireUser(request);
    const payload = proposalSchema.parse(await request.json());
    for (const session of payload.sessions) {
      if (session.endTime && new Date(session.endTime) <= new Date(session.startTime)) {
        return Response.json({ error: "Конец сессии должен быть позже начала" }, { status: 400 });
      }
    }

    const supabase = createAdminClient();
    const { data: event, error: eventError } = await supabase.from("events").insert({
      title: payload.title,
      type: payload.type,
      cost: payload.cost,
      organizer: payload.organizer,
      description: payload.description,
      is_published: false,
      publish_at: null,
      created_by: user.id,
      organizer_user_id: user.id,
    }).select("id").single();
    if (eventError || !event) throw eventError ?? new Error("Не удалось создать предложение");
    eventId = event.id;

    const { error: sessionsError } = await supabase.from("event_sessions").insert(payload.sessions.map((session) => ({
      event_id: event.id,
      start_time: session.startTime,
      end_time: session.endTime,
      registration_open_time: session.registrationOpenTime,
    })));
    if (sessionsError) throw sessionsError;

    const { data: admins } = await supabase.from("user_roles").select("user_id").in("role", ["moderator", "superadmin"]);
    if (admins?.length) {
      await supabase.from("notifications").insert(admins.map((admin) => ({
        user_id: admin.user_id,
        type: "event_proposal",
        title: "Новое предложение мероприятия",
        body: `«${payload.title}» ожидает модерации`,
        link: "/admin/events/proposals",
      })));
    }
    return Response.json({ success: true, eventId: event.id }, { status: 201 });
  } catch (error) {
    if (eventId) await createAdminClient().from("events").delete().eq("id", eventId);
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте поля предложения" }, { status: 400 });
    return authErrorResponse(error);
  }
}
