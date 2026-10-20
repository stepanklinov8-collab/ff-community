import "server-only";
import {createAdminClient} from "@/utils/supabase/admin";
import {allRows} from "./server";
import {cachePublicRead,PUBLIC_COMPETITION_TAG} from "@/lib/public-data/cache";
type Target = "player" | "team";

export const getStatisticsSummary = cachePublicRead(async (id:string,type:Target) => {
 const db=createAdminClient();
 const {data:entity,error:entityError}=await db.from(type==="player"?"profiles":"teams").select("main_rating,reputation_score").eq("id",id).maybeSingle();
 if(entityError)throw new Error(entityError.message);if(!entity)return null;
 const [ratingsResult,mainResult,summaryRows,costResult,awardsResult,placementResult,duelsResult,organizerResult]=await Promise.all([
  db.from("competition_ratings").select("mode,display_rating,wins,games,kills,deaths,assists,series").eq("target_type",type).eq("target_id",id),
  type==="player"?db.rpc("u4_player_main_statistics",{p_user_id:id}):Promise.resolve({data:null,error:null}),
  allRows((a,b)=>db.from("competition_public_history").select("id,session_id,place,mode,kills,games,wins,deaths,assists,source").eq("target_type",type).eq("target_id",id).order("id").range(a,b)),
  db.rpc("u2_cost_for_target",{p_target_type:type,p_target_id:id,p_mode:"main"}),
  db.rpc("u3_award_summary",{p_type:type,p_target:id}),
  type==="player"?db.rpc("u4_placement_bonus",{p_user_id:id}):Promise.resolve({data:null,error:null}),
  db.from("competition_duel_totals").select("mode,series,wins").eq("target_type",type).eq("target_id",id),
  type==="player"?db.from("organizer_applications").select("status").eq("user_id",id).maybeSingle():Promise.resolve({data:null,error:null}),
 ]);
 for(const result of [ratingsResult,mainResult,costResult,awardsResult,placementResult,duelsResult,organizerResult])if(result.error)throw new Error(result.error.message);
 const ratings=ratingsResult.data,mainFacts=mainResult.data,calculatedCost=costResult.data,awards=awardsResult.data,placementBonus=placementResult.data,duels=duelsResult.data;
 const validSessions=new Set<string>(Array.isArray(mainFacts?.sessionIds)?mainFacts.sessionIds:[]);
 const summaries=["main","solo","bo","kv"].filter(m=>type==="player"||m!=="solo").map(m=>{
  const rows=summaryRows.filter(r=>r.source!=="legacy_unassigned").filter(r=>m==="main"?["training","tournament"].includes(r.mode):r.mode===m).filter(r=>m!=="main"||type!=="player"||Boolean(r.session_id&&validSessions.has(r.session_id))),rating=ratings?.find(r=>r.mode===m),duel=duels?.find(r=>r.mode===m);
  const sum=(key:"kills"|"games"|"wins"|"deaths"|"assists")=>rows.reduce((s,r)=>s+Number(r[key]??0),0),personalMain=m==="main"&&type==="player",games=personalMain?Number(mainFacts?.games??0):sum("games"),kills=personalMain?Number(mainFacts?.kills??0):sum("kills"),wins=personalMain?Number(mainFacts?.wins??0):m==="bo"||m==="kv"?duel?.wins??rating?.wins??0:type==="team"&&m==="main"?new Set(rows.filter(row=>Number(row.wins??0)>0).map(row=>row.session_id??row.id)).size:sum("wins"),deaths=personalMain?mainFacts?.deaths??null:rows.some(row=>row.deaths!==null)?sum("deaths"):null;
  return {mode:m,rating:rating?Number(rating.display_rating):m==="bo"||m==="kv"?50:m==="main"?entity.main_rating==null?null:Number(Number(entity.main_rating).toFixed(2)):1,cost:m==="main"?Number(calculatedCost??0):undefined,games,kills,wins,series:duel?.series??rating?.series??0,
  deaths,assists:personalMain?mainFacts?.assists??null:rows.some(r=>r.assists!==null)?sum("assists"):null,legacyRows:rows.filter(r=>r.source==="legacy").length,ranked:m==="main"?rating!==undefined:m!=="bo"&&m!=="kv"||Number(duel?.series??rating?.series)>0};
 });

 return {summaries,validSessionIds:[...validSessions],goldOrganizer:organizerResult.data?.status==="approved",
  awards:type==="player"?{...awards,placementBonus:Number(placementBonus??0),totalRatingBonus:Math.min(499,Number(placementBonus??0)+Number(awards?.ratingBonus??0))}:awards};
},"statistics-summary-v1",PUBLIC_COMPETITION_TAG);

export const getStatisticsHistory = cachePublicRead(async (id:string,type:Target,mode:string,offset:number) => {
 const db=createAdminClient();
 let query=db.from("competition_public_history").select("id,mode,event_id,session_id,clan_war_id,title,occurred_at,name_snapshot,kills,games,place,wins,deaths,assists,source").eq("target_type",type).eq("target_id",id);
 query=mode==="main"?query.in("mode",["tournament","training"]):query.eq("mode",mode);
 const {data,error}=await query.order("occurred_at",{ascending:false}).order("id").range(offset,offset+30);
 if(error)throw new Error(error.message);
 return {history:data?.slice(0,30)??[],hasMore:(data?.length??0)>30};
},"statistics-history-v1",PUBLIC_COMPETITION_TAG);
