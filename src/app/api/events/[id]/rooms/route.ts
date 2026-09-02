import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse, requireUser } from "@/utils/supabase/server-auth";

const updateRoomSchema = z.object({
  sessionId: z.string().uuid(),
  roomCode: z.string().trim().max(100),
  roomPassword: z.string().trim().max(100),
  roomNote: z.string().trim().max(500),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getPermissions(request: Request, eventId: string) {
  const auth = await requireUser(request);
  const supabase = createAdminClient();
  const isAdmin = auth.roles.includes("moderator") || auth.roles.includes("superadmin");
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("organizer_user_id")
    .eq("id", eventId)
    .single();
  if (eventError) throw eventError;

  const isOrganizer = event.organizer_user_id === auth.user.id;
  const { data: memberships } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", auth.user.id);
  const teamIds = (memberships ?? []).map((row) => row.team_id);

  let confirmedSessionIds = new Set<string>();
  if (teamIds.length) {
    const { data: registrations } = await supabase
      .from("event_registrations")
      .select("session_id")
      .eq("event_id", eventId)
      .eq("status", "confirmed")
      .in("team_id", teamIds)
      .not("session_id", "is", null);
    confirmedSessionIds = new Set(
      (registrations ?? []).map((row) => row.session_id).filter(Boolean) as string[],
    );
  }

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
      .select("team_id")
      .eq("session_id", payload.sessionId)
      .eq("status", "confirmed");
    const teamIds = [...new Set((registrations ?? []).map((row) => row.team_id))];
    if (teamIds.length) {
      const { data: members } = await permissions.supabase
        .from("team_members")
        .select("user_id")
        .in("team_id", teamIds);
      const userIds = [...new Set((members ?? []).map((row) => row.user_id))];
      if (userIds.length) {
        await permissions.supabase.from("notifications").insert(userIds.map((userId) => ({
          user_id: userId,
          type: "room_updated",
          title: "Данные комнаты готовы",
          body: "Код и пароль доступны на странице мероприятия",
          link: `/tournaments/${eventId}`,
        })));
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Проверьте данные комнаты" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
