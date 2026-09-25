import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {requireUser,ApiAuthError,assertCanManageUserTarget} from "@/utils/supabase/server-auth";
import {allRows,competitionErrorResponse} from "@/lib/competition/server";
import {moderationAction,organizerAction,warningState} from "@/lib/competition/moderation";
export async function GET(request:Request){try{
 const auth=await requireUser(request),db=createAdminClient(),actor=auth.user.id,isAdmin=auth.roles.some(r=>r==="admin"||r==="superadmin"),url=new URL(request.url);
 const memberships=await allRows((a,b)=>db.from("team_members").select("team_id").eq("user_id",actor).order("team_id").range(a,b));
 const teamIds=[] as string[];
 for(const teamId of [...new Set(memberships.map(m=>m.team_id as string))]){const {data,error}=await db.rpc("can_manage_team",{check_team_id:teamId,check_user_id:actor});if(error)throw error;if(data)teamIds.push(teamId);}
 const owned=await allRows((a,b)=>db.from("events").select("id,title").eq("organizer_user_id",actor).order("id").range(a,b));
 const responsible=await allRows((a,b)=>db.from("event_sessions").select("id").eq("responsible_user_id",actor).order("id").range(a,b));
 const targets=[actor,...teamIds],scope=`created_by.eq.${actor},target_id.in.(${targets.join(",")}),organizer_id.eq.${actor}${responsible.length?`,session_id.in.(${responsible.map(s=>s.id).join(",")})`:""}`;
 const [warnings,sanctions,blacklist,appeals,applications,adminRoles]=await Promise.all([
  allRows((a,b)=>{let q=db.from("warnings").select("id,target_type,target_id,reason,penalty,category,source,organizer_id,event_id,session_id,created_by,created_at,activated_at,expires_at,cancelled_at,cancellation_reason,used_in_sanction,final_by_owner").eq("update2",true).not("activated_at","is",null).order("created_at",{ascending:false}).order("id");if(!isAdmin)q=q.or(scope);return q.range(a,b);}),
  allRows((a,b)=>{let q=db.from("competition_sanctions").select("*").order("starts_at",{ascending:false}).order("id");if(!isAdmin)q=q.or(`target_id.in.(${targets.join(",")}),organizer_id.eq.${actor}`);return q.range(a,b);}),
  allRows((a,b)=>{let q=db.from("organizer_blacklist").select("*").order("created_at",{ascending:false}).order("id");if(!isAdmin)q=q.eq("organizer_id",actor);return q.range(a,b);}),
  allRows((a,b)=>{let q=db.from("competition_appeals").select("*").order("created_at",{ascending:false}).order("id");if(!isAdmin)q=q.or(`applicant_id.eq.${actor},recipient_id.eq.${actor}`);return q.range(a,b);}),
  allRows((a,b)=>{let q=db.from("organizer_applications").select("*").order("created_at",{ascending:false}).order("user_id");if(!isAdmin)q=q.eq("user_id",actor);return q.range(a,b);}),
  allRows((a,b)=>db.from("user_roles").select("user_id,role").in("role",["admin","superadmin"]).order("user_id").range(a,b)),
 ]);
 let source=null;
 if(url.searchParams.has("sourceId")){
  const sourceId=z.string().uuid().parse(url.searchParams.get("sourceId")),type=z.enum(["warning","sanction","blacklist"]).parse(url.searchParams.get("sourceType"));
  const table=type==="warning"?"warnings":type==="sanction"?"competition_sanctions":"organizer_blacklist";
  const {data,error}=await db.from(table).select("id,target_type,target_id,organizer_id,reason").eq("id",sourceId).single();if(error)throw error;
  if(!isAdmin&&!targets.includes(data.target_id))throw new ApiAuthError("Нет доступа к этому решению",403);source={...data,type};
 }
 const userIds=[...new Set([actor,...adminRoles.map(r=>r.user_id),...warnings.flatMap(w=>[w.organizer_id,w.created_by,w.target_type==="player"?w.target_id:null]),...appeals.flatMap(a=>[a.applicant_id,a.recipient_id]),...applications.map(a=>a.user_id),source?.organizer_id].filter((s):s is string=>Boolean(s)))];
 const profiles=[];for(let i=0;i<userIds.length;i+=200){const {data,error}=await db.from("profiles").select("id,nickname").in("id",userIds.slice(i,i+200));if(error)throw error;profiles.push(...data??[]);}
 const warningView=warnings.map(w=>({...w,...(!isAdmin&&w.organizer_id!==actor&&w.created_by!==actor?{cancellation_reason:undefined,cancelled_at:undefined}:{}),status:warningState(w),canCancel:!w.cancelled_at&&(isAdmin||w.organizer_id===actor||w.created_by===actor),canAppeal:targets.includes(w.target_id)}));
 return Response.json({generatedAt:Date.now(),actor,isAdmin,isModerator:auth.roles.includes("moderator"),isOwner:auth.roles.includes("superadmin"),warnings:warningView,sanctions,blacklist,appeals,applications,source,profiles,events:owned,teamIds,adminIds:[...new Set(adminRoles.map(r=>r.user_id))],recipientIds:[...new Set([...adminRoles.map(r=>r.user_id),...warnings.map(w=>w.organizer_id),...sanctions.map(s=>s.organizer_id),source?.organizer_id].filter(Boolean))]},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return competitionErrorResponse(error);}}
export async function POST(request:Request){try{
 const auth=await requireUser(request),db=createAdminClient(),raw=await request.json();
 const organizer=raw.domain==="organizer",input=organizer?organizerAction.parse(raw):moderationAction.parse(raw);
 if(input.action==="issue_warning"&&input.warning.targetType==="player")await assertCanManageUserTarget(auth,input.warning.targetId);
 if(input.action==="sanction"&&input.targetType==="player")await assertCanManageUserTarget(auth,input.targetId);
 const {data,error}=await db.rpc(organizer?"u2_organizer_action":"u2_moderation_action",{p_actor:auth.user.id,p_input:input});if(error)throw new Error(error.message);
 // The committed outbox is delivered by maintenance, independently of this response.
 return Response.json(data??{success:true});
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:error.issues[0]?.message??"Проверьте форму"},{status:400});return competitionErrorResponse(error);}}
