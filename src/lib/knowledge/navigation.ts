import type { KnowledgeCategoryId } from "@/lib/knowledge/catalog";

export const knowledgeSections: Array<{ id: KnowledgeCategoryId; title: string; text: string }> = [
  { id: "overview", title: "Об игре", text: "Режимы, командная игра, события и соревновательная сцена." },
  { id: "maps", title: "Карты и локации", text: "Русские названия карт и всех доступных точек высадки." },
  { id: "weapons", title: "Оружие", text: "Типы оружия, характеристики и изменения баланса, собранные в базе." },
  { id: "characters", title: "Персонажи", text: "Персонажи, способности, пресеты и изменения навыков." },
  { id: "pets", title: "Питомцы", text: "Питомцы, навыки и правила их использования." },
  { id: "updates", title: "Новости", text: "Новости, изменения игрового процесса и история обновлений." },
  { id: "media", title: "Медиа", text: "Видео, иллюстрации и материалы для участников и организаторов." },
  { id: "support", title: "Поддержка", text: "Ответы по профилю, мероприятиям, результатам и безопасности." },
  { id: "universe", title: "Вселенная", text: "Режимы, роли, карты и соревновательная история проекта." },
  { id: "omcite", title: "Руководство OMCITE", text: "Регистрация, команды, результаты и правила мероприятий." },
];

export function isKnowledgeSection(value: string | null): value is KnowledgeCategoryId {
  return knowledgeSections.some((section) => section.id === value);
}
