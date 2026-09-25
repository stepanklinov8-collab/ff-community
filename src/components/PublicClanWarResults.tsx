"use client";
import {useEffect,useState} from "react";
import {useLanguage} from "./LanguageProvider";
import {competitionText} from "@/i18n/competition";
import type {Game,PublishedResults} from "@/lib/competition/model";
import CompetitionTable from "./CompetitionTable";
export default function PublicClanWarResults({id}:{id:string}){
 const {locale}=useLanguage(),t=(key:Parameters<typeof competitionText>[1])=>competitionText(locale,key);
 const [result,setResult]=useState<{published:PublishedResults|null;games:Game[];correctedAt:string|null}|null>(null),[error,setError]=useState("");
 useEffect(()=>{const controller=new AbortController();fetch(`/api/clan-wars/${id}/results?public=1`,{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);setResult(data);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[id]);
 if(error)return <p role="alert">{error}</p>;if(!result?.published)return <p className="mt-4 text-slate-400">{t("waiting")}</p>;
 return <section className="panel mt-6 space-y-4 p-6"><h2 className="text-xl font-bold">{t("results")}</h2>{result.correctedAt&&<p>{t("corrected")}: {new Date(result.correctedAt).toLocaleString(locale==="ru"?"ru-RU":locale==="kk"?"kk-KZ":"ky-KG",{timeZone:"Europe/Moscow"})} МСК</p>}<CompetitionTable standings={result.published.standings} rows={result.published.rows} games={result.games} mode="kv"/>{!!result.published.mvps.length&&<p>MVP: {result.published.mvps.map(id=>result.published!.rows.flatMap(r=>r.players).find(p=>p.userId===id)?.nickname??id).join(", ")}</p>}</section>;
}
