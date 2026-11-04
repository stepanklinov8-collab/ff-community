"use client";
import Link from "next/link";
import {Fragment,useState} from "react";
import {useLanguage} from "./LanguageProvider";
import {competitionText} from "@/i18n/competition";
import type {Game,GameResult,Standing} from "@/lib/competition/model";
import {mapTitle} from "@/lib/competition/map-catalog";
export default function CompetitionTable({standings,rows,games,mode,criterion}:{standings:Standing[];rows?:GameResult[];games?:Game[];mode?:string;criterion?:string}){
 const {locale}=useLanguage();const t=(key:Parameters<typeof competitionText>[1])=>key==="kills"&&locale==="ru"?"Киллы":competitionText(locale,key);
 const round=mode==="bo"||mode==="kv";
 const [expanded,setExpanded]=useState<string[]>([]);
 return <section className="min-w-0 space-y-2">
  <p className="text-xs text-slate-400 sm:hidden">Таблицу можно прокручивать вправо ↔ Место и название закреплены.</p>
  <div className="competition-table-scroll" role="region" aria-label="Таблица результатов" tabIndex={0}>
  <table className="competition-table w-full text-sm"><thead><tr>{[t("place"),t("target"),t("games"),t("wins"),t("kills"),...(!round?[criterion==="places"?t("place"):t("points")]:[])].map((name,index)=><th key={index} className={index===0?"competition-place":index===1?"competition-name":"text-right"}>{name}</th>)}</tr></thead>
  <tbody>{standings.map(row=>{const open=expanded.includes(row.registrationId);return <Fragment key={row.registrationId}>
   <tr className="border-t border-white/10"><td className="competition-place tabular-nums">{row.place}</td><td className="competition-name"><Link href={row.teamId?`/teams/${row.teamId}`:`/profile/${row.userId}`} className="block max-w-48 truncate text-cyan-300" title={row.name}>{row.name}</Link>{rows&&<button type="button" aria-expanded={open} aria-controls={`result-${row.registrationId}`} className="mt-2 text-xs text-slate-300 underline" onClick={()=>setExpanded(current=>open?current.filter(id=>id!==row.registrationId):[...current,row.registrationId])}>{t("detail")}</button>}</td><td className="text-right tabular-nums">{row.gamesPlayed}</td><td className="text-right tabular-nums">{row.wins}</td><td className="text-right tabular-nums">{row.kills}</td>{!round&&<td className="text-right tabular-nums">{criterion==="places"?row.placeSum:row.points}{!!row.bonus&&<small className="block text-slate-400">+{row.bonus}</small>}</td>}</tr>
   {rows&&open&&<tr><td colSpan={round?5:6} className="p-3"><div id={`result-${row.registrationId}`} className="grid max-w-[calc(100vw-6rem)] gap-3 lg:max-w-none lg:grid-cols-3">{rows.filter(result=>result.registrationId===row.registrationId).sort((a,b)=>(games?.find(game=>game.id===a.gameId)?.number??0)-(games?.find(game=>game.id===b.gameId)?.number??0)).map(result=>{const game=games?.find(game=>game.id===result.gameId);return <div key={result.gameId} className="min-w-0 space-y-2 rounded-lg border border-white/10 p-3"><p className="font-bold">{t("game")} {game?.number} · {game?.publicId} · {game?.map?mapTitle(game.map):"—"}</p><p>{!result.played?t("notPlayed"):`${t(round?"rounds":"place")}: ${round?result.rounds??"—":result.place} · ${t("kills")}: ${result.kills}`}</p>{result.played&&result.detail==="team"?<p className="text-slate-400">{t("teamOnly")}</p>:result.players.map(player=><p key={player.id} className={!player.played?"text-slate-500":"text-slate-200"}>{player.userId?<Link href={`/profile/${player.userId}`}>{player.nickname}</Link>:t("guest")}: {player.played?`${t("kills")}: ${player.kills}${round?` · ${t("deaths")}: ${player.deaths} · ${t("assists")}: ${player.assists} · KDA: ${(((player.kills??0)+(player.assists??0))/Math.max(1,player.deaths??0)).toFixed(2)}`:""}`:t("notPlayed")}</p>)}</div>;})}</div></td></tr>}
  </Fragment>;})}</tbody></table></div></section>;
}
