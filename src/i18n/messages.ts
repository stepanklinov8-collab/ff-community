export const locales = ["ru", "kk", "ky"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  ru: "RU",
  kk: "KZ",
  ky: "KG",
};

export const messages = {
  ru: {
    home: "Главная",
    teams: "Команды и гильдии",
    tournaments: "Турниры",
    rating: "Рейтинг игроков",
    teamStats: "Рейтинг команд",
    bloggers: "Блогеры",
    betting: "Прогнозы",
    knowledge: "База знаний",
    messages: "Сообщения",
    notifications: "Уведомления",
    profile: "Профиль",
    contacts: "Контакты",
    admin: "Управление",
    signIn: "Войти",
    signOut: "Выйти",
    search: "Поиск",
  },
  kk: {
    home: "Басты бет",
    teams: "Командалар мен гильдиялар",
    tournaments: "Турнирлер",
    rating: "Ойыншылар рейтингі",
    teamStats: "Командалар рейтингі",
    bloggers: "Блогерлер",
    betting: "Болжамдар",
    knowledge: "Білім базасы",
    messages: "Хабарламалар",
    notifications: "Хабарландырулар",
    profile: "Профиль",
    contacts: "Байланыстар",
    admin: "Басқару",
    signIn: "Кіру",
    signOut: "Шығу",
    search: "Іздеу",
  },
  ky: {
    home: "Башкы бет",
    teams: "Командалар жана гильдиялар",
    tournaments: "Турнирлер",
    rating: "Оюнчулардын рейтинги",
    teamStats: "Командалар рейтинги",
    bloggers: "Блогерлер",
    betting: "Божомолдор",
    knowledge: "Билим базасы",
    messages: "Билдирүүлөр",
    notifications: "Эскертмелер",
    profile: "Профиль",
    contacts: "Байланыштар",
    admin: "Башкаруу",
    signIn: "Кирүү",
    signOut: "Чыгуу",
    search: "Издөө",
  },
} as const;

export type MessageKey = keyof (typeof messages)["ru"];
