"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { mapCatalog } from "@/lib/competition/map-catalog";
import { type KnowledgeCategoryId } from "@/lib/knowledge/catalog";
import { knowledgeCharacters, knowledgeGuide, knowledgeMedia, knowledgeOverview, knowledgePets, knowledgeSupport, knowledgeUniverse, knowledgeUpdates, knowledgeWeapons, type KnowledgeCatalogEntry } from "@/lib/knowledge/game-catalog";
import { isKnowledgeSection, knowledgeSections as categories } from "@/lib/knowledge/navigation";

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

function GarenaMapViewer({ currentMap, selectedLocation, mapScale, onMapChange, onLocationChange, onScaleChange }: {
  currentMap: (typeof mapCatalog)[number];
  selectedLocation: string | null;
  mapScale: number;
  onMapChange: (id: (typeof mapCatalog)[number]["id"]) => void;
  onLocationChange: (id: string) => void;
  onScaleChange: (scale: number) => void;
}) {
  const currentLocation = currentMap.locations.find(location => location.id === selectedLocation);
  return <div className="garena-map-page">
    <section className="garena-map-stage" aria-label={`Карта ${currentMap.title}`}>
      <div className="garena-map-viewport">
      <div className="garena-map-canvas" style={{ transform: `scale(${mapScale})` }}><Image data-testid="knowledge-map-image" src={currentMap.imageUrl} alt={`Карта ${currentMap.title}`} fill sizes="(min-width: 1000px) 1000px, 100vw" priority unoptimized className="garena-map-image" /><div className="garena-map-grid" aria-hidden="true" />
        {currentMap.locations.map((location, index) => { const point = markerPosition(currentMap.id, index, currentMap.locations.length); const photo = currentMap.id === "solara" ? solaraMarkerPositions[location.id]?.photo : undefined; return <button key={location.id} type="button" className={`garena-map-marker ${selectedLocation === location.id ? "is-selected" : ""}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} onClick={() => onLocationChange(location.id)} aria-label={location.title}><span className="garena-map-marker-name">{location.title}</span>{selectedLocation === location.id && photo && <span className="garena-map-marker-photo"><Image src={photo} alt={`${location.title}: фотография`} fill sizes="96px" unoptimized /></span>}</button>; })}
      </div>
      </div>
      <div className="knowledge-map-zoom" aria-label="Масштаб карты"><button type="button" onClick={() => onScaleChange(Math.max(0.7, Number((mapScale - 0.1).toFixed(1))))} aria-label="Уменьшить карту">−</button><span>{Math.round(mapScale * 100)}%</span><button type="button" onClick={() => onScaleChange(Math.min(1.8, Number((mapScale + 0.1).toFixed(1))))} aria-label="Увеличить карту">+</button><button type="button" className="knowledge-map-fit" onClick={() => onScaleChange(1)}>Вписать</button></div>
      <div className="garena-map-selector"><div className="garena-map-current"><Image src={currentMap.thumbnailUrl} alt="" width={180} height={102} unoptimized className="garena-map-current-thumb" /><div className="garena-map-current-info"><p className="garena-map-current-title">{currentMap.title}</p><p className="garena-map-current-description">{currentLocation ? `${currentLocation.title}: точка выбрана для дальнейшей статистики.` : currentMap.description}</p><span className="garena-map-local-badge">Материал и фотографии доступны внутри базы знаний</span><div className="knowledge-map-gallery" aria-label={`Фотографии карты ${currentMap.title}`}>{currentMap.gallery.map((imageUrl, index) => <Image key={imageUrl} src={imageUrl} alt={`${currentMap.title}, фотография ${index + 1}`} width={54} height={34} unoptimized />)}</div></div></div><div className="garena-map-list" role="tablist" aria-label="Карты базы знаний">{mapDisplayOrder.map(map => <button key={map.id} data-testid={`knowledge-map-${map.id}`} type="button" role="tab" aria-selected={map.id === currentMap.id} className={`garena-map-choice ${map.id === currentMap.id ? "is-active" : ""}`} onClick={() => onMapChange(map.id)}><Image src={map.thumbnailUrl} alt="" width={128} height={72} unoptimized /><span>{map.title}</span></button>)}</div></div>
    </section>
  </div>;
}

const catalogBySection: Record<Exclude<KnowledgeCategoryId, "maps">, readonly KnowledgeCatalogEntry[]> = {
  overview: knowledgeOverview,
  weapons: knowledgeWeapons,
  characters: knowledgeCharacters,
  pets: knowledgePets,
  updates: knowledgeUpdates,
  media: knowledgeMedia,
  support: knowledgeSupport,
  universe: knowledgeUniverse,
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
    overview: "Краткий обзор игры, командных форматов, персонажей, событий и соревновательной сцены.",
    weapons: "Карточки оружия с типом применения, кратким описанием и ключевыми характеристиками.",
    characters: "Персонажи, их роли и описания особых способностей на русском языке.",
    pets: "Питомцы и навыки, которые помогают команде в бою, разведке и высадке.",
    updates: "Хронология обновлений, карт, режима, оружия, персонажей и игровых событий.",
    media: "Видео, изображения и материалы для подготовки к матчам и публикации мероприятий.",
    support: "Пошаговые ответы по профилю, регистрации, результатам и безопасности данных.",
    universe: "Справочник режимов, ролей, карт и соревновательной истории проекта.",
    omcite: "Локальное руководство по использованию базы знаний и функций OMCITE.",
  };
  return <section className="knowledge-catalog-section panel space-y-5 p-5 sm:p-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">База знаний OMCITE</p><h2 className="section-title mt-2">{sectionTitle}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{sectionIntro[section]}</p></div><span className="knowledge-catalog-count">{visibleEntries.length} материалов</span></div>
    <label className="block max-w-xl"><span className="sr-only">Поиск в разделе</span><input className="field" value={query} onChange={event => onQueryChange(event.target.value)} placeholder={`Поиск в разделе «${sectionTitle}»`} /></label>
    <div className="knowledge-catalog-filters" role="tablist" aria-label={`Фильтры раздела ${sectionTitle}`}>{filters.map(item => <button key={item} type="button" role="tab" aria-selected={filter === item} onClick={() => setFilter(item)} className={filter === item ? "is-active" : ""}>{item}</button>)}</div>
    <div className="knowledge-catalog-grid">{visibleEntries.map(entry => <article className="knowledge-catalog-card" key={entry.id}>
      <div className={`knowledge-catalog-card-image ${section === "weapons" ? "is-weapon" : ""}`}>{entry.imageUrl ? <Image src={entry.imageUrl} alt={`${entry.title}: иллюстрация`} fill sizes="(min-width: 900px) 220px, 100vw" unoptimized /> : <span>{entry.title.slice(0, 2).toUpperCase()}</span>}{entry.subtitle && <small>{entry.subtitle}</small>}</div>
      <div className="knowledge-catalog-card-body"><div className="flex items-start justify-between gap-3"><h3>{entry.title}</h3>{typeof entry.value === "number" && <strong className="knowledge-catalog-value">{entry.value}</strong>}</div><p>{entry.description}</p><div className="knowledge-catalog-tags">{entry.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
    </article>)}</div>
    {!visibleEntries.length && <p className="rounded-xl border border-white/10 bg-slate-950/40 p-6 text-sm text-slate-400">По вашему запросу материалы не найдены.</p>}
  </section>;
}

function KnowledgePageContent() {
  const [query, setQuery] = useState("");
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section");
  const section: KnowledgeCategoryId = isKnowledgeSection(requestedSection) ? requestedSection : "maps";
  const [selectedMap, setSelectedMap] = useState<(typeof mapCatalog)[number]["id"]>("solara");
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [mapScale, setMapScale] = useState(1);
  const currentMap = mapCatalog.find(map => map.id === selectedMap) ?? mapCatalog[0];
  const copy = { eyebrow: "Библиотека OMCITE", title: "База знаний", search: "Поиск по материалам", map: "Карты и места высадки", location: "Место высадки", official: "Материал базы знаний", open: "Открыть материал", details: "О карте", gallery: "Фотографии карты", source: "Материал базы знаний", choose: "Выберите область на карте" };

  if (section === "maps") return <main className="page-shell knowledge-page-shell space-y-6"><section className="panel space-y-3 p-6 sm:p-8"><p className="eyebrow">{copy.eyebrow}</p><h1 className="section-title">Карты и локации</h1><p className="max-w-3xl text-slate-300">Выберите карту и точку высадки. Все названия приведены на русском языке, а выбранная локация может использоваться в статистике команд.</p></section><GarenaMapViewer currentMap={currentMap} selectedLocation={selectedLocation} mapScale={mapScale} onMapChange={id => { setSelectedMap(id); setSelectedLocation(null); setMapScale(1); }} onLocationChange={setSelectedLocation} onScaleChange={setMapScale} /></main>;

  const legacySection = section as Exclude<KnowledgeCategoryId, "maps">;
  return <main className="page-shell knowledge-page-shell space-y-6">
    <section className="panel space-y-4 p-6 sm:p-8">
      <p className="eyebrow">{copy.eyebrow}</p><h1 className="section-title">{copy.title}</h1>
      <p className="max-w-3xl text-slate-300">Справочные материалы, карты, фотографии и описания собраны внутри базы знаний OMCITE. Названия карт и локаций в интерфейсе мероприятия используются на русском языке.</p>
      <label className="block max-w-xl"><span className="sr-only">{copy.search}</span><input className="field" value={query} onChange={event => setQuery(event.target.value)} placeholder={copy.search} /></label>
    </section>

    <KnowledgeCatalogSection section={legacySection} query={query} onQueryChange={setQuery} />
  </main>;
}

export default function KnowledgePage() {
  return <Suspense fallback={<main className="page-shell"><section className="panel p-8 text-slate-300">Загрузка базы знаний…</section></main>}><KnowledgePageContent /></Suspense>;
}
