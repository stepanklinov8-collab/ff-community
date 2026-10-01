export const mapCatalog = [
  { id: "bermuda", title: "Бермуды", locations: ["Peak", "Clock Tower", "Factory", "Pochinok", "Rim Nam Village", "Mars Electric"] },
  { id: "nexterra", title: "Нэкст Терра", locations: ["Grav Labs", "Intellect Center", "Mud Site", "Twin Bridges", "Deca Square", "Zipway"] },
  { id: "solara", title: "Солара", locations: ["Stadium", "Aquarium", "Condominiums", "Stellar", "Aqueduct", "Rooftop"] },
  { id: "purgatory", title: "Чистилище", locations: ["Brasilia", "Central", "Ski Lodge", "Moathouse", "Crossroads", "Forge"] },
  { id: "kalahari", title: "Калахари", locations: ["Refinery", "Command Post", "Bayfront", "Shrine", "Confinement", "Santa Catarina"] },
] as const;

export type MapId = (typeof mapCatalog)[number]["id"];
export type MapLocation = (typeof mapCatalog)[number]["locations"][number];

export function locationsForMap(map: string) {
  return mapCatalog.find(item => item.id === map)?.locations ?? [];
}

export function mapTitle(map: string) {
  return mapCatalog.find(item => item.id === map)?.title ?? map;
}

export function isKnownLandingLocation(map: string, location: string | null | undefined) {
  return !location || locationsForMap(map).includes(location as never);
}
