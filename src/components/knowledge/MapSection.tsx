"use client";
import Image from "next/image";
import {useState} from "react";
import {mapCatalog} from "@/lib/competition/map-catalog";
import {knowledgeMapPoints,mapLabelOffset} from "@/lib/knowledge/map-points";
const mapDisplayOrder = ["solara", "nexterra", "alpine", "bermuda_remastered", "bermuda", "purgatory", "kalahari"]
  .map(id => mapCatalog.find(map => map.id === id))
  .filter((map): map is (typeof mapCatalog)[number] => Boolean(map));

function GarenaMapViewer({ currentMap, selectedLocation, mapScale, onMapChange, onLocationChange, onScaleChange }: {
  currentMap: (typeof mapCatalog)[number];
  selectedLocation: string | null;
  mapScale: number;
  onMapChange: (id: (typeof mapCatalog)[number]["id"]) => void;
  onLocationChange: (id: string) => void;
  onScaleChange: (scale: number) => void;
}) {
  const currentLocation = currentMap.locations.find(location => location.id === selectedLocation);
  const points = knowledgeMapPoints[currentMap.id];
  const labelOffset = currentMap.id === "solara" ? mapLabelOffset : 0;
  const currentPoint = points.find(point => point.locationId === selectedLocation);
  const gallery = [...new Set([...(currentPoint?.photo ? [currentPoint.photo] : []), ...currentMap.gallery])];
  return <div className="garena-map-page">
    <section className="garena-map-stage" aria-label={`Карта ${currentMap.title}`}>
      <div className="garena-map-viewport">
      <div className="garena-map-canvas" style={{ transform: `scale(${mapScale})` }}><Image data-testid="knowledge-map-image" src={currentMap.imageUrl} alt={`Карта ${currentMap.title}`} fill sizes="(min-width: 1000px) 1000px, 100vw" priority unoptimized className="garena-map-image" />
        {points.map(point => {
          const location = currentMap.locations.find(item => item.id === point.locationId);
          if (!location) return null;
          return <button key={location.id} type="button" data-location-id={location.id} className={`garena-map-marker ${currentMap.id !== "solara" ? "is-flat" : ""} ${point.printedLabelWidth ? "replaces-printed-label" : ""} ${selectedLocation === location.id ? "is-selected" : ""}`} style={{ left: `${(point.x - labelOffset) / 10}%`, top: `${(point.y - labelOffset) / 10}%`, minWidth: point.printedLabelWidth ? `${point.printedLabelWidth / 10}cqw` : undefined }} onClick={() => onLocationChange(location.id)} aria-label={location.title} aria-pressed={selectedLocation === location.id}><span className="garena-map-marker-name">{point.label ?? location.title}</span></button>;
        })}
      </div>
      </div>
      <div className="knowledge-map-zoom" aria-label="Масштаб карты"><button type="button" onClick={() => onScaleChange(Math.max(0.7, Number((mapScale - 0.1).toFixed(1))))} aria-label="Уменьшить карту">−</button><span>{Math.round(mapScale * 100)}%</span><button type="button" onClick={() => onScaleChange(Math.min(1.8, Number((mapScale + 0.1).toFixed(1))))} aria-label="Увеличить карту">+</button><button type="button" className="knowledge-map-fit" onClick={() => onScaleChange(1)}>Вписать</button></div>
      <div className="garena-map-selector"><div className="garena-map-current"><Image src={currentMap.thumbnailUrl} alt="" width={180} height={102} unoptimized className="garena-map-current-thumb" /><div className="garena-map-current-info"><p className="garena-map-current-title">{currentMap.title}</p><p className="garena-map-current-description">{currentLocation ? `${currentLocation.title}: точка выбрана для дальнейшей статистики.` : currentMap.description}</p><span className="garena-map-local-badge">Материал и фотографии доступны внутри базы знаний</span><div className="knowledge-map-gallery" aria-label={`Фотографии карты ${currentMap.title}`}>{gallery.map((imageUrl, index) => <Image key={imageUrl} src={imageUrl} alt={`${currentMap.title}, фотография ${index + 1}`} width={54} height={34} unoptimized />)}</div></div></div><div className="garena-map-list" role="tablist" aria-label="Карты базы знаний">{mapDisplayOrder.map(map => <button key={map.id} data-testid={`knowledge-map-${map.id}`} type="button" role="tab" aria-selected={map.id === currentMap.id} className={`garena-map-choice ${map.id === currentMap.id ? "is-active" : ""}`} onClick={() => onMapChange(map.id)}><Image src={map.thumbnailUrl} alt="" width={128} height={72} unoptimized /><span>{map.title}</span></button>)}</div></div>
    </section>
  </div>;
}


export default function MapSection(){
  const [selectedMap, setSelectedMap] = useState<(typeof mapCatalog)[number]["id"]>("solara");
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [mapScale, setMapScale] = useState(1);
  const currentMap = mapCatalog.find(map => map.id === selectedMap) ?? mapCatalog[0];

  return <main className="page-shell knowledge-page-shell space-y-6"><section className="panel space-y-3 p-6 sm:p-8"><p className="eyebrow">Библиотека OMCITE</p><h1 className="section-title">Карты и локации</h1><p className="max-w-3xl text-slate-300">Выберите карту и точку высадки. Все названия приведены на русском языке, а выбранная локация может использоваться в статистике команд.</p></section><GarenaMapViewer currentMap={currentMap} selectedLocation={selectedLocation} mapScale={mapScale} onMapChange={id => { setSelectedMap(id); setSelectedLocation(null); setMapScale(1); }} onLocationChange={setSelectedLocation} onScaleChange={setMapScale} /></main>;
}
