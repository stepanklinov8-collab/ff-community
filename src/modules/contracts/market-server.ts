import "server-only";
import {createAdminClient,requireUser,authErrorResponse} from "@/platform/database";
import {marketMutationSchema,marketQuerySchema} from "./market-model";
import {playerTransferMutationSchema,playerTransferQuerySchema} from "./player-transfer-model";
const errors:Record<string,[number,string]>={
 MARKET_PLAYER:[422,"Игрок не найден"],MARKET_PLAYER_BUYER:[403,"Плательщик должен иметь право приглашать в выбранную организацию"],
 MARKET_PLAYER_CHANGED:[409,"Состав или действующие договоры изменились. Подготовьте новую редакцию и соберите согласия заново"],
 MARKET_PLAYER_EXCEPTION:[409,"Компенсация превышает цену. Согласуйте исключение с прежней организацией в новой редакции"],
 MARKET_PLAYER_HOME:[409,"Нужны согласия игрока и основных организаций по действующим ограничениям"],MARKET_PLAYER_CONSENT:[409,"Сначала игрок должен согласиться с условиями перехода"],
 MARKET_PLAYER_ALREADY_MEMBER:[409,"Игрок уже состоит в выбранной организации"],MARKET_PLAYER_MEMBERSHIP:[409,"У игрока несколько составов одного типа. Обратитесь в поддержку"],MARKET_PLAYER_CONTRACT_CONFLICT:[409,"Действующий договор не соответствует текущему составу. Обратитесь в поддержку"],
 MARKET_PLAYER_START:[409,"Дождитесь указанного начала нового договора"],MARKET_PLAYER_CAPACITY:[409,"В принимающей организации нет свободных мест"],MARKET_PLAYER_LEADER:[409,"Перед переходом руководителя нужно назначить ему замену и пересогласовать предложение"],
 MARKET_PLAYER_CONTRACT:[409,"Новый договор ещё не вступил в силу"],CONTRACT_TRANSFER_CANCELLATION_REQUIRED:[422,"Согласуйте последствия отмены перехода в новом договоре"],CONTRACT_SIGNATURE_STALE:[409,"Подписант организации потерял полномочия. Подготовьте новую редакцию"],CONTRACT_GUEST_OVERLAP:[409,"Сначала урегулируйте действующий гостевой договор с этой организацией"],CONTRACT_FUNDS:[422,"Недостаточно монет организации для первоначальных выплат по новому договору"],
 MARKET_PLAYER_FLOW:[409,"Для перехода игрока используется отдельное подтверждение договора и состава"],
 MARKET_AUTH:[401,"Войдите в аккаунт"],MARKET_FORBIDDEN:[403,"Нет доступа к этой сделке"],MARKET_NOT_FOUND:[404,"Сделка не найдена или недоступна"],MARKET_INPUT:[422,"Проверьте поля предложения"],CONTRACT_INPUT:[422,"Проверьте поля предложения"],CONTRACT_DATES:[422,"Проверьте срок предложения"],MARKET_DATES:[422,"Срок предложения должен быть в будущем"],
 MARKET_ORGANIZATION:[422,"Выберите действующую организацию с назначенным владельцем"],MARKET_CYCLE:[422,"Такая покупка создаёт замкнутую цепочку владения"],MARKET_CONFLICT:[409,"Предложение изменилось. Обновите его и подтвердите нужную редакцию"],MARKET_STATE:[409,"Это действие уже недоступно. Обновите сделку"],MARKET_STALE_OWNER:[409,"Сменился владелец одной из сторон. Подготовьте новую редакцию и получите согласия заново"],
 MARKET_OWNER:[403,"Продажу и раскрытие договоров подтверждает владелец"],MARKET_FINANCE:[403,"Оплату подтверждает владелец или руководитель покупателя"],MARKET_FUNDS:[422,"Недостаточно монет для цены сделки. Чужие резервы и DEMO-баланс использовать нельзя"],MARKET_RESERVE:[409,"Резерв этой редакции недоступен. Обновите сделку"],
 MARKET_DISCLOSURE_REQUIRED:[409,"Сначала владелец должен разрешить просмотр договоров и обязательств"],MARKET_DISCLOSURE_CHANGED:[409,"Состав, договоры или счета организации изменились. Нужна новая редакция и повторное согласование"],MARKET_SELLER_CONSENT:[409,"Ожидается согласие текущего владельца"],MARKET_STALE_CONSENT:[409,"Подписант покупателя потерял полномочия. Нужна новая редакция"],
 MARKET_DISPUTED:[409,"По сделке открыт спор. Дождитесь его разрешения"],MARKET_ADMIN:[403,"Это действие доступно администрации по открытому спору"],MARKET_CASH_ADMIN:[403,"Отмена покупки требует права управления монетами"],MARKET_LATER_CHANGES:[409,"После покупки были другие изменения собственности, состава или обязательств. Сначала урегулируйте их в споре"],MARKET_RATE:[429,"Слишком много сообщений. Подождите минуту"],MARKET_REPLY:[422,"Сообщение для ответа не принадлежит этой сделке"],
};
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
async function handle(request:Request,write:boolean,player=false){try{
 const {user}=await requireUser(request);const raw=write?await request.text():null;if(raw&&raw.length>30000)return response({error:"Слишком большой запрос"},413);
 let input:unknown;try{input=write?JSON.parse(raw??""):Object.fromEntries(new URL(request.url).searchParams);}catch{return response({error:"Проверьте запрос"},400);}
 const parsed=(player?(write?playerTransferMutationSchema:playerTransferQuerySchema):(write?marketMutationSchema:marketQuerySchema)).safeParse(input);if(!parsed.success)return response({error:parsed.error.issues[0]?.message??"Проверьте поля"},422);
 const value=parsed.data;const rpc=write?("action"in value&&["message","read"].includes(value.action)?"market_chat_action":player?"player_transfer_mutate":"market_mutate"):player?"player_transfer_query":"market_query";
 const {data,error}=await createAdminClient().rpc(rpc,{p_actor:user.id,p_input:value});if(error){const known=errors[error.message];if(known)return response({error:known[1]},known[0]);console.error("Market database error",error.code);return response({error:"Не удалось выполнить действие. Повторите его позже"},503);}return response(data);
}catch(cause){const result=authErrorResponse(cause);result.headers.set("Cache-Control","private, no-store");return result;}}
export const marketGet=(request:Request)=>handle(request,false);
export const marketPost=(request:Request)=>handle(request,true);
export const transfersGet=(request:Request)=>handle(request,false,true);
export const transfersPost=(request:Request)=>handle(request,true,true);
