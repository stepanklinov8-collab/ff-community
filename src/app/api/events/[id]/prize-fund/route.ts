import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {requireUser} from "@/utils/supabase/server-auth";
import {competitionErrorResponse} from "@/lib/competition/server";
const bodySchema=z.object({requestId:z.string().uuid(),action:z.enum(["close","reopen"]),expected:z.string().regex(/^[a-f0-9]{32}$/)}).strict();
const messages:Record<string,[number,string]>={CONTRACT_FORBIDDEN:[403,"Нет доступа к призовому фонду"],CONTRACT_FINANCE:[403,"Исправление закрытого фонда доступно администратору с доступом к монетам"],
 CONTRACT_QUOTE_CHANGED:[409,"Результаты или фонд изменились. Обновите расчёт"],CONTRACT_CONFLICT:[409,"Конфликт повторного запроса"],CONTRACT_STATE:[409,"Это действие с фондом недоступно"],CONTRACT_INPUT:[422,"Проверьте данные запроса"],
 CONTRACT_FUNDS:[422,"Недостаточно свободных монет организатора для новых призовых"],PERSONAL_AWARD_PENDING:[409,"Дождитесь окончания сессии, опубликуйте результаты, уточните договорные доли и закройте личные награды"]};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
async function handle(request:Request,context:{params:Promise<{id:string}>},write:boolean){
 try{
  const {user}=await requireUser(request),eventId=z.string().uuid().parse((await context.params).id),sessionId=z.string().uuid().parse(new URL(request.url).searchParams.get("sessionId")),db=createAdminClient();
  const {data:scope,error:scopeError}=await db.from("event_sessions").select("id").eq("id",sessionId).eq("event_id",eventId).maybeSingle();
  if(scopeError||!scope)return json({error:"Сессия недоступна в этом мероприятии"},403);
  let rpc="podium_fund_query",args:Record<string,unknown>={p_actor:user.id,p_session:sessionId};
  if(write){const raw=await request.text();if(raw.length>3000)return json({error:"Слишком большой запрос"},413);let parsed:unknown;try{parsed=JSON.parse(raw);}catch{return json({error:"Проверьте запрос"},400);}
   const input=bodySchema.parse(parsed);rpc="podium_fund_action";args={...args,p_request:input.requestId,p_action:input.action,p_expected:input.expected};}
  const {data,error}=await db.rpc(rpc,args);if(error){const known=messages[error.message];return json({error:known?.[1]??"Не удалось обработать призовой фонд"},known?.[0]??503);}return json(data);
 }catch(error){if(error instanceof z.ZodError)return json({error:"Проверьте данные запроса"},422);const response=competitionErrorResponse(error);response.headers.set("Cache-Control","private, no-store");return response;}
}
export const GET=(request:Request,context:{params:Promise<{id:string}>})=>handle(request,context,false);
export const POST=(request:Request,context:{params:Promise<{id:string}>})=>handle(request,context,true);
