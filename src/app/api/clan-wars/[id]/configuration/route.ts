import {z} from "zod";
import {requireUser,ApiAuthError} from "@/utils/supabase/server-auth";
import {createAdminClient} from "@/utils/supabase/admin";
import {competitionErrorResponse} from "@/lib/competition/server";
import {clanWarConfigurationSchema} from "@/lib/competition/clan-war-schema";
import {getManagedOrganizations} from "@/lib/clan-wars";
type Context={params:Promise<{id:string}>};
export async function GET(request:Request,{params}:Context){try{
 const auth=await requireUser(request),id=z.string().uuid().parse((await params).id),db=createAdminClient();
 const {data:w,error}=await db.from("clan_wars").select("*").eq("id",id).single();if(error||!w)return Response.json({error:"КВ не найдено"},{status:404});
 const admin=auth.roles.some(r=>r==="admin"||r==="superadmin"),managed=await getManagedOrganizations(db,auth.user.id);
 if(!admin&&!managed.some(t=>t.id===w.creator_team_id))throw new ApiAuthError("Нет прав редактировать КВ",403);
 const [{count:rosters},{count:responses}]=await Promise.all([db.from("clan_war_rosters").select("id",{count:"exact",head:true}).eq("clan_war_id",id),db.from("clan_war_responses").select("id",{count:"exact",head:true}).eq("clan_war_id",id).in("status",["pending","accepted"])]);
 const {data:teams,error:teamError}=await db.from("teams").select("id,name,type,avatar_url").in("id",[w.creator_team_id,w.opponent_team_id].filter(Boolean));if(teamError)throw teamError;
 return Response.json({revision:w.configuration_revision,sidesLocked:!["open","pending"].includes(w.status)||!!rosters||!!responses,structureLocked:!!w.result_first_published_at||!admin&&!!w.scheduled_at&&Date.parse(w.scheduled_at)<=Date.now(),cancelled:w.status==="cancelled",teams,
  config:{creatorTeamId:w.creator_team_id,opponentTeamId:w.opponent_team_id,title:w.title,description:w.description??"",rules:w.rules??"",format:w.format,challengeKind:w.challenge_kind,scheduledAt:w.scheduled_at,gameCount:w.game_count,winsRequired:w.wins_required,maps:w.maps,roomCode:w.room_code??"",roomPassword:w.room_password??"",roomNote:w.room_note??"",commentsClosed:w.comments_closed}}, {headers:{"Cache-Control":"no-store"}});
 }catch(error){return competitionErrorResponse(error);}}
export async function PATCH(request:Request,{params}:Context){try{
 const auth=await requireUser(request),id=z.string().uuid().parse((await params).id),input=z.object({revision:z.number().int().nonnegative(),config:clanWarConfigurationSchema}).parse(await request.json());
 const {data,error}=await createAdminClient().rpc("u2_war_configuration",{p_actor:auth.user.id,p_war:id,p_revision:input.revision,p_config:input.config});if(error)throw new Error(error.message);return Response.json(data);
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:error.issues[0]?.message},{status:422});return competitionErrorResponse(error);}}
