import type {MapId} from "../competition/map-catalog";

export type KnowledgeMapPoint = {locationId: string; englishName: string; x: number; y: number; photo: string};
// Garena atlas coordinates converted from Leaflet latitude/longitude to a 1000×1000 canvas.
// The original label centre is 17 units above and left of the marker anchor.
export const mapLabelOffset = 17;
export const knowledgeMapPoints: Record<MapId, readonly KnowledgeMapPoint[]> = {
  "solara": [
    {
      "locationId": "waterfall",
      "englishName": "Waterfall",
      "x": 275,
      "y": 250,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/17a4afa7367f9520fb97aa24b964e450.jpg"
    },
    {
      "locationId": "riders_club",
      "englishName": "Riders Club",
      "x": 400,
      "y": 130,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/2ba345de8135924fcfbc1543695d8452.jpg"
    },
    {
      "locationId": "funfair",
      "englishName": "Funfair",
      "x": 560,
      "y": 350,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/4692a60c796d8ed0a2c6b9357d633259.jpg"
    },
    {
      "locationId": "windmill",
      "englishName": "Windmill",
      "x": 790,
      "y": 185,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/f4291a7632277515fb65ab841e88be7f.jpg"
    },
    {
      "locationId": "delta_isle",
      "englishName": "Delta Isle",
      "x": 825,
      "y": 425,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/b099949fbd6bd9cb973f6a1a22ddeb7b.jpg"
    },
    {
      "locationId": "aquarium",
      "englishName": "Aquarium",
      "x": 920,
      "y": 660,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/6475e056b064e48e368221c261d084fa.jpg"
    },
    {
      "locationId": "eco_drain",
      "englishName": "Eco Drain",
      "x": 525,
      "y": 875,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/2ebf8dd1d8be7ec4011029a152115cc5.jpg"
    },
    {
      "locationId": "tv_tower",
      "englishName": "TV Tower",
      "x": 575,
      "y": 600,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/e61a99008446486c2aabe3e27f95af2b.jpg"
    },
    {
      "locationId": "bayside",
      "englishName": "Bayside",
      "x": 850,
      "y": 875,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/761503766b430d6c300e553268cfc5d9.jpg"
    },
    {
      "locationId": "bloomtown",
      "englishName": "Bloomtown",
      "x": 425,
      "y": 675,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/a03d715770a0b1eb1d8725a25a8ddd6b.jpg"
    },
    {
      "locationId": "studio",
      "englishName": "Studio",
      "x": 200,
      "y": 800,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/67ec7c4155bc1a4c020acb23c06aa6be.jpg"
    },
    {
      "locationId": "the_hub",
      "englishName": "The Hub",
      "x": 100,
      "y": 425,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/b05e2af1f305424caf84841ac6cb4651.jpg"
    },
    {
      "locationId": "archway",
      "englishName": "Archway",
      "x": 360,
      "y": 425,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/a9edfc2b3f05d50af176b12018ab5948.jpg"
    },
    {
      "locationId": "casa_vista",
      "englishName": "Casa Vista",
      "x": 700,
      "y": 700,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20255/2b2f894966d65facba89448c6937b53c.jpg"
    }
  ],
  "nexterra": [
    {
      "locationId": "intellect_center",
      "englishName": "Intellect Center",
      "x": 451,
      "y": 203,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f72d0b2882b01925bd0dedaa23ac2ef4.jpg"
    },
    {
      "locationId": "twin_bridges",
      "englishName": "Twin Bridge",
      "x": 704,
      "y": 221,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/d34e4ae1817155222d9fa974556f3529.jpg"
    },
    {
      "locationId": "museum",
      "englishName": "Museum",
      "x": 151,
      "y": 361,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/08171f13d4f7a58ea3505cd353bac74c.jpg"
    },
    {
      "locationId": "mortar_ruins",
      "englishName": "Mortar Ruins",
      "x": 755,
      "y": 365,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20241/7c09c38d7295f86513386c176b86eb0f.jpg"
    },
    {
      "locationId": "windmill",
      "englishName": "Turbine",
      "x": 128,
      "y": 543,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20241/3b9fab832c0ab895815c4e3ed390ea79.jpg"
    },
    {
      "locationId": "greenhouses",
      "englishName": "Farmtopia",
      "x": 376,
      "y": 490,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20241/9de5acea1cd3e47bffcbfa75d6d58d84.jpg"
    },
    {
      "locationId": "zipway",
      "englishName": "Zipway",
      "x": 655,
      "y": 491,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20241/29e124e7447292741b7e719d424ca70c.jpg"
    },
    {
      "locationId": "ghost_town",
      "englishName": "Rust Town",
      "x": 833,
      "y": 509,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20241/b44cdffa72b430a17bf2509bc094b6cd.jpg"
    },
    {
      "locationId": "grav_labs",
      "englishName": "Grav Labs",
      "x": 181,
      "y": 790,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/32faf858a681a2ec1dd20dea0a93e4a2.jpg"
    },
    {
      "locationId": "deca_square",
      "englishName": "Deca Square",
      "x": 583,
      "y": 817,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/1e9c3b6b886f7ba757386b8f952e069f.jpg"
    },
    {
      "locationId": "plazaria",
      "englishName": "Plazaria",
      "x": 352,
      "y": 680,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20241/b1d19238277496edeac9bd6886fc2185.jpg"
    },
    {
      "locationId": "boxing_gym",
      "englishName": "Boxing Gym",
      "x": 540,
      "y": 560,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20241/d6e7eb1eb2093954f32976fb0a5d6fc5.jpg"
    },
    {
      "locationId": "mud_site",
      "englishName": "Mud Site",
      "x": 750,
      "y": 750,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20241/3f687300054e17735e91f4ef6d17c5ab.jpg"
    }
  ],
  "alpine": [
    {
      "locationId": "snowfall",
      "englishName": "Snowfall",
      "x": 236,
      "y": 223,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/fac60ddb902924cc172f999e220449d4.jpg"
    },
    {
      "locationId": "vantage",
      "englishName": "Vantage",
      "x": 821,
      "y": 758,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/b95242d8322c35619bab227f50a8448b.jpg"
    },
    {
      "locationId": "railroad",
      "englishName": "Railroad",
      "x": 758,
      "y": 236,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/bdb124cff56bd9b032d062e270f4082a.jpg"
    },
    {
      "locationId": "dock",
      "englishName": "Dock",
      "x": 941,
      "y": 460,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/df365a385fd4725b8c18661bfe654a09.jpg"
    },
    {
      "locationId": "river",
      "englishName": "River Mouth",
      "x": 470,
      "y": 670,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/746111f8a18831a3f23748f2041f9fae.jpg"
    },
    {
      "locationId": "fusion",
      "englishName": "Fusion",
      "x": 202,
      "y": 701,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/981bbeb519244327ffa1af1e06a79979.jpg"
    }
  ],
  "bermuda_remastered": [
    {
      "locationId": "hangar",
      "englishName": "Hangar",
      "x": 215,
      "y": 532,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/76627b0f7681f28ef397a492721e32df.jpg"
    },
    {
      "locationId": "observatory",
      "englishName": "Observatory",
      "x": 146,
      "y": 341,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/92ccb7be797fea82480edb1e23c4b9f3.jpg"
    },
    {
      "locationId": "academy",
      "englishName": "Academy",
      "x": 232,
      "y": 221,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/2bc6dc11cfd19cd57599519240da7c40.jpg"
    },
    {
      "locationId": "nurek_dam",
      "englishName": "Nurek Dam",
      "x": 542,
      "y": 260,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/12352a9470ee7fdaf4cb6bb6d6c2e8cf.jpg"
    },
    {
      "locationId": "mill",
      "englishName": "Mill",
      "x": 746,
      "y": 262,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/a96ea33efb33c2b1f76f082c64612d8d.jpg"
    },
    {
      "locationId": "the_circuit",
      "englishName": "The Circuit",
      "x": 914,
      "y": 505,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f7f523c72e4fbb0e787763b64f8cfc94.jpg"
    },
    {
      "locationId": "samurai_garden",
      "englishName": "Samurai\"s Garden",
      "x": 889,
      "y": 763,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/896102fc7ef8131c33a55e87d7567765.jpg"
    }
  ],
  "bermuda": [
    {
      "locationId": "shipyard",
      "englishName": "Shipyard",
      "x": 417,
      "y": 145,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/5d5657e3de320057f9ae1db2f322778f.jpg"
    },
    {
      "locationId": "graveyard",
      "englishName": "Graveyard",
      "x": 235,
      "y": 258,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/f99dde35ffc6e5c31eb51d138aae1975.jpg"
    },
    {
      "locationId": "cape_town",
      "englishName": "Cape Town",
      "x": 943,
      "y": 497,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20236/c0efbd03a841efc4920928ed40885522.jpg"
    },
    {
      "locationId": "factory",
      "englishName": "Factory",
      "x": 452,
      "y": 700,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/10ba262d7f7efe7211e55fa8983d5679.jpg"
    },
    {
      "locationId": "mars_electric",
      "englishName": "Mars Electric",
      "x": 511,
      "y": 849,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20236/f785e7e0ab6d771e40cbbf637295dd0d.jpg"
    },
    {
      "locationId": "clock_tower",
      "englishName": "Clock Tower",
      "x": 353,
      "y": 598,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/5a02d91e5439a5936e83a517c1057b4f.jpg"
    },
    {
      "locationId": "rim_nam_village",
      "englishName": "Rim Nam Village",
      "x": 137,
      "y": 723,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20246/a3e141c710d24dcde3efbbb6684c5d72.png"
    },
    {
      "locationId": "peak",
      "englishName": "Peak",
      "x": 580,
      "y": 550,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20238/6a046e1117198d0559ed3c1cef12c9a1.jpg"
    },
    {
      "locationId": "hangar",
      "englishName": "Hangar",
      "x": 150,
      "y": 500,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/20259/49fb1e58483d0f8656e6608950997f14.jpg"
    }
  ],
  "purgatory": [
    {
      "locationId": "forge",
      "englishName": "Forge",
      "x": 874,
      "y": 581,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/38d2a5b7165fb6cc3682dd66212494b8.jpg"
    },
    {
      "locationId": "ski_lodge",
      "englishName": "Ski Lodge",
      "x": 889,
      "y": 430,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/8dcb9dfa87d1f0f5a7afcf0945e3c11c.jpg"
    },
    {
      "locationId": "lumber_mill",
      "englishName": "Lumber Mill",
      "x": 713,
      "y": 842,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/c3484f5d7c61fc6c3aa526646bea8250.jpg"
    },
    {
      "locationId": "central",
      "englishName": "Central",
      "x": 427,
      "y": 793,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/aa09bdcf62d67cdc353917081152d209.jpg"
    },
    {
      "locationId": "golf_course",
      "englishName": "Golf Course",
      "x": 275,
      "y": 677,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/e455a31c61aa812d624795cee73a57e2.jpg"
    },
    {
      "locationId": "mount_villa",
      "englishName": "Mt. Villa",
      "x": 181,
      "y": 757,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/ec596c79bb4376f91e91bb628382ff2e.jpg"
    },
    {
      "locationId": "moathouse",
      "englishName": "Moathouse",
      "x": 635,
      "y": 125,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/19a9871b025fcb044970736a577c7a7f.jpg"
    }
  ],
  "kalahari": [
    {
      "locationId": "shrines",
      "englishName": "Shrines",
      "x": 479,
      "y": 200,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/8fc4c725fc2645d254e886f321866431.jpg"
    },
    {
      "locationId": "council_hall",
      "englishName": "Council Hall",
      "x": 754,
      "y": 205,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/7dc92d3db759de7ee7772004ac80a295.jpg"
    },
    {
      "locationId": "bayfront",
      "englishName": "Bayfront",
      "x": 601,
      "y": 390,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/6ee1c61c6442b43264cf3fa89a651370.jpg"
    },
    {
      "locationId": "refinery",
      "englishName": "Refinery",
      "x": 466,
      "y": 530,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/1257247be58d6e15f520707308482c9b.jpg"
    },
    {
      "locationId": "santa_catarina",
      "englishName": "Santa Catarina",
      "x": 850,
      "y": 556,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/eae03b8cdabd5198841609023f72f98f.jpg"
    },
    {
      "locationId": "command_post",
      "englishName": "Command Post",
      "x": 601,
      "y": 635,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/8d4395b6cb76cdd93ff336e67c077be5.jpg"
    },
    {
      "locationId": "mammoth",
      "englishName": "Mammoth",
      "x": 250,
      "y": 799,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/aa38a1cd354454c03eaec585036590a8.jpg"
    },
    {
      "locationId": "confinement",
      "englishName": "Confinement",
      "x": 835,
      "y": 383,
      "photo": "https://cdn.wildflamestudio.com/common/web_event/official2.ff.garena.all/img/20228/7a191d673347869ce452bea30172a7ba.jpg"
    }
  ]
};
