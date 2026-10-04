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

const featuredKnowledgeCharacters: readonly KnowledgeCatalogEntry[] = [
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

const additionalCharacterProfiles = [
  ["iris", "Ирис", "Оператор на миссиях", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/2156d6b5ec48a11fee8cfff3a248a77f.png"],
  ["j-biebs", "Джей Бибс", "Отважный поэт", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f94d67ae9be38cebcc598d3e01a851ff.png"],
  ["homer", "Гомер", "Слепой ассасин", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/6188da437e7431dd5deec6daa07325db.png"],
  ["kenta", "Кента", "Кузнец", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/6b47bf06a33911e26a74b5928948870f.png"],
  ["nairi", "Наири", "Исследователь климата", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/bd9401e3961c42ff6b1778788a98312b.png"],
  ["otho", "Ото", "Эксперт в области памяти", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/ce44cbba16b791a412ed9a3c699b297f.png"],
  ["leon", "Леон", "Баскетболист", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/ee309a97f2c4b4cfce1ca0eec83ad660.png"],
  ["thiva", "Тива", "Певец и музыкант", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/fbbfee9cb50e7aa1d27d5bf8aacd9f02.png"],
  ["dimitri", "Димитри", "Звукорежиссёр и музыкант", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/dfeca1d95a2868e37950ee12eb48e760.png"],
  ["d-bee", "Ди-Би", "Создатель битов", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0151a21e1ee9c19efec5b05ee6cd63d4.png"],
  ["maro", "Маро", "Сокольничий", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/5260d0a86e6fa2abfd064c5578bd66eb.png"],
  ["skyler", "Скайлер", "Председатель медиакорпорации", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c1db6a8af8b43bf3e629deaeb555101d.png"],
  ["xayne", "Ксейн", "Спортсменка-экстремал", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/e4afb2e3debc88092492cdc71cceccbf.png"],
  ["shirou", "Широ", "Курьер службы доставки", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/37ceabe19f8644bcb982552070f0e520.png"],
  ["chrono", "Хроно", "Охотник за наградой", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/ff68cdffc1deb1a746d71adebead325a.png"],
  ["dasha", "Даша", "Торговец на чёрном рынке", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/4a6e93ce61e87c40c7d3f58ad8ffb0bd.png"],
  ["k", "Кей", "Профессор и мастер джиу-джитсу", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c3065fcd8976890432117933cc9b6847.png"],
  ["oscar", "Оскар", "Ночной мститель", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20253/f0f515379011e2d7be3caf6546f8f3a4.png"],
  ["luqueta", "Лукета", "Звезда футбола", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/11b1f18bd7549cba76b4f4a5e067bacb.png"],
  ["clu", "Клу", "Частный детектив", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/3809ca9651ec4b484daa726b29e4a8c0.png"],
  ["wolfrahh", "Вольфра", "Игровой стример", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/a9e23091d829b9bbca0d86c30f56a1fe.png"],
  ["jota", "Джота", "Мастер паркура", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/8f61ddcdaab137716938d7f65bb73fd4.png"],
  ["kapella", "Капелла", "Поп-звезда", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/d3c8711acac05c22d3a5ac170a7a1d32.png"],
  ["steffie", "Стеффи", "Граффити-художница", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/550cdc71cfa97dc3f23008188e474cbf.png"],
  ["maxim", "Максим", "Скоростной едок", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/2f90eae09e38bf472d2588c7938a6f71.png"],
  ["kla", "Кла", "Профессиональный кикбоксёр", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/95fa1e1e72f99888d80ecffb4f42e3f7.png"],
  ["paloma", "Палома", "Лидер банды", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/b3120346772a0052f0c6cadb90d922c2.png"],
  ["miguel", "Мигель", "Элитный боец спецназа", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/5ab77333e69f89959f39e68f787b3a36.png"],
  ["caroline", "Каролина", "Дочь влиятельной семьи", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/88068baca6c3adb14238b5050747d8c0.png"],
  ["antonio", "Антонио", "Гангстер", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/ca4550a99e019e84b9e127bf60f2d494.png"],
  ["wukong", "Вуконг", "Боевой киборг", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/a31ad9eb969fc5de5f483fb747722d35.png"],
  ["moco", "Моко", "Хакер", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/ac9a0b7d631852d8f4b3981035741ec8.png"],
  ["hayato", "Хаято", "Наследник самурайского рода", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/e90572ef474ed9c8e4112eeaa06cc6aa.png"],
  ["laura", "Лаура", "Специальный агент", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/118d193c335267a09719c42d18377853.png"],
  ["rafael", "Рафаэль", "Наёмник", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/41fb5d427a34dbf2d66ff6322ae933af.png"],
  ["a124", "А124", "Гуманоидный робот", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/a89bfb61f713424f88e8626915d30f23.png"],
  ["alvaro", "Альваро", "Подрывник", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/71c07f43d2a44aa6803e4dc04c947639.png"],
  ["santino", "Сантино", "Дизайнер одежды", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20233/b437f7d724b5bcc8e718ec395846b918.png"],
  ["notora", "Нотора", "Мотогонщица", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/68fb852b9a7c3bc8294234934a59e5f3.png"],
  ["alok", "Алок", "Известный диджей", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/181faa683450fa82e5b7ffe068a9c7f9.png"],
  ["shani", "Шани", "Инженер на свалке", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/88546c3827eca2acc868700c0e9e693f.png"],
  ["ford", "Форд", "Капитан дальнего плавания", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202211/d959ef3d3c9a5254a3a9526abab95427.png"],
  ["joseph", "Джозеф", "Председатель технокорпорации", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/9e14469ab8531dfe803b8c05cde5a14c.png"],
  ["olivia", "Оливия", "Врач", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202211/e22a6f96a8dc618ae1dd61b488de4d71.png"],
  ["andrew", "Эндрю", "Бывший полицейский", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/20ca50be91eaaa4c33a92777c8429b24.png"],
  ["kelly", "Келли", "Спринтер", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202212/9477d8a9b9d1dbce6165b43ad3eaf524.png"],
  ["nikita", "Никита", "Телохранитель", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/5fa653cce82de113a6ef059fee9176e0.png"],
  ["misha", "Миша", "Пилот гоночной машины", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/465a496fe5ca40e4cb748c82f7d53b53.png"],
] as const;

export const knowledgeCharacters: readonly KnowledgeCatalogEntry[] = [
  ...featuredKnowledgeCharacters,
  ...additionalCharacterProfiles.map(([id, title, subtitle, imageUrl]) => ({ id, title, subtitle, imageUrl, description: `${title} — персонаж с профилем «${subtitle}». Карточка включена в полный каталог персонажей.`, tags: ["Персонаж", "Полный каталог"] })),
];

const featuredKnowledgePets: readonly KnowledgeCatalogEntry[] = [
  { id: "fang", title: "Клык", subtitle: "Верность — это добродетель", description: "Даёт энергию или здоровье, когда противник отправляет союзника в нокдаун.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/58efe1ccd39d70cab6afc81962f7803b.png", tags: ["Поддержка", "Энергия"] },
  { id: "flash", title: "Флэш", subtitle: "Меня так зовут, потому что я быстрый", description: "Снижает урон сзади от ножа и пуль, помогая пережить внезапную атаку.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/07f0873e3d4b524464df9a294ccd0216.png", tags: ["Защита", "Спина"] },
  { id: "yeti", title: "Йети", subtitle: "Мягкая шерсть и холодная сила", description: "Уменьшает урон, получаемый от взрывов.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c926972d56e9197623e1bf269fcfd319.png", tags: ["Защита", "Взрывы"] },
  { id: "sovereign", title: "Соверен", subtitle: "Я плохого не посоветую", description: "Увеличивает дальность и время действия сканирующих предметов и навыков.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/031e4a53c9562a273f1a3f158886abdf.png", tags: ["Разведка", "Сканирование"] },
  { id: "katran", title: "Катран", subtitle: "Рискнёшь поплыть со мной?", description: "После устранения или нокдауна рядом владелец и его команда получают бонус к скорости передвижения.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/15f31c3f63841531600de1b3c73d0fbb.png", tags: ["Мобильность", "Команда"] },
  { id: "night-panther", title: "Ночная Пантера", subtitle: "Конец близок", description: "Увеличивает объём переносимых предметов и расширяет рюкзак.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/4c7c8b3ff7788ea4bd0f19b0870239c2.png", tags: ["Ресурсы", "Рюкзак"] },
  { id: "detective-panda", title: "Детектив Панда", subtitle: "Я защищу мир", description: "Восстанавливает здоровье после устранения противника.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/a2fce3aada53454584fcfd99c2a23d54.png", tags: ["Исцеление", "Устранение"] },
  { id: "shiba-inu", title: "Сиба-ину", subtitle: "Готовься к находке", description: "Находит грибы и отмечает их расположение на мини-карте.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/71fad31502f7fca241e0220d98102b33.png", tags: ["Разведка", "Грибы"] },
  { id: "ghost-fox", title: "Призрачная Лиса", subtitle: "Второй лучший друг человека", description: "Восстанавливает дополнительные очки здоровья при использовании аптечки.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/eaf14ab7c504f9e058de35c5afac2b45.png", tags: ["Исцеление", "Аптечка"] },
  { id: "robo", title: "Робо", subtitle: "Домашний робот на острове", description: "Добавляет прочность установленной стене.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/3b0541045e4f1e25fbe6736cd6553233.png", tags: ["Защита", "Стены"] },
  { id: "otter", title: "Выдра", subtitle: "Музыкально одарённая выдра", description: "При использовании аптечки или лечащего пистолета дополнительно восстанавливает энергию.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/b1256df8ceca9f8d7723f5036e713173.png", tags: ["Поддержка", "Энергия"] },
  { id: "falcon", title: "Сокол", subtitle: "Полетели", description: "Позволяет дальше скользить после прыжка и быстрее снижаться после открытия парашюта для всей команды.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/76f236ff23558395d69e253fe63ad225.png", tags: ["Высадка", "Команда"] },
] as const;

const additionalPetProfiles = [
  ["mr-penguin", "Мистер Пинг-Вин", "Бывший подопытный, который путешествует по миру", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/fd0ec256295b71cf5adb7383235e9ae3.png"],
  ["baboon", "Павиан", "Доброе сердце важнее внешности", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/9e60dea4a72153bdd88fade4ad48fcac.png"],
  ["rockie", "Роки", "Питомец с зелёным ирокезом", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/9c5afe38217725a9cb527b03069044ed.png"],
  ["dreki", "Дрейк", "Таинственный гость, пришедший на зов", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0c0e8047ee07ecd45cb3cb638faff2e6.png"],
  ["marcy", "Марси", "Гость из другого мира", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/549002ac06df9756b3c470051d624004.png"],
  ["dr-quack", "Доктор Кряккер", "Называет себя доктором", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/052d08e5b1ad11e2e524e560ccf2ffb4.png"],
  ["sensei-tig", "Сенсей Тиго", "Наставник для своей команды", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/b177a71fccfbbeee4bbb289213131b44.png"],
  ["agent-hop", "Агент Скок", "Агент со шрамом из прошлого", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/04c21587e8af4d44901cc1fc0456a8f3.png"],
  ["axel", "Аксель", "Популярный спутник игрока", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0c141cf65b9bf4983e893946f028bbd1.png"],
] as const;

export const knowledgePets: readonly KnowledgeCatalogEntry[] = [
  ...featuredKnowledgePets,
  ...additionalPetProfiles.map(([id, title, subtitle, imageUrl]) => ({ id, title, subtitle, imageUrl, description: `${title} — питомец с отдельным игровым навыком. Карточка включена в полный каталог питомцев.`, tags: ["Питомец", "Полный каталог"] })),
];

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
