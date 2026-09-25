import "server-only";
import type {AuthContext} from "@/utils/supabase/server-auth";
import {loadSession,type Database} from "./server";
import {loadClanWar} from "./clan-war-server";
export async function loadResultScope(db:Database,request:Request,id:string,sessionId:string,auth:AuthContext){
 const isWar=new URL(request.url).pathname.startsWith("/api/clan-wars/");
 if(!isWar)return {...await loadSession(db,sessionId,auth),isWar:false};
 if(id!==sessionId)throw new Error("Нет прав на чужое КВ");
 const loaded=await loadClanWar(db,id,auth);
 return {isWar:true,context:loaded.context,role:loaded.role,event:{id},publicId:`KV-${id}`,publication:{first_published_at:loaded.war.result_first_published_at}};
}
