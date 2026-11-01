"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {authFetch} from "@/utils/api/auth-fetch";
import {formatCoins} from "@/lib/economy/currency";
interface Data{fund:{total:number;held:number;closed_at:string|null;cancelled:boolean;last_error:string|null;awards:Array<{amount:number}>}|null;fingerprint:string;additionalReserve:number;canReopen:boolean;canFund?:boolean}
export default function PodiumFundManager({eventId,sessionId,revision}:{eventId:string;sessionId:string;revision:number}){
 const [data,setData]=useState<Data|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[confirmed,setConfirmed]=useState(false);
 const sequence=useRef(0),retry=useRef<{serialized:string;requestId:string}|null>(null);
 const endpoint=`/api/events/${eventId}/prize-fund?sessionId=${encodeURIComponent(sessionId)}`;
 const load=useCallback(async()=>{
  const current=++sequence.current;
  try{const response=await authFetch(endpoint),value=await response.json();if(current!==sequence.current)return false;if(!response.ok)throw new Error(value.error);setData(value);setConfirmed(false);return true;}
  catch(error){if(current===sequence.current)setMessage(error instanceof Error?error.message:"Не удалось загрузить фонд");return false;}
 },[endpoint]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0),version=sequence;return()=>{clearTimeout(timer);version.current++;};},[load,revision]);
 const act=async()=>{
  if(!data?.fund)return;setBusy(true);setMessage("");const payload={action:data.fund.closed_at?"reopen":"close",expected:data.fingerprint},serialized=JSON.stringify(payload);
  const operation=retry.current?.serialized===serialized?retry.current:{serialized,requestId:crypto.randomUUID()};retry.current=operation;
  try{const response=await authFetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,requestId:operation.requestId})}),value=await response.json();if(!response.ok)throw new Error(value.error);
   retry.current=null;if(!await load()){setData(null);setMessage("Действие подтверждено, но обновить фонд не удалось. Обновите страницу; повторять списание не нужно.");return;}setMessage("Действие выполнено");
  }catch(error){setMessage(error instanceof Error?error.message:"Не удалось изменить фонд");}finally{setBusy(false);}
 };
 if(!data?.fund)return message?<p role="alert" className="text-amber-200">{message}</p>:null;
 const fund=data.fund,paid=fund.awards.reduce((sum,row)=>sum+row.amount,0);
 return <section aria-label="Завершение призов топ-3" className="cyber-card space-y-3 p-5"><h2 className="text-xl font-bold">Завершение призов топ-3</h2>
  <p>Фонд: {formatCoins(fund.total)} · распределено организациям: {formatCoins(paid)} · остаток в резерве: {formatCoins(fund.held)}.</p>
  <p className="text-sm text-slate-400">{fund.cancelled?"Фонд отменён.":fund.closed_at?"Фонд закрыт. Поздние изменения выплат проводятся через администратора.":"После окончания сессии и проверки всех призов закройте выплаты. Неразыгранный остаток вернётся в доступные монеты организатора."}</p>
  {fund.last_error&&<p role="alert" className="text-amber-200">{fund.last_error==="additional_funding_required"?"Проверьте дополнительный резерв на исходном счёте организатора. Обычная публикация не списывает эти монеты.":"Результаты изменились после закрытия. Администратор должен проверить выплаты."}</p>}
  {data.additionalReserve>0&&<p>Для исправления нужен дополнительный резерв: {formatCoins(data.additionalReserve)}.</p>}
  {!fund.cancelled&&(!fund.closed_at||data.canReopen)&&<><label className="block"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/> {fund.closed_at?"Проверил исправленные результаты и источник монет":"Проверил места, договорные доли и завершил личные награды"}</label>
   <button type="button" className="secondary-button" disabled={busy||!confirmed||(data.additionalReserve>0&&!data.canFund)} onClick={()=>void act()}>{fund.closed_at?"Открыть призы топ-3 для исправления":"Закрыть призы топ-3 и вернуть остаток"}</button></>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
