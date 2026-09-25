import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {requireUser} from "@/utils/supabase/server-auth";
import {allRows,loadSession,competitionErrorResponse} from "@/lib/competition/server";
const change=z.object({action:z.enum(["add","edit","remove","distribute","qualify"]),id:z.string().uuid().optional(),targetId:z.string().uuid().optional(),targetType:z.enum(["player","team"]).optional(),
 roster:z.array(z.string().uuid()).default([]),groupId:z.string().uuid().nullable().default(null),status:z.enum(["confirmed","waiting","cancelled"]).optional(),reason:z.string().trim().max(1000).optional(),mode:z.enum(["random","balanced"]).optional(),
 selectedIds:z.array(z.string().uuid()).optional(),sourceRevision:z.number().int().nonnegative().optional(),confirmStarted:z.boolean().default(false)}).superRefine((v,ctx)=>{
 if(v.action==="add"&&(!v.targetId||!v.targetType)||["edit","remove"].includes(v.action)&&!v.id||v.action==="distribute"&&!v.mode||v.action==="qualify"&&(!v.selectedIds||v.sourceRevision===undefined))ctx.addIssue({code:"custom",message:"Заполните параметры изменения заявки"});
});
const schema=z.object({sessionId:z.string().uuid(),revision:z.number().int().nonnegative(),requestId:z.string().uuid(),change});
type Route={params:Promise<{id:string}>};
export async function GET(request:Request,route:Route){try{
 const auth=await requireUser(request),{id}=await route.params,db=createAdminClient(),url=new URL(request.url),sessionId=z.string().uuid().parse(url.searchParams.get("sessionId"));
 const loaded=await loadSession(db,sessionId,auth);if(loaded.event.id!==id)return Response.json({error:"Нет прав на эту сессию"},{status:403});
 const lookup=url.searchParams.get("lookup"),query=(url.searchParams.get("q")??"").trim().replace(/[,%()]/g,"").slice(0,80);
 if(lookup==="team"||lookup==="player"){
 const result=lookup==="team"?await db.from("teams").select("id,name,avatar_url,main_rating").ilike("name",`%${query}%`).is("dissolved_at",null).limit(30):await db.from("profiles").select("id,nickname,avatar_url,main_rating,game_id").ilike("nickname",`%${query}%`).limit(30);
 if(result.error)throw new Error(result.error.message);return Response.json({items:result.data});}
 const teamId=url.searchParams.get("teamId");if(teamId){z.string().uuid().parse(teamId);const members=await allRows((a,b)=>db.from("team_members").select("user_id").eq("team_id",teamId).order("user_id").range(a,b));
 const players=[];for(let i=0;i<members.length;i+=300){const {data,error}=await db.from("profiles").select("id,nickname,game_id,main_rating").in("id",members.slice(i,i+300).map(p=>p.user_id));if(error)throw new Error(error.message);players.push(...data??[]);}return Response.json({players});}
 const registrations=await allRows((a,b)=>db.from("event_registrations").select("id,team_id,participant_user_id,status,group_id,roster_json,roster_snapshot,name_snapshot,carried_points,qualification_source_id").eq("session_id",sessionId).order("created_at").range(a,b));
 const {data:qualification,error:qError}=await db.from("competition_qualifications").select("*").eq("session_id",sessionId).maybeSingle();if(qError)throw new Error(qError.message);
 let source=null;if(loaded.session.source_session_id){const {data,error}=await db.from("competition_publications").select("revision,published").eq("session_id",loaded.session.source_session_id).maybeSingle();if(error)throw new Error(error.message);source=data;}
 return Response.json({event:{id,title:loaded.event.title},session:loaded.session,groups:loaded.groups,registrations,source:source?{revision:source.revision,standings:source.published?.standings??[]}:null,qualification,
 revision:loaded.session.configuration_revision,role:loaded.role,mode:loaded.context.rules.mode,published:!!loaded.publication?.first_published_at,serverTime:new Date().toISOString()});
 }catch(error){return competitionErrorResponse(error);}}
export async function POST(request:Request,route:Route){try{
 const auth=await requireUser(request),{id}=await route.params,input=schema.parse(await request.json()),db=createAdminClient();
 const {data:session}=await db.from("event_sessions").select("event_id").eq("id",input.sessionId).single();if(session?.event_id!==id)return Response.json({error:"Нет прав на эту сессию"},{status:403});
 const {data,error}=await db.rpc("u2_registration_action",{p_actor:auth.user.id,p_session:input.sessionId,p_revision:input.revision,p_input:input.change,p_request:input.requestId});if(error)throw new Error(error.message);return Response.json(data);
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:error.issues[0]?.message??"Проверьте заявку"},{status:400});return competitionErrorResponse(error);}}
