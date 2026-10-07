export type MapLocation = { id: string; title: string };

type MapCatalogItem = {
  id: string;
  title: string;
  officialUrl: string;
  description: string;
  imageUrl: string;
  thumbnailUrl: string;
  gallery: readonly string[];
  locations: readonly MapLocation[];
};

const locations = (items: Array<[string, string]>): readonly MapLocation[] => items.map(([id, title]) => ({ id, title }));

export const mapCatalog = [
  {
    id: "bermuda",
    title: "Бермуды",
    officialUrl: "https://ff.garena.com/en/maps/1",
    description: "Классическая тропическая карта игры с побережьем, городскими районами и большими открытыми пространствами между ключевыми точками высадки.",
    imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/651fdcfddfb2f946f0d86df3e657bf52.jpeg",
    thumbnailUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20238/6e9a0754dc2c3177c19deb2f890b0152.jpg",
    gallery: [
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/719e90d835b1c7104bb0c551d514b37a.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/74270d241f3a6dee440b3712eac97d84.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/0555bbbeb79cf048064347033e08ef6f.jpg",
    ],
    locations: locations([
      ["shipyard", "Верфь"], ["peak", "Пик"], ["clock_tower", "Часовая башня"], ["factory", "Фабрика"],
      ["pochinok", "Починок"], ["rim_nam_village", "Деревня Рим Нам"], ["mars_electric", "Марс Электрик"],
      ["hangar", "Ангар"], ["nurek_dam", "Плотина Нурек"], ["observatory", "Обсерватория"], ["sentosa", "Сентоса"],
      ["cape_town", "Кейптаун"], ["keraton", "Кератон"], ["riverside", "Риверсайд"], ["kota_tua", "Кота-Туа"], ["mill", "Мельница"], ["plantation", "Плантация"],
      ["katulistiwa", "Катулистиуа"], ["bimasakti_strip", "Полоса Бимасакти"], ["graveyard", "Кладбище"],
      ["bullseye", "Буллсай"], ["outpost", "Аванпост"], ["sanctuary", "Святилище"],
    ]),
  },
  {
    id: "bermuda_remastered",
    title: "Бермуды: обновлённая версия",
    officialUrl: "https://ff.garena.com/en/maps/4",
    description: "Обновлённая версия Бермуд с переработанными районами, маршрутами и знакомыми точками, которые получили новое устройство.",
    imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/18dc6bf0bd596759987b6855f2e96f87.jpg",
    thumbnailUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/36a1171ae258d3bc2e428132093e51f4.jpg",
    gallery: [
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/875f278c61ca6bb57aa961359eba1b6d.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c4db9a7de897068c68975f81da8d0b9f.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/18cae25d032864a20e8904fa495775a5.jpg",
    ],
    locations: locations([
      ["hangar", "Ангар"], ["peak", "Пик"], ["clock_tower", "Часовая башня"], ["factory", "Фабрика"],
      ["pochinok", "Починок"], ["rim_nam_village", "Деревня Рим Нам"], ["mars_electric", "Марс Электрик"],
      ["nurek_dam", "Плотина Нурек"], ["observatory", "Обсерватория"], ["sentosa", "Сентоса"], ["kota_tua", "Кота-Туа"],
      ["mill", "Мельница"], ["graveyard", "Кладбище"], ["bullseye", "Буллсай"], ["outpost", "Аванпост"],
      ["shipyard", "Верфь"], ["katulistiwa", "Катулистиуа"], ["bimasakti_strip", "Полоса Бимасакти"], ["keraton", "Кератон"], ["academy", "Академия"], ["the_circuit", "Гоночная трасса"], ["samurai_garden", "Сад самурая"], ["aden_creek", "Ручей Аден"], ["sanctuary", "Святилище"],
    ]),
  },
  {
    id: "nexterra",
    title: "Нэкст Терра",
    officialUrl: "https://ff.garena.com/en/maps/11",
    description: "Футуристическая карта с технологичными объектами, вертикальными маршрутами и зонами, рассчитанными на быстрые переходы между укрытиями.",
    imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20241/359580945665659e78eea0e1aa103c60.png",
    thumbnailUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/db588e1948c88c726487ab35119dd0a6.jpg",
    gallery: [
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/a9fa7c410992baa132137948e949dccb.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/60379338656f4409b3b4d58b930ac62f.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/06cfe0feb6c4dac39dec620cbaf58af5.jpg",
    ],
    locations: locations([
      ["intellect_center", "Центр интеллекта"], ["twin_bridges", "Двойные мосты"], ["museum", "Музей"],
      ["mud_site", "Грязевой участок"], ["mortar_ruins", "Руины Мортар"], ["windmill", "Турбина"], ["greenhouses", "Фармтопия"],
      ["zipway", "Зипвей"], ["ghost_town", "Ржавый город"], ["grav_labs", "Гравитационные лаборатории"],
      ["deca_square", "Дека-сквер"], ["plazaria", "Плазария"], ["boxing_gym", "Боксёрский зал"], ["eco_drain", "Эко-сток"],
    ]),
  },
  {
    id: "alpine",
    title: "Альпийские горы",
    officialUrl: "https://ff.garena.com/en/maps/2",
    description: "Снежная карта с горными районами, железной дорогой и длинными линиями обзора, где важны укрытия и контроль высоты.",
    imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/01619af902dfaf762f816ed1028f5bbe.jpg",
    thumbnailUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/4b2b2f15b2070502a542e2e3e0be176d.jpg",
    gallery: [
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/6b77c606787d00ac9e49bf9beaab4659.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/e06acf0f1587dfc49f7ebd61452530c3.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/6258a9cb8bb7f32939cab2a46e5c4068.jpg",
    ],
    locations: locations([
      ["snowfall", "Снегопад"], ["vantage", "Авангард"], ["militia", "Милиция"], ["dock", "Док"],
      ["garrison", "Гарнизон"], ["railroad", "Железная дорога"], ["forest_red", "Красный лес"], ["fusion", "Фьюжн"],
      ["basecamp", "Базовый лагерь"], ["carousel", "Карусель"], ["mammut", "Мамонт"], ["river", "Устье реки"],
      ["sunside", "Солнечная сторона"], ["ocean_view", "Вид на океан"], ["rye", "Рай"], ["stadium", "Стадион"], ["blue_ville", "Блю-Вилль"], ["snowy_village", "Снежная деревня"], ["railway_station", "Железнодорожная станция"],
    ]),
  },
  {
    id: "solara",
    title: "Солара",
    officialUrl: "https://ff.garena.com/en/maps/",
    description: "Портовый город с извилистой береговой линией и системой слайдов, которая соединяет районы карты. Здесь есть интерактивные зоны и динамическая погода.",
    imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/0f7e4acbb96c021bb8a72338c29bf39c.jpg",
    thumbnailUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/913b56c52164b5c09ff50974647b0b5d.jpg",
    gallery: [
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/17a4afa7367f9520fb97aa24b964e450.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/2ba345de8135924fcfbc1543695d8452.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/4692a60c796d8ed0a2c6b9357d633259.jpg",
    ],
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
    description: "Большая карта с равнинами, лесными районами, промышленными объектами и перепадами высоты между центральными и окраинными зонами.",
    imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/697b5606cd8a99afd33697c1f6cde233.jpg",
    thumbnailUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/17a873147c13e75eadbfc5c8585303b9.jpg",
    gallery: [
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f82dd19851a69b1bed40fb04098404d1.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/84abdc1183b36fc78cccbc0057073fba.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/65b83837c94a69d4b42bcb4e3288a974.jpg",
    ],
    locations: locations([
      ["forge", "Кузница"], ["brasilia", "Бразилия"], ["central", "Центральный район"], ["moathouse", "Дом на озере"],
      ["ski_lodge", "Лыжный курорт"], ["crossroads", "Перекрёсток"], ["fields", "Поля"], ["lumber_mill", "Лесопилка"],
      ["campsite", "Лагерь"], ["quarry", "Карьер"], ["fire_brigade", "Пожарная часть"], ["golf_course", "Гольф-клуб"],
      ["marbleworks", "Мраморный завод"], ["trailer_park", "Автокемпинг"], ["mount_villa", "Горная вилла"], ["central_factory", "Центральная фабрика"],
    ]),
  },
  {
    id: "kalahari",
    title: "Калахари",
    officialUrl: "https://ff.garena.com/en/maps/3",
    description: "Пустынная карта с открытыми пространствами, каменными возвышенностями и промышленными районами, где особенно важны укрытия и дальние дистанции.",
    imageUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/4735b868bcfea9d613720bfd1e4ee95a.jpg",
    thumbnailUrl: "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/bbc0eb5b89e365e139b04d220a8188fc.jpg",
    gallery: [
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/01bb144b2e410615e5378d0d1621ffcc.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/8e96e17c24404f7469950b9af0d003a2.jpg",
      "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/4ce97290321f009265880e747630d356.jpg",
    ],
    locations: locations([
      ["shrines", "Святилища"], ["refinery", "Нефтеперерабатывающий завод"], ["command_post", "Командный пункт"],
      ["bayfront", "Бэйфронт"], ["santa_catarina", "Санта-Катарина"], ["confinement", "Изолятор"],
      ["stone_ridge", "Каменный хребет"], ["the_maze", "Лабиринт"], ["council_hall", "Зал совета"], ["foundation", "Фундамент"],
      ["old_hampton", "Старый Хэмптон"], ["mammoth", "Мамонт"], ["prison", "Тюрьма"], ["lab", "Лаборатория"],
      ["the_sub", "Подлодка"], ["elevated_road", "Высокая дорога"],
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
