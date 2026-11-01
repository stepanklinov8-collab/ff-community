/** Only route names are collected: never query strings, tokens or form values. */
export function analyticsPath(pathname: string) {
  return pathname.split(/[?#]/, 1)[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":id")
    .replace(/[^a-zA-Z0-9_:/-]/g, "").slice(0, 160) || "/";
}
export function analyticsActive(visible: boolean, focused: boolean, lastInteraction: number, now: number) {
  return visible && focused && now >= lastInteraction && now - lastInteraction <= 120_000;
}
export function activityDuration(seconds: number) {
  if (seconds > 0 && seconds < 60) return `${Math.floor(seconds)} с`;
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} ч ${minutes % 60} мин` : `${minutes} мин`;
}
export function analyticsPageTitle(path: string) {
  const names:Record<string,string>={"/":"Главная","/auth":"Вход и регистрация","/profile":"Мой профиль","/profile/:id":"Профиль игрока","/my-organizations":"Мои организации","/teams":"Команды и гильдии","/teams/:id":"Профиль организации","/tournaments":"Расписание","/tournaments/:id":"Мероприятие","/tournaments/:id/results":"Результаты мероприятия","/tournaments/:id/manage-results":"Ввод результатов","/rating":"Рейтинг игроков","/teams-stats":"Рейтинг организаций","/contracts":"Контракты","/transfers":"Переходы игроков","/market":"Сделки организаций","/wallet":"Кошелёк","/betting":"Прогнозы","/chat":"Чат","/knowledge":"База знаний","/admin/analytics":"Статистика пользователей"};
  return names[path]??(path.startsWith("/admin")?"Администрирование":path);
}
