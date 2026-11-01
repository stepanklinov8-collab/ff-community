import {z} from "zod";
import {createAdminClient} from "@/utils/supabase/admin";
import {requireUser} from "@/utils/supabase/server-auth";
import {competitionErrorResponse} from "@/lib/competition/server";

const inputSchema=z.object({requestId:z.string().uuid(),fundId:z.string().uuid(),action:z.enum(["choose","settle","close","reopen"]),
 expected:z.string().regex(/^[a-f0-9]{32}$/),kind:z.enum(["mvp","maxKills"]).optional(),winner:z.string().regex(/^user:[0-9a-f-]{36}$/).optional()}).strict();
const errors:Record<string,[number,string]>={
 CONTRACT_FORBIDDEN:[403,"Нет доступа к призовому фонду"],CONTRACT_FINANCE:[403,"Повторно открыть выплаты может только администратор с доступом к монетам"],
 CONTRACT_QUOTE_CHANGED:[409,"Результаты или получатели изменились. Обновите расчёт и проверьте его заново"],
 CONTRACT_CONFLICT:[409,"Этот запрос уже использован для другого действия"],CONTRACT_INPUT:[422,"Проверьте данные запроса"],
 CONTRACT_FUNDS:[422,"Недостаточно свободных монет организатора для исправленных выплат"],CONTRACT_STATE:[409,"Фонд отменён или действие уже недоступно"],
 PERSONAL_AWARD_CLOSED:[409,"Фонд закрыт. Исправление выплат проводится через администратора"],
 PERSONAL_AWARD_PENDING:[409,"Сначала заполните статистику и определите получателей всех личных наград"],
 PERSONAL_AWARD_WINNER:[422,"Выберите одного из допустимых победителей"],
};
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
async function handle(request:Request,context:{params:Promise<{id:string}>},write:boolean){
 try{
  const {user}=await requireUser(request),eventId=z.string().uuid().parse((await context.params).id),db=createAdminClient();
  if(!write){
   const sessionId=z.string().uuid().nullable().parse(new URL(request.url).searchParams.get("sessionId"));
   const {data,error}=await db.rpc("personal_award_query",{p_actor:user.id,p_event:eventId,p_session:sessionId});
   if(error){const known=errors[error.message];return json({error:known?.[1]??"Не удалось загрузить награды"},known?.[0]??503);}return json(data);
  }
  const raw=await request.text();if(raw.length>5000)return json({error:"Слишком большой запрос"},413);
  let parsed:unknown;try{parsed=JSON.parse(raw);}catch{return json({error:"Проверьте данные запроса"},400);}
  const input=inputSchema.parse(parsed);
  // Bind the route event as well as the fund: no cross-event ID substitution.
  const {data:scope,error:scopeError}=await db.rpc("personal_award_query",{p_actor:user.id,p_event:eventId,p_session:new URL(request.url).searchParams.get("sessionId")});
  if(scopeError||scope?.fund?.id!==input.fundId)return json({error:"Нет доступа к этому фонду мероприятия"},403);
  const {data,error}=await db.rpc("personal_award_action",{p_actor:user.id,p_request:input.requestId,p_fund:input.fundId,p_action:input.action,p_expected:input.expected,p_kind:input.kind??null,p_winner:input.winner??null});
  if(error){const known=errors[error.message];return json({error:known?.[1]??"Не удалось выполнить действие с наградой"},known?.[0]??503);}return json(data);
 }catch(error){if(error instanceof z.ZodError)return json({error:"Проверьте данные запроса"},422);const response=competitionErrorResponse(error);response.headers.set("Cache-Control","private, no-store");return response;}
}
export const GET=(request:Request,context:{params:Promise<{id:string}>})=>handle(request,context,false);
export const POST=(request:Request,context:{params:Promise<{id:string}>})=>handle(request,context,true);
