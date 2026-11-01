import { createAdminClient } from "@/utils/supabase/admin";
import { ApiAuthError, authErrorResponse, requireUser, type AuthContext } from "@/utils/supabase/server-auth";
import {allRows} from "@/lib/competition/server";
import {z} from "zod";

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
    z.string().uuid().parse(eventId);
    const sessionId=new URL(request.url).searchParams.get("sessionId");
    if(sessionId)z.string().uuid().parse(sessionId);
    const auth = await optionalAuth(request);
    const supabase = createAdminClient();
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, show_registrations, organizer_user_id,is_published,publish_at,moderation_status,max_teams")
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
    if (((!event.is_published&&(!event.publish_at||Date.parse(event.publish_at)>Date.now())) || event.moderation_status !== "approved") && !isPrivileged && !assignedIds.size) return Response.json({error:"Мероприятие не найдено"},{status:404});
    const [{data:memberships,error:membershipError},{data:owned,error:ownedError}]=auth?await Promise.all([
      supabase.from("team_members").select("team_id").eq("user_id",auth.user.id),
      supabase.from("teams").select("id").eq("ultimate_owner_user_id",auth.user.id).is("dissolved_at",null),
    ]):[{data:[],error:null},{data:[],error:null}];
    if(membershipError||ownedError)throw membershipError??ownedError;
    const ownTeamIds = new Set([...(memberships??[]).map(row=>row.team_id),...(owned??[]).map(row=>row.id)]);

    const [rows,countsResponse] = await Promise.all([allRows((a,b)=>{
      let query=supabase
      .from("event_registrations")
      .select("id, session_id, team_id, participant_user_id, status, is_winner, created_at, roster, roster_json, roster_snapshot, name_snapshot, team_name_override")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }).order("id");
      if(sessionId)query=query.eq("session_id",sessionId);
      return query.range(a,b);
    }),supabase.rpc("u5_event_registration_counts",{p_event:eventId})]);
    if(countsResponse.error)throw countsResponse.error;
    const registrationCounts=(countsResponse.data??[]).map((row:{session_id:string;registered:number;waiting:number;capacity:number|null})=>({...row,registered:Number(row.registered),waiting:Number(row.waiting)}));
    if(sessionId&&!registrationCounts.some((row:{session_id:string})=>row.session_id===sessionId))return Response.json({error:"Сессия не найдена в этом мероприятии"},{status:404});
    const waitingCounts = new Map<string, number>();
    const queuePositions = new Map<string, number>();
    for (const row of rows ?? []) {
      if (row.session_id && row.status === "waiting") {
        const position=(waitingCounts.get(row.session_id)??0)+1;
        waitingCounts.set(row.session_id,position);queuePositions.set(row.id,position);
      }
    }

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
        queue_position: queuePositions.get(row.id) ?? null,
        is_own: Boolean((row.team_id && ownTeamIds.has(row.team_id)) || row.participant_user_id === auth?.user.id),
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
      registrationCounts,
      visibility: event.show_registrations ? "public" : isPrivileged ? "privileged" : "own",
    },{headers:{"Cache-Control":"private, no-store"}});
  } catch (error) {
    if(error instanceof z.ZodError)return Response.json({error:"Проверьте мероприятие и сессию"},{status:400});
    if (error instanceof ApiAuthError) return authErrorResponse(error);
    return authErrorResponse(error);
  }
}
