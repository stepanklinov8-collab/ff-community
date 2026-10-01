"use client";

import { useMemo, useState } from "react";
import { mapCatalog } from "@/lib/competition/map-catalog";
import { useLanguage } from "@/components/LanguageProvider";

const categories = [
  { id: "maps", title: "Карты и локации", text: "Карта высадки, локации и навигация по игровым зонам." },
  { id: "weapons", title: "Оружие", text: "Проверяемые характеристики и сравнение типов оружия." },
  { id: "characters", title: "Персонажи и питомцы", text: "Способности, роли и применение в составах." },
  { id: "omcite", title: "Как пользоваться OMCITE", text: "Регистрация, команды, результаты и правила мероприятий." },
] as const;

export default function KnowledgePage() {
  const { locale } = useLanguage();
  const [query, setQuery] = useState("");
  const [selectedMap, setSelectedMap] = useState<(typeof mapCatalog)[number]["id"]>(mapCatalog[0].id);
  const currentMap = mapCatalog.find(map => map.id === selectedMap) ?? mapCatalog[0];
  const visibleCategories = useMemo(() => categories.filter(item => `${item.title} ${item.text}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [query]);
  const copy = locale === "kk" ? { eyebrow: "ОМCITE кітапханасы", title: "Білім базасы", search: "Материал іздеу", map: "Карта және қону орындары", location: "Қону орны", soon: "Ресми каталогтар бірінші кезеңде қосылады" } : locale === "ky" ? { eyebrow: "OMCITE китепканасы", title: "Билим базасы", search: "Материал издөө", map: "Карта жана конуучу жерлер", location: "Конгон жер", soon: "Расмий каталогдор биринчи этапта кошулат" } : { eyebrow: "Библиотека OMCITE", title: "База знаний", search: "Поиск по материалам", map: "Карта и места высадки", location: "Место высадки", soon: "Официальные каталоги добавляются первым этапом" };

  return <main className="page-shell space-y-6">
    <section className="panel space-y-4 p-6 sm:p-8">
      <p className="eyebrow">{copy.eyebrow}</p><h1 className="section-title">{copy.title}</h1>
      <p className="max-w-3xl text-slate-300">Собранные в одном месте карты, справочные материалы и инструкции сообщества. Статьи будут иметь версии игры, источники и историю изменений.</p>
      <label className="block max-w-xl"><span className="sr-only">{copy.search}</span><input className="field" value={query} onChange={event => setQuery(event.target.value)} placeholder={copy.search} /></label>
    </section>
    <section className="grid gap-4 md:grid-cols-2">{visibleCategories.map(category => <article key={category.id} className="panel p-5"><p className="text-xs uppercase tracking-[.18em] text-cyan-300">{category.id === "maps" ? "Maps" : "Guide"}</p><h2 className="mt-2 text-xl font-bold">{category.title}</h2><p className="mt-2 text-sm text-slate-400">{category.text}</p><button type="button" className="mt-4 text-sm text-cyan-300" onClick={() => category.id === "maps" && document.getElementById("knowledge-map")?.scrollIntoView({ behavior: "smooth" })}>Открыть раздел →</button></article>)}</section>
    <section id="knowledge-map" className="panel space-y-5 p-5 sm:p-7">
      <div><p className="eyebrow">{copy.map}</p><h2 className="section-title mt-2">{currentMap.title}</h2></div>
      <div className="flex flex-wrap gap-2">{mapCatalog.map(map => <button key={map.id} type="button" onClick={() => setSelectedMap(map.id)} className={`rounded-full border px-3 py-1 text-sm ${selectedMap === map.id ? "border-cyan-300 bg-cyan-950 text-cyan-100" : "border-white/15 text-slate-400"}`}>{map.title}</button>)}</div>
      <div className="relative min-h-72 overflow-hidden rounded-2xl border border-cyan-400/25 bg-[radial-gradient(circle_at_30%_30%,rgba(0,210,255,.25),transparent_32%),linear-gradient(140deg,#112c3b,#07121e_55%,#19372d)] p-5">
        <div className="absolute inset-4 rounded-[35%] border border-emerald-200/30 opacity-60" /><div className="absolute inset-12 rounded-[45%] border border-cyan-200/20 opacity-60" />
        <p className="relative text-sm text-slate-300">{copy.location}: выберите область на карте</p>
        <div className="relative mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">{currentMap.locations.map((location, index) => <button key={location} type="button" className="rounded-xl border border-white/20 bg-slate-950/60 px-3 py-3 text-left text-sm text-white transition hover:border-cyan-300 hover:bg-cyan-950/70" style={{ transform: `translateY(${index % 2 ? 10 : 0}px)` }}><span className="mr-2 inline-grid size-5 place-items-center rounded-full bg-cyan-400/80 text-xs font-bold text-slate-950">{index + 1}</span>{location}</button>)}</div>
      </div>
      <p className="text-xs text-slate-500">{copy.soon}. Исторические названия сохраняются вместе с версией игры; пользовательские советы будут отделены от официальных фактов.</p>
    </section>
  </main>;
}
