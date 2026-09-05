import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const reviewSchema = z.object({
  eventId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  sentiment: z.union([z.literal(-1), z.literal(1)]),
  reason: z.string().trim().max(500).optional(),
}).refine((value) => value.sentiment === 1 || (value.reason?.length ?? 0) >= 3, {
  message: "Для отрицательного отзыва укажите причину",
});

function rosterIds(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.flatMap((item) => {
    if (typeof item === "string") return [item];
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const id = row.user_id ?? row.userId ?? row.id;
      return typeof id === "string" ? [id] : [];
    }
    return [];
  });
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const supabase = createAdminClient();
    const targetUserId = new URL(request.url).searchParams.get("targetUserId");
    const { data, error } = await supabase.from("reputation_reviews")
      .select("id,event_id,target_user_id,sentiment,reason,status,created_at")
      .eq("reviewer_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    if (!targetUserId || !z.string().uuid().safeParse(targetUserId).success || targetUserId === user.id) {
      return Response.json({ reviews: data ?? [], eligibleEvents: [] });
    }
    const { data: registrations, error: registrationsError } = await supabase
      .from("event_registrations")
      .select("event_id,team_id,participant_user_id,roster_json,status")
      .neq("status", "cancelled");
    if (registrationsError) throw registrationsError;
    const participated = (registration: { team_id: string | null; participant_user_id: string | null; roster_json: unknown }, participantId: string) =>
      registration.participant_user_id === participantId || rosterIds(registration.roster_json).includes(participantId);
    const ownEvents = new Set((registrations ?? []).filter((row) => participated(row, user.id)).map((row) => row.event_id));
    const sharedEventIds = [...new Set((registrations ?? []).filter((row) => ownEvents.has(row.event_id) && participated(row, targetUserId)).map((row) => row.event_id))];
    if (!sharedEventIds.length) return Response.json({ reviews: data ?? [], eligibleEvents: [] });
    const [{ data: events }, { data: sessions }] = await Promise.all([
      supabase.from("events").select("id,title,type").in("id", sharedEventIds),
      supabase.from("event_sessions").select("event_id,start_time").in("event_id", sharedEventIds).lt("start_time", new Date().toISOString()),
    ]);
    const completedIds = new Set((sessions ?? []).map((session) => session.event_id));
    const reviewedIds = new Set((data ?? []).filter((review) => review.target_user_id === targetUserId).map((review) => review.event_id));
    return Response.json({
      reviews: data ?? [],
      eligibleEvents: (events ?? []).filter((event) => completedIds.has(event.id) && !reviewedIds.has(event.id)),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const payload = reviewSchema.parse(await request.json());
    if (payload.targetUserId === user.id) return Response.json({ error: "Нельзя оценивать себя" }, { status: 400 });
    const supabase = createAdminClient();
    const [{ data: session }, { data: registrations, error: registrationsError }] = await Promise.all([
      supabase.from("event_sessions").select("start_time").eq("event_id", payload.eventId)
        .order("start_time", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("event_registrations").select("participant_user_id,team_id,roster_json,status")
        .eq("event_id", payload.eventId).neq("status", "cancelled"),
    ]);
    if (registrationsError) throw registrationsError;
    if (!session || new Date(session.start_time) > new Date()) {
      return Response.json({ error: "Отзыв доступен только после мероприятия" }, { status: 400 });
    }

    const participantIds = new Set<string>();
    for (const registration of registrations ?? []) {
      if (registration.participant_user_id) participantIds.add(registration.participant_user_id);
      rosterIds(registration.roster_json).forEach((id) => participantIds.add(id));
    }
    if (!participantIds.has(user.id) || !participantIds.has(payload.targetUserId)) {
      return Response.json({ error: "Оба пользователя должны быть участниками мероприятия" }, { status: 403 });
    }
    const { error } = await supabase.from("reputation_reviews").insert({
      event_id: payload.eventId,
      reviewer_id: user.id,
      target_user_id: payload.targetUserId,
      sentiment: payload.sentiment,
      reason: payload.reason || null,
      status: "pending",
    });
    if (error?.code === "23505") return Response.json({ error: "Вы уже оставляли отзыв этому игроку за мероприятие" }, { status: 409 });
    if (error) throw error;
    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || "Проверьте отзыв" }, { status: 400 });
    return authErrorResponse(error);
  }
}
