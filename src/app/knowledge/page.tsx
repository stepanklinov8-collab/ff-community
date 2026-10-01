"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { mapCatalog } from "@/lib/competition/map-catalog";
import { officialKnowledgeHighlights, officialKnowledgeItems, type KnowledgeCategoryId } from "@/lib/knowledge/catalog";

const categories: Array<{ id: KnowledgeCategoryId; title: string; text: string }> = [
  { id: "maps", title: "Карты и локации", text: "Русские названия карт и всех доступных точек высадки." },
  { id: "weapons", title: "Оружие", text: "Типы оружия, характеристики и изменения баланса из официального каталога." },
  { id: "characters", title: "Персонажи", text: "Персонажи, способности, пресеты и официальные изменения навыков." },
  { id: "pets", title: "Питомцы", text: "Питомцы, навыки и правила их использования." },
  { id: "updates", title: "Обновления", text: "Новости, патчноуты и история изменений Free Fire." },
  { id: "omcite", title: "Как пользоваться OMCITE", text: "Регистрация, команды, результаты и правила мероприятий." },
];

export default function KnowledgePage() {
  const { locale } = useLanguage();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<KnowledgeCategoryId>("maps");
  const [selectedMap, setSelectedMap] = useState<(typeof mapCatalog)[number]["id"]>(mapCatalog[0].id);
  const currentMap = mapCatalog.find(map => map.id === selectedMap) ?? mapCatalog[0];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleCategories = useMemo(() => categories.filter(item => `${item.title} ${item.text}`.toLocaleLowerCase().includes(normalizedQuery)), [normalizedQuery]);
  const visibleOfficialItems = useMemo(() => officialKnowledgeItems.filter(item => item.category === section && `${item.title} ${item.description}`.toLocaleLowerCase().includes(normalizedQuery)), [normalizedQuery, section]);
  const visibleHighlights = useMemo(() => officialKnowledgeHighlights.filter(item => item.category === section && `${item.title} ${item.description}`.toLocaleLowerCase().includes(normalizedQuery)), [normalizedQuery, section]);
  const copy = locale === "kk"
    ? { eyebrow: "OMCITE кітапханасы", title: "Білім базасы", search: "Материал іздеу", map: "Карта және қону орындары", location: "Қону орны", official: "Ресми дереккөз", open: "Ресми сайтты ашу" }
    : locale === "ky"
      ? { eyebrow: "OMCITE китепканасы", title: "Билим базасы", search: "Материал издөө", map: "Карта жана конуучу жерлер", location: "Конгон жер", official: "Расмий булак", open: "Расмий сайтты ачуу" }
      : { eyebrow: "Библиотека OMCITE", title: "База знаний", search: "Поиск по материалам", map: "Карты и места высадки", location: "Место высадки", official: "Официальный источник", open: "Открыть официальный сайт" };

  return <main className="page-shell space-y-6">
    <section className="panel space-y-4 p-6 sm:p-8">
      <p className="eyebrow">{copy.eyebrow}</p><h1 className="section-title">{copy.title}</h1>
      <p className="max-w-3xl text-slate-300">Справочные материалы OMCITE привязаны к официальным каталогам Garena Free Fire. Названия карт и локаций в интерфейсе мероприятия используются на русском языке.</p>
      <label className="block max-w-xl"><span className="sr-only">{copy.search}</span><input className="field" value={query} onChange={event => setQuery(event.target.value)} placeholder={copy.search} /></label>
    </section>

    <nav className="flex flex-wrap gap-2" aria-label="Разделы базы знаний">{categories.map(category => <button key={category.id} type="button" onClick={() => setSection(category.id)} className={`rounded-full border px-3 py-2 text-sm ${section === category.id ? "border-cyan-300 bg-cyan-950 text-cyan-100" : "border-white/15 text-slate-400"}`}>{category.title}</button>)}</nav>

    <section className="grid gap-4 md:grid-cols-2">{visibleCategories.map(category => <article key={category.id} className={`panel p-5 ${section === category.id ? "border-cyan-300/50" : ""}`}><p className="text-xs uppercase tracking-[.18em] text-cyan-300">{category.id === "omcite" ? "OMCITE" : "Free Fire"}</p><h2 className="mt-2 text-xl font-bold">{category.title}</h2><p className="mt-2 text-sm text-slate-400">{category.text}</p><button type="button" className="mt-4 text-sm text-cyan-300" onClick={() => setSection(category.id)}>Открыть раздел →</button></article>)}</section>

    {section === "maps" ? <section id="knowledge-map" className="panel space-y-5 p-5 sm:p-7">
      <div><p className="eyebrow">{copy.map}</p><h2 className="section-title mt-2">{currentMap.title}</h2></div>
      <div className="flex flex-wrap gap-2">{mapCatalog.map(map => <button key={map.id} type="button" onClick={() => setSelectedMap(map.id)} className={`rounded-full border px-3 py-1 text-sm ${selectedMap === map.id ? "border-cyan-300 bg-cyan-950 text-cyan-100" : "border-white/15 text-slate-400"}`}>{map.title}</button>)}</div>
      <div className="relative min-h-72 overflow-hidden rounded-2xl border border-cyan-400/25 bg-[radial-gradient(circle_at_30%_30%,rgba(0,210,255,.25),transparent_32%),linear-gradient(140deg,#112c3b,#07121e_55%,#19372d)] p-5">
        <div className="absolute inset-4 rounded-[35%] border border-emerald-200/30 opacity-60" /><div className="absolute inset-12 rounded-[45%] border border-cyan-200/20 opacity-60" />
        <p className="relative text-sm text-slate-300">{copy.location}: выберите область на карте</p>
        <div className="relative mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">{currentMap.locations.map((location, index) => <button key={location.id} type="button" className="rounded-xl border border-white/20 bg-slate-950/60 px-3 py-3 text-left text-sm text-white transition hover:border-cyan-300 hover:bg-cyan-950/70" style={{ transform: `translateY(${index % 2 ? 10 : 0}px)` }}><span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-cyan-400/80 text-xs font-bold text-slate-950">{index + 1}</span>{location.title}</button>)}</div>
      </div>
      <a className="text-sm text-cyan-300 underline" href={currentMap.officialUrl} target="_blank" rel="noreferrer">{copy.open}: {currentMap.title}</a>
    </section> : <section className="space-y-4">
      {section !== "omcite" && <>{visibleOfficialItems.map(item => <article key={item.id} className="panel flex flex-wrap items-start justify-between gap-4 p-5"><div><p className="text-xs uppercase tracking-[.18em] text-cyan-300">{copy.official}</p><h2 className="mt-2 text-xl font-bold">{item.title}</h2><p className="mt-2 text-sm text-slate-400">{item.description}</p></div><a className="text-sm text-cyan-300 underline" href={item.href} target="_blank" rel="noreferrer">{copy.open}</a></article>)}{visibleHighlights.map(item => <article key={item.title} className="panel p-5"><h3 className="font-bold">{item.title}</h3><p className="mt-2 text-sm text-slate-400">{item.description}</p><a className="mt-3 inline-block text-sm text-cyan-300 underline" href={item.href} target="_blank" rel="noreferrer">{copy.open}</a></article>)}</>}
      {section === "omcite" && <article className="panel p-6"><h2 className="text-xl font-bold">Как пользоваться OMCITE</h2><p className="mt-2 text-slate-400">Здесь будут правила регистрации, работа с командами, внесение результатов, рейтинги и история мероприятий.</p></article>}
    </section>}
  </main>;
}
