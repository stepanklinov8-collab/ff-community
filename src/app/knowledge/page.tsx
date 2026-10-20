"use client";

import Image from "next/image";
import { Suspense, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { type KnowledgeCategoryId } from "@/lib/knowledge/catalog";
import type { KnowledgeCatalogEntry } from "@/lib/knowledge/types";
import { loadKnowledgeSection } from "@/lib/knowledge/load-section";
import { isKnowledgeSection, knowledgeSections as categories } from "@/lib/knowledge/navigation";

const KnowledgeMaps = dynamic(() => import("@/components/knowledge/MapSection"), { loading: () => <p className="page-shell" role="status">Загрузка карты…</p> });

function CatalogDetails({ entry }: { entry: KnowledgeCatalogEntry }) {
  const character = entry.character;
  if (character) return <details className="knowledge-entry-details">
    <summary>Способность и биография</summary>
    <div className="knowledge-entry-detail-content">
      {character.baseAbility && <><h4>{character.baseAbility.name} · Базовый навык</h4><p>{character.baseAbility.description}</p></>}
      <h4>{character.abilityName}{character.awakened ? " · Пробуждение" : ""}</h4>
      <p>{character.abilityDescription}</p>
      {character.parameters.length > 0 && <dl>{character.parameters.map(parameter => <div key={parameter.label}><dt>{parameter.label}</dt><dd>{parameter.value}</dd></div>)}</dl>}
      <p className="knowledge-detail-note">{character.awakened ? "Здесь описан пробуждённый навык из официальной карточки. " : ""}Указаны опубликованные параметры. Неуказанные значения урона, длительности и перезарядки в карточке отсутствуют.</p>
      <h4>Биография</h4>
      <dl><div><dt>Возраст, лет</dt><dd>{character.age ?? "Не указан"}</dd></div><div><dt>День рождения</dt><dd>{character.birthday}</dd></div><div><dt>Пол</dt><dd>{character.gender}</dd></div></dl>
      <p>{character.biography}</p>
      <p className="knowledge-detail-note">HP — здоровье, EP — энергия, SP — очки щита. Сведения о возрасте относятся к игровой биографии.</p>
    </div>
  </details>;
  if (entry.stats) return <details className="knowledge-entry-details knowledge-weapon-stats">
    <summary>Характеристики и обвесы</summary>
    <div className="knowledge-entry-detail-content">
      <dl>{entry.stats.map(stat => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value ?? "—"}</dd></div>)}</dl>
      <p className="knowledge-detail-note">Магазин — число боеприпасов. Остальные числа — показатели шкал каталога: урон не равен гарантированной потере HP, а скорость перезарядки не обозначает секунды. Прочерк — значение не опубликовано или неприменимо.</p>
      <h4>Обвесы, отмеченные в каталоге</h4>
      {entry.attachments?.length ? <ul className="knowledge-attachment-list">{entry.attachments.map(attachment => <li key={attachment}>{attachment}</li>)}</ul> : <p>Обвесы не отмечены.</p>}
      <p className="knowledge-detail-note">Время перезарядки в секундах, интервалы выстрелов и таблица урона по частям тела в официальной карточке не приведены.</p>
    </div>
  </details>;
  return null;
}

