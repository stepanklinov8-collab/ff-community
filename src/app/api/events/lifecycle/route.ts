import {z} from "zod";
import {requireUser, ApiAuthError} from "@/utils/supabase/server-auth";
import {createAdminClient} from "@/utils/supabase/admin";
import {competitionErrorResponse} from "@/lib/competition/server";
export async function GET(request:Request) {try {
  const auth=await requireUser(request),db=createAdminClient(),url=new URL(request.url),id=z.string().uuid().parse(url.searchParams.get("id"));
  const {data:event,error}=await db.from("events").select("organizer_user_id,frozen_at,cancelled_at,configuration_revision").eq("id",id).single();if(error)throw error;
  const isAdmin=auth.roles.some(role=>role==="admin"||role==="superadmin");
  if(!isAdmin&&event.organizer_user_id!==auth.user.id)throw new ApiAuthError("Недостаточно прав",403);
  const query=(url.searchParams.get("q")??"").slice(0,100);
  const {data:players,error:searchError}=query.length>=2?await db.from("profiles").select("id,nickname,game_id").ilike("nickname",`%${query.replace(/[%_]/g,"")}%`).order("nickname").limit(20):{data:[],error:null};if(searchError)throw searchError;
  return Response.json({event,isAdmin,players},{headers:{"Cache-Control":"no-store"}});
}catch(error){return competitionErrorResponse(error);}}
export async function POST(request:Request) {try {
  const auth=await requireUser(request),input=z.object({id:z.string().uuid(),revision:z.number().int().nonnegative(),action:z.enum(["transfer","cancel"]),target:z.string().uuid().nullable(),reason:z.string().trim().min(3).max(1000)}).parse(await request.json());
  const {data,error}=await createAdminClient().rpc("u2_event_lifecycle",{p_actor:auth.user.id,p_event:input.id,p_revision:input.revision,p_action:input.action,p_target:input.target,p_reason:input.reason});if(error)throw new Error(error.message);return Response.json(data);
}catch(error){if(error instanceof z.ZodError)return Response.json({error:"Укажите организатора и причину действия"},{status:400});return competitionErrorResponse(error);}}
