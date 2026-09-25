import {createAdminClient} from "@/utils/supabase/admin";
import {authErrorResponse,requireAdmin} from "@/utils/supabase/server-auth";
import {allRows} from "@/lib/competition/server";
export async function GET(request:Request){try{await requireAdmin(request);const db=createAdminClient();const events=await allRows((a,b)=>db.from("events").select("*").order("created_at",{ascending:false}).range(a,b));return Response.json({events});}catch(error){return authErrorResponse(error);}}
async function legacyWrite(request:Request){try{await requireAdmin(request);return Response.json({error:"Используйте полную форму мероприятия или управление заявками",editorUrl:"/tournaments/manage"},{status:410});}catch(error){return authErrorResponse(error);}}
export const POST=legacyWrite;
export const PATCH=legacyWrite;
export const DELETE=legacyWrite;