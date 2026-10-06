export type KnowledgeCatalogEntry = {
  id: string;
  title: string;
  subtitle?: string;
  description: string;
  imageUrl?: string;
  tags: readonly string[];
  value?: number;
  stats?: readonly { label: string; value: number }[];
};

export const knowledgeOverview: readonly KnowledgeCatalogEntry[] = [
  { id: "overview-game", title: "Об игре", subtitle: "Динамичные матчи на выживание", description: "Короткие матчи с высадкой, поиском снаряжения, сужающейся зоной и борьбой за последнее место в живых.", tags: ["Игра", "Королевская битва"] },
  { id: "overview-squad", title: "Командная игра", subtitle: "Отряды и роли", description: "Команда распределяет роли, выбирает маршрут высадки и собирает состав под карту, формат и соперников.", tags: ["Команды", "Роли"] },
  { id: "overview-modes", title: "Игровые режимы", subtitle: "Турниры и тренировки", description: "В базе знаний собраны соревновательные форматы, командные сессии, квалификации и тренировочные матчи.", tags: ["Режимы", "Матчи"] },
  { id: "overview-characters", title: "Персонажи и навыки", subtitle: "Соберите подходящий набор", description: "Персонажи отличаются активными и пассивными способностями, которые помогают атаковать, защищаться, лечить и перемещаться.", tags: ["Персонажи", "Навыки"] },
  { id: "overview-events", title: "События и обновления", subtitle: "История изменений", description: "Крупные обновления добавляют карты, события, оружие, персонажей и изменения игрового баланса.", tags: ["Новости", "События"] },
  { id: "overview-esports", title: "Соревновательная сцена", subtitle: "Рейтинги OMCITE", description: "Результаты мероприятий формируют историю выступлений игроков, команд и гильдий внутри проекта.", tags: ["Киберспорт", "Рейтинги"] },
] as const;

