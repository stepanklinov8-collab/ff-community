export type KnowledgeCatalogEntry = {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  imageUrl?: string;
  tags: readonly string[];
  value?: number;
};

export const knowledgeOverview: readonly KnowledgeCatalogEntry[] = [
  { id: "overview-game", title: "Об игре", subtitle: "Динамичные матчи на выживание", description: "Короткие матчи с высадкой, поиском снаряжения, сужающейся зоной и борьбой за последнее место в живых.", tags: ["Игра", "Королевская битва"] },
  { id: "overview-squad", title: "Командная игра", subtitle: "Отряды и роли", description: "Команда распределяет роли, выбирает маршрут высадки и собирает состав под карту, формат и соперников.", tags: ["Команды", "Роли"] },
  { id: "overview-modes", title: "Игровые режимы", subtitle: "Турниры и тренировки", description: "В базе знаний собраны соревновательные форматы, командные сессии, квалификации и тренировочные матчи.", tags: ["Режимы", "Матчи"] },
  { id: "overview-characters", title: "Персонажи и навыки", subtitle: "Соберите подходящий набор", description: "Персонажи отличаются активными и пассивными способностями, которые помогают атаковать, защищаться, лечить и перемещаться.", tags: ["Персонажи", "Навыки"] },
  { id: "overview-events", title: "События и обновления", subtitle: "История изменений", description: "Крупные обновления добавляют карты, события, оружие, персонажей и изменения игрового баланса.", tags: ["Новости", "События"] },
  { id: "overview-esports", title: "Соревновательная сцена", subtitle: "Рейтинги OMCITE", description: "Результаты мероприятий формируют историю выступлений игроков, команд и гильдий внутри проекта.", tags: ["Киберспорт", "Рейтинги"] },
] as const;

export const knowledgeWeapons: readonly KnowledgeCatalogEntry[] = [
  { id: "laser-healing", title: "Лазерная лечащая пушка", description: "Наводится на союзника и восстанавливает ему здоровье. Лучше всего работает на средней дистанции рядом с напарником.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/138f1641addbe25de161dd0037cb80e9.png", tags: ["Средняя дистанция", "Исцеление"], value: 30 },
  { id: "shield-gun", title: "Щитовая пушка", description: "Создаёт силовое поле, которое защищает владельца от урона и может быть создано повторно после повреждения.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/0d3e888a3e44e38bcf1bf78a7a500f8b.png", tags: ["Средняя дистанция", "Щит"], value: 30 },
  { id: "gloo-melter", title: "Стеноплавитель", description: "После взрыва оставляет область коррозии, которая разрушает стены и усиливает урон по ним.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/88e13401f4662dc43580cfbf8f7f65fa.png", tags: ["Метательное оружие", "Урон по стенам"], value: 0 },
  { id: "m1216", title: "M1216", description: "Дробовик с очередями и гранатным режимом, пригодный для ближней и средней дистанции.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202212/3d5049d73829111f5fde250b61cda07f.png", tags: ["Граната", "Очередь"], value: 12 },
  { id: "rgs50", title: "РГС50", description: "Ручной гранатомёт против транспорта, который также наносит уменьшенный урон другим целям.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/9d391017b5b3671ec8f8adff68142ec2.png", tags: ["Урон по площади", "Редкое"], value: 3 },
  { id: "minigun", title: "Миниган", description: "Пулемёт с очень высоким уроном и темпом стрельбы, но с ограниченной мобильностью.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/bd5f753a589cb281e70cc6d17abbd42f.png", tags: ["Большой урон", "Высокая скорострельность"], value: 1200 },
  { id: "cg15", title: "CG15", description: "Пистолет-пулемёт, который накапливает заряд для усиленного выстрела и сохраняет высокую дальность.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/47382512c6b7131750403b122d5d7d60.png", tags: ["Большая дальность", "Заряд"], value: 20 },
  { id: "katana", title: "Катана", description: "Оружие ближнего боя, которое также используется как защитное снаряжение.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/0983ac91311b04e7c561277f9fe9960b.png", tags: ["Ближний бой", "Щит"], value: 0 },
  { id: "an94", title: "AN94", description: "Мощный автомат с заметной отдачей, хорошей скорострельностью и эффективностью на дальних дистанциях.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/40caf43bf92e3e7e5bd157d0ccea3374.png", tags: ["Средняя дальность", "Большой урон"], value: 30 },
  { id: "healing-pistol", title: "Лечащий пистолет", description: "Наносит урон противнику и одновременно помогает лечить союзников на близкой дистанции.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/9c0866beeb5de709bf52a1256e01d0e4.png", tags: ["Исцеление", "Близкая дистанция"], value: 30 },
  { id: "mgl140", title: "MGL140", description: "Гранатомёт с магазином среднего размера, невысокой скорострельностью и сильным уроном по площади.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/c059183595f88e5c7201d0bc2203e778.png", tags: ["Урон по площади", "Высокий урон"], value: 5 },
  { id: "p90", title: "P90", description: "Пистолет-пулемёт с большим магазином и высокой скорострельностью для боя на средней дистанции.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/d20a19cb43b419f7ea7c072b838b8806.png", tags: ["Высокая скорострельность", "Глушитель"], value: 50 },
] as const;

