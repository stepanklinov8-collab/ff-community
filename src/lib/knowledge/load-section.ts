import type {KnowledgeCategoryId} from "./catalog";
import type {KnowledgeCatalogEntry} from "./types";
const loaders:Record<Exclude<KnowledgeCategoryId,"maps">,()=>Promise<readonly KnowledgeCatalogEntry[]>>={
  overview:()=>import("./catalog-data/overview").then(module=>module.knowledgeOverview),
  weapons:()=>import("./catalog-data/weapons").then(module=>module.knowledgeWeapons),
  characters:()=>import("./catalog-data/characters").then(module=>module.knowledgeCharacters),
  pets:()=>import("./catalog-data/pets").then(module=>module.knowledgePets),
  updates:()=>import("./catalog-data/updates").then(module=>module.knowledgeUpdates),
  media:()=>import("./catalog-data/media").then(module=>module.knowledgeMedia),
  support:()=>import("./catalog-data/support").then(module=>module.knowledgeSupport),
  universe:()=>import("./catalog-data/universe").then(module=>module.knowledgeUniverse),
  omcite:()=>import("./catalog-data/omcite").then(module=>module.knowledgeGuide),
};
export function loadKnowledgeSection(section:Exclude<KnowledgeCategoryId,"maps">){return loaders[section]();}
