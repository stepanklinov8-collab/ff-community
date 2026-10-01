export type MapLocation = { id: string; title: string };

type MapCatalogItem = {
  id: string;
  title: string;
  officialUrl: string;
  locations: readonly MapLocation[];
};

const locations = (items: Array<[string, string]>): readonly MapLocation[] => items.map(([id, title]) => ({ id, title }));

export const mapCatalog = [
  {
    id: "bermuda",
    title: "Бермуды",
    officialUrl: "https://ff.garena.com/en/maps/1",
    locations: locations([
      ["shipyard", "Верфь"], ["peak", "Пик"], ["clock_tower", "Часовая башня"], ["factory", "Фабрика"],
      ["pochinok", "Починок"], ["rim_nam_village", "Деревня Рим Нам"], ["mars_electric", "Марс Электрик"],
      ["hangar", "Ангар"], ["nurek_dam", "Плотина Нурек"], ["observatory", "Обсерватория"], ["sentosa", "Сентоса"],
      ["cape_town", "Кейптаун"], ["kota_tua", "Кота-Туа"], ["mill", "Мельница"], ["plantation", "Плантация"],
      ["katulistiwa", "Катулистиуа"], ["bimasakti_strip", "Полоса Бимасакти"], ["graveyard", "Кладбище"],
      ["bullseye", "Буллсай"], ["outpost", "Аванпост"], ["sanctuary", "Святилище"],
    ]),
  },
  {
    id: "bermuda_remastered",
    title: "Бермуды: обновлённая версия",
    officialUrl: "https://ff.garena.com/en/maps/4",
    locations: locations([
      ["hangar", "Ангар"], ["peak", "Пик"], ["clock_tower", "Часовая башня"], ["factory", "Фабрика"],
      ["pochinok", "Починок"], ["rim_nam_village", "Деревня Рим Нам"], ["mars_electric", "Марс Электрик"],
      ["nurek_dam", "Плотина Нурек"], ["observatory", "Обсерватория"], ["sentosa", "Сентоса"], ["kota_tua", "Кота-Туа"],
      ["mill", "Мельница"], ["graveyard", "Кладбище"], ["bullseye", "Буллсай"], ["outpost", "Аванпост"],
      ["academy", "Академия"], ["aden_creek", "Ручей Аден"], ["sanctuary", "Святилище"],
    ]),
  },
  {
    id: "nexterra",
    title: "Нэкст Терра",
    officialUrl: "https://ff.garena.com/en/maps/11",
    locations: locations([
      ["intellect_center", "Центр интеллекта"], ["twin_bridges", "Двойные мосты"], ["museum", "Музей"],
      ["mud_site", "Грязевой участок"], ["windmill", "Ветряные турбины"], ["greenhouses", "Теплицы"],
      ["zipway", "Зипвей"], ["ghost_town", "Город-призрак"], ["grav_labs", "Гравитационные лаборатории"],
      ["deca_square", "Дека-сквер"], ["plazaria", "Плазария"], ["boxing_gym", "Боксёрский зал"], ["eco_drain", "Эко-сток"],
    ]),
  },
  {
    id: "alpine",
    title: "Альпийские горы",
    officialUrl: "https://ff.garena.com/en/maps/2",
    locations: locations([
      ["snowfall", "Снегопад"], ["vantage", "Авангард"], ["militia", "Милиция"], ["dock", "Док"],
      ["garrison", "Гарнизон"], ["railroad", "Железная дорога"], ["forest_red", "Красный лес"], ["fusion", "Фьюжн"],
      ["basecamp", "Базовый лагерь"], ["carousel", "Карусель"], ["mammut", "Мамонт"], ["river", "Река"],
      ["snowy_village", "Снежная деревня"], ["railway_station", "Железнодорожная станция"],
    ]),
  },
  {
    id: "solara",
    title: "Солара",
    officialUrl: "https://ff.garena.com/en/maps/",
    locations: locations([
      ["the_hub", "Хаб"], ["waterfall", "Водопад"], ["riders_club", "Клуб райдеров"], ["funfair", "Парк развлечений"],
      ["windmill", "Ветряная мельница"], ["delta_isle", "Остров Дельта"], ["aquarium", "Аквариум"], ["eco_drain", "Эко-сток"],
      ["tv_tower", "Телебашня"], ["bayside", "Бэйсайд"], ["bloomtown", "Блумтаун"], ["studio", "Студия"],
      ["archway", "Арка"], ["casa_vista", "Каса Виста"],
    ]),
  },
  {
    id: "purgatory",
    title: "Чистилище",
    officialUrl: "https://ff.garena.com/en/maps/10",
    locations: locations([
      ["forge", "Кузница"], ["brasilia", "Бразилия"], ["central", "Центральный район"], ["moathouse", "Дом на озере"],
      ["ski_lodge", "Лыжный курорт"], ["crossroads", "Перекрёсток"], ["fields", "Поля"], ["lumber_mill", "Лесопилка"],
      ["campsite", "Лагерь"], ["quarry", "Карьер"], ["fire_brigade", "Пожарная часть"], ["golf_course", "Гольф-клуб"],
      ["trailer_park", "Автокемпинг"], ["mount_villa", "Горная вилла"], ["central_factory", "Центральная фабрика"],
    ]),
  },
  {
    id: "kalahari",
    title: "Калахари",
    officialUrl: "https://ff.garena.com/en/maps/3",
    locations: locations([
      ["shrines", "Святилища"], ["refinery", "Нефтеперерабатывающий завод"], ["command_post", "Командный пункт"],
      ["bayfront", "Бэйфронт"], ["santa_catarina", "Санта-Катарина"], ["confinement", "Изолятор"],
      ["stone_ridge", "Каменный хребет"], ["the_maze", "Лабиринт"], ["council_hall", "Зал совета"], ["foundation", "Фундамент"],
      ["old_hampton", "Старый Хэмптон"], ["mammoth", "Мамонт"], ["prison", "Тюрьма"], ["lab", "Лаборатория"],
      ["elevated_road", "Высокая дорога"],
    ]),
  },
] as const satisfies readonly MapCatalogItem[];

export type MapId = (typeof mapCatalog)[number]["id"];

export function locationsForMap(map: string): readonly MapLocation[] {
  return mapCatalog.find(item => item.id === map)?.locations ?? [];
}

export function mapTitle(map: string) {
  return mapCatalog.find(item => item.id === map)?.title ?? map;
}

export function locationTitle(map: string, location: string | null | undefined) {
  if (!location) return "";
  return locationsForMap(map).find(item => item.id === location || item.title === location)?.title ?? location;
}

export function isKnownLandingLocation(map: string, location: string | null | undefined) {
  return !location || locationsForMap(map).some(item => item.id === location || item.title === location);
}