export const knowledgeCharacters: readonly KnowledgeCatalogEntry[] = [
  { id: "ray", title: "Рэй", subtitle: "Страж затмения", description: "Помечает врага солнечной энергией. При снижении здоровья цели метка ускоряет её поражение и возвращает здоровье владельцу навыка.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20264/bd25bf95be2da2c797f315ec061da923.png", tags: ["Атака", "Метка"] },
  { id: "nero", title: "Неро", subtitle: "Кузнец мечты", description: "Создаёт йети, который преследует ближайшего врага и формирует область, где нельзя устанавливать стены.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202510/f8971a9015b19445e1d6f2be29df4d5a.png", tags: ["Контроль", "Зона"] },
  { id: "rin", title: "Рин", subtitle: "Нефритовый ниндзя", description: "Постепенно призывает кунаи, которые автоматически выбирают врагов или стены; дальняя цель получает больше урона.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20257/e9b120bb935cfe5732ffd3740d251d69.png", tags: ["Атака", "Дальность"] },
  { id: "lila", title: "Лила", subtitle: "Артист стен", description: "Замедляет врагов и транспорт, а сбитые с ног противники получают заморозку. Навык даёт дополнительную стену.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20249/9c302601566bd21a15627377bf947097.png", tags: ["Контроль", "Стены"] },
  { id: "kairos", title: "Кайрос", subtitle: "Двойной защитник", description: "Переключает режим защиты и режим пробивания, управляя энергией для защиты владельца и разрушения щитов противника.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/ec93ba611198695084ededce1c97741b.png", tags: ["Защита", "Энергия"] },
  { id: "kassie", title: "Кэсси", subtitle: "Доктор-маньяк", description: "Создаёт связь с выбранным союзником и постепенно восстанавливает здоровье обоим; повторное применение усиливает лечение цели.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/9fd2e425a0a8ccd8b8ec6aa6dcdad7dd.png", tags: ["Поддержка", "Исцеление"] },
  { id: "suzy", title: "Сьюзи", subtitle: "Наёмный убийца", description: "Метки на врагах увеличивают награду команде за их устранение и помогают отслеживать цель охоты.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20238/e8acb0e432e8b6a22a218b7be9f6491b.png", tags: ["Награда", "Метка"] },
  { id: "sonia", title: "Соня", subtitle: "Учёный", description: "После смертельного урона создаёт нанощит и может восстановить здоровье, если владелец навыка успевает сбить врага.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20238/47d9cbbf9f64d8c90ffd191e3b070cbd.png", tags: ["Выживание", "Щит"] },
  { id: "ignis", title: "Игни", subtitle: "Старшеклассник", description: "Создаёт огненный мираж, который закрывает обзор и наносит горящий урон противникам и стенам.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/8f67099cf4124437e803d5ab4bf34d64.png", tags: ["Огонь", "Контроль"] },
  { id: "orion", title: "Орион", subtitle: "Кулак возмездия", description: "Расходует энергию, чтобы получить временную неуязвимость и возможность поглощать здоровье врага.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20238/776e4fabaf46449552a7d9fd47b41297.png", tags: ["Выживание", "Энергия"] },
  { id: "tatsuya", title: "Тацуя", subtitle: "Вспыльчивый боец", description: "Позволяет резко совершать рывок вперёд и накапливать несколько использований для быстрого входа в бой.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/a00504b94adddc82ae3ff2bfc53b568b.png", tags: ["Мобильность", "Рывок"] },
  { id: "a-patroa", title: "Донна А", subtitle: "Владелица магазина", description: "Открывает дополнительный слот для навыка, а остальные слоты становятся доступны автоматически после получения персонажа.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/4a16d6dfce6f801fcb26533425bd7d2d.png", tags: ["Пресеты", "Навыки"] },
] as const;

