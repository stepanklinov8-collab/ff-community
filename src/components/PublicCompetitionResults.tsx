"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useLanguage} from "./LanguageProvider";
import {competitionText} from "@/i18n/competition";
import CompetitionTable from "./CompetitionTable";
import type {Game,GameResult,Standing} from "@/lib/competition/model";
interface PublicSession{id:string;startTime:string;publicId:string;publishedAt:string|null;correctedAt:string|null;games:Game[];results:{rows:GameResult[];standings:Standing[];mvps:string[];mode:string;criterion:string}|null}
interface Payload{event:{id:string;title:string;type:string};sessions:PublicSession[];results:Array<{id:string;team_id:string;team_name:string;score:number;is_winner:boolean;mvp_user_id:string|null;mvp_nickname:string}>}
export default function PublicCompetitionResults({eventId}:{eventId:string}){
 const {locale}=useLanguage();const t=(key:Parameters<typeof competitionText>[1])=>competitionText(locale,key);
 const [data,setData]=useState<Payload|null>(null),[session,setSession]=useState(""),[error,setError]=useState("");
 useEffect(()=>{let active=true;void fetch(`/api/events/${eventId}/results`).then(async r=>{const value=await r.json();if(!r.ok)throw new Error(value.error);if(active){setData(value);const requested=new URLSearchParams(window.location.search).get("sessionId");setSession(value.sessions.find((s:PublicSession)=>s.id===requested)?.id??value.sessions.find((s:PublicSession)=>s.results)?.id??value.sessions[0]?.id??"");}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[eventId]);
 if(!data)return <main className="page-shell"><p role="status">{error||t("loading")}</p></main>;
 const selected=data.sessions.find(s=>s.id===session),results=selected?.results;
 const mvps=results?.mvps.map(id=>results.rows.flatMap(r=>r.players).find(p=>p.userId===id)).filter(Boolean)??[];
 return <main className="page-shell space-y-5"><Link className="text-cyan-300" href={`/tournaments/${eventId}`}>← {t("back")}</Link><h1 className="text-3xl font-black">{data.event.title}</h1><h2 className="text-xl">{t("results")}</h2>{data.sessions.length>0&&<label>{t("session")}<select className="ml-3" value={session} onChange={e=>setSession(e.target.value)}>{data.sessions.map(s=><option key={s.id} value={s.id}>{s.publicId} · {new Date(s.startTime).toLocaleString(locale==="ru"?"ru-RU":locale==="kk"?"kk-KZ":"ky-KG",{timeZone:"Europe/Moscow"})} МСК</option>)}</select></label>}
 {results?<section className="cyber-card space-y-4 p-4">{selected?.correctedAt&&<p className="text-sm text-white/50">{t("corrected")}: {new Date(selected.correctedAt).toLocaleString("ru-RU",{timeZone:"Europe/Moscow"})} МСК</p>}<CompetitionTable standings={results.standings} rows={results.rows} games={selected?.games} mode={results.mode} criterion={results.criterion}/>{!!mvps.length&&<p>MVP: {mvps.map(p=><Link key={p!.userId} className="mr-3 text-amber-300" href={`/profile/${p!.userId}`}>{p!.nickname}</Link>)}</p>}</section>:<p>{t("waiting")}</p>}
 {!data.sessions.some(s=>s.results)&&data.results.length>0&&<div className="space-y-3">{data.results.map(r=><article key={r.id} className="cyber-card p-4"><Link href={`/teams/${r.team_id}`} className="text-cyan-300">{r.team_name}</Link> · {r.score} {r.is_winner?"🏆":""}{r.mvp_user_id&&<p>MVP: <Link href={`/profile/${r.mvp_user_id}`}>{r.mvp_nickname}</Link></p>}</article>)}</div>}</main>;
}
