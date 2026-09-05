import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireAdmin } from "@/utils/supabase/server-auth";

const sessionSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime().nullable(),
  registrationOpenTime: z.string().datetime().nullable(),
  registrationCloseTime: z.string().datetime().nullable(),
  maxTeams: z.number().int().min(0).max(1000),
  reminderMinutes: z.array(z.number().int().min(1).max(10080)).max(10),
});

const eventSchema = z.object({
  title: z.string().trim().min(2).max(160),
  type: z.enum(["training", "bo", "tournament", "kv", "solo"]),
  cost: z.number().int().min(0).max(10_000_000),
  organizer: z.string().trim().max(160),
  organizerUserId: z.string().uuid().nullable(),
  description: z.string().trim().max(10000),
  streamUrl: z.string().url().or(z.literal("")),
  paymentUrl: z.string().url().or(z.literal("")),
  maxTeams: z.number().int().min(0).max(1000),
  minPlayers: z.number().int().min(1).max(60),
  rosterLockMinutes: z.number().int().min(0).max(10080),
  publishAt: z.string().datetime().nullable(),
  commentsEnabled: z.boolean(),
  allowIndividualRegistration: z.boolean(),
  sessions: z.array(sessionSchema).min(1).max(100),
});

const updateSchema = eventSchema.omit({ sessions: true }).partial().extend({
  id: z.string().uuid(),
  isPublished: z.boolean().optional(),
});

const registrationSchema = z.object({
  action: z.literal("registration"),
  registrationId: z.string().uuid(),
  status: z.enum(["confirmed", "waiting", "cancelled"]).optional(),
  teamNameOverride: z.string().trim().max(100).optional(),
});

