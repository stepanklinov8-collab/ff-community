import { z } from "zod";
import { requireAdmin, authErrorResponse } from "@/utils/supabase/server-auth";
import { createAdminClient } from "@/utils/supabase/admin";
const day=z.iso.date();
export async function GET(request:Request){
  try{
    const auth=await requireAdmin(request),params=new URL(request.url).searchParams;
    const from=day.parse(params.get("from")),to=day.parse(params.get("to"));
    const start=new Date(`${from}T00:00:00+03:00`),end=new Date(Date.parse(`${to}T00:00:00+03:00`)+86400000);
    if(!Number.isFinite(+start)||!Number.isFinite(+end)||end<=start||+end-+start>90*86400000)throw new z.ZodError([{code:"custom",message:"Выберите период до 90 дней",path:[]}]);
    const offset=z.coerce.number().int().min(0).max(100000).parse(params.get("offset")??0);
    const user=params.get("userId");if(user)z.string().uuid().parse(user);
    const {data,error}=await createAdminClient().rpc("analytics_report",{p_actor:auth.user.id,p_from:start.toISOString(),p_to:end.toISOString(),p_search:(params.get("q")??"").slice(0,80),p_offset:offset,p_user:user});
    if(error)throw error;
    return Response.json(data,{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    const response=error instanceof z.ZodError?Response.json({error:"Проверьте даты и параметры отчёта"},{status:400}):authErrorResponse(error);
    response.headers.set("Cache-Control","private, no-store");return response;
  }
}
