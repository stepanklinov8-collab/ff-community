import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {requireUser,ApiAuthError} from "@/utils/supabase/server-auth";
import {allRows,loadSession,competitionErrorResponse} from "@/lib/competition/server";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const db=createAdminClient(),{id}=await params,sessionId=z.string().uuid().parse(new URL(request.url).searchParams.get("sessionId"));
 const auth=request.headers.has("authorization")?await requireUser(request):null,actor=auth?.user.id;
 const loaded=await loadSession(db,sessionId),admin=auth?.roles.some(r=>r==="admin"||r==="superadmin")??false,organizer=loaded.event.organizer_user_id===actor,responsible=loaded.session.responsible_user_id===actor;
 if(loaded.event.id!==id||(!admin&&!organizer&&!responsible&&(loaded.event.moderation_status!=="approved"||(!loaded.event.is_published&&(!loaded.event.publish_at||Date.parse(loaded.event.publish_at)>Date.now())))))throw new ApiAuthError("Мероприятие недоступно",403);
 const canManage=admin||(organizer||responsible)&&!loaded.event.frozen_at&&!loaded.event.cancelled_at&&loaded.event.moderation_status==="approved";
 const allowedGroups=new Set<string>();
 if(actor)for(const entrant of loaded.context.entrants){let allowed=entrant.userId===actor||entrant.roster.some(p=>p.id===actor);if(!allowed&&entrant.teamId){const {data,error}=await db.rpc("can_manage_team",{check_team_id:entrant.teamId,check_user_id:actor});if(error)throw error;allowed=!!data;}if(allowed)allowedGroups.add(entrant.groupId);}
 const groups=await allRows((a,b)=>db.from("event_groups").select("id,public_number,name,capacity,room_id,room_password,room_note").eq("session_id",sessionId).order("display_order").range(a,b));
 const {data:deadline,error}=await db.rpc("u2_comment_deadline",{p_event:id,p_session:sessionId});if(error)throw error;
 return Response.json({sessionId,description:loaded.session.description,canManage:!!canManage,canCloseComments:!!canManage&&(admin||organizer),commentsClosed:loaded.session.comments_closed,commentsOpen:!!deadline&&Date.parse(deadline)>Date.now(),deadline,
  groups:groups.map(g=>({id:g.id,number:g.public_number,name:g.name,capacity:g.capacity,publicId:`${loaded.publicId}-${String(g.public_number).padStart(2,"0")}`,canViewRoom:!!canManage||allowedGroups.has(g.id),...(canManage||allowedGroups.has(g.id)?{code:g.room_id??"",password:g.room_password??"",note:g.room_note}: {})}))},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return competitionErrorResponse(error);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const auth=await requireUser(request),db=createAdminClient(),{id}=await params;
 const input=z.object({sessionId:z.string().uuid(),action:z.enum(["room","description","comments"]),groupId:z.string().uuid().optional(),code:z.string().max(100).optional(),password:z.string().max(100).optional(),note:z.string().max(2000).optional(),description:z.string().max(10000).optional(),closed:z.boolean().optional()}).parse(await request.json());
 const {event}=await loadSession(db,input.sessionId,auth);if(event.id!==id)throw new ApiAuthError("Чужая сессия",403);
 const {error}=await db.rpc("u2_session_action",{p_actor:auth.user.id,p_session:input.sessionId,p_action:input.action,p_input:input});if(error)throw new Error(error.message);return Response.json({success:true});
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:"Проверьте данные"},{status:400});return competitionErrorResponse(error);}}