export const knowledgePets: readonly KnowledgeCatalogEntry[] = [
  { id: "fang", title: "Клык", subtitle: "Верность — это добродетель", description: "Даёт энергию или здоровье, когда противник отправляет союзника в нокдаун.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/58efe1ccd39d70cab6afc81962f7803b.png", tags: ["Поддержка", "Энергия"] },
  { id: "flash", title: "Флэш", subtitle: "Меня так зовут, потому что я быстрый", description: "Снижает урон сзади от ножа и пуль, помогая пережить внезапную атаку.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/af54c81493c9c48ff854337ed122887c.png", tags: ["Защита", "Спина"] },
  { id: "yeti", title: "Йети", subtitle: "Мягкая шерсть и холодная сила", description: "Уменьшает урон, получаемый от взрывов.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/07f0873e3d4b524464df9a294ccd0216.png", tags: ["Защита", "Взрывы"] },
  { id: "sovereign", title: "Соверен", subtitle: "Я плохого не посоветую", description: "Увеличивает дальность и время действия сканирующих предметов и навыков.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/8ba9d082f7b34ab77bc3cdd264529999.png", tags: ["Разведка", "Сканирование"] },
  { id: "katran", title: "Катран", subtitle: "Рискнёшь поплыть со мной?", description: "После устранения или нокдауна рядом владелец и его команда получают бонус к скорости передвижения.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c926972d56e9197623e1bf269fcfd319.png", tags: ["Мобильность", "Команда"] },
  { id: "night-panther", title: "Ночная Пантера", subtitle: "Конец близок", description: "Увеличивает объём переносимых предметов и расширяет рюкзак.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/dad6a7d911cc171d09e5a86f45477d37.png", tags: ["Ресурсы", "Рюкзак"] },
  { id: "detective-panda", title: "Детектив Панда", subtitle: "Я защищу мир", description: "Восстанавливает здоровье после устранения противника.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/031e4a53c9562a273f1a3f158886abdf.png", tags: ["Исцеление", "Устранение"] },
  { id: "shiba-inu", title: "Сиба-ину", subtitle: "Готовься к находке", description: "Находит грибы и отмечает их расположение на мини-карте.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/e14dca4b27cfd2f617ec8c22b4f01da3.png", tags: ["Разведка", "Грибы"] },
  { id: "ghost-fox", title: "Призрачная Лиса", subtitle: "Второй лучший друг человека", description: "Восстанавливает дополнительные очки здоровья при использовании аптечки.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/15f31c3f63841531600de1b3c73d0fbb.png", tags: ["Исцеление", "Аптечка"] },
  { id: "robo", title: "Робо", subtitle: "Домашний робот на острове", description: "Добавляет прочность установленной стене.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/4da07fc7bcc3e7e5b67f3b8271606134.png", tags: ["Защита", "Стены"] },
  { id: "otter", title: "Выдра", subtitle: "Музыкально одарённая выдра", description: "При использовании аптечки или лечащего пистолета дополнительно восстанавливает энергию.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/4c7c8b3ff7788ea4bd0f19b0870239c2.png", tags: ["Поддержка", "Энергия"] },
  { id: "falcon", title: "Сокол", subtitle: "Полетели", description: "Позволяет дальше скользить после прыжка и быстрее снижаться после открытия парашюта для всей команды.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/011a8792f3b70e39a5ecd0873e1e4665.png", tags: ["Высадка", "Команда"] },
] as const;

