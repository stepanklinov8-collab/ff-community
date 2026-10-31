"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {authFetch} from "@/platform/browser-services";
type Message={id:string;senderId:string;name:string;body:string;replyTo:string|null;createdAt:string};
export default function DealChat({dealId,canMessage}:{dealId:string;canMessage:boolean}){
 const[open,setOpen]=useState(false),[rows,setRows]=useState<Message[]>([]),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[sending,setSending]=useState(false),[body,setBody]=useState(""),[reply,setReply]=useState<Message|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const pending=useRef<{fingerprint:string;requestId:string}|null>(null),acked=useRef("0"),readingOlder=useRef(false);
 const load=useCallback(async(older=false,before?:string)=>{
  const query=new URLSearchParams({dealId,chat:"true"});if(older&&before)query.set("before",before);
  const response=await authFetch(`/api/market?${query}`),data=await response.json();if(!response.ok)throw new Error(data.error??"Не удалось загрузить обсуждение");
  setRows(current=>older?[...new Map([...current,...data.messages].map((row:Message)=>[row.id,row])).values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1):data.messages);
  readingOlder.current=older;setMore(data.hasMore);
  if(!older){const newest=(data.messages as Message[]).at(-1)?.id;if(newest&&BigInt(newest)>BigInt(acked.current)){
   const result=await authFetch("/api/market",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"read",requestId:crypto.randomUUID(),dealId,lastSeen:newest})});if(result.ok)acked.current=newest;
  }}
 },[dealId]);
 async function show(older=false){setBusy(true);setError("");try{await load(older,older?rows[0]?.id:undefined);setOpen(true);}catch(cause){setError(cause instanceof TypeError?"Связь прервалась. Повторите загрузку обсуждения.":cause instanceof Error?cause.message:"Не удалось загрузить обсуждение");}finally{setBusy(false);}}
 useEffect(()=>{if(!open)return;const timer=setInterval(()=>{if(!document.hidden&&!readingOlder.current)void load().catch(()=>setError("Не удалось обновить обсуждение. Сохранённые сообщения остаются в истории."));},30000);return()=>clearInterval(timer);},[open,load]);
 async function send(){setSending(true);setError("");setNotice("");let confirmed=false;try{
  const value={action:"message",dealId,body:body.trim(),replyTo:reply?.id??null},fingerprint=JSON.stringify(value);
  if(!pending.current||pending.current.fingerprint!==fingerprint)pending.current={fingerprint,requestId:crypto.randomUUID()};
  const response=await authFetch("/api/market",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...value,requestId:pending.current.requestId})}),data=await response.json();if(!response.ok)throw new Error(data.error??"Не удалось отправить сообщение");
  confirmed=true;pending.current=null;setBody("");setReply(null);setNotice("Сообщение отправлено");await load();
 }catch(cause){setError(confirmed?"Сообщение отправлено, но история не обновилась. Нажмите «Обновить обсуждение».":cause instanceof TypeError?"Ответ не получен. Повторная отправка этого текста не создаст второе сообщение.":cause instanceof Error?cause.message:"Не удалось отправить сообщение");}finally{setSending(false);}}
 return <section aria-label="Обсуждение сделки" className="space-y-3 rounded-xl border border-slate-700 p-4">
  <button className="secondary-button" disabled={busy} onClick={()=>open?setOpen(false):void show()}>Обсуждение сделки</button>
  {error&&<p role="alert" className="text-red-300">{error}</p>}{notice&&<p role="status" className="text-cyan-200">{notice}</p>}
  {open&&<><p className="text-sm text-slate-300">Переписка видна сторонам и их действующим представителям. Администрация получает доступ при открытии спора. Сообщения сохраняются в истории.</p>
   {more&&<button className="secondary-button" disabled={busy} onClick={()=>void show(true)}>Предыдущие сообщения</button>}
   <div className="max-h-96 space-y-3 overflow-y-auto">{!rows.length&&<p>Сообщений пока нет.</p>}{rows.map(row=><article className="rounded border border-slate-700 p-3" key={row.id}><p className="text-sm text-cyan-200">{row.name} · {new Date(row.createdAt).toLocaleString("ru-RU")}</p>{row.replyTo&&<p className="text-xs text-slate-400">Ответ на сообщение #{row.replyTo}</p>}<p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{row.body}</p>{canMessage&&<button className="text-sm text-cyan-300" onClick={()=>setReply(row)}>Ответить</button>}</article>)}</div>
   <button className="secondary-button" disabled={busy} onClick={()=>void show()}>Обновить обсуждение</button>
   {canMessage?<form className="space-y-2" onSubmit={event=>{event.preventDefault();void send();}}>{reply&&<p className="text-sm">Ответ: {reply.name} <button type="button" className="text-cyan-300" onClick={()=>setReply(null)}>Отменить ответ</button></p>}<label className="block">Сообщение<textarea className="w-full rounded border border-slate-600 bg-slate-950 p-2" required minLength={1} maxLength={4000} value={body} onChange={event=>setBody(event.target.value)}/></label><button className="primary-button" disabled={sending||!body.trim()}>Отправить сообщение</button></form>:<p>Завершённый спор доступен администрации для чтения.</p>}
  </>}
 </section>;
}