function KnowledgeCatalogSection({ section, query, onQueryChange }: { section: Exclude<KnowledgeCategoryId, "maps">; query: string; onQueryChange: (value: string) => void }) {
  const [entries, setEntries] = useState<readonly KnowledgeCatalogEntry[]>([]);
  const [loaded, setLoaded] = useState(false), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void loadKnowledgeSection(section).then(data => { if (active) { setEntries(data); setLoaded(true); setError(false); } })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [section, attempt]);
  const [filter, setFilter] = useState("Все");
  const filters = ["Все", ...(section === "weapons" ? Array.from(new Set(entries.map(entry => entry.tags[0]))) : section === "characters" ? ["Пробуждение", ...Array.from(new Set(entries.flatMap(entry => entry.tags))).filter(tag => tag !== "Пробуждение").slice(0, 7)] : Array.from(new Set(entries.flatMap(entry => entry.tags))).slice(0, 7))];
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleEntries = entries.filter(entry => {
    const matchesFilter = filter === "Все" || entry.tags.includes(filter);
    const haystack = `${entry.title} ${entry.subtitle ?? ""} ${entry.description} ${entry.tags.join(" ")} ${entry.character?.abilityName ?? ""} ${entry.character?.baseAbility?.name ?? ""} ${entry.character?.biography ?? ""}`.toLocaleLowerCase();
    return matchesFilter && haystack.includes(normalizedQuery);
  });
  const sectionTitle = categories.find(category => category.id === section)?.title ?? "База знаний";
  const sectionIntro: Record<typeof section, string> = {
    overview: "Краткий обзор игры, командных форматов, персонажей, событий и соревновательной сцены.",
    weapons: "Описания оружия, восемь показателей и обвесы. Раскройте карточку, чтобы увидеть характеристики.",
    characters: "Биографии, способности и опубликованные параметры 65 персонажей. Все описания доступны на русском прямо в карточках.",
    pets: "Питомцы и навыки, которые помогают команде в бою, разведке и высадке.",
    updates: "Хронология обновлений, карт, режима, оружия, персонажей и игровых событий.",
    media: "Видео, изображения и материалы для подготовки к матчам и публикации мероприятий.",
    support: "Пошаговые ответы по профилю, регистрации, результатам и безопасности данных.",
    universe: "Справочник режимов, ролей, карт и соревновательной истории проекта.",
    omcite: "Локальное руководство по использованию базы знаний и функций OMCITE.",
  };
  if (!loaded) return <section className="panel p-7">{error ? <p role="alert">Не удалось загрузить раздел. <button type="button" className="text-cyan-300" onClick={() => setAttempt(value => value + 1)}>Повторить</button></p> : <p role="status">Загрузка раздела…</p>}</section>;
  return <section className="knowledge-catalog-section panel space-y-5 p-5 sm:p-7">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">База знаний OMCITE</p><h2 className="section-title mt-2">{sectionTitle}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{sectionIntro[section]}</p></div><span className="knowledge-catalog-count">{visibleEntries.length} материалов</span></div>
    <label className="block max-w-xl"><span className="sr-only">Поиск в разделе</span><input className="field" value={query} onChange={event => onQueryChange(event.target.value)} placeholder={`Поиск в разделе «${sectionTitle}»`} /></label>
    <div className="knowledge-catalog-filters" role="tablist" aria-label={`Фильтры раздела ${sectionTitle}`}>{filters.map(item => <button key={item} type="button" role="tab" aria-selected={filter === item} onClick={() => setFilter(item)} className={filter === item ? "is-active" : ""}>{item}</button>)}</div>
    <div className="knowledge-catalog-grid">{visibleEntries.map(entry => <article className="knowledge-catalog-card" key={entry.id}>
      <div className={`knowledge-catalog-card-image ${section === "weapons" ? "is-weapon" : section === "characters" ? "is-character" : section === "pets" ? "is-pet" : ""}`}>{entry.imageUrl ? <Image src={entry.imageUrl} alt={`${entry.title}: иллюстрация`} fill sizes="(min-width: 900px) 220px, 100vw" unoptimized /> : <span>{entry.title.slice(0, 2).toUpperCase()}</span>}{entry.subtitle && section !== "characters" && <small>{entry.subtitle}</small>}</div>
      <div className="knowledge-catalog-card-body"><div className="flex items-start justify-between gap-3"><h3>{entry.title}</h3>{typeof entry.value === "number" && <strong className="knowledge-catalog-value">{entry.value}</strong>}</div>{section === "characters" && entry.subtitle && <p className="knowledge-character-subtitle">{entry.subtitle}</p>}<p>{entry.description}</p><div className="knowledge-catalog-tags">{entry.tags.map(tag => <span key={tag}>{tag}</span>)}</div><CatalogDetails entry={entry} /></div>
    </article>)}</div>
    {!visibleEntries.length && <p className="rounded-xl border border-white/10 bg-slate-950/40 p-6 text-sm text-slate-400">По вашему запросу материалы не найдены.</p>}
    {(section === "weapons" || section === "characters") && <p className="knowledge-detail-note">Справочник проверен 06.10.2026 по официальному каталогу игры. Баланс может меняться с обновлениями; сведения относятся к опубликованной версии карточек.</p>}
  </section>;
}

function KnowledgePageContent() {
  const [query, setQuery] = useState("");
  const searchParams = useSearchParams();
  const requestedSection = searchParams.get("section");
  const section: KnowledgeCategoryId = isKnowledgeSection(requestedSection) ? requestedSection : "maps";
  const copy = { eyebrow: "Библиотека OMCITE", title: "База знаний", search: "Поиск по материалам", map: "Карты и места высадки", location: "Место высадки", official: "Материал базы знаний", open: "Открыть материал", details: "О карте", gallery: "Фотографии карты", source: "Материал базы знаний", choose: "Выберите область на карте" };

  if (section === "maps") return <KnowledgeMaps />;

  const legacySection = section as Exclude<KnowledgeCategoryId, "maps">;
  return <main className="page-shell knowledge-page-shell space-y-6">
    <section className="panel space-y-4 p-6 sm:p-8">
      <p className="eyebrow">{copy.eyebrow}</p><h1 className="section-title">{copy.title}</h1>
      <p className="max-w-3xl text-slate-300">Справочные материалы, карты, фотографии и описания собраны внутри базы знаний OMCITE. Названия карт и локаций в интерфейсе мероприятия используются на русском языке.</p>
      <label className="block max-w-xl"><span className="sr-only">{copy.search}</span><input className="field" value={query} onChange={event => setQuery(event.target.value)} placeholder={copy.search} /></label>
    </section>

    <KnowledgeCatalogSection key={legacySection} section={legacySection} query={query} onQueryChange={setQuery} />
  </main>;
}

export default function KnowledgePage() {
  return <Suspense fallback={<main className="page-shell"><section className="panel p-8 text-slate-300">Загрузка базы знаний…</section></main>}><KnowledgePageContent /></Suspense>;
}
