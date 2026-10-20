import "server-only";
import {createAdminClient} from "@/utils/supabase/admin";
import {cachePublicRead,PUBLIC_COMPETITION_TAG} from "@/lib/public-data/cache";
interface Filters {mode:string;type:"player"|"team";sort:string;offset:number;limit:number;query:string;kind:"team"|"guild"|null}
export const getLeaderboard = cachePublicRead(async(input:Filters)=>{
 const db=createAdminClient();
 const {data,error}=await db.rpc("u2_leaderboard",{p_mode:input.mode,p_target_type:input.type,p_query:input.query,p_limit:input.limit,p_offset:input.offset,p_sort:input.sort,p_kind:input.kind});if(error)throw new Error(error.message);
 if(input.type==="player"&&data?.items?.length){
  const ids=(data.items as Array<{id:string}>).map(item=>item.id);
  const {data:memberships,error:membershipsError}=await db.from("team_members").select("user_id,teams(id,name,type)").in("user_id",ids);
  if(membershipsError)throw new Error(membershipsError.message);
  const byPlayer=new Map<string,Array<{id:string;name:string;type:string}>>();
  for(const membership of memberships??[]){
   const team=membership.teams as unknown as {id:string;name:string;type:string}|null;
   if(!team)continue;
   byPlayer.set(membership.user_id,[...(byPlayer.get(membership.user_id)??[]),team]);
  }
  data.items=data.items.map((item:{id:string})=>({...item,organizations:byPlayer.get(item.id)??[]}));
 }

 return data;
},"leaderboard-v1",PUBLIC_COMPETITION_TAG);
