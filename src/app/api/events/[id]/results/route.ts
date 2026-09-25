import { z } from "zod";
import {allRows,publicResults} from "@/lib/competition/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { authErrorResponse } from "@/utils/supabase/server-auth";

const paramsSchema = z.object({ id: z.string().uuid() });
interface LegacyResult {
  id: string;
  event_id: string;
  winner_team_id: string;
  score: string | null;
  mvp_user_id: string | null;
}

async function enrichResults(rows: Array<{
  id: string;
  event_id: string;
  team_id: string;
  score: number;
  is_winner: boolean;
  mvp_user_id: string | null;
}>) {
  const supabase = createAdminClient();
  const teamIds = [...new Set(rows.map((row) => row.team_id))];
  const playerIds = [...new Set(rows.map((row) => row.mvp_user_id).filter((id): id is string => Boolean(id)))];
  const [{ data: teams }, { data: profiles }] = await Promise.all([
    teamIds.length ? supabase.from("teams").select("id, name").in("id", teamIds) : Promise.resolve({ data: [] }),
    playerIds.length ? supabase.from("profiles").select("id, nickname").in("id", playerIds) : Promise.resolve({ data: [] }),
  ]);
  const teamNames = new Map((teams ?? []).map((team) => [team.id, team.name]));
  const playerNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));
  return rows.map((row) => ({
    ...row,
    team_name: teamNames.get(row.team_id) ?? "Команда",
    mvp_nickname: row.mvp_user_id ? playerNames.get(row.mvp_user_id) ?? "Игрок" : "",
  }));
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = paramsSchema.parse(await context.params);
    const supabase = createAdminClient();
    const {data:event,error:eventError}=await supabase.from("events").select("id,title,type,public_number,is_published,publish_at,moderation_status").eq("id",id).single();
    if(eventError||!event||event.moderation_status!=="approved"||(!event.is_published&&(!event.publish_at||Date.parse(event.publish_at)>Date.now())))return Response.json({error:"Мероприятие не найдено"},{status:404});
    const sessions=await allRows((a,b)=>supabase.from("event_sessions").select("id,start_time,public_number").eq("event_id",id).neq("status","cancelled").order("start_time").order("id").range(a,b));
    const publicSessions=[];
    for(const session of sessions){
      const [{data:pub,error:pubError},games,groups]=await Promise.all([
        supabase.from("competition_publications").select("published,first_published_at,corrected_at").eq("session_id",session.id).maybeSingle(),
        allRows((a,b)=>supabase.from("event_games").select("id,group_id,game_number,public_number,map_name").eq("session_id",session.id).neq("status","cancelled").order("game_number").order("id").range(a,b)),
        allRows((a,b)=>supabase.from("event_groups").select("id,public_number").eq("session_id",session.id).order("public_number").range(a,b)),
      ]);if(pubError)throw pubError;
      const prefix=`${event.public_number}-${String(session.public_number).padStart(2,"0")}`;
      publicSessions.push({id:session.id,startTime:session.start_time,publicId:prefix,publishedAt:pub?.first_published_at,correctedAt:pub?.corrected_at,results:pub?.first_published_at?publicResults(pub.published):null,
        games:games.map(g=>({id:g.id,groupId:g.group_id,number:g.game_number,map:g.map_name,publicId:`${prefix}-${String(groups.find(gr=>gr.id===g.group_id)?.public_number).padStart(2,"0")}-${String(g.public_number).padStart(2,"0")}`}))});
    }
    const publicData={event:{id:event.id,title:event.title,type:event.type},sessions:publicSessions};
    if(publicSessions.some(s=>s.results))return Response.json({...publicData,results:[]},{headers:{"Cache-Control":"no-store"}});
    const normalized = await supabase
      .from("event_team_results")
      .select("id, event_id, team_id, score, is_winner, mvp_user_id")
      .eq("event_id", id)
      .order("score", { ascending: false });

    if (!normalized.error) {
      return Response.json({ ...publicData, results: await enrichResults(normalized.data ?? []) });
    }

    const { data: legacy, error: legacyError } = await supabase
      .from("event_results")
      .select("id, event_id, winner_team_id, score, mvp_user_id")
      .eq("event_id", id);
    if (legacyError) throw legacyError;
    const rows = ((legacy ?? []) as LegacyResult[]).map((row) => ({
      id: row.id,
      event_id: row.event_id,
      team_id: row.winner_team_id,
      score: Number.parseInt(row.score ?? "0", 10) || 0,
      is_winner: true,
      mvp_user_id: row.mvp_user_id,
    }));
    return Response.json({ ...publicData, results: await enrichResults(rows), legacy: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Некорректный ID мероприятия" }, { status: 400 });
    return authErrorResponse(error);
  }
}

export async function PUT(){return Response.json({error:"Используйте редактор сессии: старый способ сохранения результатов закрыт."},{status:410});}
