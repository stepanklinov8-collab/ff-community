export type KnowledgeCatalogEntry = {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  imageUrl?: string;
  tags: readonly string[];
  value?: number;
  stats?: readonly { label: string; value: number | null }[];
  attachments?: readonly string[];
  sourceUrl?: string;
  verifiedAt?: string;
  character?: {
    age: number | null;
    birthday: string;
    gender: string;
    biography: string;
    abilityName: string;
    abilityDescription: string;
    awakened: boolean;
    baseAbility?: { name: string; description: string; sourceUrl: string };
    parameters: readonly { label: string; value: string }[];
  };
};

export const knowledgeOverview: readonly KnowledgeCatalogEntry[] = [
  { id: "overview-game", title: "Об игре", subtitle: "Динамичные матчи на выживание", description: "Короткие матчи с высадкой, поиском снаряжения, сужающейся зоной и борьбой за последнее место в живых.", tags: ["Игра", "Королевская битва"] },
  { id: "overview-squad", title: "Командная игра", subtitle: "Отряды и роли", description: "Команда распределяет роли, выбирает маршрут высадки и собирает состав под карту, формат и соперников.", tags: ["Команды", "Роли"] },
  { id: "overview-modes", title: "Игровые режимы", subtitle: "Турниры и тренировки", description: "В базе знаний собраны соревновательные форматы, командные сессии, квалификации и тренировочные матчи.", tags: ["Режимы", "Матчи"] },
  { id: "overview-characters", title: "Персонажи и навыки", subtitle: "Соберите подходящий набор", description: "Персонажи отличаются активными и пассивными способностями, которые помогают атаковать, защищаться, лечить и перемещаться.", tags: ["Персонажи", "Навыки"] },
  { id: "overview-events", title: "События и обновления", subtitle: "История изменений", description: "Крупные обновления добавляют карты, события, оружие, персонажей и изменения игрового баланса.", tags: ["Новости", "События"] },
  { id: "overview-esports", title: "Соревновательная сцена", subtitle: "Рейтинги OMCITE", description: "Результаты мероприятий формируют историю выступлений игроков, команд и гильдий внутри проекта.", tags: ["Киберспорт", "Рейтинги"] },
] as const;

