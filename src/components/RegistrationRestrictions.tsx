"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {authFetch} from "@/utils/api/auth-fetch";
type Restriction={id:string;reason:string;targetName:string;scope:string;endsAt:string|null;appealUrl:string;warnings:Array<{id:string;reason:string;issuedAt:string|null;expiresAt:string|null;eventUrl:string|null}>};
const date=(value:string)=>new Date(value).toLocaleString("ru-RU",{timeZone:"Europe/Moscow",dateStyle:"short",timeStyle:"short"})+" МСК";
export default function RegistrationRestrictions({eventId,teamId,roster=[],refreshKey=""}:{eventId:string;teamId?:string;roster?:string[];refreshKey?:string}){
 const [retry,setRetry]=useState(0),[state,setState]=useState<{key:string;rows:Restriction[];error:string}|null>(null);
 const ids=[...new Set(roster)].sort().join(","),key=`${eventId}:${teamId??"self"}:${ids}:${refreshKey}:${retry}`;
 useEffect(()=>{let alive=true;const controller=new AbortController(),params=new URLSearchParams();if(teamId)params.set("teamId",teamId);if(ids)params.set("roster",ids);
  void authFetch(`/api/events/${eventId}/eligibility?${params}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error??"Не удалось проверить ограничения");if(alive)setState({key,rows:d.restrictions??[],error:""});}).catch(e=>{if(alive)setState({key,rows:[],error:e instanceof Error?e.message:"Ошибка связи"});});
  return()=>{alive=false;controller.abort();};
 },[eventId,teamId,ids,key]);
 if(state?.key!==key)return <p className="mb-3 text-sm text-slate-400" role="status">Проверяем ограничения участия…</p>;
 if(state.error)return <div className="mb-3 text-sm text-amber-200"><p>{state.error}. При отправке заявки ограничения проверяются повторно.</p><button className="secondary-button mt-2" onClick={()=>setRetry(n=>n+1)}>Повторить проверку</button></div>;
 if(!state.rows.length)return null;
 return <section aria-label="Ограничения участия" className="mb-4 space-y-3 rounded-lg border border-amber-500/50 bg-amber-950/30 p-4"><h3 className="font-semibold text-amber-100">Есть ограничения участия</h3>{state.rows.map(row=><article key={row.id} className="space-y-2 text-sm"><p><strong>{row.targetName}</strong>: {row.reason}</p><p>{row.scope} · {row.endsAt?`До ${date(row.endsAt)}`:"Без срока окончания"}</p>{!!row.warnings.length&&<details><summary className="cursor-pointer">Основания: {row.warnings.length} предупреждения</summary><ul className="mt-2 space-y-2">{row.warnings.map(w=><li key={w.id}>{w.reason} · {w.issuedAt?date(w.issuedAt):"Дата не указана"} · {w.expiresAt?`Срок до ${date(w.expiresAt)}`:"Бессрочное"}{w.eventUrl&&<> · <Link className="text-cyan-300 underline" href={w.eventUrl}>Мероприятие</Link></>}</li>)}</ul></details>}<Link className="inline-block text-cyan-300 underline" href={row.appealUrl}>Обжаловать ограничение</Link></article>)}</section>;
}
