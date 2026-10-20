import type { KnowledgeCatalogEntry } from "../types";
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
