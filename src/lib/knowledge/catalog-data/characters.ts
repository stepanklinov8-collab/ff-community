import type { KnowledgeCatalogEntry } from "../types";
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
