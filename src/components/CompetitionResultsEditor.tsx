"use client";
import Link from "next/link";
import {useCallback,useEffect,useRef,useState} from "react";
import {authFetch} from "@/utils/api/auth-fetch";
import {useLanguage} from "@/components/LanguageProvider";
import {competitionText} from "@/i18n/competition";
import ResultsImport from "./ResultsImport";
import CompetitionEvidence from "./CompetitionEvidence";
import {mergeRecognizedRows} from "@/lib/competition/import";
import {replaceWithGuest} from "@/lib/competition/result-editor";
import {emptyDraft,type CompetitionContext,type Draft,type ResultInput,type PublishedResults,type ValidationIssue} from "@/lib/competition/model";

interface Loaded {
 event:{id:string;title:string;type:string};sessions:Array<{id:string;start_time:string}>;session:{id:string};
 groups:Array<{id:string;public_number:number;name:string}>;publicId:string;context:CompetitionContext;
 draft:Draft;published:PublishedResults|null;revision:number;configurationRevision:number;firstPublishedAt:string|null;correctedAt:string|null;
 legacySeeded?:number;
 canEdit:boolean;canRank:boolean;isAdmin:boolean;
 consent?:{revision:number;awaiting:boolean;disputed:boolean;ownTeams:Array<{id:string;name:string}>;sides:Array<{id:string;name:string;approved:boolean}>};
 candidate?:PublishedResults|null;
}
export function ResultsTable({results}:{results:Pick<PublishedResults,"standings">}){
 const {locale}=useLanguage();const t=(key:Parameters<typeof competitionText>[1])=>competitionText(locale,key);
 return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{[t("place"),t("target"),t("games"),t("wins"),t("kills"),t("points")].map(s=><th key={s} className="p-2">{s}</th>)}</tr></thead><tbody>{results.standings.map(row=><tr key={row.registrationId} className="border-t border-white/10"><td className="p-2">{row.place}</td><td className="p-2"><Link href={row.teamId?`/teams/${row.teamId}`:`/profile/${row.userId}`} className="text-cyan-300">{row.name}</Link></td><td className="p-2">{row.gamesPlayed}</td><td className="p-2">{row.wins}</td><td className="p-2">{row.kills}</td><td className="p-2">{row.points}</td></tr>)}</tbody></table></div>;
}
export default function CompetitionResultsEditor({eventId,kind="event"}:{eventId:string;kind?:"event"|"clan-war"}){
 const endpoint=kind==="clan-war"?`/api/clan-wars/${eventId}/results`:`/api/admin/events/${eventId}/competition-results`;
 const {locale}=useLanguage();const t=useCallback((key:Parameters<typeof competitionText>[1])=>competitionText(locale,key),[locale]);
 const [loaded,setLoaded]=useState<Loaded|null>(null),[draft,setDraft]=useState<Draft|null>(null),[message,setMessage]=useState("");
 const [busy,setBusy]=useState(false),[query,setQuery]=useState(""),[group,setGroup]=useState(""),[visible,setVisible]=useState(15);
 const [issues,setIssues]=useState<ValidationIssue[]>([]),[preview,setPreview]=useState<PublishedResults|null>(null),[approveRemoval,setApproveRemoval]=useState(false);
 const [removedRegistrationIds,setRemovedRegistrationIds]=useState<string[]>([]);
 const dataRef=useRef(loaded),draftRef=useRef(draft),savedRef=useRef(""),inFlight=useRef(false);
 const retryRef=useRef<{serialized:string;requestId:string}|null>(null);
 const loadVersion=useRef(0);
 const textRef=useRef(t);useEffect(()=>{textRef.current=t;},[t]);
 useEffect(()=>{dataRef.current=loaded;},[loaded]);useEffect(()=>{draftRef.current=draft;},[draft]);
 const load=useCallback(async(sessionId?:string)=>{
  const version=++loadVersion.current;
  setBusy(true);try{const response=await authFetch(`${endpoint}${sessionId?`?sessionId=${sessionId}`:""}`);const value=await response.json();if(version!==loadVersion.current)return;if(!response.ok)throw new Error(value.error);
   if(!value.context){setMessage(textRef.current("noParticipants"));return;}
   const result=value as Loaded;
   const saved=result.draft;
   const oldByKey=new Map(saved.rows.map(r=>[`${r.gameId}:${r.registrationId}`,r]));
   const merged={...saved,rows:emptyDraft(result.context).rows.map(r=>oldByKey.get(`${r.gameId}:${r.registrationId}`)??r)};
   setLoaded(result);setRemovedRegistrationIds([]);setDraft(merged);dataRef.current=result;draftRef.current=merged;savedRef.current=JSON.stringify(merged);retryRef.current=null;setIssues([]);setMessage("");setPreview(null);
  }catch(error){if(version===loadVersion.current)setMessage(error instanceof Error?error.message:textRef.current("failed"));}finally{if(version===loadVersion.current)setBusy(false);}
 },[endpoint]);
 useEffect(()=>{const versionRef=loadVersion;const timer=setTimeout(()=>void load(new URLSearchParams(window.location.search).get("sessionId")??undefined),0);return()=>{clearTimeout(timer);versionRef.current++;};},[load]);
 const send=useCallback(async(action:"draft"|"validate"|"publish",quiet=false)=>{
  const current=dataRef.current,content=draftRef.current;if(!current||!content||inFlight.current)return;
  inFlight.current=true;setBusy(true);
  const serialized=JSON.stringify({action,sessionId:current.session.id,revision:current.revision,configurationRevision:current.configurationRevision,draft:content,approveRemoval,removedRegistrationIds});
  const requestId=retryRef.current?.serialized===serialized?retryRef.current.requestId:crypto.randomUUID();retryRef.current={serialized,requestId};
  try{
   const response=await authFetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...JSON.parse(serialized),requestId}),keepalive:quiet&&serialized.length<60_000});
   const value=await response.json();if(!response.ok){setIssues(value.issues??[]);throw new Error(response.status===409?t("conflict"):value.error??t("failed"));}
   retryRef.current=null;setIssues([]);
   if(action==="validate")setPreview(value.results);
   else{
    savedRef.current=JSON.stringify(content);
    const next={...current,revision:value.revision,configurationRevision:value.configurationRevision??current.configurationRevision,firstPublishedAt:action==="publish"&&value.published?current.firstPublishedAt??new Date().toISOString():current.firstPublishedAt};
    dataRef.current=next;setLoaded(next);setMessage(action==="draft"?t("saved"):t("published"));if(action!=="draft")setPreview(null);
    if(action!=="draft"&&(kind==="clan-war"||removedRegistrationIds.length)){await load(current.session.id);if(value.awaitingApproval)setMessage(t("awaitingSides"));}
   }
  }catch(error){setMessage(error instanceof Error?error.message:t("failed"));}finally{inFlight.current=false;setBusy(false);}
 },[endpoint,kind,load,approveRemoval,removedRegistrationIds,t]);
 const consentAction=async(action:"approve"|"dispute"|"resolve",teamId?:string)=>{
  const current=dataRef.current;if(!current||inFlight.current)return;
  if(JSON.stringify(draftRef.current)!==savedRef.current){setMessage(t("saveBeforeConsent"));return;}
  inFlight.current=true;setBusy(true);
  try{const response=await authFetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,teamId,revision:current.revision,configurationRevision:current.configurationRevision,requestId:crypto.randomUUID()})});const value=await response.json();if(!response.ok)throw new Error(value.error);await load();}
  catch(error){setMessage(error instanceof Error?error.message:t("failed"));}finally{inFlight.current=false;setBusy(false);}
 };
 useEffect(()=>{
  const saveOnClose=()=>{if(!dataRef.current?.firstPublishedAt&&draftRef.current&&JSON.stringify(draftRef.current)!==savedRef.current)void send("draft",true);};
  const leave=(event:BeforeUnloadEvent)=>{if(draftRef.current&&JSON.stringify(draftRef.current)!==savedRef.current){event.preventDefault();event.returnValue="";saveOnClose();}};
  const hidden=()=>{if(document.visibilityState==="hidden")saveOnClose();};
  const pagehide=()=>saveOnClose();
  window.addEventListener("beforeunload",leave);window.addEventListener("pagehide",pagehide);document.addEventListener("visibilitychange",hidden);
  return()=>{window.removeEventListener("beforeunload",leave);window.removeEventListener("pagehide",pagehide);document.removeEventListener("visibilitychange",hidden);};
 },[send]);
 const updateRow=(row:ResultInput,patch:Partial<ResultInput>)=>setDraft(previous=>previous?{...previous,rows:previous.rows.map(item=>item.gameId===row.gameId&&item.registrationId===row.registrationId?{...item,...patch}:item)}:previous);
 if(!loaded||!draft)return <div className="page-shell"><p role="status">{message||t("loading")}</p></div>;
 const context=loaded.context,roundMode=["bo","kv"].includes(context.rules.mode);
 const selected=context.entrants.filter(e=>(!group||e.groupId===group)&&e.name.toLowerCase().includes(query.toLowerCase()));
 const number=(value:string)=>value===""?null:Number(value);
 const addWarning=(targetId:string,targetType:"player"|"team",source:"manual"|"no_show"="manual")=>setDraft(prev=>prev?{...prev,warnings:[...prev.warnings,{id:crypto.randomUUID(),targetId,targetType,source,gameId:null,reason:source==="no_show"?t("noShow"):"",duration:null,penalty:null}]}:prev);
 return <main className="page-shell space-y-5"><Link href={kind==="clan-war"?`/clan-wars/${eventId}`:`/tournaments/${eventId}`} className="text-cyan-300">← {t("back")}</Link><div><p className="section-kicker">{t("results")}</p><h1 className="text-3xl font-black">{loaded.event.title}</h1></div>
 <div className="flex flex-wrap gap-3"><label>{t("session")}<select value={loaded.session.id} disabled={busy} onChange={async e=>{if(JSON.stringify(draftRef.current)!==savedRef.current){if(dataRef.current?.firstPublishedAt){setMessage(t("failed"));return;}await send("draft");if(JSON.stringify(draftRef.current)!==savedRef.current)return;}void load(e.target.value);}}>{loaded.sessions.map(s=><option key={s.id} value={s.id}>{new Date(s.start_time).toLocaleString(locale==="ru"?"ru-RU":locale==="kk"?"kk-KZ":"ky-KG",{timeZone:"Europe/Moscow"})} МСК</option>)}</select></label><label>{t("group")}<select value={group} onChange={e=>{setGroup(e.target.value);setVisible(15);}}><option value="">{t("allGroups")}</option>{loaded.groups.map(g=><option key={g.id} value={g.id}>{g.public_number}. {g.name}</option>)}</select></label><label>{t("search")}<input value={query} onChange={e=>{setQuery(e.target.value);setVisible(15);}}/></label></div>
 <div className="flex flex-wrap items-center gap-3"><span>{loaded.firstPublishedAt?t("published"):t("draft")}</span><code>{loaded.publicId}</code><button className="secondary-button" onClick={()=>void navigator.clipboard.writeText(loaded.publicId).then(()=>setMessage(t("copied")))}>{t("copy")}</button>{loaded.correctedAt&&<span>{t("corrected")}: {new Date(loaded.correctedAt).toLocaleString("ru-RU",{timeZone:"Europe/Moscow"})}</span>}</div>
 {message&&<p role="status" className="rounded-xl border border-white/15 p-3">{message}</p>}{issues.length>0&&<ul className="rounded-xl border border-red-500/40 p-4 text-red-300">{issues.map((issue,i)=><li key={i}>{[context.entrants.find(e=>e.id===issue.registrationId)?.name,context.games.find(g=>g.id===issue.gameId)?.publicId,issue.message].filter(Boolean).join(" · ")}</li>)}</ul>}
 {loaded.consent&&<section className="cyber-card space-y-3 p-4"><h2 className="font-bold">{t("sideConsent")}</h2><p>{loaded.consent.disputed?t("disputeReview"):t("awaitingSides")}</p>{loaded.consent.sides.map(side=><p key={side.id}>{side.name}: {side.approved?t("confirmedSide"):t("pending")}</p>)}{loaded.candidate&&<details><summary>{t("review")}</summary><ResultsTable results={loaded.candidate}/></details>}<div className="flex flex-wrap gap-2">{loaded.consent.awaiting&&loaded.canEdit&&loaded.consent.ownTeams.map(team=><div key={team.id} className="flex gap-2"><button className="primary-button" disabled={busy||loaded.consent?.disputed||loaded.consent?.sides.find(s=>s.id===team.id)?.approved} onClick={()=>void consentAction("approve",team.id)}>{t("confirmedSide")}: {team.name}</button><button className="secondary-button" disabled={busy} onClick={()=>void consentAction("dispute",team.id)}>{t("disagree")}</button></div>)}{loaded.isAdmin&&loaded.consent.awaiting&&<button className="primary-button" disabled={busy} onClick={()=>void consentAction("resolve")}>{t("adminResolve")}</button>}</div></section>}
 {!!loaded.legacySeeded&&<p className="text-amber-200">{locale==="ru"?"Из старой таблицы перенесены известные командные показатели. Личные результаты и остальные игры заполните перед публикацией.":locale==="kk"?"Ескі кестеден белгілі командалық көрсеткіштер көшірілді. Жеке нәтижелер мен қалған ойындарды жариялау алдында толтырыңыз.":"Эски таблицадан белгилүү командалык көрсөткүчтөр көчүрүлдү. Жеке жыйынтыктарды жана калган оюндарды жарыялоого чейин толтуруңуз."}</p>}
 {!loaded.canEdit&&<p>{t("readOnly")}</p>}
  {kind==="event"&&loaded.isAdmin&&loaded.firstPublishedAt&&<details className="cyber-card p-4"><summary>{t("approveRemoval")}</summary><p className="mt-2 text-sm">{t("removalConsequences")}</p>{context.entrants.map(e=><label key={e.id} className="mt-2 block"><input type="checkbox" checked={removedRegistrationIds.includes(e.id)} onChange={event=>setRemovedRegistrationIds(ids=>event.target.checked?[...ids,e.id]:ids.filter(id=>id!==e.id))}/> {e.name}</label>)}</details>}
