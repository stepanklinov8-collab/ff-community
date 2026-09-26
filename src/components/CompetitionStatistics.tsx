"use client";
import {useEffect, useState} from "react";
import Link from "next/link";
import {useLanguage} from "./LanguageProvider";
import {statisticsText} from "@/i18n/competition-statistics";
import {getPublicStatistics, type CompetitionMode, type PublicStatistics} from "@/lib/competition/public-statistics";
import {competitionCost} from "@/lib/competition/cost";

export default function CompetitionStatistics({id, type = "player"}: {id: string; type?: "player" | "team"}) {
  const {locale} = useLanguage(), t = statisticsText(locale);
  const [mode, setMode] = useState<CompetitionMode>("main");
  return <section className="cyber-card my-6 space-y-5 p-5"><h2 className="text-xl font-bold">{t.statistics} · {t.allTime}</h2>
    <div className="flex flex-wrap gap-2">{(["main", "solo", "bo", "kv"] as const).filter(item => type === "player" || item !== "solo").map(item => <button key={item} aria-pressed={mode === item} className={mode === item ? "btn-primary" : "btn-secondary"} onClick={() => setMode(item)}>{t[item]}</button>)}</div>
    <StatisticsRows key={`${id}:${type}:${mode}`} id={id} type={type} mode={mode}/>
  </section>;
}
function StatisticsRows({id, type, mode}: {id: string; type: "player" | "team"; mode: CompetitionMode}) {
  const {locale, formatNumber} = useLanguage(), t = statisticsText(locale);
  const [data, setData] = useState<PublicStatistics | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [offset, setOffset] = useState(0), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getPublicStatistics(id, type, mode, offset, controller.signal).then(body => {
      if (!controller.signal.aborted) {setData(previous => ({...body, history: offset === 0 ? body.history : [...(previous?.history ?? []), ...body.history.filter(row => !previous?.history.some(p => p.id === row.id))]})); setError("");}
    }).catch(e => {if (!controller.signal.aborted) setError(e.message);}).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [id, type, mode, offset, retry]);
  const summary = data?.summaries.find(item => item.mode === mode), duel = mode === "bo" || mode === "kv";
  const mainSummary = data?.summaries.find(item => item.mode === "main");
  const metrics = summary ? [[t.rating, formatNumber(summary.rating, {minimumFractionDigits: type === "player" ? 1 : 2, maximumFractionDigits: type === "player" ? 1 : 2})], ...(mode === "main" ? [[t.cost, `${formatNumber(Number(summary.cost ?? mainSummary?.cost ?? competitionCost({kills: summary.kills, deaths: summary.deaths, games: summary.games, wins: summary.wins, rating: summary.rating, reputation: 50})))} ₽`]] : []), [t.games, summary.games], [t.kills, summary.kills], [t.wins, summary.wins], [t.ratio, summary.games ? formatNumber(summary.kills / summary.games, {maximumFractionDigits: 2}) : "—"], ...(duel ? [[t.series, summary.series], [t.deaths, summary.deaths ?? "—"], [t.assists, summary.assists ?? "—"], ["KDA", summary.deaths !== null && summary.assists !== null ? formatNumber((summary.kills + summary.assists) / Math.max(1, summary.deaths), {maximumFractionDigits: 2}) : "—"]] : [])] : [];
  return <div className="space-y-4" aria-busy={loading}>
    {data?.goldOrganizer && <p className="text-amber-300">★ {t.gold}</p>}
    {summary && <><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{metrics.map(([label, value]) => <div key={String(label)} className="rounded-lg bg-white/5 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>{!summary.ranked && <p className="text-slate-400">{t.unranked}</p>}</>}
    {(data?.history.length ?? 0) > 0 && <><h3 className="font-bold">{t.history}</h3>{data?.history.some(row => row.source.startsWith("legacy")) && <p className="text-sm text-slate-400">{t.historyNote}</p>}<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr>{[t.date, t.event, t.snapshot, t.games, t.position, t.kills, ...(duel ? [t.deaths, t.assists] : [])].map(label => <th key={label} className="whitespace-nowrap p-3">{label}</th>)}</tr></thead><tbody>{data?.history.map(row => <tr key={row.id} className="border-t border-white/10"><td className="whitespace-nowrap p-3">{new Date(row.occurred_at).toLocaleString(locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "ky-KG", {timeZone: "Europe/Moscow", dateStyle: "short", timeStyle: "short"})}</td><td className="p-3">{row.clan_war_id || row.event_id ? <Link className="text-cyan-200" href={row.clan_war_id ? `/clan-wars/${row.clan_war_id}` : `/tournaments/${row.event_id}${row.session_id ? `?sessionId=${row.session_id}` : ""}`}>{row.title}</Link> : row.title}{row.source.startsWith("legacy") && <span className="block text-xs text-slate-500">{row.source==="legacy_unassigned"?t.unassigned:t.legacy}</span>}</td><td className="p-3">{row.name_snapshot || "—"}</td><td className="p-3">{row.games ?? "—"}</td><td className="p-3">{row.place ?? "—"}</td><td className="p-3">{row.kills}</td>{duel && <><td className="p-3">{row.deaths ?? "—"}</td><td className="p-3">{row.assists ?? "—"}</td></>}</tr>)}</tbody></table></div></>}
    {error && <p role="alert" className="text-red-300">{error} <button className="btn-secondary" onClick={() => {setLoading(true); setRetry(n => n + 1);}}>{t.retry}</button></p>}
    {loading ? <p role="status">{t.loading}</p> : !error && !data?.history.length ? <p className="text-slate-400">{t.empty}</p> : null}
    {data?.hasMore && !error && <button className="btn-secondary" disabled={loading} onClick={() => {setLoading(true); setOffset(n => n + 30);}}>{t.more}</button>}
  </div>;
}
