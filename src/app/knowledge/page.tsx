"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { mapCatalog } from "@/lib/competition/map-catalog";
import { type KnowledgeCategoryId } from "@/lib/knowledge/catalog";
import { knowledgeCharacters, knowledgeGuide, knowledgePets, knowledgeUpdates, knowledgeWeapons, type KnowledgeCatalogEntry } from "@/lib/knowledge/game-catalog";

const categories: Array<{ id: KnowledgeCategoryId; title: string; text: string }> = [
  { id: "maps", title: "Карты и локации", text: "Русские названия карт и всех доступных точек высадки." },
  { id: "weapons", title: "Оружие", text: "Типы оружия, характеристики и изменения баланса, собранные в базе." },
  { id: "characters", title: "Персонажи", text: "Персонажи, способности, пресеты и изменения навыков." },
  { id: "pets", title: "Питомцы", text: "Питомцы, навыки и правила их использования." },
  { id: "updates", title: "Обновления", text: "Новости, изменения игрового процесса и история обновлений." },
  { id: "omcite", title: "Руководство", text: "Регистрация, команды, результаты и правила мероприятий." },
];

const solaraMarkerPositions: Record<string, { x: number; y: number; photo?: string }> = {
  waterfall: { x: 0.288, y: 0.343, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/17a4afa7367f9520fb97aa24b964e450.jpg" },
  riders_club: { x: 0.413, y: 0.223, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/2ba345de8135924fcfbc1543695d8452.jpg" },
  funfair: { x: 0.573, y: 0.443, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/4692a60c796d8ed0a2c6b9357d633259.jpg" },
  windmill: { x: 0.803, y: 0.578, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/f4291a7632277515fb65ab841e88be7f.jpg" },
  delta_isle: { x: 0.838, y: 0.498, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/b099949fbd6bd9cb973f6a1a22ddeb7b.jpg" },
  aquarium: { x: 0.933, y: 0.733, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/6475e056b064e48e368221c261d084fa.jpg" },
  eco_drain: { x: 0.538, y: 0.948, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/2ebf8dd1d8be7ec4011029a152115cc5.jpg" },
  tv_tower: { x: 0.588, y: 0.673, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/e61a99008446486c2aabe3e27f95af2b.jpg" },
  bayside: { x: 0.863, y: 0.948, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/761503766b430d6c300e553268cfc5d9.jpg" },
  bloomtown: { x: 0.438, y: 0.748, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/a03d715770a0b1eb1d8725a25a8ddd6b.jpg" },
  studio: { x: 0.213, y: 0.873, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/67ec7c4155bc1a4c020acb23c06aa6be.jpg" },
  the_hub: { x: 0.113, y: 0.498, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/b05e2af1f305424caf84841ac6cb4651.jpg" },
  archway: { x: 0.373, y: 0.498, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/a9edfc2b3f05d50af176b12018ab5948.jpg" },
  casa_vista: { x: 0.713, y: 0.773, photo: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/2b2f894966d65facba89448c6937b53c.jpg" },
};

const mapDisplayOrder = ["solara", "nexterra", "alpine", "bermuda_remastered", "bermuda", "purgatory", "kalahari"]
  .map(id => mapCatalog.find(map => map.id === id))
  .filter((map): map is (typeof mapCatalog)[number] => Boolean(map));

function markerPosition(mapId: string, index: number, total: number) {
  if (mapId === "solara") return solaraMarkerPositions[mapCatalog.find(map => map.id === mapId)?.locations[index]?.id ?? ""] ?? { x: 0.12 + ((index * 0.23) % 0.78), y: 0.2 + ((index * 0.19) % 0.68) };
  const columns = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(total))));
  return { x: 0.12 + (index % columns) * (0.76 / Math.max(1, columns - 1)), y: 0.2 + Math.floor(index / columns) * 0.23 };
}

function GarenaMapViewer({ currentMap, selectedLocation, onMapChange, onLocationChange, onSectionChange }: {
  currentMap: (typeof mapCatalog)[number];
  selectedLocation: string | null;
  onMapChange: (id: (typeof mapCatalog)[number]["id"]) => void;
  onLocationChange: (id: string) => void;
  onSectionChange: (id: KnowledgeCategoryId) => void;
}) {
  const currentLocation = currentMap.locations.find(location => location.id === selectedLocation);
  return <div className="garena-map-page">
    <header className="garena-map-nav">
      <Link className="garena-map-logo" href="/" aria-label="OMCITE">OMCITE</Link>
      <nav className="garena-map-links" aria-label="Разделы базы знаний">{categories.map(category => <button key={category.id} type="button" className={category.id === "maps" ? "is-active" : ""} onClick={() => onSectionChange(category.id)}>{category.title}</button>)}</nav>
      <div className="garena-map-actions"><span aria-hidden="true">◉</span><span aria-hidden="true">◎</span><Link href="/">На главную</Link></div>
    </header>
    <section className="garena-map-stage" aria-label={`Карта ${currentMap.title}`}>
      <div className="garena-map-canvas"><Image data-testid="knowledge-map-image" src={currentMap.imageUrl} alt={`Карта ${currentMap.title}`} fill sizes="(min-width: 1000px) 1000px, 100vw" priority unoptimized className="garena-map-image" /><div className="garena-map-grid" aria-hidden="true" />
        {currentMap.locations.map((location, index) => { const point = markerPosition(currentMap.id, index, currentMap.locations.length); const photo = currentMap.id === "solara" ? solaraMarkerPositions[location.id]?.photo : undefined; return <button key={location.id} type="button" className={`garena-map-marker ${selectedLocation === location.id ? "is-selected" : ""}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} onClick={() => onLocationChange(location.id)} aria-label={location.title}><span className="garena-map-marker-name">{location.title}</span>{selectedLocation === location.id && photo && <span className="garena-map-marker-photo"><Image src={photo} alt={`${location.title}: фотография`} fill sizes="96px" unoptimized /></span>}</button>; })}
      </div>
      <div className="garena-map-selector"><div className="garena-map-current"><Image src={currentMap.thumbnailUrl} alt="" width={180} height={102} unoptimized className="garena-map-current-thumb" /><div className="garena-map-current-info"><p className="garena-map-current-title">{currentMap.title}</p><p className="garena-map-current-description">{currentLocation ? `${currentLocation.title}: точка выбрана для дальнейшей статистики.` : currentMap.description}</p><span className="garena-map-local-badge">Материал и фотографии доступны внутри базы знаний</span><div className="knowledge-map-gallery" aria-label={`Фотографии карты ${currentMap.title}`}>{currentMap.gallery.map((imageUrl, index) => <Image key={imageUrl} src={imageUrl} alt={`${currentMap.title}, фотография ${index + 1}`} width={54} height={34} unoptimized />)}</div></div></div><div className="garena-map-list" role="tablist" aria-label="Карты базы знаний">{mapDisplayOrder.map(map => <button key={map.id} data-testid={`knowledge-map-${map.id}`} type="button" role="tab" aria-selected={map.id === currentMap.id} className={`garena-map-choice ${map.id === currentMap.id ? "is-active" : ""}`} onClick={() => onMapChange(map.id)}><Image src={map.thumbnailUrl} alt="" width={128} height={72} unoptimized /><span>{map.title}</span></button>)}</div></div>
    </section>
    <footer className="garena-map-footer"><strong>OMCITE</strong><nav><a href="/rules">Правила</a><a href="/privacy">Конфиденциальность</a><a href="/terms">Условия</a><a href="/contacts">Контакты</a></nav><span>Карты, описания и фотографии доступны внутри базы знаний.</span></footer>
  </div>;
}

const catalogBySection: Record<Exclude<KnowledgeCategoryId, "maps">, readonly KnowledgeCatalogEntry[]> = {
  weapons: knowledgeWeapons,
  characters: knowledgeCharacters,
  pets: knowledgePets,
  updates: knowledgeUpdates,
  omcite: knowledgeGuide,
};

function KnowledgeCatalogSection({ section, query, onQueryChange }: { section: Exclude<KnowledgeCategoryId, "maps">; query: string; onQueryChange: (value: string) => void }) {
  const entries = catalogBySection[section];
  const [filter, setFilter] = useState("Все");
  const filters = ["Все", ...Array.from(new Set(entries.flatMap(entry => entry.tags))).slice(0, 7)];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleEntries = entries.filter(entry => {
    const matchesFilter = filter === "Все" || entry.tags.includes(filter);
    const haystack = `${entry.title} ${entry.subtitle ?? ""} ${entry.description} ${entry.tags.join(" ")}`.toLocaleLowerCase();
    return matchesFilter && haystack.includes(normalizedQuery);
  });
  const sectionTitle = categories.find(category => category.id === section)?.title ?? "База знаний";
  const sectionIntro: Record<typeof section, string> = {
    weapons: "Карточки оружия с типом применения, кратким описанием и ключевыми характеристиками.",
    characters: "Персонажи, их роли и описания особых способностей на русском языке.",
    pets: "Питомцы и навыки, которые помогают команде в бою, разведке и высадке.",
    updates: "Хронология обновлений, карт, режима, оружия, персонажей и игровых событий.",
    omcite: "Локальное руководство по использованию базы знаний и функций OMCITE.",
  };
  return <section className="knowledge-catalog-section panel space-y-5 p-5 sm:p-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">База знаний OMCITE</p><h2 className="section-title mt-2">{sectionTitle}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{sectionIntro[section]}</p></div><span className="knowledge-catalog-count">{visibleEntries.length} материалов</span></div>
    <label className="block max-w-xl"><span className="sr-only">Поиск в разделе</span><input className="field" value={query} onChange={event => onQueryChange(event.target.value)} placeholder={`Поиск в разделе «${sectionTitle}»`} /></label>
    <div className="knowledge-catalog-filters" role="tablist" aria-label={`Фильтры раздела ${sectionTitle}`}>{filters.map(item => <button key={item} type="button" role="tab" aria-selected={filter === item} onClick={() => setFilter(item)} className={filter === item ? "is-active" : ""}>{item}</button>)}</div>
    <div className="knowledge-catalog-grid">{visibleEntries.map(entry => <article className="knowledge-catalog-card" key={entry.id}>
      <div className="knowledge-catalog-card-image">{entry.imageUrl ? <Image src={entry.imageUrl} alt={`${entry.title}: иллюстрация`} fill sizes="(min-width: 900px) 220px, 100vw" unoptimized /> : <span>{entry.title.slice(0, 2).toUpperCase()}</span>}{entry.subtitle && <small>{entry.subtitle}</small>}</div>
      <div className="knowledge-catalog-card-body"><div className="flex items-start justify-between gap-3"><h3>{entry.title}</h3>{typeof entry.value === "number" && <strong className="knowledge-catalog-value">{entry.value}</strong>}</div><p>{entry.description}</p><div className="knowledge-catalog-tags">{entry.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
    </article>)}</div>
    {!visibleEntries.length && <p className="rounded-xl border border-white/10 bg-slate-950/40 p-6 text-sm text-slate-400">По вашему запросу материалы не найдены.</p>}
  </section>;
}

export default function KnowledgePage() {
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<KnowledgeCategoryId>("maps");
  const [selectedMap, setSelectedMap] = useState<(typeof mapCatalog)[number]["id"]>("solara");
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const currentMap = mapCatalog.find(map => map.id === selectedMap) ?? mapCatalog[0];
  const currentLocation = currentMap.locations.find(location => location.id === selectedLocation);
  const copy = { eyebrow: "Библиотека OMCITE", title: "База знаний", search: "Поиск по материалам", map: "Карты и места высадки", location: "Место высадки", official: "Материал базы знаний", open: "Открыть материал", details: "О карте", gallery: "Фотографии карты", source: "Материал базы знаний", choose: "Выберите область на карте" };

  useEffect(() => {
    document.body.classList.toggle("knowledge-garena-mode", section === "maps");
    return () => document.body.classList.remove("knowledge-garena-mode");
  }, [section]);

  if (section === "maps") return <main className="knowledge-garena-root"><h1 className="sr-only">{copy.title}</h1><GarenaMapViewer currentMap={currentMap} selectedLocation={selectedLocation} onMapChange={id => { setSelectedMap(id); setSelectedLocation(null); }} onLocationChange={setSelectedLocation} onSectionChange={setSection} /><nav className="garena-section-switcher" aria-label="Другие разделы базы знаний">{categories.filter(item => item.id !== "maps").map(item => <button key={item.id} type="button" onClick={() => setSection(item.id)}>{item.title}</button>)}</nav></main>;

  const legacySection = section as KnowledgeCategoryId;
  return <main className="page-shell space-y-6">
    <section className="panel space-y-4 p-6 sm:p-8">
      <p className="eyebrow">{copy.eyebrow}</p><h1 className="section-title">{copy.title}</h1>
      <p className="max-w-3xl text-slate-300">Справочные материалы, карты, фотографии и описания собраны внутри базы знаний OMCITE. Названия карт и локаций в интерфейсе мероприятия используются на русском языке.</p>
      <label className="block max-w-xl"><span className="sr-only">{copy.search}</span><input className="field" value={query} onChange={event => setQuery(event.target.value)} placeholder={copy.search} /></label>
    </section>

    <nav className="flex flex-wrap gap-2" aria-label="Разделы базы знаний">{categories.map(category => <button key={category.id} type="button" onClick={() => setSection(category.id)} className={`rounded-full border px-3 py-2 text-sm ${section === category.id ? "border-cyan-300 bg-cyan-950 text-cyan-100" : "border-white/15 text-slate-400"}`}>{category.title}</button>)}</nav>

    {legacySection === "maps" ? <section id="knowledge-map" className="panel space-y-5 p-5 sm:p-7">
      <div><p className="eyebrow">{copy.map}</p><h2 className="section-title mt-2">{currentMap.title}</h2></div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Карты базы знаний">{mapCatalog.map(map => <button key={map.id} data-testid={`knowledge-map-${map.id}`} type="button" role="tab" aria-selected={selectedMap === map.id} onClick={() => { setSelectedMap(map.id); setSelectedLocation(null); }} className={`rounded-full border px-3 py-1 text-sm transition ${selectedMap === map.id ? "border-cyan-300 bg-cyan-950 text-cyan-100" : "border-white/15 text-slate-400 hover:border-cyan-300/60 hover:text-white"}`}>{map.title}</button>)}</div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,.85fr)]">
        <div className="relative min-h-72 overflow-hidden rounded-2xl border border-cyan-400/25 bg-slate-950 shadow-2xl shadow-cyan-950/20">
          <Image data-testid="knowledge-map-image" src={currentMap.imageUrl} alt={`Карта ${currentMap.title}`} className="h-full min-h-72 w-full object-cover" fill sizes="(min-width: 1024px) 60vw, 100vw" priority unoptimized />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5"><p className="text-xs uppercase tracking-[.18em] text-cyan-200">{copy.source}</p><p className="mt-1 text-2xl font-black text-white">{currentMap.title}</p></div>
        </div>
        <div className="space-y-4">
          <div><p className="eyebrow">{copy.details}</p><p className="mt-2 text-sm leading-6 text-slate-300">{currentMap.description}</p></div>
          <p className="text-sm text-cyan-300">Вся информация открывается на сайте OMCITE и доступна без переходов на другие страницы.</p>
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"><p className="text-sm font-semibold text-white">{copy.choose}</p><div className="mt-3 grid grid-cols-2 gap-2">{currentMap.locations.map(location => <button key={location.id} type="button" onClick={() => setSelectedLocation(location.id)} className={`rounded-lg border px-2.5 py-2 text-left text-xs transition ${selectedLocation === location.id ? "border-cyan-300 bg-cyan-950/80 text-cyan-50" : "border-white/10 bg-slate-900/50 text-slate-300 hover:border-cyan-300/60 hover:text-white"}`}>{location.title}</button>)}</div></div>
          {currentLocation && <div className="rounded-2xl border border-cyan-300/30 bg-cyan-950/30 p-4"><p className="text-xs uppercase tracking-[.18em] text-cyan-300">{copy.location}</p><p className="mt-1 text-lg font-bold text-white">{currentLocation.title}</p><p className="mt-1 text-sm text-slate-300">Точка доступна для выбора при внесении статистики и расчёта любимой локации команды.</p></div>}
        </div>
      </div>
      <div><p className="eyebrow">{copy.gallery}</p><div className="mt-3 grid gap-3 sm:grid-cols-3">{currentMap.gallery.map((imageUrl, index) => <div key={imageUrl} className="group overflow-hidden rounded-xl border border-white/10 bg-slate-950"><Image src={imageUrl} alt={`${currentMap.title}: фотография ${index + 1}`} width={640} height={360} className="h-32 w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" unoptimized /></div>)}</div></div>
    </section> : <KnowledgeCatalogSection section={legacySection} query={query} onQueryChange={setQuery} />}
  </main>;
}