// Official catalogue snapshot: https://ff.garena.com/en/weapons/ (2026-10-05).
export const knowledgeWeapons: readonly KnowledgeCatalogEntry[] = [
  {
    "id": "weapon-1117",
    "title": "Стеноплавитель",
    "description": "Снаряжение для броска, создания укрытий и контроля пространства.",
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
        "label": "Подвижность",
        "value": 90
      }
    ]
  },
  {
    "id": "weapon-1118",
    "title": "Щитовая пушка",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/0d3e888a3e44e38bcf1bf78a7a500f8b.png",
    "tags": [
      "Штурмовые винтовки",
      "Средняя дистанция",
      "Щит"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 35
      },
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
        "label": "Перезарядка",
        "value": 54
      },
      {
        "label": "Точность",
        "value": 31
      },
      {
        "label": "Подвижность",
        "value": 70
      }
    ]
  },
  {
    "id": "weapon-1119",
    "title": "Лазерная лечащая пушка",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/138f1641addbe25de161dd0037cb80e9.png",
    "tags": [
      "Штурмовые винтовки",
      "Средняя дистанция",
      "Лечение"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 67
      },
      {
        "label": "Точность",
        "value": 100
      },
      {
        "label": "Подвижность",
        "value": 74
      }
    ]
  },
  {
    "id": "weapon-1161",
    "title": "Trogon",
    "description": "Оружие для боя на короткой дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202212/3d5049d73829111f5fde250b61cda07f.png",
    "tags": [
      "Дробовики",
      "Очередь по 3 выстрела"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 9
      },
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
        "label": "Перезарядка",
        "value": 34
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
    ]
  },
  {
    "id": "weapon-1267",
    "title": "VSK94",
    "description": "Винтовка для прицельных выстрелов на дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/e7f33ba7124e80b60d6fd9149de7601f.png",
    "tags": [
      "Снайперские винтовки",
      "Дальняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 26
      },
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
        "label": "Перезарядка",
        "value": 60
      },
      {
        "label": "Точность",
        "value": 23
      },
      {
        "label": "Подвижность",
        "value": 92
      }
    ]
  },
  {
    "id": "weapon-1269",
    "title": "FGL-24",
    "description": "Компактное оружие дополнительного слота.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/2777e4a3343b6aa480eff589ff7e717b.png",
    "tags": [
      "Пистолеты",
      "Дополнительный урон",
      "Урон по площади"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 2
      },
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
        "label": "Перезарядка",
        "value": 74
      },
      {
        "label": "Подвижность",
        "value": 70
      }
    ]
  },
  {
    "id": "weapon-1275",
    "title": "M590",
    "description": "Оружие для боя на короткой дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202412/911ef415c743f4618332b079fec0c547.png",
    "tags": [
      "Дробовики",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 1
      },
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
        "label": "Перезарядка",
        "value": 74
      },
      {
        "label": "Подвижность",
        "value": 70
      }
    ]
  },
  {
    "id": "weapon-1280",
    "title": "Winchester",
    "description": "Винтовка для точных выстрелов на средней и дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202510/efd3e2a5d59ed24c247abaadfff97022.png",
    "tags": [
      "Марксманские винтовки",
      "Высокий урон",
      "Стрельба очередями"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 12
      }
    ]
  },
  {
    "id": "weapon-1285",
    "title": "M7",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/e7ad0146211258d6e4ff4c9be49834be.png",
    "tags": [
      "Штурмовые винтовки",
      "Отдача",
      "Сбалансированное"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      }
    ]
  },
  {
    "id": "weapon-1286",
    "title": "Skorp",
    "description": "Автоматическое оружие для коротких дистанций.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/d6513a255a4a686b7bb3f21c13af1df6.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Отдача",
      "Скорострельность"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      }
    ]
  },
  {
    "id": "weapon-1287",
    "title": "Hawk",
    "description": "Винтовка для прицельных выстрелов на дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/1d36261a4c6823fd96076baf962bf22e.png",
    "tags": [
      "Снайперские винтовки",
      "Отдача",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 2
      }
    ]
  },
  {
    "id": "weapon-1288",
    "title": "RPK",
    "description": "Автоматическое оружие для продолжительного огня.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/1e31b81d4ed25a10d89166a1a275d8a1.png",
    "tags": [
      "Пулемёты",
      "Отдача",
      "Точность"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 75
      }
    ]
  },
  {
    "id": "weapon-1289",
    "title": "Огненная граната",
    "description": "Снаряжение для броска, создания укрытий и контроля пространства.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/33358f1af6893411fe850870cb2bade9.png",
    "tags": [
      "Метательное снаряжение",
      "Метательное",
      "Длительный урон по области"
    ],
    "stats": []
  },
  {
    "id": "weapon-1290",
    "title": "Сонарная граната",
    "description": "Снаряжение для броска, создания укрытий и контроля пространства.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/c3f5e06b7b21b70293eeb9192f870955.png",
    "tags": [
      "Метательное снаряжение",
      "Метательное",
      "Обнаружение врагов"
    ],
    "stats": []
  },
  {
    "id": "weapon-297",
    "title": "RGS50",
    "description": "Оружие для поражения целей взрывными боеприпасами.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official/a42ed7790ad0Icon_slot_RGS50.png",
    "tags": [
      "Гранатомёты",
      "Высокий урон",
      "Разрушение"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 2
      },
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
        "label": "Перезарядка",
        "value": 62
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 65
      }
    ]
  },
  {
    "id": "weapon-305",
    "title": "Миниган",
    "description": "Автоматическое оружие для продолжительного огня.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/df16d03e0649a503f92de68ab0aac585.png",
    "tags": [
      "Пулемёты",
      "Огневая мощь",
      "Очень высокая скорострельность"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 1200
      },
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
        "label": "Перезарядка",
        "value": 62
      },
      {
        "label": "Точность",
        "value": 79
      },
      {
        "label": "Подвижность",
        "value": 32
      }
    ]
  },
  {
    "id": "weapon-313",
    "title": "CG15",
    "description": "Автоматическое оружие для коротких дистанций.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/efb774d875151b9faa51366c4d5ed699.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Дальняя дистанция",
      "Зарядка выстрела"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 20
      },
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
        "label": "Перезарядка",
        "value": 62
      },
      {
        "label": "Точность",
        "value": 60
      },
      {
        "label": "Подвижность",
        "value": 77
      }
    ]
  },
  {
    "id": "weapon-321",
    "title": "Катана",
    "description": "Оружие ближнего боя.",
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
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 88
      }
    ]
  },
  {
    "id": "weapon-329",
    "title": "AN94",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/6e18ff1a4fdc4cbd9650f62b7d5bbd1a.png",
    "tags": [
      "Штурмовые винтовки",
      "Огневая мощь",
      "Средняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 45
      },
      {
        "label": "Точность",
        "value": 48
      },
      {
        "label": "Подвижность",
        "value": 74
      }
    ]
  },
  {
    "id": "weapon-337",
    "title": "Лечащий пистолет",
    "description": "Компактное оружие дополнительного слота.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f3bc5385dea6a1dba577a733c7458b98.png",
    "tags": [
      "Пистолеты",
      "Лечение",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Точность",
        "value": 54
      },
      {
        "label": "Подвижность",
        "value": 76
      }
    ]
  },
  {
    "id": "weapon-345",
    "title": "MGL140",
    "description": "Оружие для поражения целей взрывными боеприпасами.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/42b16b1e58e45e53d99c053e027859c5.png",
    "tags": [
      "Гранатомёты",
      "Урон по площади",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 5
      },
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
        "label": "Перезарядка",
        "value": 76
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 65
      }
    ]
  },
  {
    "id": "weapon-353",
    "title": "P90",
    "description": "Автоматическое оружие для коротких дистанций.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/60a61fd8deab840ef913b93ecd7f2882.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Глушитель",
      "Очень высокая скорострельность"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 50
      },
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
        "label": "Перезарядка",
        "value": 48
      },
      {
        "label": "Точность",
        "value": 57
      },
      {
        "label": "Подвижность",
        "value": 77
      }
    ]
  },
  {
    "id": "weapon-361",
    "title": "XM8",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f4fd729d5d723c9d9e6acea55706d428.png",
    "tags": [
      "Штурмовые винтовки",
      "Прицел ×2",
      "Стабильность"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 45
      },
      {
        "label": "Точность",
        "value": 65
      },
      {
        "label": "Подвижность",
        "value": 86
      }
    ]
  },
  {
    "id": "weapon-369",
    "title": "M60",
    "description": "Автоматическое оружие для продолжительного огня.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/2d75bdd4d64bed99556825534851249e.png",
    "tags": [
      "Пулемёты",
      "Средняя дистанция",
      "Большой магазин"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 70
      },
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
        "label": "Перезарядка",
        "value": 48
      },
      {
        "label": "Точность",
        "value": 43
      },
      {
        "label": "Подвижность",
        "value": 63
      }
    ]
  },
  {
    "id": "weapon-377",
    "title": "SPAS12",
    "description": "Оружие для боя на короткой дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/3b7c991baf200535e98e41de53815d5c.png",
    "tags": [
      "Дробовики",
      "Одиночные выстрелы",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 5
      },
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
        "label": "Перезарядка",
        "value": 41
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 60
      }
    ]
  },
  {
    "id": "weapon-385",
    "title": "Бита",
    "description": "Оружие ближнего боя.",
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
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 104
      }
    ]
  },
  {
    "id": "weapon-393",
    "title": "SVD",
    "description": "Винтовка для точных выстрелов на средней и дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/eda7684b0854c1b1136d87927a2fbcbd.png",
    "tags": [
      "Марксманские винтовки",
      "Редкое",
      "Дальняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 10
      },
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
        "label": "Перезарядка",
        "value": 41
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
    ]
  },
  {
    "id": "weapon-401",
    "title": "Арбалет",
    "description": "Оружие, использующее стрелы вместо пуль.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/7eddf7c5c7f19d603233f302b695ab09.png",
    "tags": [
      "Арбалеты",
      "Периодический урон",
      "Долгая перезарядка"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 1
      },
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
        "label": "Перезарядка",
        "value": 41
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 65
      }
    ]
  },
  {
    "id": "weapon-409",
    "title": "FAMAS",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0516690dac28178d6baf02644a0980f9.png",
    "tags": [
      "Штурмовые винтовки",
      "Стрельба очередями",
      "Скорострельность"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 48
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
    ]
  },
  {
    "id": "weapon-417",
    "title": "M500",
    "description": "Компактное оружие дополнительного слота.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/8416c43b66be1ecf9f54301c26506a69.png",
    "tags": [
      "Пистолеты",
      "Дальняя дистанция",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 5
      },
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
        "label": "Перезарядка",
        "value": 69
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 66
      }
    ]
  },
  {
    "id": "weapon-425",
    "title": "MP40",
    "description": "Автоматическое оружие для коротких дистанций.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/dc148c9021b38531e6e0de8e15970e53.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Очень высокая скорострельность",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 20
      },
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
        "label": "Перезарядка",
        "value": 48
      },
      {
        "label": "Точность",
        "value": 27
      },
      {
        "label": "Подвижность",
        "value": 88
      }
    ]
  },
  {
    "id": "weapon-433",
    "title": "M79",
    "description": "Оружие для поражения целей взрывными боеприпасами.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f51732eb72f3beb88c021765f70818a9.png",
    "tags": [
      "Гранатомёты",
      "Урон по площади",
      "Снаряд"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 1
      },
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
        "label": "Перезарядка",
        "value": 62
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 80
      }
    ]
  },
  {
    "id": "weapon-441",
    "title": "Kar98k",
    "description": "Винтовка для прицельных выстрелов на дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f0d9ce079561f1ae65472cacd8707139.png",
    "tags": [
      "Снайперские винтовки",
      "Дальняя дистанция",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 5
      },
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
        "label": "Перезарядка",
        "value": 27
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
    ]
  },
  {
    "id": "weapon-449",
    "title": "M1873",
    "description": "Компактное оружие дополнительного слота.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/835df2c791ed827034bb65c9f8af33a4.png",
    "tags": [
      "Пистолеты",
      "Ближняя дистанция",
      "Дополнительное оружие"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 2
      },
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
        "label": "Перезарядка",
        "value": 41
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 88
      }
    ]
  },
  {
    "id": "weapon-457",
    "title": "M249",
    "description": "Автоматическое оружие для продолжительного огня.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c0cd7df4ad6265497183c56408033e84.png",
    "tags": [
      "Пулемёты",
      "Редкое",
      "Большой магазин"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 100
      },
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
        "label": "Перезарядка",
        "value": 48
      },
      {
        "label": "Точность",
        "value": 67
      },
      {
        "label": "Подвижность",
        "value": 58
      }
    ]
  },
  {
    "id": "weapon-465",
    "title": "Граната",
    "description": "Снаряжение для броска, создания укрытий и контроля пространства.",
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
        "label": "Подвижность",
        "value": 90
      }
    ]
  },
  {
    "id": "weapon-473",
    "title": "M4A1",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f9d228799e70a11feaf2c493bedb007e.png",
    "tags": [
      "Штурмовые винтовки",
      "Простое управление",
      "Дальняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 48
      },
      {
        "label": "Точность",
        "value": 55
      },
      {
        "label": "Подвижность",
        "value": 74
      }
    ]
  },
  {
    "id": "weapon-481",
    "title": "AK47",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/bc3a04e98225ef35976771ad109d4ee6.png",
    "tags": [
      "Штурмовые винтовки",
      "Высокий урон",
      "Сильная отдача"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 41
      },
      {
        "label": "Точность",
        "value": 41
      },
      {
        "label": "Подвижность",
        "value": 62
      }
    ]
  },
  {
    "id": "weapon-489",
    "title": "AWM",
    "description": "Винтовка для прицельных выстрелов на дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/bf268d2f9b0cb421ce1bd3b581fc9924.png",
    "tags": [
      "Снайперские винтовки",
      "Дальняя дистанция",
      "По неподвижным целям"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 5
      },
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
        "label": "Перезарядка",
        "value": 34
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 65
      }
    ]
  },
  {
    "id": "weapon-497",
    "title": "SKS",
    "description": "Винтовка для точных выстрелов на средней и дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/d8a7797a0cb0d3e82d00153a4415c905.png",
    "tags": [
      "Марксманские винтовки",
      "Дальняя дистанция",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 16
      },
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
        "label": "Перезарядка",
        "value": 27
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
    ]
  },
  {
    "id": "weapon-505",
    "title": "Groza",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c49e5145e37a5c66b1202e04031f6363.png",
    "tags": [
      "Штурмовые винтовки",
      "Редкое",
      "Дальняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 48
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
    ]
  },
  {
    "id": "weapon-513",
    "title": "M1014",
    "description": "Оружие для боя на короткой дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/ee748629c0e7e1dda3f4f8147648d486.png",
    "tags": [
      "Дробовики",
      "Ближняя дистанция",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 6
      },
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
        "label": "Перезарядка",
        "value": 31
      },
      {
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 60
      }
    ]
  },
  {
    "id": "weapon-521",
    "title": "UMP",
    "description": "Автоматическое оружие для коротких дистанций.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/45f4534bf331d27bba092af3691c0e3b.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Точность",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 59
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
    ]
  },
  {
    "id": "weapon-529",
    "title": "MP5",
    "description": "Автоматическое оружие для коротких дистанций.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/ffa3810470bfe2ec0e96be36f7f75653.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Ближняя дистанция",
      "Скорострельность"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 62
      },
      {
        "label": "Точность",
        "value": 54
      },
      {
        "label": "Подвижность",
        "value": 81
      }
    ]
  },
  {
    "id": "weapon-537",
    "title": "M14",
    "description": "Винтовка для точных выстрелов на средней и дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/1ba9139067b1e18044edc9efa1a75ca6.png",
    "tags": [
      "Марксманские винтовки",
      "Дальняя дистанция",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 15
      },
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
        "label": "Перезарядка",
        "value": 52
      },
      {
        "label": "Точность",
        "value": 57
      },
      {
        "label": "Подвижность",
        "value": 74
      }
    ]
  },
  {
    "id": "weapon-545",
    "title": "SCAR",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/5f07a4687e38296c2f5e95e296d8d51b.png",
    "tags": [
      "Штурмовые винтовки",
      "Сбалансированное",
      "Низкая отдача"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 52
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
    ]
  },
  {
    "id": "weapon-553",
    "title": "VSS",
    "description": "Автоматическое оружие для коротких дистанций.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/60c2f74d8d87290681c0a0dbdffcb8b9.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Дальняя дистанция",
      "Глушитель"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 55
      },
      {
        "label": "Точность",
        "value": 73
      },
      {
        "label": "Подвижность",
        "value": 67
      }
    ]
  },
  {
    "id": "weapon-561",
    "title": "USP",
    "description": "Компактное оружие дополнительного слота.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/3e1f2407e7f97689071651a190757325.png",
    "tags": [
      "Пистолеты",
      "Мобильность",
      "Начало матча"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 12
      },
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
        "label": "Перезарядка",
        "value": 83
      },
      {
        "label": "Точность",
        "value": 57
      },
      {
        "label": "Подвижность",
        "value": 76
      }
    ]
  },
  {
    "id": "weapon-569",
    "title": "G18",
    "description": "Компактное оружие дополнительного слота.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/5528d2a0820bc1ed8b6064b9c20ab218.png",
    "tags": [
      "Пистолеты",
      "Большой магазин",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 24
      },
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
        "label": "Перезарядка",
        "value": 61
      },
      {
        "label": "Точность",
        "value": 57
      },
      {
        "label": "Подвижность",
        "value": 76
      }
    ]
  },
  {
    "id": "weapon-577",
    "title": "DESERT EAGLE",
    "description": "Компактное оружие дополнительного слота.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/262c55300da7b4070ad76611e2003fc5.png",
    "tags": [
      "Пистолеты",
      "Высокий урон",
      "Мобильность"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 11
      },
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
        "label": "Перезарядка",
        "value": 86
      },
      {
        "label": "Точность",
        "value": 45
      },
      {
        "label": "Подвижность",
        "value": 76
      }
    ]
  },
  {
    "id": "weapon-585",
    "title": "Сковорода",
    "description": "Оружие ближнего боя.",
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
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 88
      }
    ]
  },
  {
    "id": "weapon-593",
    "title": "Мачете",
    "description": "Оружие ближнего боя.",
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
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 88
      }
    ]
  },
  {
    "id": "weapon-601",
    "title": "M1887",
    "description": "Оружие для боя на короткой дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20229/c642875194de4e4e544e58513b92a4ae.png",
    "tags": [
      "Дробовики",
      "Высокий урон",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 2
      },
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
        "label": "Перезарядка",
        "value": 43
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
    ]
  },
  {
    "id": "weapon-602",
    "title": "Thompson",
    "description": "Автоматическое оружие для коротких дистанций.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/774de06b4f1a2c3708119733a4ddd7f5.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Ближняя дистанция",
      "Скорострельность"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 48
      },
      {
        "label": "Точность",
        "value": 42
      },
      {
        "label": "Подвижность",
        "value": 81
      }
    ]
  },
  {
    "id": "weapon-603",
    "title": "Ручная пушка",
    "description": "Компактное оружие дополнительного слота.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/b2d5940583d09254dee082989a8ff26a.png",
    "tags": [
      "Пистолеты",
      "Урон по площади",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 2
      },
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
        "label": "Перезарядка",
        "value": 62
      },
      {
        "label": "Точность",
        "value": 34
      },
      {
        "label": "Подвижность",
        "value": 75
      }
    ]
  },
  {
    "id": "weapon-604",
    "title": "Плазменная пушка",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c824bf1a7bbffed3f77588e051ff2f70.png",
    "tags": [
      "Штурмовые винтовки",
      "Редкое",
      "Дальняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Точность",
        "value": 54
      },
      {
        "label": "Подвижность",
        "value": 74
      }
    ]
  },
  {
    "id": "weapon-624",
    "title": "M82B",
    "description": "Винтовка для прицельных выстрелов на дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0a30d6bcf413ffacded1230f747bfb36.png",
    "tags": [
      "Снайперские винтовки",
      "Высокий урон",
      "Пробитие стен"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 8
      },
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
        "label": "Перезарядка",
        "value": 41
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
    ]
  },
  {
    "id": "weapon-629",
    "title": "AUG",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/fc7eb3fd85c623b2c999a7958feb86e7.png",
    "tags": [
      "Штурмовые винтовки",
      "Редкое"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 55
      },
      {
        "label": "Точность",
        "value": 55
      },
      {
        "label": "Подвижность",
        "value": 84
      }
    ]
  },
  {
    "id": "weapon-674",
    "title": "PARAFAL",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/a92fa1acd8533cdf92fd30931a57254e.png",
    "tags": [
      "Штурмовые винтовки",
      "Средняя дистанция",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 20
      },
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
        "label": "Перезарядка",
        "value": 41
      },
      {
        "label": "Точность",
        "value": 40
      },
      {
        "label": "Подвижность",
        "value": 63
      }
    ]
  },
  {
    "id": "weapon-1073",
    "title": "Woodpecker",
    "description": "Винтовка для точных выстрелов на средней и дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/57039d8e746433254d5912d64df8ec79.png",
    "tags": [
      "Марксманские винтовки",
      "Высокий урон",
      "Бронепробитие"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 12
      },
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
        "label": "Перезарядка",
        "value": 41
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
    ]
  },
  {
    "id": "weapon-1074",
    "title": "Vector",
    "description": "Автоматическое оружие для коротких дистанций.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c1b06eb80e2c4f02bef1f8087765c199.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Парное оружие",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 23
      },
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
        "label": "Перезарядка",
        "value": 27
      },
      {
        "label": "Точность",
        "value": 61
      },
      {
        "label": "Подвижность",
        "value": 91
      }
    ]
  },
  {
    "id": "weapon-1075",
    "title": "Коса",
    "description": "Оружие ближнего боя.",
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
        "label": "Точность",
        "value": 10
      },
      {
        "label": "Подвижность",
        "value": 90
      }
    ]
  },
  {
    "id": "weapon-1076",
    "title": "MAG-7",
    "description": "Оружие для боя на короткой дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c083b9923bb4e2fe20dc572a6f65818d.png",
    "tags": [
      "Дробовики",
      "Большой магазин",
      "Очень высокая скорострельность"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 8
      },
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
        "label": "Перезарядка",
        "value": 55
      },
      {
        "label": "Точность",
        "value": 17
      },
      {
        "label": "Подвижность",
        "value": 60
      }
    ]
  },
  {
    "id": "weapon-1077",
    "title": "Kord",
    "description": "Автоматическое оружие для продолжительного огня.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/631c6fceb57830faf26ffacfd1726556.png",
    "tags": [
      "Пулемёты",
      "Большой магазин",
      "Огневая мощь"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 50
      },
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
        "label": "Перезарядка",
        "value": 41
      },
      {
        "label": "Точность",
        "value": 34
      },
      {
        "label": "Подвижность",
        "value": 58
      }
    ]
  },
  {
    "id": "weapon-1078",
    "title": "M1917",
    "description": "Компактное оружие дополнительного слота.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f176e1be59ac986474cffc8d26b3e8cc.png",
    "tags": [
      "Пистолеты",
      "Парное оружие",
      "Дополнительное оружие"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 12
      },
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
        "label": "Перезарядка",
        "value": 38
      },
      {
        "label": "Точность",
        "value": 57
      },
      {
        "label": "Подвижность",
        "value": 76
      }
    ]
  },
  {
    "id": "weapon-1079",
    "title": "USP-2",
    "description": "Компактное оружие дополнительного слота.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/3e1f2407e7f97689071651a190757325.png",
    "tags": [
      "Пистолеты",
      "Парное оружие",
      "Дополнительное оружие"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 12
      },
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
        "label": "Перезарядка",
        "value": 55
      },
      {
        "label": "Точность",
        "value": 57
      },
      {
        "label": "Подвижность",
        "value": 76
      }
    ]
  },
  {
    "id": "weapon-1080",
    "title": "Дымовая граната",
    "description": "Снаряжение для броска, создания укрытий и контроля пространства.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/9d722d5dc960baa4018ee34e35e4e4ef.png",
    "tags": [
      "Метательное снаряжение",
      "Дымовая завеса"
    ],
    "stats": [
      {
        "label": "Подвижность",
        "value": 90
      }
    ]
  },
  {
    "id": "weapon-1081",
    "title": "Защитная стена",
    "description": "Снаряжение для броска, создания укрытий и контроля пространства.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/71c9976d4b23cc37bb15fe398d186b7e.png",
    "tags": [
      "Метательное снаряжение",
      "Щит"
    ],
    "stats": [
      {
        "label": "Подвижность",
        "value": 90
      }
    ]
  },
  {
    "id": "weapon-1082",
    "title": "Ледяная граната",
    "description": "Снаряжение для броска, создания укрытий и контроля пространства.",
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
        "label": "Подвижность",
        "value": 90
      }
    ]
  },
  {
    "id": "weapon-1083",
    "title": "Нож FF",
    "description": "Оружие ближнего боя.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0a7e9a154df42962387613548e6def2f.png",
    "tags": [
      "Ближний бой",
      "Высокий урон",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 3
      },
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
    ]
  },
  {
    "id": "weapon-1084",
    "title": "Kingfisher",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/3ee20074dac98bdd06e0fb9b512c9400.png",
    "tags": [
      "Штурмовые винтовки",
      "Средняя дистанция",
      "Стрельба очередями"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 22
      },
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
        "label": "Перезарядка",
        "value": 55
      },
      {
        "label": "Точность",
        "value": 50
      },
      {
        "label": "Подвижность",
        "value": 89
      }
    ]
  },
  {
    "id": "weapon-1085",
    "title": "UZI",
    "description": "Компактное оружие дополнительного слота.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c3e906b732e6016a8d4076b8179feb17.png",
    "tags": [
      "Пистолеты",
      "Скорострельность",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 16
      },
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
        "label": "Перезарядка",
        "value": 55
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
    ]
  },
  {
    "id": "weapon-1086",
    "title": "Лечащая снайперская винтовка",
    "description": "Винтовка для прицельных выстрелов на дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/3a160e5e1833dfdb2d8eab657bb62dc1.png",
    "tags": [
      "Снайперские винтовки",
      "Дальняя дистанция",
      "Лечение"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 5
      },
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
        "label": "Перезарядка",
        "value": 34
      },
      {
        "label": "Точность",
        "value": 90
      },
      {
        "label": "Подвижность",
        "value": 80
      }
    ]
  },
  {
    "id": "weapon-1087",
    "title": "Огнемёт",
    "description": "Компактное оружие дополнительного слота.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/e4fdaca2482dd5a5a860f2b40d4cc7be.png",
    "tags": [
      "Пистолеты",
      "Дополнительный урон",
      "Урон по площади"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 200
      },
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
        "label": "Перезарядка",
        "value": 48
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
    ]
  },
  {
    "id": "weapon-1088",
    "title": "MAC10",
    "description": "Автоматическое оружие для коротких дистанций.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0f4164f6bd1d1b2d84924cf06486aa96.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Скорострельность",
      "Ближняя дистанция"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 62
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
    ]
  },
  {
    "id": "weapon-1089",
    "title": "AC80",
    "description": "Винтовка для точных выстрелов на средней и дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/a6ef7cbb8dff95b6fd4b701601ce338a.png",
    "tags": [
      "Марксманские винтовки",
      "Дальняя дистанция",
      "Дополнительный урон"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 8
      },
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
        "label": "Перезарядка",
        "value": 55
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
    ]
  },
  {
    "id": "weapon-1090",
    "title": "G36",
    "description": "Автоматическая винтовка для перестрелок на средней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/152363f5ad54dcf2ad569b2e6d63b2be.png",
    "tags": [
      "Штурмовые винтовки",
      "Точность",
      "Высокий урон"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 30
      },
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
        "label": "Перезарядка",
        "value": 48
      },
      {
        "label": "Точность",
        "value": 55
      },
      {
        "label": "Подвижность",
        "value": 74
      }
    ]
  },
  {
    "id": "weapon-1091",
    "title": "Зарядный дробовик",
    "description": "Оружие для боя на короткой дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/cc8e2f2ec7f785b93590d7646d2bee84.png",
    "tags": [
      "Дробовики",
      "Быстрый урон",
      "Зарядка выстрела"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 3
      },
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
        "label": "Перезарядка",
        "value": 48
      },
      {
        "label": "Точность",
        "value": 31
      },
      {
        "label": "Подвижность",
        "value": 86
      }
    ]
  },
  {
    "id": "weapon-1092",
    "title": "M24",
    "description": "Винтовка для прицельных выстрелов на дальней дистанции.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/196e9c4af34d1709974016106db22b18.png",
    "tags": [
      "Снайперские винтовки",
      "Мобильность",
      "Пробитие стен"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 5
      },
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
        "label": "Перезарядка",
        "value": 48
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
    ]
  },
  {
    "id": "weapon-1093",
    "title": "Bizon",
    "description": "Автоматическое оружие для коротких дистанций.",
    "imageUrl": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f7e85f353cc9463cfb0ab105add251b9.png",
    "tags": [
      "Пистолеты-пулемёты",
      "Высокий урон",
      "Быстрый урон"
    ],
    "stats": [
      {
        "label": "Магазин",
        "value": 25
      },
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
        "label": "Перезарядка",
        "value": 41
      },
      {
        "label": "Точность",
        "value": 17
      },
      {
        "label": "Подвижность",
        "value": 91
      }
    ]
  }
];

