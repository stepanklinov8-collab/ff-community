"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {usePathname,useRouter,useSearchParams} from "next/navigation";
import {useLanguage} from "./LanguageProvider";
import {competitionText} from "@/i18n/competition";
import CompetitionTable from "./CompetitionTable";
import type {Game,GameResult,Standing} from "@/lib/competition/model";
interface PublicSession{id:string;startTime:string;publicId:string;publishedAt:string|null;correctedAt:string|null;games:Game[];results:{rows:GameResult[];standings:Standing[];mvps:string[];mode:string;criterion:string;prizes?:Array<{registrationId:string;amount:number}>}|null}
interface Payload{event:{id:string;title:string;type:string};selectedSessionId?:string|null;sessions:PublicSession[];results:Array<{id:string;team_id:string;team_name:string;score:number;is_winner:boolean;mvp_user_id:string|null;mvp_nickname:string}>}
export default function PublicCompetitionResults({eventId}:{eventId:string}){
 const {locale}=useLanguage();const t=(key:Parameters<typeof competitionText>[1])=>competitionText(locale,key);
 const params=useSearchParams(),pathname=usePathname(),router=useRouter(),requested=params.get("sessionId");
 const [loaded,setLoaded]=useState<{key:string;data:Payload|null;error:string}|null>(null),[retry,setRetry]=useState(0);
 const key=`${eventId}:${requested??"latest"}:${retry}`;
 useEffect(()=>{let active=true;const controller=new AbortController();
  void fetch(`/api/events/${eventId}/results${requested?`?sessionId=${encodeURIComponent(requested)}`:""}`,{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])})
   .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error??"Не удалось загрузить результаты");if(active)setLoaded({key,data,error:""});})
   .catch(e=>{if(active)setLoaded({key,data:null,error:e instanceof Error?e.message:"Ошибка связи"});});
  return()=>{active=false;controller.abort();};
 },[eventId,requested,key]);
 const data=loaded?.key===key?loaded.data:null,error=loaded?.key===key?loaded.error:"";
 if(!data)return <main className="page-shell">{error?<><p role="alert">{error}</p><button className="secondary-button mt-3" onClick={()=>setRetry(n=>n+1)}>Повторить</button><Link className="ml-4 text-cyan-300" href={pathname}>Последние результаты</Link></>:<p role="status">{t("loading")}</p>}</main>;
 const session=data.selectedSessionId??data.sessions.find(s=>s.results)?.id??data.sessions[0]?.id??"";
 const selected=data.sessions.find(s=>s.id===session),results=selected?.results;
 const mvps=results?.mvps.map(id=>results.rows.flatMap(r=>r.players).find(p=>p.userId===id)).filter(Boolean)??[];
 return <main className="page-shell space-y-5"><Link className="text-cyan-300" href={`/tournaments/${eventId}${session?`?sessionId=${session}`:""}`}>← {t("back")}</Link><h1 className="text-3xl font-black">{data.event.title}</h1><h2 className="text-xl">{t("results")}</h2><div className="flex flex-wrap items-end gap-3">{data.sessions.length>0&&<label className="min-w-0 max-w-full">{t("session")}<select className="mt-2 block max-w-full" value={session} onChange={e=>{const next=new URLSearchParams(params.toString());next.set("sessionId",e.target.value);router.push(`${pathname}?${next}`,{scroll:false});}}>{data.sessions.map(s=><option key={s.id} value={s.id}>{s.publicId} · {new Date(s.startTime).toLocaleString(locale==="ru"?"ru-RU":locale==="kk"?"kk-KZ":"ky-KG",{timeZone:"Europe/Moscow"})} МСК</option>)}</select></label>}<button className="secondary-button" onClick={()=>setRetry(n=>n+1)}>Обновить результаты</button></div>
 {results?<section className="cyber-card space-y-4 p-4">{selected?.correctedAt&&<p className="text-sm text-white/50">{t("corrected")}: {new Date(selected.correctedAt).toLocaleString("ru-RU",{timeZone:"Europe/Moscow"})} МСК</p>}<CompetitionTable standings={results.standings} rows={results.rows} games={selected?.games} mode={results.mode} criterion={results.criterion}/>{results.prizes?.map(p=><p key={p.registrationId} className="text-amber-300">{results.standings.find(s=>s.registrationId===p.registrationId)?.name}: {p.amount.toLocaleString("ru-RU")} 🪙</p>)}{!!mvps.length&&<p>MVP: {mvps.map(p=><Link key={p!.userId} className="mr-3 text-amber-300" href={`/profile/${p!.userId}`}>{p!.nickname}</Link>)}</p>}</section>:<p>{t("waiting")}</p>}
 {!data.sessions.some(s=>s.results)&&data.results.length>0&&<div className="space-y-3">{data.results.map(r=><article key={r.id} className="cyber-card p-4"><Link href={`/teams/${r.team_id}`} className="text-cyan-300">{r.team_name}</Link> · {r.score} {r.is_winner?"🏆":""}{r.mvp_user_id&&<p>MVP: <Link href={`/profile/${r.mvp_user_id}`}>{r.mvp_nickname}</Link></p>}</article>)}</div>}</main>;
}
