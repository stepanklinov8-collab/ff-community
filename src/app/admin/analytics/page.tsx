"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {authFetch} from "@/utils/api/auth-fetch";
import {activityDuration,analyticsPageTitle} from "@/lib/analytics/model";
type Row={id:string;nickname:string;visits:number;views:number;seconds:number;first_at:string;last_at:string;online:boolean};
type History={path:string;started_at:string;last_seen_at:string;active_seconds:number;screen_kind:string};
type Report={summary:{users:number;visits:number;views:number;seconds:number;online:number};items:Row[];hasMore:boolean;history:History[]};
const date=(value:string)=>new Date(value).toLocaleString("ru-RU",{timeZone:"Europe/Moscow",dateStyle:"short",timeStyle:"short"});
const day=(value:number)=>new Date(value+3*3600000).toISOString().slice(0,10);
const field="rounded-lg border border-slate-600 bg-slate-950 p-2 text-white";
export default function AnalyticsPage(){
 const [from,setFrom]=useState(()=>day(Date.now()-6*86400000)),[to,setTo]=useState(()=>day(Date.now()));
 const [search,setSearch]=useState(""),[query,setQuery]=useState(""),[offset,setOffset]=useState(0),[user,setUser]=useState<Row|null>(null);
 const [data,setData]=useState<Report|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0);
 useEffect(()=>{const timer=setTimeout(()=>{setOffset(0);setQuery(search);},300);return()=>clearTimeout(timer);},[search]);
 useEffect(()=>{let alive=true;const controller=new AbortController();const params=new URLSearchParams({from,to,q:query,offset:String(offset)});if(user)params.set("userId",user.id);
  void authFetch(`/api/admin/analytics?${params}`,{signal:controller.signal}).then(async response=>{const report=await response.json();if(!response.ok)throw Error(report.error??"Не удалось загрузить статистику");if(alive){setData(report);setError("");}}).catch(e=>{if(alive)setError(e instanceof Error?e.message:"Ошибка связи");}).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;controller.abort();};
 },[from,to,query,offset,user,retry]);
 return <div className="page-shell space-y-5"><Link className="text-cyan-300" href="/admin">← Админ-панель</Link><h1 className="section-title">Активность пользователей</h1>
  <p className="text-slate-300">Посещения авторизованных аккаунтов с момента включения статистики. Время приблизительное: считается активная вкладка при недавнем взаимодействии. Две вкладки не удваивают время. Данные хранятся 90 дней.</p>
  <div className="flex flex-wrap gap-3"><label>С даты<input className={`${field} block`} type="date" value={from} onChange={e=>{setLoading(true);setOffset(0);setFrom(e.target.value);}}/></label><label>По дату<input className={`${field} block`} type="date" value={to} onChange={e=>{setLoading(true);setOffset(0);setTo(e.target.value);}}/></label><label>Никнейм<input className={`${field} block`} value={search} onChange={e=>setSearch(e.target.value)}/></label><button className="secondary-button" onClick={()=>{setLoading(true);setRetry(n=>n+1);}}>Обновить</button></div>
  {loading&&<p role="status">Загрузка статистики…</p>}{error&&<p role="alert" className="text-red-300">{error}</p>}
  {!error&&data&&<><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[["Пользователи",data.summary.users],["Визиты",data.summary.visits],["Страницы",data.summary.views],["Активное время",activityDuration(data.summary.seconds)],["Активны сейчас",data.summary.online]].map(([label,value])=><div className="cyber-card p-4" key={label}><p className="text-slate-400">{label}</p><strong className="text-xl">{value}</strong></div>)}</div>
   <div className="panel overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Игрок","Визиты","Страницы","Активное время","Первый визит в периоде","Последнее посещение",""].map((label,i)=><th className="p-3" key={i}>{label}</th>)}</tr></thead><tbody>{data.items.map(row=><tr key={row.id} className="border-t border-slate-700"><td className="p-3"><Link href={`/profile/${row.id}`} className="text-cyan-300">{row.nickname}</Link>{row.online&&<span className="ml-2 text-emerald-300">Активен</span>}</td><td className="p-3">{row.visits}</td><td className="p-3">{row.views}</td><td className="p-3">{activityDuration(row.seconds)}</td><td className="p-3">{date(row.first_at)}</td><td className="p-3">{date(row.last_at)}</td><td className="p-3"><button className="secondary-button" onClick={()=>{setLoading(true);setUser(row);}}>Посещения</button></td></tr>)}</tbody></table>{!data.items.length&&<p className="p-4">За выбранный период посещений пока нет.</p>}</div>
   <div className="flex gap-3"><button className="secondary-button" disabled={!offset} onClick={()=>{setLoading(true);setOffset(n=>Math.max(0,n-50));}}>Назад</button><button className="secondary-button" disabled={!data.hasMore} onClick={()=>{setLoading(true);setOffset(n=>n+50);}}>Далее</button></div>
   {user&&<section className="cyber-card space-y-3 p-4"><h2 className="text-xl font-bold">Посещения — {user.nickname}</h2><p className="text-slate-400">Последние 100 просмотров за выбранный период. Параметры ссылок и содержимое форм не сохраняются.</p><button className="secondary-button" onClick={()=>setUser(null)}>Закрыть историю</button>{data.history.map((row,i)=><div className="border-t border-slate-700 pt-3" key={i}><p>{analyticsPageTitle(row.path)}</p><p className="text-sm text-slate-400">{date(row.started_at)} · {row.screen_kind==="mobile"?"Телефон":"Компьютер"} · {activityDuration(row.active_seconds)}</p></div>)}</section>}
  </>}
 </div>;
}
