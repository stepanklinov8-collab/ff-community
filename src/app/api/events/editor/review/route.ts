import {z} from "zod";
import {requireAdmin} from "@/utils/supabase/server-auth";
import {createAdminClient} from "@/utils/supabase/admin";
import {competitionErrorResponse} from "@/lib/competition/server";
export async function POST(request:Request){try{
 const auth=await requireAdmin(request),input=z.object({id:z.string().uuid(),revision:z.number().int().nonnegative(),reason:z.string().trim().min(1).max(1000)}).parse(await request.json());
 const {data,error}=await createAdminClient().rpc("u2_reject_event",{p_actor:auth.user.id,p_event:input.id,p_revision:input.revision,p_reason:input.reason});if(error)throw new Error(error.message);return Response.json(data);
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:"Укажите причину отклонения"},{status:400});return competitionErrorResponse(error);}}
