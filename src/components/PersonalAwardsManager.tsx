"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {authFetch} from "@/utils/api/auth-fetch";
import {formatCoins} from "@/lib/economy/currency";

type Kind="mvp"|"maxKills";
type Winner={key:string;userId:string|null;nickname:string;kills:number;mvpCandidate:boolean;maxKillsCandidate:boolean};
type Plan={ready:boolean;reason?:string;amount?:number;playerAmount?:number;organizationAmount?:number;winner?:Winner;homeShares?:Array<{organizationId:string;amount:number}>};
interface Data{
 fund:{id:string;session_id:string|null;total:number;held:number;closed_at:string|null;cancelled_at:string|null;last_error:string|null;plan:Record<Kind,number>}|null;
 plans?:Record<Kind,Plan>;fingerprint?:string;canReopen?:boolean;canFund?:boolean;additionalReserve?:number;activeKinds?:Kind[];
 candidates?:{players?:Winner[]};history?:Array<{id:string;kind:Kind;amount:number;nickname:string;createdAt:string;reversedAt:string|null;playerAmount:number;recoveryDebt:number}>;
}
const titles:Record<Kind,string>={mvp:"MVP",maxKills:"Максимум киллов"};
const reasons:Record<string,string>={
 incomplete_player_statistics:"Заполните личную статистику каждого участника, включая отметки неявки.",unpublished_sessions:"Опубликуйте результаты всех сессий.",
 sessions_not_finished:"Награда рассчитывается после окончания выступления.",winner_choice_required:"При равенстве показателей выберите победителя.",
 winner_account_missing:"Победил гость без аккаунта. Привяжите его аккаунт в результатах; приз сохранён в резерве.",
 stale_winner_choice:"После исправления результатов прежний выбор недействителен. Выберите победителя заново.",
 no_eligible_winner:"Нет участника с киллами. Неразыгранный приз вернётся организатору при закрытии фонда.",
 insufficient_funds:"Не хватает свободных монет организатора для исправленных выплат.",closed_results_changed:"Результаты изменились после закрытия. Выплаты проверяет администратор.",
 additional_funding_required:"Возврат прежнего приза ещё не завершён. Дополнительное резервирование подтверждает владелец исходного счёта или администратор с доступом к монетам.",
 ambiguous_award_contract:"Найдено несколько применимых договоров с разными организациями. Требуется проверка администрации.",
 duplicate_player_statistics:"Проверьте повторяющиеся строки игроков.",missing_final_session:"Выберите итоговую сессию турнира.",invalid_final_session:"Проверьте итоговую сессию турнира.",
};
export default function PersonalAwardsManager({eventId,sessionId,revision}:{eventId:string;sessionId:string;revision:number}){
 const [data,setData]=useState<Data|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false);
 const [choices,setChoices]=useState<Partial<Record<Kind,string>>>({});
 const version=useRef(0),retry=useRef<{serialized:string;requestId:string}|null>(null);
 const endpoint=`/api/events/${eventId}/personal-awards?sessionId=${encodeURIComponent(sessionId)}`;
 const load=useCallback(async()=>{
  const current=++version.current;
  try{const response=await authFetch(endpoint),value=await response.json();if(current!==version.current)return false;if(!response.ok)throw new Error(value.error);
   setData(value);setChoices({});setConfirmed(false);return true;
  }catch(error){if(current===version.current)setMessage(error instanceof Error?error.message:"Не удалось загрузить награды");return false;}
 },[endpoint]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);const sequence=version;return()=>{clearTimeout(timer);sequence.current++;};},[load,revision]);
 const act=async(action:"choose"|"settle"|"close"|"reopen",kind?:Kind)=>{
  if(!data?.fund||!data.fingerprint)return;setBusy(true);setMessage("");
  const payload={fundId:data.fund.id,action,expected:data.fingerprint,...(kind?{kind,winner:choices[kind]}:{})},serialized=JSON.stringify(payload);
  const pending=retry.current?.serialized===serialized?retry.current:{serialized,requestId:crypto.randomUUID()};retry.current=pending;
  try{const response=await authFetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,requestId:pending.requestId})}),value=await response.json();
   if(!response.ok)throw new Error(value.error);retry.current=null;if(!await load()){setData(null);setMessage("Действие подтверждено, но обновить список не удалось. Обновите страницу; повторять перевод не нужно.");return;}setMessage(value.settlement?.pending?"Расчёт сохранён. Выплата ожидает устранения указанной причины.":"Действие выполнено");
  }catch(error){setMessage(error instanceof Error?error.message:"Не удалось выполнить действие");}finally{setBusy(false);}
 };
 if(!data?.fund)return message?<p role="alert" className="text-amber-200">{message}</p>:null;
 const fund=data.fund,closed=!!fund.closed_at,cancelled=!!fund.cancelled_at;
 return <section aria-label="Личные денежные награды" className="cyber-card space-y-4 p-5">
  <h2 className="text-xl font-bold">Личные денежные награды</h2>
  <p className="text-sm text-slate-300">{fund.session_id?"За выбранную сессию":"За весь турнир, один раз после завершения всех этапов"}. Фонд: {formatCoins(fund.total)} · в резерве: {formatCoins(fund.held)}. {cancelled?"Отменён":closed?"Выплаты окончательно закрыты":"Выплаты открыты"}.</p>
  <p className="text-sm text-slate-400">Без заранее подписанного договора личный приз получает игрок. При договоре применяются сохранённые доли и условия выступления.</p>
  {fund.last_error&&<p role="alert" className="text-amber-200">{reasons[fund.last_error]??"Расчёт ожидает проверки результатов."}</p>}
  {(data.additionalReserve??0)>0&&<p>Для исправления потребуется дополнительно зарезервировать на исходном счёте организатора до {formatCoins(data.additionalReserve!)}. Это не затрагивает другие резервы.</p>}
  {(["mvp","maxKills"] as const).filter(kind=>fund.plan[kind]>0).map(kind=>{
   const plan=data.plans?.[kind],eligible=data.candidates?.players?.filter(p=>kind==="mvp"?p.mvpCandidate:p.maxKillsCandidate)??[];
   return <article key={kind} className="space-y-2 rounded-lg border border-white/15 p-3"><h3 className="font-bold">{titles[kind]} · {formatCoins(fund.plan[kind])}</h3>
    {plan?.ready&&plan.winner?<p>{plan.winner.nickname}: игроку {formatCoins(plan.playerAmount??0)}, организации {formatCoins(plan.organizationAmount??0)}{(plan.homeShares?.length??0)>0?`, основным организациям ${formatCoins(plan.homeShares!.reduce((sum,row)=>sum+row.amount,0))}`:""}. {data.activeKinds?.includes(kind)?"Выплачено.":"Ожидает выплаты."}</p>:<p>{reasons[plan?.reason??""]??"Ожидаются подтверждённые результаты."}</p>}
    {!cancelled&&!closed&&eligible.length>0&&["winner_choice_required","stale_winner_choice"].includes(plan?.reason??"")&&<div className="flex flex-wrap items-end gap-3">
     <label>Получатель: {titles[kind]}<select className="ml-2 bg-slate-950 p-2" disabled={busy} value={choices[kind]??""} onChange={e=>setChoices(c=>({...c,[kind]:e.target.value}))}><option value="">Выберите победителя</option>{eligible.map(player=><option disabled={!player.userId} key={player.key} value={player.key}>{player.nickname} · {player.kills} киллов{!player.userId?" · нужен аккаунт":""}</option>)}</select></label>
     <button type="button" className="secondary-button" disabled={busy||!choices[kind]} onClick={()=>void act("choose",kind)}>Подтвердить получателя</button>
    </div>}
   </article>;
  })}
  {message&&<p role="status">{message}</p>}
  {!cancelled&&<div className="space-y-3">
   {!closed&&<button type="button" className="secondary-button" disabled={busy||((data.additionalReserve??0)>0&&!data.canFund)} onClick={()=>void act("settle")}>Проверить и выплатить награды</button>}
   {(!closed||data.canReopen)&&<><label className="block"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> {closed?"Проверил изменённые результаты и финансирование":"Проверил получателей и выплаты; неразыгранный остаток можно вернуть организатору"}</label>
    <button type="button" className="secondary-button" disabled={busy||!confirmed} onClick={()=>void act(closed?"reopen":"close")}>{closed?"Открыть для исправления выплат":"Окончательно закрыть личный фонд"}</button></>}
  </div>}
  {!!data.history?.length&&<details><summary>История личных наград</summary><ul className="mt-3 space-y-2 text-sm">{data.history.map(item=><li key={item.id}>{titles[item.kind]} · {item.nickname} · {formatCoins(item.amount)} · {new Date(item.createdAt).toLocaleString("ru-RU")}{item.reversedAt?" · отменено при исправлении":" · выплачено"}{item.recoveryDebt>0?` · остаток возврата ${formatCoins(item.recoveryDebt)}`:""}</li>)}</ul></details>}
 </section>;
}