export const knowledgeUpdates: readonly KnowledgeCatalogEntry[] = [
  { id: "solara", title: "Солара: новая карта", subtitle: "20 мая 2025", description: "Футуристический портовый город с рельсовыми слайдами, динамической погодой, интерактивными зонами и новыми маршрутами для тактической игры.", tags: ["Карта", "Событие"] },
  { id: "ob47", title: "Дневник обновления OB47", subtitle: "3 декабря 2024", description: "Зимние трассы, полярное сияние, зимние машины, обновления торговых автоматов и изменения баланса персонажей.", tags: ["Патч", "Королевская битва"] },
  { id: "ob46", title: "Дневник обновления OB46", subtitle: "4 сентября 2024", description: "Изменения режимов, карты, оружия и персонажей, а также обновления интерфейса и игровых событий.", tags: ["Патч", "Баланс"] },
  { id: "shotguns-smg", title: "Оптимизация дробовиков и ПП", subtitle: "29 мая 2023", description: "Изменения характеристик дробовиков и пистолетов-пулемётов для более понятного и сбалансированного боя.", tags: ["Оружие", "Баланс"] },
  { id: "gloo-walls", title: "Изменения стен", subtitle: "26 мая 2023", description: "Обновления механики стен, их размещения и взаимодействия с навыками персонажей.", tags: ["Стены", "Механики"] },
  { id: "ob44", title: "Дневник обновления", subtitle: "22 марта 2023", description: "Пакет изменений игрового процесса, оружия и режимов, собранный в одном выпуске.", tags: ["Патч", "Режимы"] },
  { id: "ob43", title: "Дневники обновления", subtitle: "9 марта 2023", description: "Новые игровые возможности, корректировки интерфейса и настройка соревновательного баланса.", tags: ["Патч", "События"] },
  { id: "ob42", title: "Дневник обновления", subtitle: "11 января 2023", description: "Изменения персонажей, оружия и карт с отдельными улучшениями стабильности матчей.", tags: ["Патч", "Баланс"] },
  { id: "booyah-day", title: "День Booyah", subtitle: "21 сентября 2022", description: "Праздничное обновление с событиями, наградами и временными активностями для игроков.", tags: ["Событие", "Награды"] },
  { id: "cataclysm", title: "Катаклизм", subtitle: "24 мая 2022", description: "Тематическое обновление с изменениями карты, режима и игрового окружения.", tags: ["Событие", "Карта"] },
  { id: "new-heroes", title: "Новые герои", subtitle: "23 марта 2022", description: "Выпуск новых персонажей и обновление системы навыков для разных стилей игры.", tags: ["Персонажи", "Навыки"] },
] as const;

export const knowledgeMedia: readonly KnowledgeCatalogEntry[] = [
  { id: "match-video", title: "Видео матчей", subtitle: "Разборы и лучшие моменты", description: "Подборки матчей, клипы и разборы игровых эпизодов для подготовки к турнирам и обучения команды.", tags: ["Видео", "Матчи"] },
  { id: "map-visuals", title: "Обложки карт", subtitle: "Иллюстрации базы знаний", description: "Панорамные изображения карт и точки высадки, которые можно открыть прямо в карточке карты.", tags: ["Карты", "Иллюстрации"] },
  { id: "organizer-media", title: "Материалы организатора", subtitle: "Для публикаций мероприятий", description: "Готовые описания, подсказки и форматы публикаций для организаторов соревнований OMCITE.", tags: ["Организаторам", "Публикации"] },
  { id: "community-guides", title: "Гайды сообщества", subtitle: "Практические советы", description: "Короткие тематические материалы о высадке, составе команды, ролях и подготовке к серии игр.", tags: ["Гайды", "Команды"] },
  { id: "landing-guides", title: "Разборы высадок", subtitle: "Маршруты по картам", description: "Видео и схемы с вариантами безопасной, быстрой и агрессивной высадки для разных составов.", tags: ["Видео", "Локации"] },
  { id: "weapon-guides", title: "Разборы оружия", subtitle: "Дистанция и сочетания", description: "Материалы о назначении оружия, удобной дистанции боя и сочетании с ролями игроков.", tags: ["Гайды", "Оружие"] },
  { id: "team-highlights", title: "Лучшие моменты команд", subtitle: "Архив сообщества", description: "Подборки ярких эпизодов и побед из опубликованных мероприятий проекта.", tags: ["Видео", "Команды"] },
  { id: "event-gallery", title: "Галерея мероприятий", subtitle: "Карты и результаты", description: "Обложки завершённых сессий, изображения карт и визуальные материалы из истории турниров.", tags: ["Иллюстрации", "События"] },
] as const;

