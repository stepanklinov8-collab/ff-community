import {z} from "zod";
import {getLeaderboard} from "@/lib/competition/leaderboard-server";
import {competitionErrorResponse} from "@/lib/competition/server";
export async function GET(request:Request){try{
 const url=new URL(request.url),input=z.object({mode:z.enum(["main","solo","bo","kv"]),type:z.enum(["player","team"]),sort:z.enum(["rating","cost","kills","games","ratio"]),offset:z.coerce.number().int().min(0).max(1000000),limit:z.coerce.number().int().min(1).max(100),query:z.string().max(100),kind:z.enum(["team","guild"]).nullable()}).parse({mode:url.searchParams.get("mode")??"main",type:url.searchParams.get("type")??"player",sort:url.searchParams.get("sort")??"rating",offset:url.searchParams.get("offset")??0,limit:url.searchParams.get("limit")??50,query:url.searchParams.get("q")??"",kind:url.searchParams.get("kind")});
 if(input.mode==="solo"&&input.type==="team")return Response.json({items:[],hasMore:false});
 const data=await getLeaderboard(input);
 return Response.json(data,{headers:{"Cache-Control":"no-store"}});
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:"Проверьте фильтры рейтинга"},{status:400});return competitionErrorResponse(error);}}
