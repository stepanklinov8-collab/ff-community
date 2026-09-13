import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const updateRoomSchema = z.object({
  sessionId: z.string().uuid(),
  roomCode: z.string(),
  roomPassword: z.string(),
  roomNote: z.string(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

function parseRoster(rosterJson: unknown, legacyRoster: unknown) {
  const value = Array.isArray(rosterJson) ? rosterJson : Array.isArray(legacyRoster) ? legacyRoster : null;
  if (value) return value.filter((item): item is string => typeof item === "string");
  if (!legacyRoster) return [];
  try {
    const parsed: unknown = JSON.parse(String(legacyRoster));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function getPermissions(request: Request, eventId: string) {
  const auth = await requireUser(request);
  const supabase = createAdminClient();
  const isAdmin = auth.roles.includes("moderator") || auth.roles.includes("admin") || auth.roles.includes("superadmin");
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("organizer_user_id")
    .eq("id", eventId)
    .single();
  if (eventError) throw eventError;

  const isOrganizer = event.organizer_user_id === auth.user.id;
  const { data: registrations, error: registrationsError } = await supabase
    .from("event_registrations")
    .select("session_id, participant_user_id, roster, roster_json")
    .eq("event_id", eventId)
    .eq("status", "confirmed")
    .not("session_id", "is", null);
  if (registrationsError) throw registrationsError;
  const confirmedSessionIds = new Set(
    (registrations ?? [])
      .filter((row) => row.participant_user_id === auth.user.id || parseRoster(row.roster_json, row.roster).includes(auth.user.id))
      .map((row) => row.session_id)
      .filter(Boolean) as string[],
  );

  return { auth, supabase, isAdmin, isOrganizer, confirmedSessionIds };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: eventId } = await context.params;
    const permissions = await getPermissions(request, eventId);
    const { data: sessions, error } = await permissions.supabase
      .from("event_sessions")
      .select("id, room_code, room_password, room_note, responsible_user_id")
      .eq("event_id", eventId);
    if (error) throw error;

    const allowed = (sessions ?? []).flatMap((session) => {
      const canEdit = permissions.isAdmin || permissions.isOrganizer ||
        session.responsible_user_id === permissions.auth.user.id;
      const canView = canEdit || permissions.confirmedSessionIds.has(session.id);
      if (!canView) return [];
      return [{
        id: session.id,
        room_code: session.room_code,
        room_password: session.room_password,
        room_note: session.room_note,
        can_edit_room: canEdit,
      }];
    });

    return Response.json({ sessions: allowed });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id: eventId } = await context.params;
    const payload = updateRoomSchema.parse(await request.json());
    const permissions = await getPermissions(request, eventId);
    const { data: session, error: sessionError } = await permissions.supabase
      .from("event_sessions")
      .select("id, responsible_user_id")
      .eq("id", payload.sessionId)
      .eq("event_id", eventId)
      .single();
    if (sessionError) throw sessionError;

    const canEdit = permissions.isAdmin || permissions.isOrganizer ||
      session.responsible_user_id === permissions.auth.user.id;
    if (!canEdit) return Response.json({ error: "Недостаточно прав" }, { status: 403 });

    const { error } = await permissions.supabase
      .from("event_sessions")
      .update({
        room_code: payload.roomCode,
        room_password: payload.roomPassword,
        room_note: payload.roomNote,
      })
      .eq("id", payload.sessionId)
      .eq("event_id", eventId);
    if (error) throw error;

    const { data: registrations } = await permissions.supabase
      .from("event_registrations")
      .select("participant_user_id, roster, roster_json")
      .eq("session_id", payload.sessionId)
      .eq("status", "confirmed");
    const recipientIds = new Set((registrations ?? [])
      .map((row) => row.participant_user_id)
      .filter((id): id is string => Boolean(id)));
    for (const registration of registrations ?? []) {
      for (const userId of parseRoster(registration.roster_json, registration.roster)) recipientIds.add(userId);
    }
    let notificationWarning: string | null = null;
    if (recipientIds.size) {
      const { error: notificationError } = await permissions.supabase.from("notifications").insert([...recipientIds].map((userId) => ({
        user_id: userId,
        type: "room_updated",
        title: "Данные комнаты готовы",
        body: "Код и пароль доступны на странице мероприятия",
        link: `/tournaments/${eventId}`,
      })));
      if (notificationError) {
        console.error("Room notification error", notificationError);
        notificationWarning = "Данные сохранены, но часть уведомлений не отправлена";
      }
    }

    return Response.json({
      success: true,
      warning: notificationWarning,
      room: {
        id: payload.sessionId,
        room_code: payload.roomCode,
        room_password: payload.roomPassword,
        room_note: payload.roomNote,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Проверьте данные комнаты" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
