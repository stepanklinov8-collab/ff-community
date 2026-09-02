import { createAdminClient } from "@/utils/supabase/admin";
import { ApiAuthError, authErrorResponse, requireUser, type AuthContext } from "@/utils/supabase/server-auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function optionalAuth(request: Request): Promise<AuthContext | null> {
  if (!request.headers.get("authorization")) return null;
  return requireUser(request);
}

function parseRoster(rosterJson: unknown, legacyRoster: unknown) {
  if (Array.isArray(rosterJson)) return rosterJson.filter((value): value is string => typeof value === "string");
  if (Array.isArray(legacyRoster)) return legacyRoster.filter((value): value is string => typeof value === "string");
  if (!legacyRoster) return [];
  try {
    const parsed: unknown = JSON.parse(String(legacyRoster));
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: eventId } = await context.params;
    const auth = await optionalAuth(request);
    const supabase = createAdminClient();
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, show_registrations, organizer_user_id")
      .eq("id", eventId)
      .single();
    if (eventError) throw eventError;

    const isPrivileged = Boolean(
      auth && (
        auth.roles.includes("moderator") ||
        auth.roles.includes("superadmin") ||
        event.organizer_user_id === auth.user.id
      ),
    );
    const { data: memberships } = auth
      ? await supabase.from("team_members").select("team_id").eq("user_id", auth.user.id)
      : { data: [] };
    const ownTeamIds = new Set((memberships ?? []).map((row) => row.team_id));

    const normalizedRows = await supabase
      .from("event_registrations")
      .select("id, session_id, team_id, status, is_winner, created_at, roster, roster_json, team_name_override")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    const legacyRows = normalizedRows.error
      ? await supabase
          .from("event_registrations")
          .select("id, team_id, status, is_winner, created_at, roster, team_name_override")
          .eq("event_id", eventId)
          .order("created_at", { ascending: true })
      : null;
    if (legacyRows?.error) throw legacyRows.error;
    const rows = normalizedRows.data ?? (legacyRows?.data ?? []).map((row) => ({ ...row, session_id: null, roster_json: null }));

    const visibleRows = event.show_registrations || isPrivileged
      ? rows ?? []
      : (rows ?? []).filter((row) => ownTeamIds.has(row.team_id));

    const teamIds = [...new Set(visibleRows.map((row) => row.team_id))];
    const { data: teams } = teamIds.length
      ? await supabase.from("teams").select("id, name").in("id", teamIds)
      : { data: [] };
    const teamById = new Map((teams ?? []).map((team) => [team.id, team.name]));

    const registrations = visibleRows.map((row) => {
      const maySeeRoster = isPrivileged || ownTeamIds.has(row.team_id) || event.show_registrations;
      return {
        id: row.id,
        session_id: row.session_id,
        team_id: row.team_id,
        team_name: row.team_name_override || teamById.get(row.team_id) || "Команда",
        status: row.status,
        is_winner: row.is_winner,
        created_at: row.created_at,
        roster: maySeeRoster ? parseRoster(row.roster_json, row.roster) : [],
      };
    });

    return Response.json({
      registrations,
      visibility: event.show_registrations ? "public" : isPrivileged ? "privileged" : "own",
    });
  } catch (error) {
    if (error instanceof ApiAuthError) return authErrorResponse(error);
    return authErrorResponse(error);
  }
}