// Public official catalogue snapshot checked 2026-10-06. See docs/development/knowledge-catalog.md.
// Null statistics mean not supplied/applicable; do not turn them into measured zeroes.
export const knowledgeWeapons: readonly KnowledgeCatalogEntry[] = [
  {
    "id": "weapon-1117",
    "title": "Стеноплавитель",
    "description": "Взрыв создаёт область, которая повреждает ледяные стены и делает их уязвимее к последующим атакам.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/88e13401f4662dc43580cfbf8f7f65fa.png",
    "tags": [
      "Метательное снаряжение",
      "Метательное",
      "Урон по стенам"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 15
      },
      {
        "label": "Скорострельность",
        "value": null
      },
      {
        "label": "Дальность",
        "value": null
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": null
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": 90
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1118",
    "title": "Щитовая пушка",
    "description": "Оружие создаёт защитное силовое поле. Повреждённый щит может сформироваться заново.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/0d3e888a3e44e38bcf1bf78a7a500f8b.png",
    "tags": [
      "Штурмовые винтовки",
      "Средняя дистанция",
      "Щит"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 43
      },
      {
        "label": "Скорострельность",
        "value": 58
      },
      {
        "label": "Дальность",
        "value": 80
      },
      {
        "label": "Скорость перезарядки",
        "value": 54
      },
      {
        "label": "Магазин",
        "value": 35
      },
      {
        "label": "Точность",
        "value": 31
      },
      {
        "label": "Подвижность",
        "value": 70
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1119",
    "title": "Лазерная лечащая пушка",
    "description": "Лечащий луч наводится на союзника и восстанавливает ему здоровье. Для лечения нужно держаться рядом с целью.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/138f1641addbe25de161dd0037cb80e9.png",
    "tags": [
      "Штурмовые винтовки",
      "Средняя дистанция",
      "Лечение"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 23
      },
      {
        "label": "Скорострельность",
        "value": 67
      },
      {
        "label": "Дальность",
        "value": 17
      },
      {
        "label": "Скорость перезарядки",
        "value": 67
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 100
      },
      {
        "label": "Подвижность",
        "value": 74
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1161",
    "title": "Trogon",
    "description": "Дробовик с двумя режимами: стрельбой очередями и запуском гранат. Режим выбирается под дистанцию боя.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202212/3d5049d73829111f5fde250b61cda07f.png",
    "tags": [
      "Дробовики",
      "Очередь по 3 выстрела"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 67
      },
      {
        "label": "Скорострельность",
        "value": 43
      },
      {
        "label": "Дальность",
        "value": 11
      },
      {
        "label": "Скорость перезарядки",
        "value": 34
      },
      {
        "label": "Магазин",
        "value": 9
      },
      {
        "label": "Точность",
        "value": 18
      },
      {
        "label": "Подвижность",
        "value": 77
      },
      {
        "label": "Бронепробитие",
        "value": 10
      }
    ],
    "attachments": [
      "Рукоятка"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1267",
    "title": "VSK94",
    "description": "Лёгкая снайперская винтовка с особой механикой прицеливания.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/e7f33ba7124e80b60d6fd9149de7601f.png",
    "tags": [
      "Снайперские винтовки",
      "Дальняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 91
      },
      {
        "label": "Скорострельность",
        "value": 21
      },
      {
        "label": "Дальность",
        "value": 62
      },
      {
        "label": "Скорость перезарядки",
        "value": 60
      },
      {
        "label": "Магазин",
        "value": 26
      },
      {
        "label": "Точность",
        "value": 23
      },
      {
        "label": "Подвижность",
        "value": 92
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1269",
    "title": "FGL-24",
    "description": "Боеприпасы взрываются и распространяют огонь в зоне попадания.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/2777e4a3343b6aa480eff589ff7e717b.png",
    "tags": [
      "Пистолеты",
      "Дополнительный урон",
      "Урон по площади"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 71
      },
      {
        "label": "Скорострельность",
        "value": 26
      },
      {
        "label": "Дальность",
        "value": 100
      },
      {
        "label": "Скорость перезарядки",
        "value": 74
      },
      {
        "label": "Магазин",
        "value": 2
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": 70
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1275",
    "title": "M590",
    "description": "Дробовик для ближней и средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202412/911ef415c743f4618332b079fec0c547.png",
    "tags": [
      "Дробовики",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 71
      },
      {
        "label": "Скорострельность",
        "value": 26
      },
      {
        "label": "Дальность",
        "value": 100
      },
      {
        "label": "Скорость перезарядки",
        "value": 74
      },
      {
        "label": "Магазин",
        "value": 1
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": 70
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1280",
    "title": "Winchester",
    "description": "Автоматическая марксманская винтовка с рычажным механизмом, особым ритмом стрельбы и перезарядки.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202510/efd3e2a5d59ed24c247abaadfff97022.png",
    "tags": [
      "Марксманские винтовки",
      "Высокий урон",
      "Стрельба очередями"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": null
      },
      {
        "label": "Скорострельность",
        "value": null
      },
      {
        "label": "Дальность",
        "value": null
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": 12
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": null
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1285",
    "title": "M7",
    "description": "Автоматическая винтовка с направленной отдачей: при продолжительной стрельбе прицел постепенно уходит вверх.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/e7ad0146211258d6e4ff4c9be49834be.png",
    "tags": [
      "Штурмовые винтовки",
      "Отдача",
      "Сбалансированное"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": null
      },
      {
        "label": "Скорострельность",
        "value": null
      },
      {
        "label": "Дальность",
        "value": null
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": null
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1286",
    "title": "Skorp",
    "description": "Высокая скорострельность сочетается с бронепробитием. Система отдачи работает по тому же принципу, что у M7.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/d6513a255a4a686b7bb3f21c13af1df6.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Отдача",
      "Скорострельность"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": null
      },
      {
        "label": "Скорострельность",
        "value": null
      },
      {
        "label": "Дальность",
        "value": null
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": null
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1287",
    "title": "Hawk",
    "description": "Снайперская винтовка на два патрона. Быстрые последовательные выстрелы позволяют нанести высокий урон за короткое время.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/1d36261a4c6823fd96076baf962bf22e.png",
    "tags": [
      "Снайперские винтовки",
      "Отдача",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": null
      },
      {
        "label": "Скорострельность",
        "value": null
      },
      {
        "label": "Дальность",
        "value": null
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": 2
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": null
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1288",
    "title": "RPK",
    "description": "Автоматическое оружие с новой системой отдачи, сочетающее огневую мощь пулемёта и подвижность штурмовой винтовки.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/1e31b81d4ed25a10d89166a1a275d8a1.png",
    "tags": [
      "Пулемёты",
      "Отдача",
      "Точность"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": null
      },
      {
        "label": "Скорострельность",
        "value": null
      },
      {
        "label": "Дальность",
        "value": null
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": 75
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": null
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1289",
    "title": "Огненная граната",
    "description": "После броска оставляет на земле горящую область. Точная длительность в официальной карточке не указана.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/33358f1af6893411fe850870cb2bade9.png",
    "tags": [
      "Метательное снаряжение",
      "Метательное",
      "Длительный урон по области"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": null
      },
      {
        "label": "Скорострельность",
        "value": null
      },
      {
        "label": "Дальность",
        "value": null
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": null
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": null
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1290",
    "title": "Сонарная граната",
    "description": "После броска обнаруживает противников в области действия. Точный радиус в официальной карточке не указан.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/c3f5e06b7b21b70293eeb9192f870955.png",
    "tags": [
      "Метательное снаряжение",
      "Метательное",
      "Обнаружение врагов"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": null
      },
      {
        "label": "Скорострельность",
        "value": null
      },
      {
        "label": "Дальность",
        "value": null
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": null
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": null
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-297",
    "title": "RGS50",
    "description": "Гранатомёт умеет захватывать транспорт в качестве цели. По целям, не являющимся транспортом, наносит меньше урона.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official/a42ed7790ad0Icon_slot_RGS50.png",
    "tags": [
      "Гранатомёты",
      "Высокий урон",
      "Разрушение"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 85
      },
      {
        "label": "Скорострельность",
        "value": 27
      },
      {
        "label": "Дальность",
        "value": 100
      },
      {
        "label": "Скорость перезарядки",
        "value": 62
      },
      {
        "label": "Магазин",
        "value": 2
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 65
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-305",
    "title": "Миниган",
    "description": "Пулемёт с высокой скорострельностью и огневой мощью. Использование оружия заметно ограничивает подвижность.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/df16d03e0649a503f92de68ab0aac585.png",
    "tags": [
      "Пулемёты",
      "Огневая мощь",
      "Очень высокая скорострельность"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 55
      },
      {
        "label": "Скорострельность",
        "value": 56
      },
      {
        "label": "Дальность",
        "value": 84
      },
      {
        "label": "Скорость перезарядки",
        "value": 62
      },
      {
        "label": "Магазин",
        "value": 1200
      },
      {
        "label": "Точность",
        "value": 79
      },
      {
        "label": "Подвижность",
        "value": 32
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-313",
    "title": "CG15",
    "description": "Пистолет-пулемёт с заряжаемым выстрелом: накопление заряда позволяет усилить отдельный выстрел.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/efb774d875151b9faa51366c4d5ed699.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Дальняя дистанция",
      "Зарядка выстрела"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 50
      },
      {
        "label": "Скорострельность",
        "value": 69
      },
      {
        "label": "Дальность",
        "value": 71
      },
      {
        "label": "Скорость перезарядки",
        "value": 62
      },
      {
        "label": "Магазин",
        "value": 20
      },
      {
        "label": "Точность",
        "value": 60
      },
      {
        "label": "Подвижность",
        "value": 77
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Рукоятка",
      "Магазин"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-321",
    "title": "Катана",
    "description": "Катана — клинковое оружие для ближнего боя.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/902c1bed5215a00de66473a64b454349.png",
    "tags": [
      "Ближний бой",
      "Щит"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 66
      },
      {
        "label": "Скорострельность",
        "value": 32
      },
      {
        "label": "Дальность",
        "value": 5
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": null
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 88
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-329",
    "title": "AN94",
    "description": "Штурмовая винтовка с высокой отдачей и значительным уроном. Рассчитана в том числе на дальнюю дистанцию.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/6e18ff1a4fdc4cbd9650f62b7d5bbd1a.png",
    "tags": [
      "Штурмовые винтовки",
      "Огневая мощь",
      "Средняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 60
      },
      {
        "label": "Скорострельность",
        "value": 59
      },
      {
        "label": "Дальность",
        "value": 76
      },
      {
        "label": "Скорость перезарядки",
        "value": 45
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 48
      },
      {
        "label": "Подвижность",
        "value": 74
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-337",
    "title": "Лечащий пистолет",
    "description": "Попадания по противнику наносят урон, а по союзнику — восстанавливают здоровье.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f3bc5385dea6a1dba577a733c7458b98.png",
    "tags": [
      "Пистолеты",
      "Лечение",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 57
      },
      {
        "label": "Скорострельность",
        "value": 58
      },
      {
        "label": "Дальность",
        "value": 73
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 54
      },
      {
        "label": "Подвижность",
        "value": 76
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-345",
    "title": "MGL140",
    "description": "Многозарядный гранатомёт с невысокой скорострельностью и мощными взрывными боеприпасами.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/42b16b1e58e45e53d99c053e027859c5.png",
    "tags": [
      "Гранатомёты",
      "Урон по площади",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 90
      },
      {
        "label": "Скорострельность",
        "value": 33
      },
      {
        "label": "Дальность",
        "value": 51
      },
      {
        "label": "Скорость перезарядки",
        "value": 76
      },
      {
        "label": "Магазин",
        "value": 5
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 65
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Магазин"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-353",
    "title": "P90",
    "description": "Пистолет-пулемёт с вместительным магазином и высокой скорострельностью. Подходит для боя на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/60a61fd8deab840ef913b93ecd7f2882.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Глушитель",
      "Очень высокая скорострельность"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 52
      },
      {
        "label": "Скорострельность",
        "value": 76
      },
      {
        "label": "Дальность",
        "value": 27
      },
      {
        "label": "Скорость перезарядки",
        "value": 48
      },
      {
        "label": "Магазин",
        "value": 50
      },
      {
        "label": "Точность",
        "value": 57
      },
      {
        "label": "Подвижность",
        "value": 77
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Магазин",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-361",
    "title": "XM8",
    "description": "Винтовка со встроенным прицелом 2× и устойчивой стрельбой на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f4fd729d5d723c9d9e6acea55706d428.png",
    "tags": [
      "Штурмовые винтовки",
      "Прицел ×2",
      "Стабильность"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 60
      },
      {
        "label": "Скорострельность",
        "value": 61
      },
      {
        "label": "Дальность",
        "value": 60
      },
      {
        "label": "Скорость перезарядки",
        "value": 45
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 65
      },
      {
        "label": "Подвижность",
        "value": 86
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Магазин",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-369",
    "title": "M60",
    "description": "Ручной пулемёт с большим магазином, рассчитанный на продолжительный огонь на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/2d75bdd4d64bed99556825534851249e.png",
    "tags": [
      "Пулемёты",
      "Средняя дистанция",
      "Большой магазин"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 56
      },
      {
        "label": "Скорострельность",
        "value": 56
      },
      {
        "label": "Дальность",
        "value": 65
      },
      {
        "label": "Скорость перезарядки",
        "value": 48
      },
      {
        "label": "Магазин",
        "value": 70
      },
      {
        "label": "Точность",
        "value": 43
      },
      {
        "label": "Подвижность",
        "value": 63
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Магазин"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-377",
    "title": "SPAS12",
    "description": "Мощный дробовик для ближнего боя. Между одиночными выстрелами промах оставляет противнику возможность ответить.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/3b7c991baf200535e98e41de53815d5c.png",
    "tags": [
      "Дробовики",
      "Одиночные выстрелы",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 97
      },
      {
        "label": "Скорострельность",
        "value": 42
      },
      {
        "label": "Дальность",
        "value": 14
      },
      {
        "label": "Скорость перезарядки",
        "value": 41
      },
      {
        "label": "Магазин",
        "value": 5
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 60
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Магазин"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-385",
    "title": "Бита",
    "description": "Дальность удара больше, чем у сковороды, но форма биты хуже подходит для отражения пуль.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/698669f81b6b3d5c79f6059d1d934ad5.png",
    "tags": [
      "Ближний бой",
      "Мобильность"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 63
      },
      {
        "label": "Скорострельность",
        "value": 33
      },
      {
        "label": "Дальность",
        "value": 5
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": null
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 104
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-393",
    "title": "SVD",
    "description": "Точная и мощная винтовка Драгунова. Официальный каталог указывает точки снабжения и аирдропы как источники получения.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/eda7684b0854c1b1136d87927a2fbcbd.png",
    "tags": [
      "Марксманские винтовки",
      "Редкое",
      "Дальняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 89
      },
      {
        "label": "Скорострельность",
        "value": 34
      },
      {
        "label": "Дальность",
        "value": 80
      },
      {
        "label": "Скорость перезарядки",
        "value": 41
      },
      {
        "label": "Магазин",
        "value": 10
      },
      {
        "label": "Точность",
        "value": 51
      },
      {
        "label": "Подвижность",
        "value": 74
      },
      {
        "label": "Бронепробитие",
        "value": 54
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-401",
    "title": "Арбалет",
    "description": "Бесшумные болты пробивают защитное снаряжение и вызывают кровотечение с последующим уроном.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/7eddf7c5c7f19d603233f302b695ab09.png",
    "tags": [
      "Арбалеты",
      "Периодический урон",
      "Долгая перезарядка"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 90
      },
      {
        "label": "Скорострельность",
        "value": 48
      },
      {
        "label": "Дальность",
        "value": 36
      },
      {
        "label": "Скорость перезарядки",
        "value": 41
      },
      {
        "label": "Магазин",
        "value": 1
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 65
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Прицел"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-409",
    "title": "FAMAS",
    "description": "Стреляет очередью из трёх патронов. Предназначена для средней и дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0516690dac28178d6baf02644a0980f9.png",
    "tags": [
      "Штурмовые винтовки",
      "Стрельба очередями",
      "Скорострельность"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 54
      },
      {
        "label": "Скорострельность",
        "value": 72
      },
      {
        "label": "Дальность",
        "value": 64
      },
      {
        "label": "Скорость перезарядки",
        "value": 48
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 47
      },
      {
        "label": "Подвижность",
        "value": 74
      },
      {
        "label": "Бронепробитие",
        "value": 44
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-417",
    "title": "M500",
    "description": "Пистолет с одиночной стрельбой, небольшим магазином и установленным прицелом 2× для дальних целей.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/8416c43b66be1ecf9f54301c26506a69.png",
    "tags": [
      "Пистолеты",
      "Дальняя дистанция",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 67
      },
      {
        "label": "Скорострельность",
        "value": 43
      },
      {
        "label": "Дальность",
        "value": 76
      },
      {
        "label": "Скорость перезарядки",
        "value": 69
      },
      {
        "label": "Магазин",
        "value": 5
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 66
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Прицел"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-425",
    "title": "MP40",
    "description": "Пистолет-пулемёт с высокой скорострельностью, наиболее эффективный в ближнем бою.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/dc148c9021b38531e6e0de8e15970e53.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Очень высокая скорострельность",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 48
      },
      {
        "label": "Скорострельность",
        "value": 83
      },
      {
        "label": "Дальность",
        "value": 22
      },
      {
        "label": "Скорость перезарядки",
        "value": 48
      },
      {
        "label": "Магазин",
        "value": 20
      },
      {
        "label": "Точность",
        "value": 27
      },
      {
        "label": "Подвижность",
        "value": 88
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Рукоятка",
      "Магазин",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-433",
    "title": "M79",
    "description": "Однозарядный гранатомёт с уроном по области. Для попадания нужно учитывать траекторию боеприпаса.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f51732eb72f3beb88c021765f70818a9.png",
    "tags": [
      "Гранатомёты",
      "Урон по площади",
      "Снаряд"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 84
      },
      {
        "label": "Скорострельность",
        "value": 27
      },
      {
        "label": "Дальность",
        "value": 51
      },
      {
        "label": "Скорость перезарядки",
        "value": 62
      },
      {
        "label": "Магазин",
        "value": 1
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 80
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-441",
    "title": "Kar98k",
    "description": "Снайперская винтовка с установленным прицелом 8×.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f0d9ce079561f1ae65472cacd8707139.png",
    "tags": [
      "Снайперские винтовки",
      "Дальняя дистанция",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 90
      },
      {
        "label": "Скорострельность",
        "value": 27
      },
      {
        "label": "Дальность",
        "value": 84
      },
      {
        "label": "Скорость перезарядки",
        "value": 27
      },
      {
        "label": "Магазин",
        "value": 5
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 80
      },
      {
        "label": "Бронепробитие",
        "value": 63
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Прицел"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-449",
    "title": "M1873",
    "description": "Компактный дробовик, занимающий слот дополнительного оружия и предназначенный для близких целей.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/835df2c791ed827034bb65c9f8af33a4.png",
    "tags": [
      "Пистолеты",
      "Ближняя дистанция",
      "Дополнительное оружие"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 94
      },
      {
        "label": "Скорострельность",
        "value": 35
      },
      {
        "label": "Дальность",
        "value": 8
      },
      {
        "label": "Скорость перезарядки",
        "value": 41
      },
      {
        "label": "Магазин",
        "value": 2
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 88
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-457",
    "title": "M249",
    "description": "Пулемёт с магазином на 100 патронов. В официальном описании указан как оружие из аирдропа.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c0cd7df4ad6265497183c56408033e84.png",
    "tags": [
      "Пулемёты",
      "Редкое",
      "Большой магазин"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 57
      },
      {
        "label": "Скорострельность",
        "value": 59
      },
      {
        "label": "Дальность",
        "value": 76
      },
      {
        "label": "Скорость перезарядки",
        "value": 48
      },
      {
        "label": "Магазин",
        "value": 100
      },
      {
        "label": "Точность",
        "value": 67
      },
      {
        "label": "Подвижность",
        "value": 58
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Прицел"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-465",
    "title": "Граната",
    "description": "Взрывная граната наносит урон по области и помогает вытеснять противника из укрытия.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/326bfdf7bbf526c9d1b0ae000e1aee61.png",
    "tags": [
      "Метательное снаряжение",
      "Урон по площади"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 300
      },
      {
        "label": "Скорострельность",
        "value": null
      },
      {
        "label": "Дальность",
        "value": null
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": null
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": 90
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-473",
    "title": "M4A1",
    "description": "Штурмовая винтовка со сбалансированными характеристиками для разных боевых ситуаций.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f9d228799e70a11feaf2c493bedb007e.png",
    "tags": [
      "Штурмовые винтовки",
      "Простое управление",
      "Дальняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 54
      },
      {
        "label": "Скорострельность",
        "value": 57
      },
      {
        "label": "Дальность",
        "value": 68
      },
      {
        "label": "Скорость перезарядки",
        "value": 48
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 55
      },
      {
        "label": "Подвижность",
        "value": 74
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-481",
    "title": "AK47",
    "description": "Винтовка с высоким уроном. Для точной стрельбы требуется контроль отдачи.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/bc3a04e98225ef35976771ad109d4ee6.png",
    "tags": [
      "Штурмовые винтовки",
      "Высокий урон",
      "Сильная отдача"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 62
      },
      {
        "label": "Скорострельность",
        "value": 56
      },
      {
        "label": "Дальность",
        "value": 72
      },
      {
        "label": "Скорость перезарядки",
        "value": 41
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 41
      },
      {
        "label": "Подвижность",
        "value": 62
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-489",
    "title": "AWM",
    "description": "Снайперская винтовка с высоким уроном и продолжительной перезарядкой. Время в секундах в каталоге не приведено.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/bf268d2f9b0cb421ce1bd3b581fc9924.png",
    "tags": [
      "Снайперские винтовки",
      "Дальняя дистанция",
      "По неподвижным целям"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 90
      },
      {
        "label": "Скорострельность",
        "value": 27
      },
      {
        "label": "Дальность",
        "value": 91
      },
      {
        "label": "Скорость перезарядки",
        "value": 34
      },
      {
        "label": "Магазин",
        "value": 5
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 65
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-497",
    "title": "SKS",
    "description": "Полуавтоматическая винтовка с установленным прицелом 4×.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/d8a7797a0cb0d3e82d00153a4415c905.png",
    "tags": [
      "Марксманские винтовки",
      "Дальняя дистанция",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 82
      },
      {
        "label": "Скорострельность",
        "value": 35
      },
      {
        "label": "Дальность",
        "value": 82
      },
      {
        "label": "Скорость перезарядки",
        "value": 27
      },
      {
        "label": "Магазин",
        "value": 16
      },
      {
        "label": "Точность",
        "value": 51
      },
      {
        "label": "Подвижность",
        "value": 62
      },
      {
        "label": "Бронепробитие",
        "value": 46
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-505",
    "title": "Groza",
    "description": "Винтовка для дальней дистанции, сочетающая высокий урон и устойчивость при стрельбе.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c49e5145e37a5c66b1202e04031f6363.png",
    "tags": [
      "Штурмовые винтовки",
      "Редкое",
      "Дальняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 61
      },
      {
        "label": "Скорострельность",
        "value": 58
      },
      {
        "label": "Дальность",
        "value": 77
      },
      {
        "label": "Скорость перезарядки",
        "value": 48
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 52
      },
      {
        "label": "Подвижность",
        "value": 63
      },
      {
        "label": "Бронепробитие",
        "value": 44
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-513",
    "title": "M1014",
    "description": "Дробовик для быстрого поражения противника на близкой дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/ee748629c0e7e1dda3f4f8147648d486.png",
    "tags": [
      "Дробовики",
      "Ближняя дистанция",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 94
      },
      {
        "label": "Скорострельность",
        "value": 39
      },
      {
        "label": "Дальность",
        "value": 10
      },
      {
        "label": "Скорость перезарядки",
        "value": 31
      },
      {
        "label": "Магазин",
        "value": 6
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 60
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-521",
    "title": "UMP",
    "description": "Устойчивый при стрельбе пистолет-пулемёт, подходящий для освоения ближнего боя.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/45f4534bf331d27bba092af3691c0e3b.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Точность",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 50
      },
      {
        "label": "Скорострельность",
        "value": 74
      },
      {
        "label": "Дальность",
        "value": 24
      },
      {
        "label": "Скорость перезарядки",
        "value": 59
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 42
      },
      {
        "label": "Подвижность",
        "value": 91
      },
      {
        "label": "Бронепробитие",
        "value": 54
      }
    ],
    "attachments": [
      "Глушитель",
      "Рукоятка",
      "Магазин",
      "Прицел"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-529",
    "title": "MP5",
    "description": "Пистолет-пулемёт с устойчивой стрельбой; эффективность снижается на большой дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/ffa3810470bfe2ec0e96be36f7f75653.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Ближняя дистанция",
      "Скорострельность"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 50
      },
      {
        "label": "Скорострельность",
        "value": 76
      },
      {
        "label": "Дальность",
        "value": 27
      },
      {
        "label": "Скорость перезарядки",
        "value": 62
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 54
      },
      {
        "label": "Подвижность",
        "value": 81
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-537",
    "title": "M14",
    "description": "Дальнобойная винтовка, приближающаяся по характеру применения к снайперскому оружию.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/1ba9139067b1e18044edc9efa1a75ca6.png",
    "tags": [
      "Марксманские винтовки",
      "Дальняя дистанция",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 75
      },
      {
        "label": "Скорострельность",
        "value": 43
      },
      {
        "label": "Дальность",
        "value": 83
      },
      {
        "label": "Скорость перезарядки",
        "value": 52
      },
      {
        "label": "Магазин",
        "value": 15
      },
      {
        "label": "Точность",
        "value": 57
      },
      {
        "label": "Подвижность",
        "value": 74
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-545",
    "title": "SCAR",
    "description": "Штурмовая винтовка со сбалансированными характеристиками и устойчивой стрельбой.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/5f07a4687e38296c2f5e95e296d8d51b.png",
    "tags": [
      "Штурмовые винтовки",
      "Сбалансированное",
      "Низкая отдача"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 54
      },
      {
        "label": "Скорострельность",
        "value": 61
      },
      {
        "label": "Дальность",
        "value": 68
      },
      {
        "label": "Скорость перезарядки",
        "value": 52
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 50
      },
      {
        "label": "Подвижность",
        "value": 74
      },
      {
        "label": "Бронепробитие",
        "value": 28
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-553",
    "title": "VSS",
    "description": "Винтовка с глушителем для боя на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/60c2f74d8d87290681c0a0dbdffcb8b9.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Дальняя дистанция",
      "Глушитель"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 54
      },
      {
        "label": "Скорострельность",
        "value": 48
      },
      {
        "label": "Дальность",
        "value": 72
      },
      {
        "label": "Скорость перезарядки",
        "value": 55
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 73
      },
      {
        "label": "Подвижность",
        "value": 67
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Магазин",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-561",
    "title": "USP",
    "description": "Лёгкий пистолет, позволяющий сохранять высокую подвижность в бою.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/3e1f2407e7f97689071651a190757325.png",
    "tags": [
      "Пистолеты",
      "Мобильность",
      "Начало матча"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 45
      },
      {
        "label": "Скорострельность",
        "value": 44
      },
      {
        "label": "Дальность",
        "value": 29
      },
      {
        "label": "Скорость перезарядки",
        "value": 83
      },
      {
        "label": "Магазин",
        "value": 12
      },
      {
        "label": "Точность",
        "value": 57
      },
      {
        "label": "Подвижность",
        "value": 76
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Магазин"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-569",
    "title": "G18",
    "description": "Пистолет с вместительным магазином и умеренным уроном для близких целей.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/5528d2a0820bc1ed8b6064b9c20ab218.png",
    "tags": [
      "Пистолеты",
      "Большой магазин",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 45
      },
      {
        "label": "Скорострельность",
        "value": 64
      },
      {
        "label": "Дальность",
        "value": 42
      },
      {
        "label": "Скорость перезарядки",
        "value": 61
      },
      {
        "label": "Магазин",
        "value": 24
      },
      {
        "label": "Точность",
        "value": 57
      },
      {
        "label": "Подвижность",
        "value": 76
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Магазин"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-577",
    "title": "DESERT EAGLE",
    "description": "Мощный пистолет с низкой скорострельностью, сохраняющий эффективность на дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/262c55300da7b4070ad76611e2003fc5.png",
    "tags": [
      "Пистолеты",
      "Высокий урон",
      "Мобильность"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 90
      },
      {
        "label": "Скорострельность",
        "value": 34
      },
      {
        "label": "Дальность",
        "value": 79
      },
      {
        "label": "Скорость перезарядки",
        "value": 86
      },
      {
        "label": "Магазин",
        "value": 11
      },
      {
        "label": "Точность",
        "value": 45
      },
      {
        "label": "Подвижность",
        "value": 76
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-585",
    "title": "Сковорода",
    "description": "Оружие ближнего боя, способное закрывать часть тела от вражеских пуль.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/5fcb37e763470c7f785a1bc5055d398d.png",
    "tags": [
      "Ближний бой",
      "Щит"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 62
      },
      {
        "label": "Скорострельность",
        "value": 35
      },
      {
        "label": "Дальность",
        "value": 5
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": null
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 88
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-593",
    "title": "Мачете",
    "description": "Клинковое оружие с большей дальностью удара, чем у сковороды; может защищать от попаданий в закрываемую им область.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/294b5dffe76f6f1c699569bf7e83d50d.png",
    "tags": [
      "Ближний бой",
      "Щит"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 66
      },
      {
        "label": "Скорострельность",
        "value": 32
      },
      {
        "label": "Дальность",
        "value": 5
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": null
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 88
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-601",
    "title": "M1887",
    "description": "Крупнокалиберный двуствольный дробовик для ближнего боя.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20229/c642875194de4e4e544e58513b92a4ae.png",
    "tags": [
      "Дробовики",
      "Высокий урон",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 100
      },
      {
        "label": "Скорострельность",
        "value": 40
      },
      {
        "label": "Дальность",
        "value": 12
      },
      {
        "label": "Скорость перезарядки",
        "value": 43
      },
      {
        "label": "Магазин",
        "value": 2
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 79
      },
      {
        "label": "Бронепробитие",
        "value": 28
      }
    ],
    "attachments": [
      "Рукоятка",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-602",
    "title": "Thompson",
    "description": "Пистолет-пулемёт Thompson. Его индивидуальные показатели приведены в таблице характеристик.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/774de06b4f1a2c3708119733a4ddd7f5.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Ближняя дистанция",
      "Скорострельность"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 50
      },
      {
        "label": "Скорострельность",
        "value": 78
      },
      {
        "label": "Дальность",
        "value": 24
      },
      {
        "label": "Скорость перезарядки",
        "value": 48
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 42
      },
      {
        "label": "Подвижность",
        "value": 81
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Дульная насадка",
      "Рукоятка"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-603",
    "title": "Ручная пушка",
    "description": "Компактный гранатомёт, который занимает слот дополнительного оружия.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/b2d5940583d09254dee082989a8ff26a.png",
    "tags": [
      "Пистолеты",
      "Урон по площади",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 90
      },
      {
        "label": "Скорострельность",
        "value": 27
      },
      {
        "label": "Дальность",
        "value": 10
      },
      {
        "label": "Скорость перезарядки",
        "value": 62
      },
      {
        "label": "Магазин",
        "value": 2
      },
      {
        "label": "Точность",
        "value": 34
      },
      {
        "label": "Подвижность",
        "value": 75
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-604",
    "title": "Плазменная пушка",
    "description": "Стреляет за счёт энергии. Продолжительный огонь вызывает перегрев.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c824bf1a7bbffed3f77588e051ff2f70.png",
    "tags": [
      "Штурмовые винтовки",
      "Редкое",
      "Дальняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 57
      },
      {
        "label": "Скорострельность",
        "value": 60
      },
      {
        "label": "Дальность",
        "value": 73
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 54
      },
      {
        "label": "Подвижность",
        "value": 74
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Рукоятка",
      "Прицел"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-624",
    "title": "M82B",
    "description": "Снайперская винтовка с дополнительным уроном по транспорту и ледяным стенам. Пули могут проходить сквозь ледяную стену.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0a30d6bcf413ffacded1230f747bfb36.png",
    "tags": [
      "Снайперские винтовки",
      "Высокий урон",
      "Пробитие стен"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 90
      },
      {
        "label": "Скорострельность",
        "value": 27
      },
      {
        "label": "Дальность",
        "value": 85
      },
      {
        "label": "Скорость перезарядки",
        "value": 41
      },
      {
        "label": "Магазин",
        "value": 8
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 70
      },
      {
        "label": "Бронепробитие",
        "value": 54
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Прицел"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-629",
    "title": "AUG",
    "description": "Штурмовая винтовка с заменяемым прицелом 2×.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/fc7eb3fd85c623b2c999a7958feb86e7.png",
    "tags": [
      "Штурмовые винтовки",
      "Редкое"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 56
      },
      {
        "label": "Скорострельность",
        "value": 61
      },
      {
        "label": "Дальность",
        "value": 58
      },
      {
        "label": "Скорость перезарядки",
        "value": 55
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 55
      },
      {
        "label": "Подвижность",
        "value": 84
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-674",
    "title": "PARAFAL",
    "description": "Винтовка использует патроны для штурмового оружия, сочетая высокий урон и подвижность.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/a92fa1acd8533cdf92fd30931a57254e.png",
    "tags": [
      "Штурмовые винтовки",
      "Средняя дистанция",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 69
      },
      {
        "label": "Скорострельность",
        "value": 50
      },
      {
        "label": "Дальность",
        "value": 58
      },
      {
        "label": "Скорость перезарядки",
        "value": 41
      },
      {
        "label": "Магазин",
        "value": 20
      },
      {
        "label": "Точность",
        "value": 40
      },
      {
        "label": "Подвижность",
        "value": 63
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1073",
    "title": "Woodpecker",
    "description": "Марксманская винтовка M21 с высокой точностью и бронепробитием; использует патроны для штурмового оружия.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/57039d8e746433254d5912d64df8ec79.png",
    "tags": [
      "Марксманские винтовки",
      "Высокий урон",
      "Бронепробитие"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 80
      },
      {
        "label": "Скорострельность",
        "value": 38
      },
      {
        "label": "Дальность",
        "value": 70
      },
      {
        "label": "Скорость перезарядки",
        "value": 41
      },
      {
        "label": "Магазин",
        "value": 12
      },
      {
        "label": "Точность",
        "value": 69
      },
      {
        "label": "Подвижность",
        "value": 74
      },
      {
        "label": "Бронепробитие",
        "value": 77
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1074",
    "title": "Vector",
    "description": "Пистолет-пулемёт поддерживает парное использование: по одному Vector в каждой руке. Основная дистанция боя — близкая.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c1b06eb80e2c4f02bef1f8087765c199.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Парное оружие",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 47
      },
      {
        "label": "Скорострельность",
        "value": 81
      },
      {
        "label": "Дальность",
        "value": 33
      },
      {
        "label": "Скорость перезарядки",
        "value": 27
      },
      {
        "label": "Магазин",
        "value": 23
      },
      {
        "label": "Точность",
        "value": 61
      },
      {
        "label": "Подвижность",
        "value": 91
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1075",
    "title": "Коса",
    "description": "Коса с высоким уроном и увеличенной дальностью удара среди оружия ближнего боя.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/d19bc732b69e186cdfd8b4486265f321.png",
    "tags": [
      "Ближний бой",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 90
      },
      {
        "label": "Скорострельность",
        "value": 30
      },
      {
        "label": "Дальность",
        "value": 6
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": null
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 90
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1076",
    "title": "MAG-7",
    "description": "Подвижный дробовик с высокой скорострельностью и возможностью вести бой на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c083b9923bb4e2fe20dc572a6f65818d.png",
    "tags": [
      "Дробовики",
      "Большой магазин",
      "Очень высокая скорострельность"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 89
      },
      {
        "label": "Скорострельность",
        "value": 53
      },
      {
        "label": "Дальность",
        "value": 15
      },
      {
        "label": "Скорость перезарядки",
        "value": 55
      },
      {
        "label": "Магазин",
        "value": 8
      },
      {
        "label": "Точность",
        "value": 17
      },
      {
        "label": "Подвижность",
        "value": 60
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Рукоятка",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1077",
    "title": "Kord",
    "description": "Пулемёт раскрывает дополнительные возможности при стрельбе сидя или лёжа.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/631c6fceb57830faf26ffacfd1726556.png",
    "tags": [
      "Пулемёты",
      "Большой магазин",
      "Огневая мощь"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 59
      },
      {
        "label": "Скорострельность",
        "value": 52
      },
      {
        "label": "Дальность",
        "value": 73
      },
      {
        "label": "Скорость перезарядки",
        "value": 41
      },
      {
        "label": "Магазин",
        "value": 50
      },
      {
        "label": "Точность",
        "value": 34
      },
      {
        "label": "Подвижность",
        "value": 58
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1078",
    "title": "M1917",
    "description": "Револьвер для слота дополнительного оружия.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f176e1be59ac986474cffc8d26b3e8cc.png",
    "tags": [
      "Пистолеты",
      "Парное оружие",
      "Дополнительное оружие"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 60
      },
      {
        "label": "Скорострельность",
        "value": 57
      },
      {
        "label": "Дальность",
        "value": 28
      },
      {
        "label": "Скорость перезарядки",
        "value": 38
      },
      {
        "label": "Магазин",
        "value": 12
      },
      {
        "label": "Точность",
        "value": 57
      },
      {
        "label": "Подвижность",
        "value": 76
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Рукоятка",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1079",
    "title": "USP-2",
    "description": "Парный вариант пистолета USP.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/3e1f2407e7f97689071651a190757325.png",
    "tags": [
      "Пистолеты",
      "Парное оружие",
      "Дополнительное оружие"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 45
      },
      {
        "label": "Скорострельность",
        "value": 61
      },
      {
        "label": "Дальность",
        "value": 29
      },
      {
        "label": "Скорость перезарядки",
        "value": 55
      },
      {
        "label": "Магазин",
        "value": 12
      },
      {
        "label": "Точность",
        "value": 57
      },
      {
        "label": "Подвижность",
        "value": 76
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Дульная насадка",
      "Магазин"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1080",
    "title": "Дымовая граната",
    "description": "Создаёт дымовую завесу, скрывающую перемещение и обход противника.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/9d722d5dc960baa4018ee34e35e4e4ef.png",
    "tags": [
      "Метательное снаряжение",
      "Дымовая завеса"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": null
      },
      {
        "label": "Скорострельность",
        "value": null
      },
      {
        "label": "Дальность",
        "value": null
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": null
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": 90
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1081",
    "title": "Защитная стена",
    "description": "Размещает ледяную стену, которую можно использовать как укрытие.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/71c9976d4b23cc37bb15fe398d186b7e.png",
    "tags": [
      "Метательное снаряжение",
      "Щит"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": null
      },
      {
        "label": "Скорострельность",
        "value": null
      },
      {
        "label": "Дальность",
        "value": null
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": null
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": 90
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1082",
    "title": "Ледяная граната",
    "description": "После взрыва создаёт холодную область, замедляющую противников и наносящую им урон.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f1fa2b4ca56ae57d38e97e5beccce8bb.png",
    "tags": [
      "Метательное снаряжение",
      "Замедление",
      "Периодический урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 100
      },
      {
        "label": "Скорострельность",
        "value": null
      },
      {
        "label": "Дальность",
        "value": null
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": null
      },
      {
        "label": "Точность",
        "value": null
      },
      {
        "label": "Подвижность",
        "value": 90
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1083",
    "title": "Нож FF",
    "description": "Нож для атаки противника на близкой дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0a7e9a154df42962387613548e6def2f.png",
    "tags": [
      "Ближний бой",
      "Высокий урон",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 90
      },
      {
        "label": "Скорострельность",
        "value": 38
      },
      {
        "label": "Дальность",
        "value": 53
      },
      {
        "label": "Скорость перезарядки",
        "value": null
      },
      {
        "label": "Магазин",
        "value": 3
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 84
      },
      {
        "label": "Бронепробитие",
        "value": 100
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1084",
    "title": "Kingfisher",
    "description": "Винтовка с высокой скорострельностью.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/3ee20074dac98bdd06e0fb9b512c9400.png",
    "tags": [
      "Штурмовые винтовки",
      "Средняя дистанция",
      "Стрельба очередями"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 54
      },
      {
        "label": "Скорострельность",
        "value": 69
      },
      {
        "label": "Дальность",
        "value": 52
      },
      {
        "label": "Скорость перезарядки",
        "value": 55
      },
      {
        "label": "Магазин",
        "value": 22
      },
      {
        "label": "Точность",
        "value": 50
      },
      {
        "label": "Подвижность",
        "value": 89
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Дульная насадка",
      "Рукоятка",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1085",
    "title": "UZI",
    "description": "Компактное оружие, позволяющее сохранять высокую подвижность.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c3e906b732e6016a8d4076b8179feb17.png",
    "tags": [
      "Пистолеты",
      "Скорострельность",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 41
      },
      {
        "label": "Скорострельность",
        "value": 92
      },
      {
        "label": "Дальность",
        "value": 16
      },
      {
        "label": "Скорость перезарядки",
        "value": 55
      },
      {
        "label": "Магазин",
        "value": 16
      },
      {
        "label": "Точность",
        "value": 54
      },
      {
        "label": "Подвижность",
        "value": 97
      },
      {
        "label": "Бронепробитие",
        "value": 30
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1086",
    "title": "Лечащая снайперская винтовка",
    "description": "Попадание по союзнику восстанавливает ему здоровье. При перегреве оружие временно недоступно.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/3a160e5e1833dfdb2d8eab657bb62dc1.png",
    "tags": [
      "Снайперские винтовки",
      "Дальняя дистанция",
      "Лечение"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 84
      },
      {
        "label": "Скорострельность",
        "value": 36
      },
      {
        "label": "Дальность",
        "value": 90
      },
      {
        "label": "Скорость перезарядки",
        "value": 34
      },
      {
        "label": "Магазин",
        "value": 5
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 80
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1087",
    "title": "Огнемёт",
    "description": "Огнемёт ближнего действия с высоким бронепробитием; поражает противников, транспорт и ледяные стены.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/e4fdaca2482dd5a5a860f2b40d4cc7be.png",
    "tags": [
      "Пистолеты",
      "Дополнительный урон",
      "Урон по площади"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 39
      },
      {
        "label": "Скорострельность",
        "value": 89
      },
      {
        "label": "Дальность",
        "value": 35
      },
      {
        "label": "Скорость перезарядки",
        "value": 48
      },
      {
        "label": "Магазин",
        "value": 200
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 97
      },
      {
        "label": "Бронепробитие",
        "value": 100
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1088",
    "title": "MAC10",
    "description": "Пистолет-пулемёт со встроенным глушителем и сбалансированными характеристиками.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0f4164f6bd1d1b2d84924cf06486aa96.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Скорострельность",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 49
      },
      {
        "label": "Скорострельность",
        "value": 75
      },
      {
        "label": "Дальность",
        "value": 25
      },
      {
        "label": "Скорость перезарядки",
        "value": 62
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 51
      },
      {
        "label": "Подвижность",
        "value": 90
      },
      {
        "label": "Бронепробитие",
        "value": 42
      }
    ],
    "attachments": [
      "Глушитель",
      "Рукоятка",
      "Магазин"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1089",
    "title": "AC80",
    "description": "Два последовательных попадания по цели активируют дополнительный урон. Предназначена для средней и дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/a6ef7cbb8dff95b6fd4b701601ce338a.png",
    "tags": [
      "Марксманские винтовки",
      "Дальняя дистанция",
      "Дополнительный урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 77
      },
      {
        "label": "Скорострельность",
        "value": 32
      },
      {
        "label": "Дальность",
        "value": 76
      },
      {
        "label": "Скорость перезарядки",
        "value": 55
      },
      {
        "label": "Магазин",
        "value": 8
      },
      {
        "label": "Точность",
        "value": 51
      },
      {
        "label": "Подвижность",
        "value": 77
      },
      {
        "label": "Бронепробитие",
        "value": 70
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1090",
    "title": "G36",
    "description": "Использует патроны для штурмового оружия и поддерживает два режима стрельбы.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/152363f5ad54dcf2ad569b2e6d63b2be.png",
    "tags": [
      "Штурмовые винтовки",
      "Точность",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 57
      },
      {
        "label": "Скорострельность",
        "value": 61
      },
      {
        "label": "Дальность",
        "value": 60
      },
      {
        "label": "Скорость перезарядки",
        "value": 48
      },
      {
        "label": "Магазин",
        "value": 30
      },
      {
        "label": "Точность",
        "value": 55
      },
      {
        "label": "Подвижность",
        "value": 74
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1091",
    "title": "Зарядный дробовик",
    "description": "Удержание кнопки огня заряжает выстрел, повышая урон и дальность и уменьшая разброс. Слишком долгое удержание сбрасывает заряд.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/cc8e2f2ec7f785b93590d7646d2bee84.png",
    "tags": [
      "Дробовики",
      "Быстрый урон",
      "Зарядка выстрела"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 75
      },
      {
        "label": "Скорострельность",
        "value": 40
      },
      {
        "label": "Дальность",
        "value": 18
      },
      {
        "label": "Скорость перезарядки",
        "value": 48
      },
      {
        "label": "Магазин",
        "value": 3
      },
      {
        "label": "Точность",
        "value": 31
      },
      {
        "label": "Подвижность",
        "value": 86
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1092",
    "title": "M24",
    "description": "Лёгкая снайперская винтовка с высокой подвижностью и скорострельностью.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/196e9c4af34d1709974016106db22b18.png",
    "tags": [
      "Снайперские винтовки",
      "Мобильность",
      "Пробитие стен"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 90
      },
      {
        "label": "Скорострельность",
        "value": 27
      },
      {
        "label": "Дальность",
        "value": 79
      },
      {
        "label": "Скорость перезарядки",
        "value": 48
      },
      {
        "label": "Магазин",
        "value": 5
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 93
      },
      {
        "label": "Бронепробитие",
        "value": 14
      }
    ],
    "attachments": [
      "Дульная насадка",
      "Рукоятка",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "weapon-1093",
    "title": "Bizon",
    "description": "Пистолет-пулемёт с высоким уроном и невысокой устойчивостью при стрельбе.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f7e85f353cc9463cfb0ab105add251b9.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Высокий урон",
      "Быстрый урон"
    ],
    "stats": [
      {
        "label": "Урон",
        "value": 54
      },
      {
        "label": "Скорострельность",
        "value": 75
      },
      {
        "label": "Дальность",
        "value": 20
      },
      {
        "label": "Скорость перезарядки",
        "value": 41
      },
      {
        "label": "Магазин",
        "value": 25
      },
      {
        "label": "Точность",
        "value": 17
      },
      {
        "label": "Подвижность",
        "value": 91
      },
      {
        "label": "Бронепробитие",
        "value": null
      }
    ],
    "attachments": [
      "Глушитель",
      "Дульная насадка",
      "Рукоятка",
      "Магазин",
      "Прицел",
      "Приклад"
    ],
    "sourceUrl": "https://ff.garena.com/en/weapons/",
    "verifiedAt": "2026-10-06"
  }
];

export const knowledgeCharacters: readonly KnowledgeCatalogEntry[] = [
  {
    "id": "ray",
    "title": "Рэй",
    "subtitle": "Страж затмения",
    "description": "Помечает первого не сбитого с ног противника в секторе перед собой.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20264/1a2c81cd893f6ea43a527cb3b7b2f897.png",
    "tags": [
      "Атака",
      "Метка"
    ],
    "character": {
      "age": 24,
      "birthday": "19.06",
      "gender": "Мужской",
      "biography": "Рэй покинул банду при поддержке отца Широ. Теперь он путешествует по городам и защищает тех, кто не может постоять за себя.",
      "abilityName": "Связь затмения",
      "abilityDescription": "Помечает первого не сбитого с ног противника в секторе перед собой. Связь видят только владелец и цель. Если владелец снижает здоровье цели до порога, она сразу падает. Нокдаун или устранение отмеченного врага сбрасывает перезарядку навыка и лечит владельца.",
      "awakened": false,
      "parameters": [
        {
          "label": "Дальность сектора",
          "value": "30 м"
        },
        {
          "label": "Метка",
          "value": "10 с"
        },
        {
          "label": "Видимость связи",
          "value": "До 40 м"
        },
        {
          "label": "Порог нокдауна",
          "value": "30 HP или меньше"
        },
        {
          "label": "Лечение",
          "value": "10 HP/с в течение 3 с"
        },
        {
          "label": "Перезарядка",
          "value": "45 с"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/794",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "nero",
    "title": "Неро",
    "subtitle": "Кузнец мечты",
    "description": "Выпускает игрушку, проходящую сквозь препятствия.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202510/5d937a0ac5fe4e67c97fb8fb8e43455e.png",
    "tags": [
      "Контроль",
      "Зона"
    ],
    "character": {
      "age": 23,
      "birthday": "16.09",
      "gender": "Мужской",
      "biography": "Неро пережил замерзание и получил необычную власть над снами. Он держится особняком и использует новые силы на свой лад.",
      "abilityName": "Ледяной разум",
      "abilityDescription": "Выпускает игрушку, проходящую сквозь препятствия. Она преследует ближайшего видимого врага и создаёт зону, где владелец и противники не могут ставить ледяные стены. Враги теряют здоровье. Уничтожение игрушки снимает зону и помечает уничтожившего её игрока.",
      "awakened": false,
      "parameters": [
        {
          "label": "Прочность игрушки",
          "value": "1 HP"
        },
        {
          "label": "Время существования",
          "value": "12 с"
        },
        {
          "label": "Полёт",
          "value": "50 м; 100 м в королевской битве"
        },
        {
          "label": "Обнаружение / радиус зоны",
          "value": "8 м / 8 м"
        },
        {
          "label": "Урон в зоне",
          "value": "6 HP/с"
        },
        {
          "label": "Метка за уничтожение",
          "value": "5 с"
        },
        {
          "label": "Перезарядка",
          "value": "45 с"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/775",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "rin",
    "title": "Рин",
    "subtitle": "Нефритовый ниндзя",
    "description": "Постепенно создаёт кунаи.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20257/9aa96a782fab8633cbb57f9229e7a5e6.png",
    "tags": [
      "Атака",
      "Дальность"
    ],
    "character": {
      "age": 19,
      "birthday": "29.08",
      "gender": "Женский",
      "biography": "Рин — младшая сестра Хаято из семьи Ягами. Обучение искусству ниндзя помогает ей защищать близких.",
      "abilityName": "Шквал кунаев",
      "abilityDescription": "Постепенно создаёт кунаи. Они автоматически атакуют врага или ледяную стену, по которым попал владелец. Урон по врагу растёт с расстоянием; по стенам наносится повышенный урон.",
      "awakened": false,
      "parameters": [
        {
          "label": "Создание куная",
          "value": "Каждые 8 с"
        },
        {
          "label": "Запас",
          "value": "До 3 кунаев"
        },
        {
          "label": "Урон по врагу",
          "value": "До 12 за кунай"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/767",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "lila",
    "title": "Лила",
    "subtitle": "Артист стен",
    "description": "Попадания из винтовки замедляют врагов и транспорт.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20249/b09e7f93ec7c7a47dccbd704d8e4d879.png",
    "tags": [
      "Контроль",
      "Стены"
    ],
    "character": {
      "age": 19,
      "birthday": "25.03",
      "gender": "Женский",
      "biography": "Лила отличается жизнерадостностью и оптимистичным взглядом на жизнь. Она сохраняет энергию и хорошее настроение в самых разных обстоятельствах.",
      "abilityName": "Ледяной удар",
      "abilityDescription": "Попадания из винтовки замедляют врагов и транспорт. Нокдаун замедленного врага вызывает заморозку и даёт дополнительную ледяную стену.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/737",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "kairos",
    "title": "Кайрос",
    "subtitle": "Двойной защитник",
    "description": "Постепенно накапливает энергию.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/ed1e34b6c47b37675eae84daffdf63b1.png",
    "tags": [
      "Защита",
      "Энергия"
    ],
    "character": {
      "age": 24,
      "birthday": "02.02",
      "gender": "Мужской",
      "biography": "Кайрос служил в спецназе. Необычный источник энергии изменил его тело и превратил поиск новой энергии в постоянную потребность.",
      "abilityName": "Разрушитель защиты",
      "abilityDescription": "Постепенно накапливает энергию. При полном запасе переходит в режим, где атаки дополнительно повреждают щиты и броню, расходуя энергию до нуля.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/719",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "kassie",
    "title": "Кэсси",
    "subtitle": "Доктор-маньяк",
    "description": "Создаёт лечебную связь с союзником и восстанавливает здоровье обоим.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/8d87fe1959e300741eda601e800c0f40.png",
    "tags": [
      "Поддержка",
      "Исцеление"
    ],
    "character": {
      "age": 19,
      "birthday": "30.07",
      "gender": "Женский",
      "biography": "Кэсси занимается нейронаукой и экспериментирует с электротерапией. Её увлечённость исследованиями сопровождается весьма своеобразными представлениями о допустимом.",
      "abilityName": "Электротерапия",
      "abilityDescription": "Создаёт лечебную связь с союзником и восстанавливает здоровье обоим. Повторная активация даёт связанному союзнику дополнительное лечение.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/720",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "suzy",
    "title": "Сьюзи",
    "subtitle": "Наёмный убийца",
    "description": "Помеченные цели при устранении приносят команде игровую валюту матча.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/2cdde4e7d5010be2a35971e19f2285e4.png",
    "tags": [
      "Награда",
      "Метка"
    ],
    "character": {
      "age": 19,
      "birthday": "10.08",
      "gender": "Женский",
      "biography": "Сьюзи работает охотницей за головами. Она предпочитает хладнокровный расчёт, тщательно готовит операции и редко действует без плана.",
      "abilityName": "Денежная метка",
      "abilityDescription": "Помеченные цели при устранении приносят команде игровую валюту матча. За собственное устранение такой цели владелец получает дополнительную награду.",
      "awakened": false,
      "parameters": [
        {
          "label": "Командная награда за цель",
          "value": "100 монет матча"
        },
        {
          "label": "Доплата владельцу за своё устранение",
          "value": "100 монет матча"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/677",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "sonia",
    "title": "Соня",
    "subtitle": "Учёный",
    "description": "После смертельного урона получает защитный щит.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20238/8f978bdbe46d3d2366b82713082d6683.png",
    "tags": [
      "Выживание",
      "Щит"
    ],
    "character": {
      "age": 20,
      "birthday": "04.08",
      "gender": "Женский",
      "biography": "Соня — учёная, изменившая себя с помощью генетических технологий. Она рассматривает техническое совершенствование как путь исправления человеческих недостатков.",
      "abilityName": "Нанощит жизни",
      "abilityDescription": "После смертельного урона получает защитный щит. Нокдаун противника во время действия щита позволяет восстановить здоровье в размере его запаса.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/676",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "ignis",
    "title": "Игни",
    "subtitle": "Старшеклассник",
    "description": "Создаёт движущуюся огненную завесу, которая обжигает врагов и ледяные стены.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202311/a393f95f57bdaa3d2031a052b6acef24.png",
    "tags": [
      "Огонь",
      "Контроль"
    ],
    "character": {
      "age": 16,
      "birthday": "17.07",
      "gender": "Мужской",
      "biography": "Игни — подросток с огненными способностями и сильным чувством справедливости. Его попытки помогать иногда приводят к разрушениям и недовольству окружающих.",
      "abilityName": "Огненный мираж",
      "abilityDescription": "Создаёт движущуюся огненную завесу, которая обжигает врагов и ледяные стены. Можно накапливать применения навыка.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/695",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "orion",
    "title": "Орион",
    "subtitle": "Кулак возмездия",
    "description": "Увеличивает предел энергии и позволяет расходовать её на короткую неуязвимость с поглощением здоровья находящихся рядом врагов.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20238/4f4fc6c6d43fc3bb5ef4617f9f5340f7.png",
    "tags": [
      "Выживание",
      "Энергия"
    ],
    "character": {
      "age": 22,
      "birthday": "13.08",
      "gender": "Мужской",
      "biography": "Орион одержим возмездием. Багровая энергия даёт ему силу, но вместе с ней приходится сдерживать внутреннего зверя.",
      "abilityName": "Багровое сокрушение",
      "abilityDescription": "Увеличивает предел энергии и позволяет расходовать её на короткую неуязвимость с поглощением здоровья находящихся рядом врагов.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/680",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "tatsuya",
    "title": "Тацуя",
    "subtitle": "Вспыльчивый боец",
    "description": "Резко перемещается вперёд.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/e37e48adf72a2c014c2bfa8ed483f5b5.png",
    "tags": [
      "Мобильность",
      "Рывок"
    ],
    "character": {
      "age": 16,
      "birthday": "20.12",
      "gender": "Мужской",
      "biography": "Тацуя рос в семье, пострадавшей от предательства. Встреча с братом Широ помогает ему разобраться в прошлом и раскрыть более крупный заговор.",
      "abilityName": "Мятежный рывок",
      "abilityDescription": "Резко перемещается вперёд. Нокдаун вскоре после применения позволяет немедленно использовать навык снова.",
      "awakened": false,
      "parameters": [
        {
          "label": "Длительность рывка",
          "value": "0,3 с"
        },
        {
          "label": "Окно нокдауна для сброса",
          "value": "10 с"
        },
        {
          "label": "Перезарядка",
          "value": "90 с"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/602",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "a-patroa",
    "title": "Донна А",
    "subtitle": "Владелица магазина",
    "description": "Собственного боевого навыка нет: в специальный слот можно установить любой имеющийся навык.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f5a466acec3ed5bd7cdd149e26288ad1.png",
    "tags": [
      "Пресеты",
      "Навыки"
    ],
    "character": {
      "age": 28,
      "birthday": "30.03",
      "gender": "Женский",
      "biography": "Донна А владеет музыкальным магазином в небезопасном районе. Для местных жителей её магазин стал местом, где можно получить поддержку и почувствовать себя защищёнными.",
      "abilityName": "Гибкий набор навыков",
      "abilityDescription": "Собственного боевого навыка нет: в специальный слот можно установить любой имеющийся навык. Остальные слоты доступны после получения персонажа.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/552",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "iris",
    "title": "Ирис",
    "subtitle": "Оператор на миссиях",
    "description": "Попадание по ледяной стене отмечает врагов рядом с ней.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0b623468a09995f46f5ff98c6a48d49b.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 30,
      "birthday": "01.10",
      "gender": "Женский",
      "biography": "Ирис славится точными предчувствиями и сохраняет оптимизм даже на опасных заданиях. Она предпочитает работать самостоятельно, делая исключение для Гомера.",
      "abilityName": "Бой сквозь стены",
      "abilityDescription": "Попадание по ледяной стене отмечает врагов рядом с ней. По отмеченным целям можно стрелять сквозь стену с пониженным уроном.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/551",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "j-biebs",
    "title": "Джей Бибс",
    "subtitle": "Отважный поэт",
    "description": "Владелец и союзники могут расходовать энергию для поглощения урона.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/caae50176c5171c6041ca3ecd37d83d1.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 28,
      "birthday": "01.03",
      "gender": "Мужской",
      "biography": "Джей Бибс верит в силу человеческих связей. С помощью музыки он стремится объединять людей, считая взаимопонимание важнее богатства и влияния.",
      "abilityName": "Тихий страж",
      "abilityDescription": "Владелец и союзники могут расходовать энергию для поглощения урона. Потраченная союзниками энергия передаётся владельцу навыка.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/550",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "homer",
    "title": "Гомер",
    "subtitle": "Слепой ассасин",
    "description": "Дрон ищет ближайшего противника впереди и взрывается рядом с ним.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/26d226fa08410cc418959e3cc30095c7.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 30,
      "birthday": "01.06",
      "gender": "Мужской",
      "biography": "Незрячий Гомер помог создать технологическую преступную группировку Гризы. Он ищет связь между своей детской болезнью, исследовательским институтом и загадочными минералами.",
      "abilityName": "Удар по чувствам",
      "abilityDescription": "Дрон ищет ближайшего противника впереди и взрывается рядом с ним. Взрыв наносит урон, замедляет перемещение и стрельбу задетых врагов.",
      "awakened": false,
      "parameters": [
        {
          "label": "Диаметр взрыва",
          "value": "5 м"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/537",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "kenta",
    "title": "Кента",
    "subtitle": "Кузнец",
    "description": "Отправляет движущийся вихрь, наносящий урон.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/62312b920d0f43370998d4a7557e4b79.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 38,
      "birthday": "05.05",
      "gender": "Мужской",
      "biography": "Кента — кузнец и преданный защитник семьи Ягами. Его мастерство и верность помогают семье переживать опасные перемены.",
      "abilityName": "Налёт бури",
      "abilityDescription": "Отправляет движущийся вихрь, наносящий урон. Повторная активация телепортирует владельца к вихрю и даёт временное снижение входящего урона.",
      "awakened": false,
      "parameters": [
        {
          "label": "Существование вихря",
          "value": "8 с"
        },
        {
          "label": "Урон",
          "value": "25"
        },
        {
          "label": "Снижение урона после перемещения",
          "value": "20% на 5 с"
        },
        {
          "label": "Перезарядка",
          "value": "45 с"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/535",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "nairi",
    "title": "Наири",
    "subtitle": "Исследователь климата",
    "description": "Установленные ледяные стены восстанавливают прочность и лечат находящихся рядом союзников.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/e21eb41a3705ff817156dd5758157274.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 23,
      "birthday": "27.12",
      "gender": "Мужской",
      "biography": "Наири исследует климат и разрабатывает устройства для управления погодными явлениями. Вместо спокойной работы он предпочитает отправляться навстречу бурям.",
      "abilityName": "Ледяное железо",
      "abilityDescription": "Установленные ледяные стены восстанавливают прочность и лечат находящихся рядом союзников.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/536",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "otho",
    "title": "Ото",
    "subtitle": "Эксперт в области памяти",
    "description": "После устранения противника раскрывает расположение других врагов поблизости.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/d0ea6553e85abbf0a8b718e29900b7f5.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 21,
      "birthday": "01.11",
      "gender": "Мужской",
      "biography": "Ото боится утратить воспоминания и создаёт устройство для работы с памятью. Его исследования также помогают понимать намерения окружающих.",
      "abilityName": "Туман памяти",
      "abilityDescription": "После устранения противника раскрывает расположение других врагов поблизости.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/505",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "leon",
    "title": "Леон",
    "subtitle": "Баскетболист",
    "description": "Восстанавливает здоровье после выхода из боя.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/b79f47950001fb7f7130a6b3752b3446.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 20,
      "birthday": "30.09",
      "gender": "Мужской",
      "biography": "Леон учится и играет в баскетбол с бионическим протезом ноги. Он ремонтирует электронику и старается поддерживать семью и друзей.",
      "abilityName": "На последней секунде",
      "abilityDescription": "Восстанавливает здоровье после выхода из боя.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/504",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "thiva",
    "title": "Тива",
    "subtitle": "Певец и музыкант",
    "description": "Ускоряет поднятие союзников.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/217c0184667efa92bcec0caa73af73b9.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 25,
      "birthday": "02.12",
      "gender": "Мужской",
      "biography": "Тива — младший брат Димитри. Он посвятил себя музыке и хочет с её помощью помогать другим людям.",
      "abilityName": "Живительный ритм",
      "abilityDescription": "Ускоряет поднятие союзников. Успешная помощь восстанавливает здоровье владельцу навыка.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/478",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "dimitri",
    "title": "Димитри",
    "subtitle": "Звукорежиссёр и музыкант",
    "description": "Создаёт область восстановления здоровья.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/024c98913571304db2cba9d257e7291a.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 26,
      "birthday": "16.05",
      "gender": "Мужской",
      "biography": "Димитри — старший брат Тивы, музыкант и специалист по звуковым технологиям. Он исследует, как его разработки могут приносить людям пользу.",
      "abilityName": "Исцеляющий ритм",
      "abilityDescription": "Создаёт область восстановления здоровья. Находящиеся в ней сбитые с ног игроки могут подняться самостоятельно.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/477",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "d-bee",
    "title": "Ди-Би",
    "subtitle": "Создатель битов",
    "description": "При стрельбе на ходу увеличивает точность и скорость передвижения.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f1a09717ed71e7302da8d4cc889d2e33.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 19,
      "birthday": "23.09",
      "gender": "Мужской",
      "biography": "Ди-Би — общительный танцор и создатель музыки. Он любит знакомиться с людьми и выражать свои идеи через творчество.",
      "abilityName": "Пулевой ритм",
      "abilityDescription": "При стрельбе на ходу увеличивает точность и скорость передвижения.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/464",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "maro",
    "title": "Маро",
    "subtitle": "Сокольничий",
    "description": "Урон увеличивается с расстоянием до цели.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/8af9a328d62a330a76221b79670daf37.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 32,
      "birthday": "23.05",
      "gender": "Мужской",
      "biography": "Маро лучше чувствует себя рядом с животными, чем среди людей. Соколиная охота помогает ему сохранять связь с природой.",
      "abilityName": "Соколиная охота",
      "abilityDescription": "Урон увеличивается с расстоянием до цели. По отмеченным врагам действует дополнительное усиление.",
      "awakened": false,
      "parameters": [
        {
          "label": "Бонус за расстояние",
          "value": "До 20%"
        },
        {
          "label": "Бонус по отмеченной цели",
          "value": "5%"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/447",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "skyler",
    "title": "Скайлер",
    "subtitle": "Председатель медиакорпорации",
    "description": "Звуковая волна повреждает ледяные стены.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/547dea01d82886891297443e8e9d270f.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 26,
      "birthday": "05.07",
      "gender": "Мужской",
      "biography": "Скайлер — вьетнамский артист и руководитель развлекательной компании. Он ищет талантливых людей и создаёт условия для новых творческих проектов.",
      "abilityName": "Разрывная волна",
      "abilityDescription": "Звуковая волна повреждает ледяные стены. Установка собственной стены восстанавливает здоровье; одновременные эффекты лечения не складываются.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/462",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "xayne",
    "title": "Ксейн",
    "subtitle": "Спортсменка-экстремал",
    "description": "Даёт временный запас щита.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20229/ea05dd27c4f4faf3267679d5f90cdaec.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 23,
      "birthday": "21.04",
      "gender": "Женский",
      "biography": "Ксейн увлекается экстремальным спортом и постоянно ищет сильные впечатления. Для неё свобода и новые испытания важнее спокойной жизни.",
      "abilityName": "Экстремальное столкновение",
      "abilityDescription": "Даёт временный запас щита. Нокдаун противника восстанавливает запас и продлевает эффект; после завершения временные очки исчезают.",
      "awakened": false,
      "parameters": [
        {
          "label": "Временный щит",
          "value": "70 SP"
        },
        {
          "label": "Длительность",
          "value": "15 с"
        },
        {
          "label": "Восстановление после нокдауна",
          "value": "До 70 SP, длительность сбрасывается"
        },
        {
          "label": "Перезарядка",
          "value": "75 с"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/446",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "shirou",
    "title": "Широ",
    "subtitle": "Курьер службы доставки",
    "description": "Помечает противника, попавшего во владельца.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/dbe25891f13c5752e84ad7daf57106cc.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 19,
      "birthday": "20.11",
      "gender": "Мужской",
      "biography": "Широ работает курьером в Гризе. За повседневными доставками стоит его желание защитить семью и родной город.",
      "abilityName": "Ответный удар",
      "abilityDescription": "Помечает противника, попавшего во владельца. Метка видна только владельцу, а первый ответный выстрел получает усиленное бронепробитие.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/405",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "chrono",
    "title": "Хроно",
    "subtitle": "Охотник за наградой",
    "description": "Создаёт защитное поле, поглощающее урон.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/6c2bdfaa7f07939c8e2cfa6578b3bb9a.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 35,
      "birthday": "05.02",
      "gender": "Мужской",
      "biography": "Хроно пришёл из более технологически развитого параллельного мира. Родители-юристы, помогавшие нуждающимся, вдохновили его защищать других.",
      "abilityName": "Повелитель времени",
      "abilityDescription": "Создаёт защитное поле, поглощающее урон. Находясь внутри, нельзя стрелять по противникам за его пределами.",
      "awakened": false,
      "parameters": [
        {
          "label": "Прочность поля",
          "value": "1000 урона"
        },
        {
          "label": "Длительность",
          "value": "10 с"
        },
        {
          "label": "Перезарядка",
          "value": "45 с"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/299",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "dasha",
    "title": "Даша",
    "subtitle": "Торговец на чёрном рынке",
    "description": "Снижает урон от падения и время восстановления после него.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/8d2bc4db79fe889ab6541ae2dd7cd2cb.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 25,
      "birthday": "08.12",
      "gender": "Женский",
      "biography": "Даша пережила трудное прошлое, но сохранила бунтарский характер. Позже она нашла своё место среди участников сопротивления Mambas.",
      "abilityName": "Вечеринка продолжается",
      "abilityDescription": "Снижает урон от падения и время восстановления после него. Также уменьшает накопление отдачи и её максимальный уровень.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/293",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "k",
    "title": "Кей",
    "subtitle": "Профессор и мастер джиу-джитсу",
    "description": "Увеличивает предел энергии.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/cace792e96191c1623da45de2e52a589.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 31,
      "birthday": "06.10",
      "gender": "Мужской",
      "biography": "После тяжёлой травмы позвоночника Кей заново учился ходить и заниматься спортом. Восстановление научило его внимательнее относиться к телу, разуму и окружающим людям.",
      "abilityName": "Мастер всего",
      "abilityDescription": "Увеличивает предел энергии. Один режим ускоряет преобразование энергии в здоровье у союзников, другой постепенно восстанавливает собственную энергию.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/255",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "oscar",
    "title": "Оскар",
    "subtitle": "Ночной мститель",
    "description": "Рывок пробивает ледяные стены на пути, повреждает их и задетых противников.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20252/d5d04e40eb00900e96a28828decdaff0.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 20,
      "birthday": "08.04",
      "gender": "Мужской",
      "biography": "Днём Оскар производит впечатление примерного студента. Ночью он становится мстителем, самостоятельно борющимся с преступностью.",
      "abilityName": "Отважный рывок",
      "abilityDescription": "Рывок пробивает ледяные стены на пути, повреждает их и задетых противников. Враги также отбрасываются.",
      "awakened": false,
      "parameters": [
        {
          "label": "Пробиваемые стены",
          "value": "Первые 3"
        },
        {
          "label": "Урон стенам и врагам",
          "value": "25"
        },
        {
          "label": "Перезарядка",
          "value": "60 с"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/753",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "luqueta",
    "title": "Лукета",
    "subtitle": "Звезда футбола",
    "description": "Устранения повышают максимальный запас щита.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/28b704e964e8057d7fc76e1a2cca7d26.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 20,
      "birthday": "10.06",
      "gender": "Мужской",
      "biography": "Лукета приехал учиться по обмену. Отец видел его будущее в бизнесе, но выдающийся футбольный талант открыл ему путь в спорт.",
      "abilityName": "Хет-трик",
      "abilityDescription": "Устранения повышают максимальный запас щита. Накопленное преимущество сбрасывается при гибели или начале нового раунда.",
      "awakened": false,
      "parameters": [
        {
          "label": "Щит за устранение",
          "value": "+15 SP к максимуму"
        },
        {
          "label": "Максимальная прибавка",
          "value": "45 SP"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/243",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "clu",
    "title": "Клу",
    "subtitle": "Частный детектив",
    "description": "Обнаруживает противников поблизости, если они не лежат и не сидят на корточках.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/81def6541fb94bd20887bad6b5a725cf.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 24,
      "birthday": "28.02",
      "gender": "Женский",
      "biography": "После исчезновения отца на войне Клу стала частным детективом. Она использует своё образование и наблюдательность, чтобы искать ответы и помогать другим.",
      "abilityName": "Следопыт",
      "abilityDescription": "Обнаруживает противников поблизости, если они не лежат и не сидят на корточках.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/209",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "wolfrahh",
    "title": "Вольфра",
    "subtitle": "Игровой стример",
    "description": "Каждое устранение добавляет постоянного зрителя.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/e4169a44d8a6e83549b3b7f8a7820c1e.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 19,
      "birthday": "29.04",
      "gender": "Мужской",
      "biography": "Вольфра преодолевает пережитую травму и неуверенность через игровые соревнования. Участие в виртуальном турнире приводит его к неожиданным тайнам.",
      "abilityName": "В центре внимания",
      "abilityDescription": "Каждое устранение добавляет постоянного зрителя. Зрители уменьшают входящий урон в голову и усиливают собственные попадания в голову.",
      "awakened": false,
      "parameters": [
        {
          "label": "Входящий урон в голову",
          "value": "−4% за зрителя, до −12%"
        },
        {
          "label": "Исходящий урон в голову",
          "value": "+10% за зрителя, до +30%"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/210",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "jota",
    "title": "Джота",
    "subtitle": "Мастер паркура",
    "description": "Попадания из огнестрельного оружия восстанавливают здоровье владельца.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/5ae1530683a65bdfd81f6f7f7552650c.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 31,
      "birthday": "23.06",
      "gender": "Мужской",
      "biography": "Джота вырос в обычной семье, но выбрал жизнь, полную движения. Он занимается паркуром и покоряет высотные здания.",
      "abilityName": "Непрерывная атака",
      "abilityDescription": "Попадания из огнестрельного оружия восстанавливают здоровье владельца.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/178",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "kapella",
    "title": "Капелла",
    "subtitle": "Поп-звезда",
    "description": "Попадания по союзникам восстанавливают им здоровье.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/9c6b10d2984125fbdd96fae9e0a84518.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 21,
      "birthday": "17.07",
      "gender": "Женский",
      "biography": "Капелла выросла сиротой, была удочерена Джозефом и стала певицей. Её история связана с сопротивлением Mambas и другом детства Альваро.",
      "abilityName": "Целительные выстрелы",
      "abilityDescription": "Попадания по союзникам восстанавливают им здоровье. При использовании лечащего пистолета лечение усиливается.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/177",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "steffie",
    "title": "Стеффи",
    "subtitle": "Граффити-художница",
    "description": "Создаёт область, блокирующую метательное снаряжение.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/809499ee33234f1c72c6a3ab120e85dd.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 23,
      "birthday": "05.11",
      "gender": "Женский",
      "biography": "Стеффи — художница, привыкшая спорить с авторитетами. Конфликт с Horizon вынудил её скрываться; помощь Моко привела её в движение сопротивления Mambas.",
      "abilityName": "Благословение граффити",
      "abilityDescription": "Создаёт область, блокирующую метательное снаряжение. Союзники внутри постепенно восстанавливают броню и получают меньше урона от пуль.",
      "awakened": false,
      "parameters": [
        {
          "label": "Восстановление брони",
          "value": "Каждую секунду; величина не указана"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/150",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "maxim",
    "title": "Максим",
    "subtitle": "Скоростной едок",
    "description": "Сокращает время использования аптечек и поедания грибов.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/59dc42433e877fa0cc3bb69b74dbf2c8.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 17,
      "birthday": "30.11",
      "gender": "Мужской",
      "biography": "Максим подрабатывал трансляциями с едой, пока сестра Миша обеспечивала семью. Его и Келли похитили из школьного автобуса; на Бермудах ему пришлось стать сильнее и увереннее.",
      "abilityName": "Обжорство",
      "abilityDescription": "Сокращает время использования аптечек и поедания грибов.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/15",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "kla",
    "title": "Кла",
    "subtitle": "Профессиональный кикбоксёр",
    "description": "Повышает урон ударами кулаков.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/1655985bf74931458766921ee6bb6e0a.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 27,
      "birthday": "14.12",
      "gender": "Мужской",
      "biography": "После убийства родителей Кла жил жаждой мести. Встреча с виновником заставила мастера боевых искусств иначе взглянуть на собственную ярость.",
      "abilityName": "Муай-тай",
      "abilityDescription": "Повышает урон ударами кулаков.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/8",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "paloma",
    "title": "Палома",
    "subtitle": "Лидер банды",
    "description": "После уничтожения ледяной стены повышает точность стрельбы.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/93a87a41a13af14c2346379a0d917d36.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 28,
      "birthday": "04.08",
      "gender": "Женский",
      "biography": "Палома выросла в бедном районе и стала уверенной в себе предводительницей. Важное место в её жизни занимает Антонио.",
      "abilityName": "Разрушительный залп",
      "abilityDescription": "После уничтожения ледяной стены повышает точность стрельбы.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/12",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "miguel",
    "title": "Мигель",
    "subtitle": "Элитный боец спецназа",
    "description": "Получает энергию за устранение противников.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/041a8586fe9d5461a7f28510fb5786d0.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 26,
      "birthday": "10.10",
      "gender": "Мужской",
      "biography": "Мигель командовал отрядом с безупречным послужным списком. Провал важного задания заставил его столкнуться с предательством человека, которого он считал другом.",
      "abilityName": "Неистовый боец",
      "abilityDescription": "Получает энергию за устранение противников.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/4",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "caroline",
    "title": "Каролина",
    "subtitle": "Дочь влиятельной семьи",
    "description": "Увеличивает скорость передвижения, когда в руках дробовик.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/aa43b9f99d6a367a5123dbae9f6cd5c6.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 17,
      "birthday": "10.10",
      "gender": "Женский",
      "biography": "Каролина выросла во влиятельной семье, связанной с Horizon. За вежливостью скрываются расчётливость и самостоятельность; она знакома с Хаято.",
      "abilityName": "Ловкость",
      "abilityDescription": "Увеличивает скорость передвижения, когда в руках дробовик.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/11",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "antonio",
    "title": "Антонио",
    "subtitle": "Гангстер",
    "description": "Даёт стартовый запас щита и восстанавливает его после выхода из боя.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c87a2bcb4b4ab665908df11672aa191d.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 30,
      "birthday": "01.08",
      "gender": "Мужской",
      "biography": "За грозным обликом Антонио скрывается застенчивый и заботливый человек. Он дорожит женой, семьёй и своим чихуахуа Пончо.",
      "abilityName": "Дух гангстера",
      "abilityDescription": "Даёт стартовый запас щита и восстанавливает его после выхода из боя.",
      "awakened": false,
      "parameters": [
        {
          "label": "Стартовый щит",
          "value": "20 SP"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/17",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "wukong",
    "title": "Вуконг",
    "subtitle": "Боевой киборг",
    "description": "Превращается в куст с небольшой потерей скорости.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/c0f1547f51f4c2b99e28ef4ec52db084.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": null,
      "birthday": "14.12",
      "gender": "Мужской",
      "biography": "Вуконг стал киборгом в результате экспериментов Horizon. Освободившись от контролирующего чипа, он покинул организацию и начал искать собственный путь к справедливости.",
      "abilityName": "Камуфляж",
      "abilityDescription": "Превращается в куст с небольшой потерей скорости. Атака завершает маскировку. Нокдаун вскоре после активации сбрасывает перезарядку.",
      "awakened": false,
      "parameters": [
        {
          "label": "Маскировка",
          "value": "10 с"
        },
        {
          "label": "Скорость",
          "value": "−10%"
        },
        {
          "label": "Окно нокдауна для сброса",
          "value": "10 с"
        },
        {
          "label": "Перезарядка",
          "value": "75 с"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/7",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "moco",
    "title": "Моко",
    "subtitle": "Хакер",
    "description": "Попадания отмечают противника и позволяют отслеживать его положение.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/769ceca68c62ec35cdbf90f1c0d7c73f.png",
    "tags": [
      "Персонаж",
      "Пробуждение"
    ],
    "character": {
      "age": 20,
      "birthday": "13.02",
      "gender": "Женский",
      "biography": "Моко работала в Horizon, пока не узнала о преступных планах корпорации. Она стёрла сведения о себе и скрылась, чтобы найти способ остановить бывшего работодателя.",
      "abilityName": "Око загадки",
      "abilityDescription": "Попадания отмечают врага для владельца и союзников в поле зрения и на мини-карте. Движение отмеченной цели продлевает обнаружение.",
      "awakened": true,
      "parameters": [
        {
          "label": "Исходная метка",
          "value": "3 с"
        },
        {
          "label": "Продление за движение",
          "value": "До 4 с"
        }
      ],
      "baseAbility": {
        "name": "Глаз хакера",
        "description": "Попадания отмечают противника и позволяют отслеживать его положение.",
        "sourceUrl": "https://ff.garena.com/en/chars/118"
      }
    },
    "sourceUrl": "https://ff.garena.com/en/chars/10",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "hayato",
    "title": "Хаято",
    "subtitle": "Наследник самурайского рода",
    "description": "Потеря здоровья увеличивает бронепробитие атак.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/d8800f78f00e9831fc157a04aa3078aa.png",
    "tags": [
      "Персонаж",
      "Пробуждение"
    ],
    "character": {
      "age": 20,
      "birthday": "21.03",
      "gender": "Мужской",
      "biography": "Хаято — старший наследник семьи Ягами. Когда семейную корпорацию поглотила Horizon, он вмешался в её дела, чтобы сохранить честь и самостоятельность семьи.",
      "abilityName": "Искусство клинков",
      "abilityDescription": "Чем меньше остаётся здоровья, тем сильнее уменьшается урон, приходящий спереди.",
      "awakened": true,
      "parameters": [
        {
          "label": "Снижение фронтального урона",
          "value": "2% за каждые потерянные 10% максимального HP"
        }
      ],
      "baseAbility": {
        "name": "Бусидо",
        "description": "Потеря здоровья увеличивает бронепробитие атак.",
        "sourceUrl": "https://ff.garena.com/en/chars/306"
      }
    },
    "sourceUrl": "https://ff.garena.com/en/chars/3",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "laura",
    "title": "Лаура",
    "subtitle": "Специальный агент",
    "description": "Повышает точность при стрельбе через прицел.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/a742beadf78c01fb9e05aabc51c9369e.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 29,
      "birthday": "21.05",
      "gender": "Женский",
      "biography": "Лаура — талантливый стрелок и специальный агент. Поиск пропавшего отца и задание, связанное с Рафаэлем, ставят её перед непростым выбором.",
      "abilityName": "Меткий стрелок",
      "abilityDescription": "Повышает точность при стрельбе через прицел.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/5",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "rafael",
    "title": "Рафаэль",
    "subtitle": "Наёмник",
    "description": "Выстрелы из снайперских и марксманских винтовок становятся беззвучными.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/738a885af3eb66c1415a0ac61bfd304b.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 31,
      "birthday": "09.09",
      "gender": "Мужской",
      "biography": "После семейной трагедии Рафаэль стал наёмником и искал справедливость через месть. Отношения с Лаурой заставляют его пересматривать свои убеждения.",
      "abilityName": "Беззвучная смерть",
      "abilityDescription": "Выстрелы из снайперских и марксманских винтовок становятся беззвучными. Сбитые владельцем враги быстрее теряют оставшееся здоровье.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/14",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "a124",
    "title": "А124",
    "subtitle": "Гуманоидный робот",
    "description": "Выпускает электромагнитную волну, которая блокирует использование способностей врагами и прерывает их взаимодействия.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/ab1469c59a10c4669482e1ab625357dd.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 18,
      "birthday": "01.01",
      "gender": "Женский",
      "biography": "А124 создали как боевую машину. Со временем робот начал интересоваться человеческими чувствами и искать что-то за пределами заложенных приказов.",
      "abilityName": "Боевой импульс",
      "abilityDescription": "Выпускает электромагнитную волну, которая блокирует использование способностей врагами и прерывает их взаимодействия.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/6",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "alvaro",
    "title": "Альваро",
    "subtitle": "Подрывник",
    "description": "Повышает урон взрывного оружия и увеличивает область поражения.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/d5c0af0ac8632385f2cdb0500874b2a5.png",
    "tags": [
      "Персонаж",
      "Пробуждение"
    ],
    "character": {
      "age": 26,
      "birthday": "28.05",
      "gender": "Мужской",
      "biography": "После взрыва Альваро получил необычные способности и потерял память. Капелла, его подруга детства, осталась частью прошлого, которое ему ещё предстоит вспомнить.",
      "abilityName": "Взрывное разделение",
      "abilityDescription": "Перед взрывом граната создаёт дополнительные гранаты, каждая из которых наносит часть исходного урона.",
      "awakened": true,
      "parameters": [
        {
          "label": "Разделение",
          "value": "За 1 с до взрыва"
        },
        {
          "label": "Дополнительные гранаты",
          "value": "3"
        },
        {
          "label": "Урон каждой",
          "value": "20% исходного"
        }
      ],
      "baseAbility": {
        "name": "Искусство разрушения",
        "description": "Повышает урон взрывного оружия и увеличивает область поражения.",
        "sourceUrl": "https://ff.garena.com/es/article/1120/"
      }
    },
    "sourceUrl": "https://ff.garena.com/en/chars/145",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "santino",
    "title": "Сантино",
    "subtitle": "Дизайнер одежды",
    "description": "Отправляет вперёд манекен.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20233/a3810f993d32077e88c5226625bb55a9.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 34,
      "birthday": "14.10",
      "gender": "Мужской",
      "biography": "Сантино вырос в бедности, учился искусству и создал модный бренд Angelic. Известность принесли не только его работы, но и умение привлекать внимание публики.",
      "abilityName": "Подмена формы",
      "abilityDescription": "Отправляет вперёд манекен. Повторная активация позволяет переместиться к нему.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/668",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "notora",
    "title": "Нотора",
    "subtitle": "Мотогонщица",
    "description": "Во время управления транспортом восстанавливает здоровье находящимся в нём игрокам.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/fab6aa1cb1c6ce92652a3f184d265b76.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 27,
      "birthday": "22.03",
      "gender": "Женский",
      "biography": "Нотора выросла среди байкеров, но не разделяла их жестокость. После разгрома её банды она оказалась в плену и была отправлена на Бермуды.",
      "abilityName": "Благословение гонщика",
      "abilityDescription": "Во время управления транспортом восстанавливает здоровье находящимся в нём игрокам. Эффекты нескольких таких навыков не складываются.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/147",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "alok",
    "title": "Алок",
    "subtitle": "Известный диджей",
    "description": "Создаёт ауру, которая ускоряет владельца и ближайших союзников и восстанавливает здоровье. Несколько таких эффектов не складываются.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c62e709e3ad8387f5484bb12e1cc81a9.png",
    "tags": [
      "Персонаж",
      "Пробуждение"
    ],
    "character": {
      "age": 28,
      "birthday": "26.08",
      "gender": "Мужской",
      "biography": "Бразильский диджей Алок путешествует с концертами по миру. В игровой истории его пригласили выступить на острове для закрытого круга гостей.",
      "abilityName": "Музыкальный ремикс",
      "abilityDescription": "Пока действует аура, позади персонажа появляются ноты. Подобравший ноту союзник получает эффект ауры.",
      "awakened": true,
      "parameters": [
        {
          "label": "Появление нот",
          "value": "Каждые 2 с"
        },
        {
          "label": "Место появления",
          "value": "В 2 м позади"
        },
        {
          "label": "Время существования ноты",
          "value": "5 с"
        }
      ],
      "baseAbility": {
        "name": "Заведи ритм",
        "description": "Создаёт ауру, которая ускоряет владельца и ближайших союзников и восстанавливает здоровье. Несколько таких эффектов не складываются.",
        "sourceUrl": "https://ff.garena.com/en/chars/153"
      }
    },
    "sourceUrl": "https://ff.garena.com/en/chars/146",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "shani",
    "title": "Шани",
    "subtitle": "Инженер на свалке",
    "description": "Использование активного навыка даёт владельцу и ближайшим союзникам очки щита.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/2a790a2ca70a797b5384a122ad7d8d10.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 31,
      "birthday": "23.06",
      "gender": "Женский",
      "biography": "Шани потеряла родителей при взрыве здания и долго перебивалась случайными заработками. Владелец свалки помог ей обрести дом, где она смогла развивать инженерные способности.",
      "abilityName": "Переработка снаряжения",
      "abilityDescription": "Использование активного навыка даёт владельцу и ближайшим союзникам очки щита. Через некоторое время они начинают убывать.",
      "awakened": false,
      "parameters": [
        {
          "label": "Щит",
          "value": "30 SP"
        },
        {
          "label": "Радиус для команды",
          "value": "10 м"
        },
        {
          "label": "Начало убывания щита",
          "value": "Через 5 с"
        },
        {
          "label": "Перезарядка",
          "value": "10 с"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/148",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "ford",
    "title": "Форд",
    "subtitle": "Капитан дальнего плавания",
    "description": "Уменьшает получаемый за пределами безопасной зоны урон.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202211/e4eba268be6b474381acc6c4b282f5ea.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 31,
      "birthday": "23.01",
      "gender": "Мужской",
      "biography": "Бывший моряк Форд искал убежище на Бермудах. Пережитое предательство сделало его осторожным; особенно важны для него безопасность и отношения с Оливией.",
      "abilityName": "Железная воля",
      "abilityDescription": "Уменьшает получаемый за пределами безопасной зоны урон.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/13",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "joseph",
    "title": "Джозеф",
    "subtitle": "Председатель технокорпорации",
    "description": "Даёт защиту от мешающих эффектов, включая замедление, метки и блокировку способностей, а также увеличивает скорость передвижения.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/07d65d842e613a0cc22794f953c44be3.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 45,
      "birthday": "02.02",
      "gender": "Мужской",
      "biography": "Джозеф основал Nerve Labs и связан с проектом New Dawn. Узнав о планах Horizon, он превратился в противника корпорации.",
      "abilityName": "Серебряная ложка",
      "abilityDescription": "Даёт защиту от мешающих эффектов, включая замедление, метки и блокировку способностей, а также увеличивает скорость передвижения.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/149",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "olivia",
    "title": "Оливия",
    "subtitle": "Врач",
    "description": "Усиливает лечение.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202211/435b2230bb59c6a7f087d841e7dc8590.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 29,
      "birthday": "10.11",
      "gender": "Женский",
      "biography": "После перенесённой в детстве операции Оливия обнаружила целительные способности. Она ведёт сдержанную жизнь и помогает людям в безопасном убежище Форда.",
      "abilityName": "Целительное прикосновение",
      "abilityDescription": "Усиливает лечение. Часть одиночного лечения передаётся ближайшим союзникам.",
      "awakened": false,
      "parameters": [
        {
          "label": "Усиление лечения",
          "value": "30%"
        },
        {
          "label": "Передаваемая доля",
          "value": "90% одиночного лечения"
        },
        {
          "label": "Радиус",
          "value": "20 м"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/18",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "andrew",
    "title": "Эндрю",
    "subtitle": "Бывший полицейский",
    "description": "Уменьшает потерю прочности бронежилета.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/564762d9a1137afaf2c9abb0ea8862b7.png",
    "tags": [
      "Персонаж",
      "Пробуждение"
    ],
    "character": {
      "age": 42,
      "birthday": "25.12",
      "gender": "Мужской",
      "biography": "Эндрю — бывший сержант полиции и отчим Келли. После гибели невесты и потери работы он продолжил расследование связей преступности, полиции и Horizon.",
      "abilityName": "Волчья стая",
      "abilityDescription": "Усиливает снижение урона бронёй. Находящиеся рядом союзники дают дополнительную защиту.",
      "awakened": true,
      "parameters": [
        {
          "label": "Снижение урона",
          "value": "4%"
        },
        {
          "label": "За каждого союзника рядом",
          "value": "Ещё 1%"
        },
        {
          "label": "Радиус",
          "value": "15 м"
        }
      ],
      "baseAbility": {
        "name": "Специалист по броне",
        "description": "Уменьшает потерю прочности бронежилета.",
        "sourceUrl": "https://ff.garena.com/vn/chars/441"
      }
    },
    "sourceUrl": "https://ff.garena.com/en/chars/2",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "kelly",
    "title": "Келли",
    "subtitle": "Спринтер",
    "description": "Увеличивает скорость спринта.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202311/a80ef2744fa83dc119cc09249d70444e.png",
    "tags": [
      "Персонаж",
      "Пробуждение"
    ],
    "character": {
      "age": 17,
      "birthday": "01.04",
      "gender": "Женский",
      "biography": "Келли — школьница и успешная бегунья. Даже после развода приёмной матери с Эндрю она сохранила с ним близкие отношения; попадание на остров стало для неё серьёзным испытанием.",
      "abilityName": "Смертельная скорость",
      "abilityDescription": "После непрерывного спринта усиливает первый выстрел. Окно усиленного выстрела ограничено по времени.",
      "awakened": true,
      "parameters": [
        {
          "label": "Подготовка спринтом",
          "value": "4 с"
        },
        {
          "label": "Урон первого выстрела",
          "value": "106% обычного, то есть +6%"
        },
        {
          "label": "Окно усиления",
          "value": "5 с"
        }
      ],
      "baseAbility": {
        "name": "Бегунья",
        "description": "Увеличивает скорость спринта.",
        "sourceUrl": "https://ff.garena.com/en/chars/91"
      }
    },
    "sourceUrl": "https://ff.garena.com/en/chars/1",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "nikita",
    "title": "Никита",
    "subtitle": "Телохранитель",
    "description": "Ускоряет перезарядку.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/93bac478d8b64e0a6b31fee8c75220d9.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 22,
      "birthday": "11.11",
      "gender": "Женский",
      "biography": "Никита — подготовленный стрелок, ставшая телохранителем Каролины. За обязанностью защищать дочь влиятельного руководителя могут скрываться её собственные цели.",
      "abilityName": "Мастер оружия",
      "abilityDescription": "Ускоряет перезарядку. Попадание временно ослабляет лечение противника; сила ослабления не превышает указанный предел.",
      "awakened": false,
      "parameters": [
        {
          "label": "Скорость перезарядки",
          "value": "+20%"
        },
        {
          "label": "Снижение лечения врага",
          "value": "50%, максимум 50%"
        },
        {
          "label": "Длительность",
          "value": "6 с"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/16",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "misha",
    "title": "Миша",
    "subtitle": "Пилот гоночной машины",
    "description": "Увеличивает скорость управления транспортом и уменьшает урон внутри него.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/33110529f97da7fc1bf681e61a1de2bb.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 19,
      "birthday": "26.07",
      "gender": "Женский",
      "biography": "После гибели родителей Миша оставила школу и стала гонщицей, чтобы содержать себя и Максима. Когда брат пропал, она объединила поиски с Эндрю.",
      "abilityName": "Форсаж",
      "abilityDescription": "Увеличивает скорость управления транспортом и уменьшает урон внутри него. Во время вождения по персонажу труднее прицелиться.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/9",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "morse",
    "title": "Морс",
    "subtitle": "Хакер",
    "description": "В режиме скрытности персонажа трудно увидеть издалека, а обнаружение навыками не работает.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20261/87b0db20d90350d22979b03d8b65a567.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 21,
      "birthday": "11.11",
      "gender": "Мужской",
      "biography": "Морс — хакер, умеющий исчезать как в сети, так и в реальном мире. Он предпочитает действовать скрытно и прежде всего руководствуется собственными интересами.",
      "abilityName": "Скрытые байты",
      "abilityDescription": "В режиме скрытности персонажа трудно увидеть издалека, а обнаружение навыками не работает. Он получает скорость и временный щит, но не может стрелять. Вблизи противники по-прежнему могут использовать помощь в прицеливании.",
      "awakened": false,
      "parameters": [
        {
          "label": "Граница скрытности",
          "value": "12 м"
        },
        {
          "label": "Скорость",
          "value": "+20%"
        },
        {
          "label": "Временный щит",
          "value": "25 SP"
        },
        {
          "label": "Длительность",
          "value": "До 13 с"
        },
        {
          "label": "Задержка выхода",
          "value": "0,5 с"
        },
        {
          "label": "Перезарядка",
          "value": "45 с"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/785",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "ryden",
    "title": "Райден",
    "subtitle": "Изобретатель",
    "description": "Запускает роботизированного паука.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20241/fb808bb7cfc4820384c7a52fee3201ea.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 16,
      "birthday": "07.09",
      "gender": "Мужской",
      "biography": "Райден — младший брат Сьюзи и талантливый изобретатель. Он предпочитает решать задачи с помощью техники и тщательно продуманных устройств.",
      "abilityName": "Паучья ловушка",
      "abilityDescription": "Запускает роботизированного паука. Обнаружив противника, тот замедляет его и вызывает кровотечение.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/707",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "luna",
    "title": "Луна",
    "subtitle": "Лидер Гильдии",
    "description": "Повышает скорострельность.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202211/9d03033ed89089d1f25c6be01817ebca.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 28,
      "birthday": "18.03",
      "gender": "Женский",
      "biography": "Когда отца Луны, руководившего Гильдией, похитили, ей пришлось взять ответственность на себя. Она учится управлять людьми и защищать общее дело.",
      "abilityName": "Бей и беги",
      "abilityDescription": "Повышает скорострельность. Попадания превращают часть бонуса скорострельности в ускорение передвижения; после выхода из боя эффект сбрасывается.",
      "awakened": false,
      "parameters": [
        {
          "label": "Скорострельность",
          "value": "+5%"
        },
        {
          "label": "Преобразование в скорость",
          "value": "До 10% скорострельности"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/614",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "koda",
    "title": "Кода",
    "subtitle": "Искатель приключений",
    "description": "Ускоряет передвижение и периодически обнаруживает врагов за укрытиями, кроме присевших и лежащих.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202412/b2f635a96ed787a8e540031402ea751b.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 17,
      "birthday": "01.09",
      "gender": "Мужской",
      "biography": "Кода вырос близко к природе. Поддержка друзей вдохновила его отправиться навстречу приключениям и знакомству с большим миром.",
      "abilityName": "Сияние авроры",
      "abilityDescription": "Ускоряет передвижение и периодически обнаруживает врагов за укрытиями, кроме присевших и лежащих. При спуске на парашюте отмечает видимых противников только для владельца.",
      "awakened": false,
      "parameters": [
        {
          "label": "Длительность",
          "value": "8 с"
        },
        {
          "label": "Скорость",
          "value": "+15%"
        },
        {
          "label": "Обнаружение",
          "value": "До 50 м, раз в 1 с"
        },
        {
          "label": "Перезарядка",
          "value": "45 с"
        }
      ]
    },
    "sourceUrl": "https://ff.garena.com/en/chars/750",
    "verifiedAt": "2026-10-06"
  },
  {
    "id": "jai",
    "title": "Джай",
    "subtitle": "Борец за справедливость",
    "description": "После нокдауна противника автоматически пополняет часть магазина.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202412/077ccf77edb55d6b9d529e4afc1ae965.png",
    "tags": [
      "Персонаж"
    ],
    "character": {
      "age": 30,
      "birthday": "10.01",
      "gender": "Мужской",
      "biography": "Отец Джая погиб на военной службе. Сын стремится к справедливости и хочет продолжить его дело, выбирая собственный путь.",
      "abilityName": "Яростная перезарядка",
      "abilityDescription": "После нокдауна противника автоматически пополняет часть магазина. Работает со штурмовыми винтовками, пистолетами, пистолетами-пулемётами и дробовиками.",
      "awakened": false,
      "parameters": []
    },
    "sourceUrl": "https://ff.garena.com/en/chars/752",
    "verifiedAt": "2026-10-06"
  }
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
