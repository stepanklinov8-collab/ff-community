import { createAdminClient } from "@/utils/supabase/admin";
import { ApiAuthError, authErrorResponse, requireUser, type AuthContext } from "@/utils/supabase/server-auth";
import {allRows} from "@/lib/competition/server";

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
      .select("id, show_registrations, organizer_user_id,is_published,moderation_status")
      .eq("id", eventId)
      .single();
    if (eventError) throw eventError;

    const isPrivileged = Boolean(
      auth && (
        auth.roles.includes("moderator") ||
        auth.roles.includes("admin") || auth.roles.includes("superadmin") ||
        event.organizer_user_id === auth.user.id
      ),
    );
    const {data: assignedSessions} = auth ? await supabase.from("event_sessions").select("id").eq("event_id",eventId).eq("responsible_user_id",auth.user.id) : {data: []};
    const assignedIds = new Set((assignedSessions ?? []).map(row => row.id));
    if ((!event.is_published || event.moderation_status !== "approved") && !isPrivileged && !assignedIds.size) return Response.json({error:"Мероприятие не найдено"},{status:404});
    const { data: memberships } = auth
      ? await supabase.from("team_members").select("team_id").eq("user_id", auth.user.id)
      : { data: [] };
    const ownTeamIds = new Set((memberships ?? []).map((row) => row.team_id));

    const rows = await allRows((a,b)=>supabase
      .from("event_registrations")
      .select("id, session_id, team_id, participant_user_id, status, is_winner, created_at, roster, roster_json, roster_snapshot, name_snapshot, team_name_override")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }).order("id").range(a,b));

    const visibleRows = event.show_registrations || isPrivileged
      ? rows ?? []
      : (rows ?? []).filter((row) =>
          assignedIds.has(row.session_id) || (row.team_id && ownTeamIds.has(row.team_id)) || row.participant_user_id === auth?.user.id,
        );

    const teamIds = [...new Set(visibleRows.map((row) => row.team_id).filter((id): id is string => Boolean(id)))];
    const participantIds = [...new Set(visibleRows
      .map((row) => row.participant_user_id)
      .filter((id): id is string => Boolean(id)))];
    const rosterIds = [...new Set(visibleRows.flatMap((row) => parseRoster(row.roster_json, row.roster)))];
    const teams: Array<{id:string;name:string;avatar_url:string|null;main_rating:number}> = [];
    for(let i=0;i<teamIds.length;i+=100){const {data,error}=await supabase.from("teams").select("id, name, avatar_url, main_rating").in("id",teamIds.slice(i,i+100));if(error)throw error;teams.push(...(data??[]));}
    const profileIds = [...new Set([...participantIds, ...rosterIds])];
    const participants: Array<{id:string;nickname:string;avatar_url:string|null;main_rating:number}> = [];
    for(let i=0;i<profileIds.length;i+=100){const {data,error}=await supabase.from("profiles").select("id, nickname, avatar_url, main_rating").in("id",profileIds.slice(i,i+100));if(error)throw error;participants.push(...(data??[]));}
    const teamById = new Map((teams ?? []).map((team) => [team.id, team]));
    const participantById = new Map((participants ?? []).map((profile) => [profile.id, profile]));

    const registrations = visibleRows.map((row) => {
      const maySeeRoster = isPrivileged || assignedIds.has(row.session_id) ||
        (row.team_id && ownTeamIds.has(row.team_id)) ||
        row.participant_user_id === auth?.user.id ||
        event.show_registrations;
      const participantName = row.participant_user_id
        ? participantById.get(row.participant_user_id)?.nickname || "Игрок"
        : null;
      const team = row.team_id ? teamById.get(row.team_id) : null;
      const roster = maySeeRoster ? parseRoster(row.roster_json, row.roster) : [];
      return {
        id: row.id,
        session_id: row.session_id,
        team_id: row.team_id,
        participant_user_id: row.participant_user_id,
        team_name: row.name_snapshot || row.team_name_override || participantName || team?.name || "Участник",
        team_avatar_url: team?.avatar_url || (row.participant_user_id ? participantById.get(row.participant_user_id)?.avatar_url : null) || null,
        team_rating: Number(team?.main_rating ?? (row.participant_user_id ? participantById.get(row.participant_user_id)?.main_rating : 1) ?? 1),
        registration_kind: row.participant_user_id ? "individual" : "team",
        status: row.status,
        is_winner: row.is_winner,
        created_at: row.created_at,
        roster,
        roster_players: roster.map((userId) => {
          const current = participantById.get(userId);
          const snapshot = (Array.isArray(row.roster_snapshot) ? row.roster_snapshot : []).find((entry:{id:string})=>entry.id===userId);
          return current ? {...current,nickname:snapshot?.nickname??current.nickname} : snapshot ? {id:userId,nickname:snapshot.nickname,avatar_url:null,main_rating:null} : null;
        }).filter(Boolean),
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
