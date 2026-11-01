import "server-only";
import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {requireUser,ApiAuthError} from "@/utils/supabase/server-auth";
import {allRows,competitionErrorResponse} from "./server";
export async function getEligibility(request:Request,context:{params:Promise<{id:string}>}){
 try{
  const auth=await requireUser(request),db=createAdminClient(),eventId=z.string().uuid().parse((await context.params).id),url=new URL(request.url);
  const teamId=url.searchParams.get("teamId");if(teamId)z.string().uuid().parse(teamId);
  const selected=z.array(z.string().uuid()).max(60).parse(url.searchParams.get("roster")?.split(",").filter(Boolean)??[]);
  const targets=new Map<string,string>();
  if(teamId){
   const {data,error}=await db.rpc("can_manage_team",{check_team_id:teamId,check_user_id:auth.user.id});if(error)throw error;if(!data)throw new ApiAuthError("Нет доступа к заявке команды",403);
   targets.set(`team:${teamId}`,"Организация");
   // A manager may inspect members' restrictions, never arbitrary users supplied in a URL.
   if(selected.length){const {data:members,error}=await db.from("team_members").select("user_id").eq("team_id",teamId).in("user_id",selected);if(error)throw error;
    const ids=(members??[]).map(row=>row.user_id);
    if(ids.length){const {data:profiles,error}=await db.from("profiles").select("id,nickname").in("id",ids);if(error)throw error;for(const player of profiles??[])targets.set(`player:${player.id}`,player.nickname||"Игрок");}
   }
  }else targets.set(`player:${auth.user.id}`,"Вы");
  const {data:event,error}=await db.from("events").select("organizer_user_id,is_published,publish_at,moderation_status").eq("id",eventId).single();if(error)throw error;
  if(event.moderation_status!=="approved"||(!event.is_published&&(!event.publish_at||Date.parse(event.publish_at)>Date.now())))return Response.json({restrictions:[]},{headers:{"Cache-Control":"private, no-store"}});
  const ids=[...targets.keys()].map(key=>key.split(":")[1]),now=new Date().toISOString();
  const [blacklist,sanctions,bans]=await Promise.all([
   event.organizer_user_id?allRows((a,b)=>db.from("organizer_blacklist").select("id,target_type,target_id,reason,event_id,expires_at").eq("organizer_id",event.organizer_user_id).in("target_id",ids).is("removed_at",null).order("id").range(a,b)):Promise.resolve([]),
   allRows((a,b)=>db.from("competition_sanctions").select("id,target_type,target_id,reason,ends_at,organizer_id").in("target_id",ids).is("lifted_at",null).contains("scopes",["events"]).order("id").range(a,b)),
   allRows((a,b)=>db.from("bans").select("id,target_type,target_id,reason").in("target_id",ids).eq("is_active",true).order("id").range(a,b)),
  ]);
  const applies=(row:{target_type:string;target_id:string})=>targets.has(`${row.target_type}:${row.target_id}`);
  const activeSanctions=sanctions.filter(row=>applies(row)&&(!row.organizer_id||row.organizer_id===event.organizer_user_id)&&(!row.ends_at||row.ends_at>now));
  const warnings=activeSanctions.length?await allRows((a,b)=>db.from("warnings").select("id,reason,activated_at,expires_at,event_id,session_id,used_in_sanction").in("used_in_sanction",activeSanctions.map(row=>row.id)).is("cancelled_at",null).order("activated_at").order("id").range(a,b)):[];
  const targetName=(row:{target_type:string;target_id:string})=>targets.get(`${row.target_type}:${row.target_id}`);
  const restrictions=[
   ...blacklist.filter(row=>applies(row)&&(!row.event_id||row.event_id===eventId)&&(!row.expires_at||row.expires_at>now)).map(row=>({id:row.id,targetName:targetName(row),reason:row.reason||"Организатор ограничил участие",endsAt:row.expires_at,scope:"У этого организатора",appealUrl:`/appeals?sourceType=blacklist&sourceId=${row.id}`,warnings:[]})),
   ...activeSanctions.map(row=>({id:row.id,targetName:targetName(row),reason:row.reason,endsAt:row.ends_at,scope:row.organizer_id?"У этого организатора":"На всех мероприятиях",appealUrl:`/appeals?sourceType=sanction&sourceId=${row.id}`,warnings:warnings.filter(warning=>warning.used_in_sanction===row.id).map(warning=>({id:warning.id,reason:warning.reason,issuedAt:warning.activated_at,expiresAt:warning.expires_at,eventUrl:warning.event_id?`/tournaments/${warning.event_id}${warning.session_id?`?sessionId=${warning.session_id}`:""}`:null}))})),
   ...bans.filter(applies).map(row=>({id:row.id,targetName:targetName(row),reason:row.reason,endsAt:null,scope:"Блокировка на сайте",appealUrl:"/support",warnings:[]})),
  ];
  return Response.json({restrictions},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){const response=error instanceof z.ZodError?Response.json({error:"Проверьте мероприятие, команду и состав"},{status:400}):competitionErrorResponse(error);response.headers.set("Cache-Control","private, no-store");return response;}
}
