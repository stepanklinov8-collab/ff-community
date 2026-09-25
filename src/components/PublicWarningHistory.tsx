"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useLanguage} from "./LanguageProvider";
import {competitionText} from "@/i18n/competition";
interface Item{id:string;reason:string;penalty:number|null;legacy:boolean;category:string;eventId:string|null;expiresAt:string|null;status:"active"|"expired"|"cancelled"|"used"}
export default function PublicWarningHistory({type,id}:{type:"player"|"team";id:string}){
 const {locale}=useLanguage();const t=(key:Parameters<typeof competitionText>[1])=>competitionText(locale,key);
 const [items,setItems]=useState<Item[]>([]),[error,setError]=useState("");
 useEffect(()=>{let active=true;void fetch(`/api/competition/history?type=${type}&id=${id}`).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(active)setItems(d.warnings);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[type,id]);
 return <section className="cyber-card my-6 space-y-3 p-5"><h2 className="text-xl font-bold">{t("warnings")}</h2>{error?<p role="alert">{error}</p>:!items.length?<p className="text-white/50">{t("empty")}</p>:items.map(w=><article key={w.id} className={`border-t border-white/10 pt-3 ${w.status==="active"?w.expiresAt?"text-orange-200":"text-red-300":"text-white/40"}`}><p>{t(w.status)} · {w.penalty===null?(locale==="ru"?"Штраф не указан в старой записи":locale==="kk"?"Ескі жазбада айыппұл көрсетілмеген":"Эски жазууда айып көрсөтүлгөн эмес"):`−${w.penalty}`} · {w.expiresAt?new Date(w.expiresAt).toLocaleString("ru-RU",{timeZone:"Europe/Moscow"})+" МСК":t("permanent")}</p><p>{w.reason}</p><div className="flex gap-4">{w.eventId&&<Link className="text-cyan-300" href={`/tournaments/${w.eventId}`}>{locale==="ru"?"Мероприятие":locale==="kk"?"Іс-шара":"Иш-чара"}</Link>}<Link className="text-cyan-300" href={`/appeals?sourceType=warning&sourceId=${w.id}`}>{t("appeals")}</Link></div></article>)}</section>;
}