function validateSessionTimes(sessions: z.infer<typeof sessionSchema>[]) {
  for (const session of sessions) {
    const start = new Date(session.startTime);
    if (session.endTime && new Date(session.endTime) <= start) throw new Error("Конец сессии должен быть позже начала");
    if (session.registrationCloseTime && new Date(session.registrationCloseTime) >= start) {
      throw new Error("Регистрация должна закрываться до начала сессии");
    }
    if (
      session.registrationOpenTime &&
      session.registrationCloseTime &&
      new Date(session.registrationOpenTime) >= new Date(session.registrationCloseTime)
    ) {
      throw new Error("Открытие регистрации должно быть раньше закрытия");
    }
  }
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const supabase = createAdminClient();
    const { error: publishError } = await supabase
      .from("events")
      .update({ is_published: true })
      .eq("is_published", false)
      .not("publish_at", "is", null)
      .lte("publish_at", new Date().toISOString());
    if (publishError) throw publishError;
    const { data, error } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return Response.json({ events: data ?? [] });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    const { user } = await requireAdmin(request);
    const formData = await request.formData();
    const payload = eventSchema.parse(JSON.parse(String(formData.get("payload") ?? "{}")));
    validateSessionTimes(payload.sessions);
    const image = formData.get("image");
    if (image && (!(image instanceof File) || image.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(image.type))) {
      return Response.json({ error: "Обложка: JPEG/PNG/WebP, не более 5 МБ" }, { status: 400 });
    }

    const supabase = createAdminClient();
    let imageUrl = "";
    if (image instanceof File && image.size > 0) {
      const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
      uploadedPath = `${user.id}/${randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("event-images")
        .upload(uploadedPath, await image.arrayBuffer(), { contentType: image.type, upsert: false });
      if (uploadError) throw uploadError;
      imageUrl = supabase.storage.from("event-images").getPublicUrl(uploadedPath).data.publicUrl;
    }

    const publishAt = payload.publishAt ? new Date(payload.publishAt) : null;
    const { data: event, error: eventError } = await supabase.from("events").insert({
      title: payload.title,
      type: payload.type,
      cost: payload.cost,
      organizer: payload.organizer,
      organizer_user_id: payload.organizerUserId ?? user.id,
      description: payload.description,
      stream_url: payload.streamUrl || null,
      payment_url: payload.paymentUrl || null,
      image_url: imageUrl || null,
      max_teams: payload.maxTeams,
      min_players: payload.minPlayers,
      roster_lock_minutes: payload.rosterLockMinutes,
      publish_at: publishAt?.toISOString() ?? null,
      is_published: !publishAt || publishAt <= new Date(),
      comments_enabled: payload.commentsEnabled,
      allow_individual_registration: payload.type === "solo" || payload.allowIndividualRegistration,
      created_by: user.id,
    }).select("id").single();
    if (eventError || !event) throw eventError ?? new Error("Не удалось создать мероприятие");

    const { error: sessionsError } = await supabase.from("event_sessions").insert(payload.sessions.map((session) => ({
      event_id: event.id,
      start_time: session.startTime,
      end_time: session.endTime,
      registration_open_time: session.registrationOpenTime,
      registration_close_time: session.registrationCloseTime,
      max_teams: session.maxTeams || payload.maxTeams,
      reminder_minutes: session.reminderMinutes,
    })));
    if (sessionsError) {
      await supabase.from("events").delete().eq("id", event.id);
      throw sessionsError;
    }
    return Response.json({ success: true, eventId: event.id }, { status: 201 });
  } catch (error) {
    if (uploadedPath) {
      await createAdminClient().storage.from("event-images").remove([uploadedPath]);
    }
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте поля мероприятия" }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ error: "Некорректные данные" }, { status: 400 });
    if (error instanceof Error && ["Регистрация", "Конец", "Открытие"].some((prefix) => error.message.startsWith(prefix))) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
    const raw: unknown = await request.json();
    const registrationResult = registrationSchema.safeParse(raw);
    const supabase = createAdminClient();
    if (registrationResult.success) {
      const updates: { status?: string; team_name_override?: string } = {};
      if (registrationResult.data.status) updates.status = registrationResult.data.status;
      if (registrationResult.data.teamNameOverride !== undefined) updates.team_name_override = registrationResult.data.teamNameOverride;
      const { error } = await supabase.from("event_registrations").update(updates).eq("id", registrationResult.data.registrationId);
      if (error) throw error;
      return Response.json({ success: true });
    }

    const payload = updateSchema.parse(raw);
    const updates: Record<string, unknown> = {};
    if (payload.title !== undefined) updates.title = payload.title;
    if (payload.type !== undefined) updates.type = payload.type;
    if (payload.cost !== undefined) updates.cost = payload.cost;
    if (payload.organizer !== undefined) updates.organizer = payload.organizer;
    if (payload.organizerUserId !== undefined) updates.organizer_user_id = payload.organizerUserId;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.streamUrl !== undefined) updates.stream_url = payload.streamUrl || null;
    if (payload.paymentUrl !== undefined) updates.payment_url = payload.paymentUrl || null;
    if (payload.maxTeams !== undefined) updates.max_teams = payload.maxTeams;
    if (payload.minPlayers !== undefined) updates.min_players = payload.minPlayers;
    if (payload.rosterLockMinutes !== undefined) updates.roster_lock_minutes = payload.rosterLockMinutes;
    if (payload.publishAt !== undefined) updates.publish_at = payload.publishAt;
    if (payload.commentsEnabled !== undefined) updates.comments_enabled = payload.commentsEnabled;
    if (payload.allowIndividualRegistration !== undefined) {
      updates.allow_individual_registration = payload.type === "solo" || payload.allowIndividualRegistration;
    } else if (payload.type === "solo") {
      updates.allow_individual_registration = true;
    }
    if (payload.isPublished !== undefined) updates.is_published = payload.isPublished;
    const { error } = await supabase.from("events").update(updates).eq("id", payload.id);
    if (error) throw error;
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Проверьте изменения" }, { status: 400 });
    return authErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId");
    const registrationId = url.searchParams.get("registrationId");
    const supabase = createAdminClient();
    if (registrationId) {
      const { error } = await supabase.from("event_registrations").delete().eq("id", z.string().uuid().parse(registrationId));
      if (error) throw error;
    } else if (eventId) {
      const { error } = await supabase.from("events").delete().eq("id", z.string().uuid().parse(eventId));
      if (error) throw error;
    } else {
      return Response.json({ error: "Не указан объект удаления" }, { status: 400 });
    }
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Некорректный ID" }, { status: 400 });
    return authErrorResponse(error);
  }
}
