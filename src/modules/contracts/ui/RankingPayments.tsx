"use client";
import {useState} from "react";
import {authFetch} from "@/platform/browser-services";
type Row={id:string;revision:number;status:string;rule:{ranking:"organizations"|"teams"|"guilds";mode:"at_end"|"best"|"throughout";top:number;amount:number;startsAt:string;endsAt:string};assessment:{reason?:string;bestPosition?:number|null;worstPosition?:number|null;endPosition?:number|null};obligationId:string|null};
const states:Record<string,string>={earned:"Бонус начислен",not_earned:"Условие не выполнено",history_missing:"Недостаточно истории рейтинга",late_signature:"Договор подписан после начала периода"};
const modes={at_end:"Место на конец периода",best:"Лучшее место за период",throughout:"Удержание в топе весь период"};
const rankings={organizations:"Все организации",teams:"Команды",guilds:"Гильдии"};
export default function RankingPayments({contractId}:{contractId:string}){
 const[open,setOpen]=useState(false),[rows,setRows]=useState<Row[]>([]),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[coverage,setCoverage]=useState<string|null>(null);
 async function load(append=false){setBusy(true);setError("");try{
  const response=await authFetch(`/api/contracts?${new URLSearchParams({contractId,ranking:"true",offset:String(append?rows.length:0)})}`);const data=await response.json();if(!response.ok)throw new Error(data.error??"Не удалось загрузить рейтинговые начисления");
  setRows(current=>append?[...current,...data.rows]:data.rows);setMore(data.hasMore);setCoverage(data.coverageSince);setOpen(true);
 }catch(cause){setError(cause instanceof TypeError?"Не удалось связаться с сайтом. Повторите загрузку.":cause instanceof Error?cause.message:"Не удалось загрузить начисления");}finally{setBusy(false);}}
 return <section aria-label="Рейтинговые начисления" className="space-y-3">
  <button className="secondary-button" disabled={busy} onClick={()=>open?setOpen(false):void load()}>Бонусы за место в рейтинге</button>
  {error&&<p role="alert" className="text-red-300">{error}</p>}
  {open&&<div className="space-y-3 text-sm"><p>Проверка выполняется после конца периода по сохранённым местам организации. Договор должен непрерывно действовать до конца периода. Начисленный бонус и его фактическая оплата отображаются отдельно в выплатах договора.</p>
   {coverage&&<p>История таблиц ведётся с {new Date(coverage).toLocaleString("ru-RU")}. Более ранние места не восстанавливаются из сегодняшнего рейтинга.</p>}
   {!rows.length&&<p>Завершённых проверок пока нет.</p>}
   {rows.map(row=><article className="rounded border border-slate-700 p-3" key={row.id}><strong>{states[row.status]??row.status} · {row.rule.amount.toLocaleString("ru-RU")} OC</strong><p>{rankings[row.rule.ranking]} · {modes[row.rule.mode]}, топ-{row.rule.top}. Редакция {row.revision}.</p><p>{new Date(row.rule.startsAt).toLocaleString("ru-RU")} — {new Date(row.rule.endsAt).toLocaleString("ru-RU")}</p>
    {row.assessment.reason==="contract_ended_before_period"?<p>Договор закончился до конца периода или действовал с перерывом. Бонус не начисляется.</p>:<p>На конец периода: {row.assessment.endPosition??"—"}; лучшее место: {row.assessment.bestPosition??"—"}; худшее: {row.assessment.worstPosition??"—"}.</p>}
    {row.status==="history_missing"&&<p>Нет полной истории этого периода. Автоматического начисления нет.</p>}
   </article>)}{more&&<button disabled={busy} className="secondary-button" onClick={()=>void load(true)}>Ещё проверки рейтинга</button>}
  </div>}
 </section>;
}
