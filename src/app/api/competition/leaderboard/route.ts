import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {competitionErrorResponse} from "@/lib/competition/server";
export async function GET(request:Request){try{
 const url=new URL(request.url),input=z.object({mode:z.enum(["main","solo","bo","kv"]),type:z.enum(["player","team"]),sort:z.enum(["rating","cost","kills","games","ratio"]),offset:z.coerce.number().int().min(0).max(1000000),limit:z.coerce.number().int().min(1).max(100),query:z.string().max(100),kind:z.enum(["team","guild"]).nullable()}).parse({mode:url.searchParams.get("mode")??"main",type:url.searchParams.get("type")??"player",sort:url.searchParams.get("sort")??"rating",offset:url.searchParams.get("offset")??0,limit:url.searchParams.get("limit")??50,query:url.searchParams.get("q")??"",kind:url.searchParams.get("kind")});
 if(input.mode==="solo"&&input.type==="team")return Response.json({items:[],hasMore:false});
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
 return Response.json(data,{headers:{"Cache-Control":"no-store"}});
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:"Проверьте фильтры рейтинга"},{status:400});return competitionErrorResponse(error);}}
