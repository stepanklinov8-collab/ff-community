export type KnowledgeCategoryId = "overview" | "maps" | "weapons" | "characters" | "pets" | "updates" | "media" | "support" | "universe" | "omcite";

export type OfficialKnowledgeItem = {
  id: string;
  category: Exclude<KnowledgeCategoryId, "overview" | "omcite">;
  title: string;
  description: string;
  href: string;
};

export const officialKnowledgeItems: readonly OfficialKnowledgeItem[] = [
  { id: "maps", category: "maps", title: "Карты и точки интереса", description: "Каталог карт с описаниями и точками интереса, доступный внутри базы знаний.", href: "https://ff.garena.com/en/maps/" },
  { id: "weapons", category: "weapons", title: "Оружие и характеристики", description: "Каталог оружия, типов, характеристик и описаний внутри базы знаний.", href: "https://ff.garena.com/en/weapons/" },
  { id: "characters", category: "characters", title: "Персонажи и способности", description: "Список персонажей и их навыков внутри базы знаний.", href: "https://ff.garena.com/en/chars" },
  { id: "pets", category: "pets", title: "Питомцы и навыки", description: "Каталог питомцев и их навыков внутри базы знаний.", href: "https://ff.garena.com/en/pets/" },
  { id: "updates", category: "updates", title: "Обновления и патчноуты", description: "Новости, изменения карт, оружия, персонажей и питомцев внутри базы знаний.", href: "https://ff.garena.com/en/news/" },
];

export const officialKnowledgeHighlights = [
  { category: "updates" as const, title: "OB55: последние патчноуты", description: "Актуальные изменения игрового процесса, баланса и контента.", href: "https://ff.garena.com/en/article/" },
  { category: "updates" as const, title: "Система персонажей и питомцев", description: "Официальное описание пресетов, навыков и механики питомцев.", href: "https://ff.garena.com/en/article/1120/" },
  { category: "maps" as const, title: "Солара", description: "Официальное описание карты, районов, слайдов и динамической погоды.", href: "https://ff.garena.com/en/article/1482/" },
  { category: "pets" as const, title: "Питомцы и навыки", description: "Официальный материал о роли питомцев и смене навыков.", href: "https://ff.garena.com/en/article/228/" },
] as const;
