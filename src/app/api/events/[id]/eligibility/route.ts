import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {requireUser,ApiAuthError} from "@/utils/supabase/server-auth";
import {competitionErrorResponse} from "@/lib/competition/server";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{
 const auth=await requireUser(request),db=createAdminClient(),eventId=z.string().uuid().parse((await context.params).id),url=new URL(request.url);
 const teamId=url.searchParams.get("teamId"),target=teamId?z.string().uuid().parse(teamId):auth.user.id,type=teamId?"team":"player";
 if(teamId){const {data,error}=await db.rpc("can_manage_team",{check_team_id:target,check_user_id:auth.user.id});if(error)throw error;if(!data)throw new ApiAuthError("Нет доступа к заявке команды",403);}
 const {data:event,error:eError}=await db.from("events").select("organizer_user_id,is_published,moderation_status").eq("id",eventId).single();if(eError)throw eError;
 if(!event.is_published||event.moderation_status!=="approved")return Response.json({restrictions:[]});
 const now=new Date().toISOString();
 const [{data:blacklist,error:bError},{data:sanctions,error:sError},{data:bans,error:banError}]=await Promise.all([
  db.from("organizer_blacklist").select("id,reason,event_id,expires_at").eq("organizer_id",event.organizer_user_id).eq("target_type",type).eq("target_id",target).is("removed_at",null),
  db.from("competition_sanctions").select("id,reason,ends_at,organizer_id,scopes").eq("target_type",type).eq("target_id",target).is("lifted_at",null).contains("scopes",["events"]),
  db.from("bans").select("id,reason").eq("target_type",type).eq("target_id",target).eq("is_active",true),
 ]);if(bError||sError||banError)throw bError??sError??banError;
 const restrictions=[...(blacklist??[]).filter(r=>(!r.event_id||r.event_id===eventId)&&(!r.expires_at||r.expires_at>now)).map(r=>({id:r.id,reason:r.reason||"Организатор ограничил участие",appealUrl:`/appeals?sourceType=blacklist&sourceId=${r.id}`})),
 ...(sanctions??[]).filter(r=>(!r.organizer_id||r.organizer_id===event.organizer_user_id)&&(!r.ends_at||r.ends_at>now)).map(r=>({id:r.id,reason:r.reason,appealUrl:`/appeals?sourceType=sanction&sourceId=${r.id}`})),
 ...(bans??[]).map(r=>({id:r.id,reason:r.reason,appealUrl:"/support"}))];
 return Response.json({restrictions},{headers:{"Cache-Control":"private, no-store"}});
}catch(error){if(error instanceof z.ZodError)return Response.json({error:"Проверьте мероприятие и команду"},{status:400});return competitionErrorResponse(error);}}
