import {z} from "zod";
import {competitionErrorResponse} from "@/lib/competition/server";
import {getStatisticsSummary,getStatisticsHistory} from "@/lib/competition/statistics-server";
export async function GET(request:Request){try{
 const url=new URL(request.url),id=z.string().uuid().parse(url.searchParams.get("id")),type=z.enum(["player","team"]).parse(url.searchParams.get("type")??"player"),mode=z.enum(["main","solo","bo","kv"]).parse(url.searchParams.get("mode")??"main"),offset=z.coerce.number().int().min(0).max(1000000).parse(url.searchParams.get("offset")??0);
 const [summary,page]=await Promise.all([getStatisticsSummary(id,type),getStatisticsHistory(id,type,mode,offset)]);
 if(!summary)return Response.json({error:"Участник не найден"},{status:404});
 const {validSessionIds,...publicSummary}=summary;
 const validSessions=new Set(validSessionIds);
 return Response.json({...publicSummary,...page,history:page.history.map(row=>({...row,countedInRating:mode!=="main"||type!=="player"||Boolean(row.session_id&&validSessions.has(row.session_id))}))},{headers:{"Cache-Control":"no-store"}});
}catch(error){if(error instanceof z.ZodError)return Response.json({error:"Проверьте параметры статистики"},{status:400});return competitionErrorResponse(error);}}
