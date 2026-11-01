import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {allRows,competitionErrorResponse} from "@/lib/competition/server";
export async function GET(_request:Request,route:{params:Promise<{id:string}>}){try{
 const id=z.string().uuid().parse((await route.params).id),db=createAdminClient();
 const {data:event,error}=await db.from("events").select("id,is_published,publish_at,moderation_status,cancelled_at").eq("id",id).maybeSingle();
 if(error)throw new Error(error.message);
 if(!event||event.cancelled_at||event.moderation_status!=="approved"||(!event.is_published&&(!event.publish_at||Date.parse(event.publish_at)>Date.now())))return Response.json({error:"Мероприятие не найдено"},{status:404});
 const funds=await allRows((a,b)=>db.from("event_prize_funds").select("session_id,plan,total,event_sessions!inner(event_id)").eq("event_sessions.event_id",id).eq("cancelled",false).order("session_id").range(a,b));
 return Response.json({funds:funds.map(f=>({sessionId:f.session_id,plan:f.plan,total:f.total}))},{headers:{"Cache-Control":"no-store"}});
}catch(error){return competitionErrorResponse(error);}}
