"use client";

import { useEffect, useState } from "react";
import { mapTitle } from "@/lib/competition/map-catalog";
import type { MapStatistic } from "@/lib/competition/map-statistics";

export default function TeamMapStatistics({ teamId }: { teamId: string }) {
  const [maps, setMaps] = useState<MapStatistic[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { let active = true; fetch(`/api/teams/${teamId}/map-stats`).then(async response => response.ok ? response.json() : { maps: [] }).then(payload => { if (active) { setMaps(payload.maps ?? []); setSelected(payload.maps?.[0]?.map ?? ""); } }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [teamId]);
  const current = maps.find(item => item.map === selected) ?? maps[0];
  return <section className="mt-6 rounded bg-gray-800 p-4 sm:p-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[.18em] text-cyan-300">Update 3</p><h2 className="mt-1 text-xl font-semibold">Статистика по картам</h2></div>{maps.length > 0 && <select className="rounded bg-gray-700 p-2 text-sm" value={current?.map ?? ""} onChange={event => setSelected(event.target.value)}>{maps.map(item => <option key={item.map} value={item.map}>{mapTitle(item.map)}</option>)}</select>}</div>
    {loading ? <p className="mt-4 text-sm text-gray-400">Загрузка…</p> : !current ? <p className="mt-4 text-sm text-gray-400">Опубликованных игр с картой пока нет.</p> : <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
      <div className="relative min-h-48 overflow-hidden rounded-xl border border-cyan-400/25 bg-[radial-gradient(circle_at_30%_30%,rgba(0,210,255,.25),transparent_32%),linear-gradient(140deg,#112c3b,#07121e_55%,#19372d)] p-4"><div className="absolute inset-5 rounded-[35%] border border-emerald-200/30" /><div className="absolute inset-12 rounded-[45%] border border-cyan-200/20" /><p className="relative text-xs text-slate-300">Любимая локация</p><div className="relative mt-12 flex flex-wrap gap-2">{current.favoriteLocations.length ? current.favoriteLocations.map(item => <span key={item.location} className="rounded-full border border-amber-300 bg-amber-300/20 px-3 py-1 text-sm text-amber-100">● {item.location}</span>) : <span className="text-sm text-slate-400">Нет данных о высадках</span>}</div></div>
      <div className="grid grid-cols-2 gap-3"><div className="rounded bg-gray-700 p-3"><p className="text-xs text-gray-400">Сыграно игр</p><p className="mt-1 text-2xl font-bold">{current.games}</p></div><div className="rounded bg-gray-700 p-3"><p className="text-xs text-gray-400">Первые места</p><p className="mt-1 text-2xl font-bold">{current.firstPlaces}</p></div><div className="rounded bg-gray-700 p-3"><p className="text-xs text-gray-400">Процент первых мест</p><p className="mt-1 text-2xl font-bold">{current.winPercent.toFixed(2)}%</p></div><div className="rounded bg-gray-700 p-3"><p className="text-xs text-gray-400">Среднее место</p><p className="mt-1 text-2xl font-bold">{current.averagePlace.toFixed(2)}</p></div><div className="col-span-2 rounded bg-gray-700 p-3 text-sm text-gray-300">Локация указана в {current.locationGames} из {current.games} игр. Групповые отборочные игры учитываются в этой аналитике.</div></div>
    </div>}
  </section>;
}
