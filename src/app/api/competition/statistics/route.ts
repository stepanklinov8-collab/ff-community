import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {allRows,competitionErrorResponse} from "@/lib/competition/server";
export async function GET(request:Request){try{
 const url=new URL(request.url),db=createAdminClient(),id=z.string().uuid().parse(url.searchParams.get("id")),type=z.enum(["player","team"]).parse(url.searchParams.get("type")??"player"),mode=z.enum(["main","solo","bo","kv"]).parse(url.searchParams.get("mode")??"main"),offset=z.coerce.number().int().min(0).max(1000000).parse(url.searchParams.get("offset")??0);
 const {data:entity,error:entityError}=await db.from(type==="player"?"profiles":"teams").select("main_rating").eq("id",id).maybeSingle();if(entityError)throw new Error(entityError.message);if(!entity)return Response.json({error:"Участник не найден"},{status:404});
 const {data:ratings,error:rError}=await db.from("competition_ratings").select("mode,display_rating,wins,games,kills,deaths,assists,series").eq("target_type",type).eq("target_id",id);if(rError)throw new Error(rError.message);
 const summaryRows=await allRows((a,b)=>db.from("competition_public_history").select("mode,kills,games,wins,deaths,assists,source").eq("target_type",type).eq("target_id",id).order("id").range(a,b));
 let organizationCost:number|undefined;
 if(type==="team"){
  const {data:members,error:mError}=await db.from("team_members").select("user_id").eq("team_id",id);if(mError)throw new Error(mError.message);
  const memberIds=[...new Set((members??[]).map(row=>row.user_id))];
  if(memberIds.length){
   const memberHistory=await allRows((a,b)=>db.from("competition_public_history").select("target_id,kills,games,mode,source").eq("target_type","player").in("target_id",memberIds).in("mode",["tournament","training"]).neq("source","legacy_unassigned").order("id").range(a,b));
   organizationCost=Math.round(memberHistory.reduce((total,row)=>total+Math.max(0,Number(row.kills??0))*10+Math.max(0,Number(row.games??0))*5,0));
  }else organizationCost=0;
 }
 const {data:duels,error:dError}=await db.from("competition_duel_totals").select("mode,series,wins").eq("target_type",type).eq("target_id",id);if(dError)throw new Error(dError.message);
 const summaries=["main","solo","bo","kv"].filter(m=>type==="player"||m!=="solo").map(m=>{
  const rows=summaryRows.filter(r=>r.source!=="legacy_unassigned").filter(r=>m==="main"?["training","tournament"].includes(r.mode):r.mode===m),rating=ratings?.find(r=>r.mode===m),duel=duels?.find(r=>r.mode===m);
  const sum=(key:"kills"|"games"|"wins"|"deaths"|"assists")=>rows.reduce((s,r)=>s+Number(r[key]??0),0);
  return {mode:m,rating:rating?Number(rating.display_rating):m==="bo"||m==="kv"?50:m==="main"?Number(Number(entity.main_rating??1).toFixed(type==="team"?2:1)):1,cost:m==="main"?(organizationCost??Math.round(sum("kills")*10+sum("games")*5)):undefined,games:sum("games"),kills:sum("kills"),wins:m==="bo"||m==="kv"?duel?.wins??rating?.wins??0:sum("wins"),series:duel?.series??rating?.series??0,
  deaths:rows.some(r=>r.deaths!==null)?sum("deaths"):null,assists:rows.some(r=>r.assists!==null)?sum("assists"):null,legacyRows:rows.filter(r=>r.source==="legacy").length,ranked:m!=="bo"&&m!=="kv"||Number(duel?.series??rating?.series)>0};
 });
 let query=db.from("competition_public_history").select("id,mode,event_id,session_id,clan_war_id,title,occurred_at,name_snapshot,kills,games,place,wins,deaths,assists,source").eq("target_type",type).eq("target_id",id);
 query=mode==="main"?query.in("mode",["tournament","training"]):query.eq("mode",mode);
 const {data:history,error:hError}=await query.order("occurred_at",{ascending:false}).order("id").range(offset,offset+30);if(hError)throw new Error(hError.message);
 const {data:organizer}=type==="player"?await db.from("organizer_applications").select("status").eq("user_id",id).maybeSingle():{data:null};
 return Response.json({summaries,history:history?.slice(0,30)??[],hasMore:(history?.length??0)>30,goldOrganizer:organizer?.status==="approved"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:"Проверьте параметры статистики"},{status:400});return competitionErrorResponse(error);}}
