import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {allRows,competitionErrorResponse} from "@/lib/competition/server";
import {warningState} from "@/lib/competition/moderation";
export async function GET(request:Request){try{
 const url=new URL(request.url),type=z.enum(["player","team"]).parse(url.searchParams.get("type")),id=z.string().uuid().parse(url.searchParams.get("id")),db=createAdminClient();
 const warnings=await allRows((a,b)=>db.from("warnings").select("id,reason,penalty,category,update2,event_id,created_at,activated_at,expires_at,cancelled_at,used_in_sanction").eq("target_type",type).eq("target_id",id).or("update2.eq.false,activated_at.not.is.null").order("created_at",{ascending:false}).order("id").range(a,b));
 return Response.json({warnings:warnings.map(w=>({id:w.id,reason:w.reason,penalty:w.update2?w.penalty:null,category:w.category,eventId:w.event_id,createdAt:w.activated_at??w.created_at,expiresAt:w.expires_at,legacy:!w.update2,status:warningState({...w,activated_at:w.update2?w.activated_at:w.created_at})}))},{headers:{"Cache-Control":"no-store"}});
 }catch(error){return competitionErrorResponse(error);}}