const featuredKnowledgeCharacters: readonly KnowledgeCatalogEntry[] = [
  { id: "ray", title: "Рэй", subtitle: "Страж затмения", description: "Помечает врага солнечной энергией. При снижении здоровья цели метка ускоряет её поражение и возвращает здоровье владельцу навыка.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20264/1a2c81cd893f6ea43a527cb3b7b2f897.png", tags: ["Атака", "Метка"] },
  { id: "nero", title: "Неро", subtitle: "Кузнец мечты", description: "Создаёт йети, который преследует ближайшего врага и формирует область, где нельзя устанавливать стены.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202510/5d937a0ac5fe4e67c97fb8fb8e43455e.png", tags: ["Контроль", "Зона"] },
  { id: "rin", title: "Рин", subtitle: "Нефритовый ниндзя", description: "Постепенно призывает кунаи, которые автоматически выбирают врагов или стены; дальняя цель получает больше урона.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20257/9aa96a782fab8633cbb57f9229e7a5e6.png", tags: ["Атака", "Дальность"] },
  { id: "lila", title: "Лила", subtitle: "Артист стен", description: "Замедляет врагов и транспорт, а сбитые с ног противники получают заморозку. Навык даёт дополнительную стену.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20249/b09e7f93ec7c7a47dccbd704d8e4d879.png", tags: ["Контроль", "Стены"] },
  { id: "kairos", title: "Кайрос", subtitle: "Двойной защитник", description: "Переключает режим защиты и режим пробивания, управляя энергией для защиты владельца и разрушения щитов противника.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/ed1e34b6c47b37675eae84daffdf63b1.png", tags: ["Защита", "Энергия"] },
  { id: "kassie", title: "Кэсси", subtitle: "Доктор-маньяк", description: "Создаёт связь с выбранным союзником и постепенно восстанавливает здоровье обоим; повторное применение усиливает лечение цели.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/8d87fe1959e300741eda601e800c0f40.png", tags: ["Поддержка", "Исцеление"] },
  { id: "suzy", title: "Сьюзи", subtitle: "Наёмный убийца", description: "Метки на врагах увеличивают награду команде за их устранение и помогают отслеживать цель охоты.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/2cdde4e7d5010be2a35971e19f2285e4.png", tags: ["Награда", "Метка"] },
  { id: "sonia", title: "Соня", subtitle: "Учёный", description: "После смертельного урона создаёт нанощит и может восстановить здоровье, если владелец навыка успевает сбить врага.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20238/8f978bdbe46d3d2366b82713082d6683.png", tags: ["Выживание", "Щит"] },
  { id: "ignis", title: "Игни", subtitle: "Старшеклассник", description: "Создаёт огненный мираж, который закрывает обзор и наносит горящий урон противникам и стенам.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202310/a72ab49cc322359afdc5b66fcd3fcdf8.png", tags: ["Огонь", "Контроль"] },
  { id: "orion", title: "Орион", subtitle: "Кулак возмездия", description: "Расходует энергию, чтобы получить временную неуязвимость и возможность поглощать здоровье врага.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20238/4f4fc6c6d43fc3bb5ef4617f9f5340f7.png", tags: ["Выживание", "Энергия"] },
  { id: "tatsuya", title: "Тацуя", subtitle: "Вспыльчивый боец", description: "Позволяет резко совершать рывок вперёд и накапливать несколько использований для быстрого входа в бой.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/e37e48adf72a2c014c2bfa8ed483f5b5.png", tags: ["Мобильность", "Рывок"] },
  { id: "a-patroa", title: "Донна А", subtitle: "Владелица магазина", description: "Открывает дополнительный слот для навыка, а остальные слоты становятся доступны автоматически после получения персонажа.", imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f5a466acec3ed5bd7cdd149e26288ad1.png", tags: ["Пресеты", "Навыки"] },
] as const;

const additionalCharacterProfiles = [
  ["iris", "Ирис", "Оператор на миссиях", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0b623468a09995f46f5ff98c6a48d49b.png"],
  ["j-biebs", "Джей Бибс", "Отважный поэт", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202412/d3eb3130503cd726a5b7bce881d46c93.png"],
  ["homer", "Гомер", "Слепой ассасин", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/26d226fa08410cc418959e3cc30095c7.png"],
  ["kenta", "Кента", "Кузнец", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20269/62312b920d0f43370998d4a7557e4b79.png"],
  ["nairi", "Наири", "Исследователь климата", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/e21eb41a3705ff817156dd5758157274.png"],
  ["otho", "Ото", "Эксперт в области памяти", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/d0ea6553e85abbf0a8b718e29900b7f5.png"],
  ["leon", "Леон", "Баскетболист", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/b79f47950001fb7f7130a6b3752b3446.png"],
  ["thiva", "Тива", "Певец и музыкант", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/217c0184667efa92bcec0caa73af73b9.png"],
  ["dimitri", "Димитри", "Звукорежиссёр и музыкант", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/024c98913571304db2cba9d257e7291a.png"],
  ["d-bee", "Ди-Би", "Создатель битов", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f1a09717ed71e7302da8d4cc889d2e33.png"],
  ["maro", "Маро", "Сокольничий", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/8af9a328d62a330a76221b79670daf37.png"],
  ["skyler", "Скайлер", "Председатель медиакорпорации", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/547dea01d82886891297443e8e9d270f.png"],
  ["xayne", "Ксейн", "Спортсменка-экстремал", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20229/ea05dd27c4f4faf3267679d5f90cdaec.png"],
  ["shirou", "Широ", "Курьер службы доставки", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/dbe25891f13c5752e84ad7daf57106cc.png"],
  ["chrono", "Хроно", "Охотник за наградой", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202412/6d5de642b070e208a38b037d8233df85.png"],
  ["dasha", "Даша", "Торговец на чёрном рынке", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/8d2bc4db79fe889ab6541ae2dd7cd2cb.png"],
  ["k", "Кей", "Профессор и мастер джиу-джитсу", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/cace792e96191c1623da45de2e52a589.png"],
  ["oscar", "Оскар", "Ночной мститель", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20252/d5d04e40eb00900e96a28828decdaff0.png"],
  ["luqueta", "Лукета", "Звезда футбола", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/28b704e964e8057d7fc76e1a2cca7d26.png"],
  ["clu", "Клу", "Частный детектив", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/81def6541fb94bd20887bad6b5a725cf.png"],
  ["wolfrahh", "Вольфра", "Игровой стример", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/e4169a44d8a6e83549b3b7f8a7820c1e.png"],
  ["jota", "Джота", "Мастер паркура", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/5ae1530683a65bdfd81f6f7f7552650c.png"],
  ["kapella", "Капелла", "Поп-звезда", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/9c6b10d2984125fbdd96fae9e0a84518.png"],
  ["steffie", "Стеффи", "Граффити-художница", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/809499ee33234f1c72c6a3ab120e85dd.png"],
  ["maxim", "Максим", "Скоростной едок", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/59dc42433e877fa0cc3bb69b74dbf2c8.png"],
  ["kla", "Кла", "Профессиональный кикбоксёр", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/1655985bf74931458766921ee6bb6e0a.png"],
  ["paloma", "Палома", "Лидер банды", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/93a87a41a13af14c2346379a0d917d36.png"],
  ["miguel", "Мигель", "Элитный боец спецназа", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/041a8586fe9d5461a7f28510fb5786d0.png"],
  ["caroline", "Каролина", "Дочь влиятельной семьи", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/aa43b9f99d6a367a5123dbae9f6cd5c6.png"],
  ["antonio", "Антонио", "Гангстер", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c87a2bcb4b4ab665908df11672aa191d.png"],
  ["wukong", "Вуконг", "Боевой киборг", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/c0f1547f51f4c2b99e28ef4ec52db084.png"],
  ["moco", "Моко", "Хакер", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/769ceca68c62ec35cdbf90f1c0d7c73f.png"],
  ["hayato", "Хаято", "Наследник самурайского рода", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/d8800f78f00e9831fc157a04aa3078aa.png"],
  ["laura", "Лаура", "Специальный агент", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/a742beadf78c01fb9e05aabc51c9369e.png"],
  ["rafael", "Рафаэль", "Наёмник", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/738a885af3eb66c1415a0ac61bfd304b.png"],
  ["a124", "А124", "Гуманоидный робот", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/ab1469c59a10c4669482e1ab625357dd.png"],
  ["alvaro", "Альваро", "Подрывник", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/d5c0af0ac8632385f2cdb0500874b2a5.png"],
  ["santino", "Сантино", "Дизайнер одежды", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20233/a3810f993d32077e88c5226625bb55a9.png"],
  ["notora", "Нотора", "Мотогонщица", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/fab6aa1cb1c6ce92652a3f184d265b76.png"],
  ["alok", "Алок", "Известный диджей", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c62e709e3ad8387f5484bb12e1cc81a9.png"],
  ["shani", "Шани", "Инженер на свалке", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20229/2a790a2ca70a797b5384a122ad7d8d10.png"],
  ["ford", "Форд", "Капитан дальнего плавания", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202211/e4eba268be6b474381acc6c4b282f5ea.png"],
  ["joseph", "Джозеф", "Председатель технокорпорации", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/07d65d842e613a0cc22794f953c44be3.png"],
  ["olivia", "Оливия", "Врач", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202211/435b2230bb59c6a7f087d841e7dc8590.png"],
  ["andrew", "Эндрю", "Бывший полицейский", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/564762d9a1137afaf2c9abb0ea8862b7.png"],
  ["kelly", "Келли", "Спринтер", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/202212/872433784844d0b3d55c17c0b017818d.png"],
  ["nikita", "Никита", "Телохранитель", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/93bac478d8b64e0a6b31fee8c75220d9.png"],
  ["misha", "Миша", "Пилот гоночной машины", "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/33110529f97da7fc1bf681e61a1de2bb.png"],
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
