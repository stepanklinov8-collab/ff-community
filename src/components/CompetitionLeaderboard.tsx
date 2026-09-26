"use client";
import {useEffect, useState} from "react";
import Link from "next/link";
import Image from "next/image";
import {useLanguage} from "./LanguageProvider";
import {statisticsText} from "@/i18n/competition-statistics";
import type {CompetitionMode} from "@/lib/competition/public-statistics";
import {competitionCost} from "@/lib/competition/cost";

interface Entry {id: string; name: string; avatar_url: string | null; position: number; rating: number; wins: number; games: number; kills: number; deaths: number | null; cost?: number; series: number}
export default function CompetitionLeaderboard({initialKind = "player"}: {initialKind?: "player" | "team"}) {
  const {locale} = useLanguage(), t = statisticsText(locale);
  const [mode, setMode] = useState<CompetitionMode>("main");
  const [kind, setKind] = useState<"player" | "team" | "guild">(initialKind);
  const [sort, setSort] = useState("rating"), [query, setQuery] = useState(""), [search, setSearch] = useState("");
  useEffect(() => {const timer = setTimeout(() => setSearch(query.trim()), 300); return () => clearTimeout(timer);}, [query]);
  const selectKind = (value: typeof kind) => {setKind(value); if (value !== "player" && mode === "solo") setMode("main");};
  return <main className="page-shell space-y-6">
    <div><p className="eyebrow">{t.allTime}</p><h1 className="mt-2 text-3xl font-black">{t.title}</h1></div>
    <div className="flex flex-wrap gap-2" aria-label={t.name}>{(["player", "team", "guild"] as const).map(item => <button key={item} className={kind === item ? "btn-primary" : "btn-secondary"} aria-pressed={kind === item} onClick={() => selectKind(item)}>{t[item]}</button>)}</div>
    <div className="flex flex-wrap gap-2" aria-label={t.title}>{(["main", "solo", "bo", "kv"] as const).filter(item => kind === "player" || item !== "solo").map(item => <button key={item} className={mode === item ? "btn-primary" : "btn-secondary"} aria-pressed={mode === item} onClick={() => setMode(item)}>{t[item]}</button>)}</div>
    <div className="flex flex-wrap gap-3"><input className="input-field flex-1" aria-label={t.search} placeholder={t.search} maxLength={100} value={query} onChange={e => setQuery(e.target.value)}/><select className="input-field" aria-label={t.title} value={sort} onChange={e => setSort(e.target.value)}>{(["rating", "kills", "games", "ratio"] as const).map(item => <option key={item} value={item}>{t[item]}</option>)}</select></div>
    <LeaderboardRows key={`${kind}:${mode}:${sort}:${search}`} kind={kind} mode={mode} sort={sort} search={search}/>
  </main>;
}
function LeaderboardRows({kind, mode, sort, search}: {kind: "player" | "team" | "guild"; mode: CompetitionMode; sort: string; search: string}) {
  const {locale, formatNumber} = useLanguage(), t = statisticsText(locale);
  const [items, setItems] = useState<Entry[]>([]), [hasMore, setHasMore] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [offset, setOffset] = useState(0), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({mode, type: kind === "player" ? "player" : "team", sort, q: search, offset: String(offset)});
    if (kind !== "player") params.set("kind", kind);
    void fetch(`/api/competition/leaderboard?${params}`, {signal: controller.signal}).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error || t.error);
      if (!controller.signal.aborted) {setItems(previous => offset === 0 ? body.items : [...previous, ...body.items.filter((row: Entry) => !previous.some(p => p.id === row.id))]); setHasMore(body.hasMore); setError("");}
    }).catch(e => {if (!controller.signal.aborted) setError(e.message);}).finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [kind, mode, sort, search, offset, retry, t.error]);
  const showCost = mode === "main";
  return <section className="space-y-4" aria-busy={loading}>
    {items.length > 0 && <div className="panel overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-slate-400"><tr>{[t.position, t.name, t.rating, t.wins, t.games, t.kills, t.ratio, ...(showCost ? [t.cost] : []), ...(mode === "bo" || mode === "kv" ? [t.series] : [])].map(label => <th key={label} className="whitespace-nowrap p-4">{label}</th>)}</tr></thead><tbody>{items.map(row => <tr key={row.id} className="border-t border-white/10"><td className="p-4">{row.position}</td><td className="p-4"><Link className="flex items-center gap-3 text-cyan-200" href={kind === "player" ? `/profile/${row.id}` : `/teams/${row.id}`}>{row.avatar_url && <Image unoptimized src={row.avatar_url} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover"/>}{row.name || "—"}</Link></td><td className="p-4 font-bold">{formatNumber(Number(row.rating), {minimumFractionDigits: kind === "player" ? 1 : 2, maximumFractionDigits: kind === "player" ? 1 : 2})}</td><td className="p-4">{row.wins}</td><td className="p-4">{row.games}</td><td className="p-4">{row.kills}</td><td className="p-4">{row.games ? formatNumber(row.kills / row.games, {maximumFractionDigits: 2}) : "—"}</td>{showCost && <td className="p-4 text-amber-300">{formatNumber(Number(row.cost ?? competitionCost({kills: row.kills, deaths: row.deaths, games: row.games, wins: row.wins, rating: row.rating, reputation: 50})))} ₽</td>}{(mode === "bo" || mode === "kv") && <td className="p-4">{row.series}</td>}</tr>)}</tbody></table></div>}
    {error && <p role="alert" className="text-red-300">{error} <button className="btn-secondary" onClick={() => {setLoading(true); setRetry(n => n + 1);}}>{t.retry}</button></p>}
    {loading ? <p role="status">{t.loading}</p> : !error && !items.length ? <p className="panel p-6 text-slate-400">{t.empty}</p> : null}
    {hasMore && !error && <button className="btn-secondary" disabled={loading} onClick={() => {setLoading(true); setOffset(n => n + 50);}}>{t.more}</button>}
  </section>;
}
