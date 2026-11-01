"use client";
import {useRef,useState} from "react";
import {authFetch} from "@/platform/browser-services";
import {describeRentalCompensation,rentalBasisLabels,type RentalCondition,type RentalCompensation} from "../rental-terms";
const inputClass="w-full rounded border border-slate-600 bg-slate-900 p-2";
type Organization={organizationId:string;name:string;policy:string;compensation:RentalCompensation};
export function RentalConditionsEditor({organizationId,playerId,eventId,sessionId,value,onChange}:{organizationId:string;playerId:string;eventId:string;sessionId:string|null;value:RentalCondition[];onChange:(value:RentalCondition[])=>void}){
 const [rows,setRows]=useState<Organization[]|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function load(){
  setBusy(true);setError("");
  try{const params=new URLSearchParams({rentalOptions:"true",organizationId,rentalPlayerId:playerId,rentalEventId:eventId,...(sessionId?{rentalSessionId:sessionId}:{})});
   const response=await authFetch(`/api/contracts?${params}`),data=await response.json();if(!response.ok)throw new Error(data.error);
   setRows(data.organizations);onChange(data.organizations.map((row:Organization)=>value.find(item=>item.organizationId===row.organizationId)??{organizationId:row.organizationId,compensation:row.compensation}));
  }catch(caught){setError(caught instanceof Error?caught.message:"Не удалось загрузить основные организации");}finally{setBusy(false);}
 }
 const update=(id:string,compensation:RentalCompensation)=>onChange(value.map(row=>row.organizationId===id?{...row,compensation}:row));
 return <section className="space-y-3 rounded border border-cyan-800 p-4" aria-label="Условия оплаты аренды"><h3 className="font-semibold">Расчёт с основными организациями</h3>
  <p className="text-sm text-slate-300">Компенсацию платит нанявшая организация со своего счёта. Выплата игроку не уменьшается. Новые условия отдельно согласует основная организация; основной договор не изменяется.</p>
  <button type="button" className="secondary-button" disabled={busy} onClick={()=>void load()}>Загрузить условия аренды</button>
  {error&&<p role="alert">{error}</p>}{rows?.length===0&&<p>Основных организаций с действующим договором для этого выступления нет.</p>}
  {rows?.map(row=>{const rule=value.find(item=>item.organizationId===row.organizationId)?.compensation??row.compensation;
   const changeKind=(kind:string)=>update(row.organizationId,kind==="none"?{kind:"none"}:kind==="fixed"?{kind:"fixed",amount:0}:kind==="percent"?{kind:"percent",basisPoints:0,basis:"organization_prizes"}:{kind:"combined",amount:0,basisPoints:0,basis:"organization_prizes",selection:"maximum"});
   return <fieldset key={row.organizationId} className="space-y-3 rounded border border-slate-700 p-3"><legend>{row.name}</legend>
    <label>Компенсация за аренду<select className={inputClass} value={rule.kind} onChange={e=>changeKind(e.target.value)}><option value="none">Без компенсации</option><option value="fixed">Фиксированная сумма</option><option value="percent">Процент</option><option value="combined">Сумма и процент: большее/меньшее</option></select></label>
    {(rule.kind==="fixed"||rule.kind==="combined")&&<label>Фиксированная сумма, OC<input className={inputClass} type="number" min={0} max={1e12} step={1} required value={rule.amount} onChange={e=>update(row.organizationId,{...rule,amount:Number(e.target.value)})}/></label>}
    {(rule.kind==="percent"||rule.kind==="combined")&&<><label>Процент компенсации<input className={inputClass} type="number" min={0} max={100} step={0.01} required value={rule.basisPoints/100} onChange={e=>update(row.organizationId,{...rule,basisPoints:Math.round(Number(e.target.value)*100)})}/></label>
     <label>Основание процента<select className={inputClass} value={rule.basis} onChange={e=>update(row.organizationId,{...rule,basis:e.target.value as typeof rule.basis})}>{Object.entries(rentalBasisLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
     <p className="text-xs text-slate-400">{rule.basis==="organization_prizes"?"Обеспеченные призы за место до распределения игрокам плюс личные награды в части, причитающейся организации. Только выбранное выступление.":"Фактически выплаченные по этому договору аренды бонус за подписание, зарплата, участие, киллы/MVP/рейтинг и призовые доли, включая личные награды. Изменение редакции не исключает прежние выплаты; первоначальный бонус не повторяется. Возвраты и компенсации расторжения не входят."}</p></>}
    {rule.kind==="combined"&&<label>Как выбрать итог<select className={inputClass} value={rule.selection} onChange={e=>update(row.organizationId,{...rule,selection:e.target.value as typeof rule.selection})}><option value="maximum">Большее из суммы и процента</option><option value="minimum">Меньшее из суммы и процента</option></select></label>}
    <p className="text-sm text-slate-300">{describeRentalCompensation(rule)}</p>
   </fieldset>;
  })}
  <p className="text-sm text-slate-400">Фиксированная часть резервируется при подписании. После подтверждения участия производится расчёт; непокрытый остаток — долг нанявшей организации, погашаемый отдельно. По умолчанию все призы получает она; доли игрока задаются выше.</p>
 </section>;
}
type Fee={id:string|null;revision:number;organizationName:string;rule:RentalCompensation;accountingVersion:number;amount:number|null;paid:number;held:number;remaining:number;plan?:{basis?:{organizationPrizes:number;playerPayments:number}}};
export function RentalPayments({contractId}:{contractId:string}){
 const [data,setData]=useState<{rows:Fee[];canPay:boolean}|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[selected,setSelected]=useState<Fee|null>(null),[amount,setAmount]=useState("");
 const retry=useRef<{serialized:string;requestId:string}|null>(null);
 async function load(){try{const response=await authFetch(`/api/contracts?${new URLSearchParams({rentalPayments:"true",contractId})}`),value=await response.json();if(!response.ok)throw new Error(value.error);setData(value);return true;}catch(error){setMessage(error instanceof Error?error.message:"Ошибка чтения аренды");return false;}}
 async function pay(){
  if(!selected?.id)return;setBusy(true);setMessage("");const payload={action:"rental_pay",feeId:selected.id,amount:Number(amount)},serialized=JSON.stringify(payload);
  const operation=retry.current?.serialized===serialized?retry.current:{serialized,requestId:crypto.randomUUID()};retry.current=operation;
  try{const response=await authFetch("/api/contracts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,requestId:operation.requestId})}),result=await response.json();if(!response.ok)throw new Error(result.error);
   retry.current=null;setSelected(null);if(!await load()){setData(null);setMessage("Оплата подтверждена, но список не обновился. Обновите страницу; повторять перевод не нужно.");return;}setMessage("Компенсация перечислена со счёта нанявшей организации");
  }catch(error){setMessage(error instanceof TypeError?"Связь прервалась. Повторите ту же оплату: запрос защищён от повторного списания.":error instanceof Error?error.message:"Не удалось выполнить оплату");}finally{setBusy(false);}
 }
 return <section className="space-y-3"><button type="button" className="secondary-button" disabled={busy} onClick={()=>{setBusy(true);void load().finally(()=>setBusy(false));}}>Расчёты за аренду</button>
  {message&&<p role="status">{message}</p>}{data&&<div role="region" aria-label="Расчёты за аренду" className="space-y-3">{!data.rows.length&&<p>Компенсации основным организациям не предусмотрены.</p>}{data.rows.map((row,i)=><article key={row.id??i} className="rounded border border-slate-700 p-3"><h4 className="font-semibold">{row.organizationName} · редакция {row.revision}</h4>
   {row.accountingVersion===2?<><p className="text-sm">{describeRentalCompensation(row.rule)}</p><p>{row.amount===null?"Ожидаются подтверждённые итоги выступления":`Начислено ${row.amount.toLocaleString("ru-RU")} OC · оплачено ${row.paid.toLocaleString("ru-RU")} OC · долг ${row.remaining.toLocaleString("ru-RU")} OC`}. Резерв: {row.held.toLocaleString("ru-RU")} OC.</p>
    {data.canPay&&row.id&&row.remaining>0&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>{setSelected(row);setAmount(String(Math.min(row.remaining,1e12)));}}>Погасить долг за аренду</button>}</>:<p>Исторические расчёты прежнего гостевого договора сохранены. См. его условия и историю выплат.</p>}
  </article>)}</div>}
  {selected&&<div role="dialog" aria-label="Оплата аренды" className="space-y-3 rounded border border-cyan-700 p-4"><p>Перечислить компенсацию организации «{selected.organizationName}» со счёта нанявшей организации? Личный баланс владельца и чужие резервы не используются.</p>
   <label>Сумма оплаты аренды, OC<input className={inputClass} type="number" min={1} max={Math.min(selected.remaining,1e12)} step={1} value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   <button type="button" className="primary-button" disabled={busy||!Number.isSafeInteger(Number(amount))||Number(amount)<=0||Number(amount)>Math.min(selected.remaining,1e12)} onClick={()=>void pay()}>Подтвердить оплату аренды</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>setSelected(null)}>Отмена</button>
  </div>}
 </section>;
}
export function RentalIncoming(){
 const [rows,setRows]=useState<Array<{id:string;hostName:string;playerName:string;eventTitle:string}>>([]),[open,setOpen]=useState(false),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function load(append=false){setBusy(true);setError("");try{
  const response=await authFetch(`/api/contracts?${new URLSearchParams({rentalPayments:"true",offset:String(append?rows.length:0)})}`),value=await response.json();if(!response.ok)throw new Error(value.error);
  setRows(current=>append?[...current,...value.incoming]:value.incoming);setMore(value.hasMore);setOpen(true);
 }catch(caught){setError(caught instanceof Error?caught.message:"Не удалось загрузить аренду");}finally{setBusy(false);}}
 return <section className="space-y-3"><button type="button" className="secondary-button" disabled={busy} onClick={()=>open?setOpen(false):void load()}>Игроки ваших организаций в аренде</button>
  {error&&<p role="alert">{error}</p>}{open&&<div role="region" aria-label="Входящая аренда" className="space-y-3">{!rows.length&&<p>Подписанных аренд ваших игроков нет.</p>}{rows.map(row=><article key={row.id} className="cyber-card space-y-2 p-4"><h3>{row.playerName} → {row.hostName}</h3><p>{row.eventTitle}</p><RentalPayments contractId={row.id}/></article>)}{more&&<button type="button" className="secondary-button" disabled={busy} onClick={()=>void load(true)}>Ещё аренды</button>}</div>}
 </section>;
}