export const knowledgeSupport: readonly KnowledgeCatalogEntry[] = [
  { id: "support-account", title: "Аккаунт и профиль", subtitle: "Данные пользователя", description: "Как изменить профиль, добавить контактную социальную сеть и выбрать несколько игровых ролей.", tags: ["Профиль", "Участники"] },
  { id: "support-tournament", title: "Участие в мероприятии", subtitle: "Регистрация и места", description: "Проверка правил, расписания, свободных мест и статуса регистрации перед началом сессии.", tags: ["Мероприятия", "Регистрация"] },
  { id: "support-results", title: "Результаты и апелляции", subtitle: "Проверка публикаций", description: "Порядок исправления результатов, подачи обращения и рассмотрения спорных ситуаций администрацией.", tags: ["Результаты", "Апелляции"] },
  { id: "support-privacy", title: "Безопасность и данные", subtitle: "Настройки доступа", description: "Какие сведения видны зарегистрированным пользователям и как работает доступ к публичной статистике.", tags: ["Безопасность", "Конфиденциальность"] },
  { id: "support-fair-play", title: "Честная игра", subtitle: "Запрещённые действия", description: "Изменение игрового клиента, сторонние программы и получение недоступных обычному игроку преимуществ запрещены.", tags: ["FAQ", "Безопасность"] },
  { id: "support-report", title: "Как сообщить о нарушении", subtitle: "Жалобы и доказательства", description: "Сохраните подтверждение, укажите мероприятие или сессию и отправьте обращение через предусмотренный на сайте раздел.", tags: ["FAQ", "Обращения"] },
  { id: "support-ban", title: "Блокировки и ограничения", subtitle: "Рассмотрение администрацией", description: "Ограничения применяются после проверки нарушения; спорное решение можно обжаловать через отдельный интерфейс.", tags: ["FAQ", "Ограничения"] },
  { id: "support-contact", title: "Связь с администрацией", subtitle: "Помощь по сайту", description: "В обращении укажите страницу, действие, ожидаемый результат и фактическую ошибку, чтобы ускорить проверку.", tags: ["Поддержка", "Обращения"] },
] as const;

export const knowledgeUniverse: readonly KnowledgeCatalogEntry[] = [
  { id: "universe-modes", title: "Игровые режимы", subtitle: "Форматы матчей", description: "Описание одиночных, командных и отборочных форматов, которые можно использовать в мероприятиях OMCITE.", tags: ["Режимы", "Матчи"] },
  { id: "universe-maps", title: "Мир карт", subtitle: "Локации и маршруты", description: "Связанные с картой точки интереса, места высадки и заметки команды о любимых локациях.", tags: ["Карты", "Локации"] },
  { id: "universe-roles", title: "Роли игроков", subtitle: "Стили игры", description: "Снайпер, стрелок, штурмовик, гренадер, пулемётчик и хиллер — роли можно выбрать одновременно.", tags: ["Роли", "Команды"] },
  { id: "universe-competition", title: "Соревновательная сцена", subtitle: "Рейтинги и история", description: "Как результаты сессий влияют на историю игрока, команды и гильдии, а также на рейтинговые таблицы.", tags: ["Рейтинги", "История"] },
  { id: "universe-battle-royale", title: "Королевская битва", subtitle: "Выживание до финала", description: "Участники высаживаются на большую карту, собирают ресурсы и перемещаются вслед за безопасной зоной.", tags: ["Режимы", "Королевская битва"] },
  { id: "universe-clash-squad", title: "Битва отрядов", subtitle: "Раундовый формат", description: "Две команды встречаются в серии коротких раундов, закупают снаряжение и борются за победу в матче.", tags: ["Режимы", "Команды"] },
  { id: "universe-training", title: "Тренировочные матчи", subtitle: "Подготовка состава", description: "Тренировки позволяют проверить роли, высадки и взаимодействие команды без турнирного давления.", tags: ["Матчи", "Подготовка"] },
  { id: "universe-events", title: "События сообщества", subtitle: "Турниры и серии", description: "Организаторы создают открытые и закрытые мероприятия, квалификации и финальные этапы с отдельными правилами.", tags: ["События", "Организаторы"] },
] as const;

export const knowledgeGuide: readonly KnowledgeCatalogEntry[] = [
  { id: "guide-registration", title: "Регистрация на мероприятие", description: "Откройте карточку мероприятия, проверьте формат, даты, правила и доступные места, затем подтвердите участие.", tags: ["Участникам"] },
  { id: "guide-results", title: "Внесение результатов", description: "Администратор выбирает карту и место высадки, затем заполняет статистику игроков и команд и публикует сессию после проверки.", tags: ["Администраторам"] },
  { id: "guide-map-stats", title: "Статистика карты", description: "Локация высадки необязательна. Если она указана, результат участвует в расчёте любимых мест и среднего места команды на карте.", tags: ["Командам"] },
  { id: "guide-profile", title: "Профиль и роли", description: "Игрок может указать несколько ролей: снайпер, стрелок, штурмовик, гренадер, пулемётчик и хиллер.", tags: ["Профиль"] },
] as const;

export const weaponCategories = ["Все", "Поражающее", "Поддержка", "Метательное", "Ближний бой"] as const;