<fieldset disabled={!loaded.canEdit||busy} className="space-y-4">
 {selected.slice(0,visible).map(entrant=><details key={entrant.id} className="cyber-card p-4"><summary className="cursor-pointer font-bold">{entrant.name} <span className="ml-2 text-xs text-white/50">{t("group")} {loaded.groups.find(g=>g.id===entrant.groupId)?.public_number}</span></summary><div className="mt-4 space-y-4">{context.games.filter(g=>g.groupId===entrant.groupId).sort((a,b)=>a.number-b.number).map((game,gameIndex,ownGames)=>{
 const row=draft.rows.find(r=>r.gameId===game.id&&r.registrationId===entrant.id);if(!row)return null;
 const hasError=issues.some(i=>i.registrationId===entrant.id&&i.gameId===game.id);
 return <details open key={game.id} className={`rounded-xl border p-3 ${hasError?"border-red-500":"border-white/10"}`}><summary>{t("game")} {game.number} · {game.map} · {game.publicId}</summary><div className="mt-3 grid gap-3 sm:grid-cols-3"><label>{t("played")}<select value={row.played===null?"":String(row.played)} onChange={e=>updateRow(row,{played:e.target.value===""?null:e.target.value==="true",...(e.target.value==="false"?{place:null,kills:0,rounds:null}: {})})}><option value="">{t("choose")}</option><option value="true">{t("played")}</option><option value="false">{t("notPlayed")}</option></select></label>{row.played===false?<label>{t("reason")}<select value={row.reason} onChange={e=>updateRow(row,{reason:e.target.value as ResultInput["reason"]})}><option value="no_show">{t("noShow")}</option><option value="technical">{t("technical")}</option></select></label>:<>
 <label>{roundMode?t("rounds"):t("place")}<input type="number" min={roundMode?0:1} max={roundMode?7:undefined} value={(roundMode?row.rounds:row.place)??""} onChange={e=>updateRow(row,roundMode?{rounds:number(e.target.value)}:{place:number(e.target.value)})}/></label>
 {!entrant.userId&&<label>{t("detail")}<select value={row.detail} onChange={e=>updateRow(row,{detail:e.target.value as ResultInput["detail"]})}><option value="players">{t("detail")}</option><option value="team">{t("teamOnly")}</option></select></label>}
 </>}</div>
 {row.played!==false&&(row.detail==="team"?<label className="mt-3 block">{t("kills")}<input type="number" min={0} value={row.kills??""} onChange={e=>updateRow(row,{kills:number(e.target.value)})}/></label>:<div className="mt-3 space-y-2">{row.players.map((player,index)=><div key={player.id} role="group" aria-label={`${player.userId?entrant.roster.find(p=>p.id===player.userId)?.nickname:t("guest")} · ${game.publicId}`} className={`grid gap-2 rounded-lg bg-white/[.03] p-3 sm:grid-cols-6 ${!player.played?"opacity-50":""}`}><span className="sm:col-span-2">{player.userId?entrant.roster.find(p=>p.id===player.userId)?.nickname:t("guest")}{!player.played&&<small className="block">{t("notPlayed")}</small>}</span><label><input type="checkbox" checked={player.played} onChange={e=>updateRow(row,{players:row.players.map((p,i)=>i===index?{...p,played:e.target.checked,...(!e.target.checked?{kills:0,deaths:0,assists:0}: {})}:p)})}/> {t("played")}</label>{(["kills",...(roundMode?["deaths","assists"]:[])] as const).map(field=><label key={field}>{t(field as "kills"|"deaths"|"assists")}<input type="number" min={0} disabled={!player.played} value={player[field as "kills"|"deaths"|"assists"]??""} onChange={e=>updateRow(row,{players:row.players.map((p,i)=>i===index?{...p,[field]:number(e.target.value)}:p)})}/></label>)}{player.userId&&!entrant.userId&&player.played&&<button type="button" className="text-left text-cyan-300 sm:col-span-2" onClick={()=>updateRow(row,{players:replaceWithGuest(row,player.id,crypto.randomUUID()).players})}>{t("replaceGuest")}</button>}{!player.userId&&<button type="button" className="text-red-300" onClick={()=>updateRow(row,{players:row.players.filter((_,i)=>i!==index)})}>{t("remove")}</button>}</div>)}
 {!entrant.userId&&<p className="text-sm text-slate-400">{t("guestHelp")}</p>}{!entrant.userId&&<div className="flex flex-wrap gap-2"><button type="button" className="secondary-button" onClick={()=>updateRow(row,{players:[...row.players,{id:crypto.randomUUID(),userId:null,played:true,kills:null,deaths:null,assists:null}]})}>{t("addGuest")}</button>{ownGames[gameIndex+1]&&<button type="button" className="secondary-button" onClick={()=>{const next=draft.rows.find(r=>r.gameId===ownGames[gameIndex+1].id&&r.registrationId===entrant.id);if(next)updateRow(next,{players:[...next.players,...row.players.filter(p=>!p.userId).map(p=>({...p,id:crypto.randomUUID(),kills:null,deaths:null,assists:null}))]});}}>{t("copyGuest")}</button>}</div>}
 </div>)}
 {row.played===false&&row.reason==="no_show"&&entrant.teamId&&!draft.warnings.some(w=>w.targetId===entrant.teamId&&w.source==="no_show")&&<button type="button" className="secondary-button mt-3" onClick={()=>addWarning(entrant.teamId!,"team","no_show")}>{t("addWarning")} · {t("noShow")}</button>}
 </details>;})}</div></details>)}
 </fieldset>{selected.length>visible&&<button className="secondary-button" onClick={()=>setVisible(v=>v+15)}>{t("more")}</button>}
 <details className="cyber-card p-4"><summary>{t("warnings")} ({draft.warnings.length})</summary><fieldset disabled={!loaded.canEdit||busy} className="mt-3 space-y-3">{draft.warnings.map((w,index)=><div key={w.id} className="grid gap-2 border-b border-white/10 pb-3 sm:grid-cols-4"><span>{context.entrants.find(e=>e.teamId===w.targetId||e.userId===w.targetId)?.name??context.entrants.flatMap(e=>e.roster).find(p=>p.id===w.targetId)?.nickname}</span><label>{t("reason")}<input value={w.reason} onChange={e=>setDraft(v=>v?{...v,warnings:v.warnings.map((item,i)=>i===index?{...item,reason:e.target.value}:item)}:v)}/></label><label>{t("penalty")}<input type="number" min={1} max={99} value={w.penalty??""} onChange={e=>setDraft(v=>v?{...v,warnings:v.warnings.map((item,i)=>i===index?{...item,penalty:e.target.value?Number(e.target.value):null}:item)}:v)}/></label><select aria-label={t("warning")} value={w.duration??""} onChange={e=>setDraft(v=>v?{...v,warnings:v.warnings.map((item,i)=>i===index?{...item,duration:(e.target.value||null) as "week"|"permanent"|null}:item)}:v)}><option value="">{t("choose")}</option><option value="week">{t("week")}</option><option value="permanent">{t("permanent")}</option></select><button type="button" onClick={()=>setDraft(v=>v?{...v,warnings:v.warnings.filter((_,i)=>i!==index)}:v)}>{t("remove")}</button></div>)}<label>{t("addWarning")}<select value="" onChange={e=>{if(e.target.value){const [kind,id]=e.target.value.split(":");addWarning(id,kind as "player"|"team");}}}><option value="">{t("target")}</option>{context.entrants.map(e=><option key={e.id} value={`${e.teamId?"team":"player"}:${e.teamId??e.userId}`}>{e.name}</option>)}{context.entrants.filter(e=>e.teamId).flatMap(e=>e.roster.map(p=><option key={`${e.id}:${p.id}`} value={`player:${p.id}`}>{e.name} · {p.nickname}</option>))}</select></label></fieldset></details>
 {loaded.canRank&&<details className="cyber-card p-4"><summary>{t("manualOrder")}</summary><div className="grid gap-2 sm:grid-cols-2">{context.entrants.map(e=><label key={e.id}>{e.name}<input type="number" min={1} max={context.entrants.length} value={draft.manualOrder.includes(e.id)?draft.manualOrder.indexOf(e.id)+1:""} onChange={event=>setDraft(v=>{if(!v)return v;const order=v.manualOrder.filter(id=>id!==e.id);if(event.target.value)order.splice(Number(event.target.value)-1,0,e.id);return {...v,manualOrder:order};})}/></label>)}</div></details>}
 <ResultsImport key={`import:${loaded.session.id}`} eventId={eventId} apiBase={endpoint} sessionId={loaded.session.id} publicId={loaded.publicId} context={context} disabled={!loaded.canEdit||busy} onApply={rows=>setDraft(v=>v?{...v,rows}:v)}/>
 <CompetitionEvidence key={`evidence:${loaded.session.id}`} eventId={eventId} apiBase={endpoint} sessionId={loaded.session.id} publicId={loaded.publicId} context={context} disabled={!loaded.canEdit||busy} onRows={rows=>setDraft(v=>v?{...v,rows:mergeRecognizedRows(v.rows,rows)}:v)} onReplay={gameId=>{const fresh=emptyDraft(context);setDraft(v=>v?{...v,rows:v.rows.map(r=>r.gameId===gameId?fresh.rows.find(n=>n.gameId===r.gameId&&n.registrationId===r.registrationId)??r:r)}:v);}}/>
 <div className="sticky bottom-2 rounded-xl border border-white/15 bg-slate-950/95 p-4"><div className="flex flex-wrap gap-3">{!loaded.firstPublishedAt&&<button className="secondary-button" disabled={busy||!loaded.canEdit} onClick={()=>void send("draft")}>{busy?t("saving"):t("saveDraft")}</button>}<button className="primary-button" disabled={busy||!loaded.canEdit} onClick={()=>void send(loaded.firstPublishedAt?"publish":"validate")}>{kind==="clan-war"?t("submitSides"):loaded.firstPublishedAt?t("correct"):t("checkBeforePublish")}</button><button className="secondary-button" disabled={busy} onClick={()=>{if(JSON.stringify(draftRef.current)!==savedRef.current&&!window.confirm(t("replace")))return;void load(loaded.session.id);}}>{t("reload")}</button></div>{loaded.isAdmin&&loaded.firstPublishedAt&&<label className="mt-3 block text-sm"><input type="checkbox" checked={approveRemoval} onChange={e=>setApproveRemoval(e.target.checked)}/> {t("approveRemoval")}</label>}</div>
 {preview&&<div role="dialog" aria-modal="true" aria-label={t("review")} className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 sm:p-10"><div className="mx-auto max-w-5xl space-y-4 rounded-xl border border-white/20 bg-slate-950 p-5"><h2 className="text-xl font-bold">{t("review")}</h2><ResultsTable results={preview}/><h3>{t("warnings")}</h3>{draft.warnings.map(w=><p key={w.id}>{w.reason} · −{w.penalty} · {t(w.duration==="week"?"week":"permanent")}</p>)}<p>{kind==="clan-war"?t("awaitingSides"):t("betting")}</p><div className="flex gap-3"><button className="primary-button" disabled={busy} onClick={()=>void send("publish")}>{kind==="clan-war"?t("submitSides"):t("confirm")}</button><button className="secondary-button" onClick={()=>setPreview(null)}>{t("cancel")}</button></div></div></div>}
 </main>;
}
