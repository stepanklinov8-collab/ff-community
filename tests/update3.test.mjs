import test from "node:test";
import assert from "node:assert/strict";
import { calculateMapStatistics } from "../src/lib/competition/map-statistics.ts";
import { isKnownLandingLocation, locationsForMap, mapCatalog } from "../src/lib/competition/map-catalog.ts";
import { playerRoleIds } from "../src/lib/profile/roles.ts";
import { knowledgeMapPoints } from "../src/lib/knowledge/map-points.ts";
import { knowledgeCharacters, knowledgeWeapons } from "../src/lib/knowledge/game-catalog.ts";

test("map statistics use played games, first places and only recorded landing locations", () => {
  const rows = [
    { map: "bermuda", played: true, place: 1, landingLocation: "peak", teamId: "team" },
    { map: "bermuda", played: true, place: 4, landingLocation: "peak", teamId: "team" },
    { map: "bermuda", played: true, place: 6, landingLocation: "factory", teamId: "team" },
    { map: "bermuda", played: false, place: null, landingLocation: null, teamId: "team" },
  ];
  const [stat] = calculateMapStatistics(rows);
  assert.equal(stat.games, 3);
  assert.equal(stat.firstPlaces, 1);
  assert.equal(stat.winPercent, 33.33);
  assert.equal(stat.averagePlace, 3.67);
  assert.deepEqual(stat.favoriteLocations, [{ location: "peak", games: 2, percent: 66.67 }]);
});

test("landing locations are restricted to the selected map and roles remain a finite allowlist", () => {
  assert.equal(locationsForMap("bermuda").find(item => item.id === "peak")?.title, "Пик");
  assert.equal(isKnownLandingLocation("bermuda", "peak"), true);
  assert.equal(isKnownLandingLocation("bermuda", "Пик"), true);
  assert.equal(isKnownLandingLocation("bermuda", "stadium"), false);
  assert.equal(isKnownLandingLocation("bermuda", null), true);
  assert.ok(locationsForMap("solara").length >= 14);
  assert.equal(playerRoleIds.has("healer"), true);
  assert.equal(playerRoleIds.has("captain"), false);
});

test("every official map has a Russian catalog entry, map image and source gallery", () => {
  assert.equal(mapCatalog.length, 7);
  for (const map of mapCatalog) {
    assert.ok(map.title.length > 0);
    assert.match(map.officialUrl, /^https:\/\/ff\.garena\.com\/en\/maps\//);
    assert.match(map.imageUrl, /^https:\/\/cdn\.wildflamestudio\.com\//);
    assert.match(map.thumbnailUrl, /^https:\/\/cdn\.wildflamestudio\.com\//);
    assert.equal(map.gallery.length, 3);
    assert.ok(map.gallery.every(image => image.startsWith("https://cdn.wildflamestudio.com/")));
  }
});

test("map labels cover verified locations without breaking saved landing IDs", () => {
  const counts = { solara: 14, nexterra: 13, alpine: 16, bermuda_remastered: 18, bermuda: 21, purgatory: 14, kalahari: 13 };
  for (const map of mapCatalog) {
    const points = knowledgeMapPoints[map.id];
    assert.equal(points.length, counts[map.id], map.id);
    assert.equal(new Set(points.map(point => point.locationId)).size, points.length);
    for (const point of points) {
      assert.ok(map.locations.some(location => location.id === point.locationId), `${map.id}/${point.locationId}`);
      assert.ok(point.x > 0 && point.x < 1000 && point.y > 0 && point.y < 1000);
    }
  }
  assert.deepEqual(knowledgeMapPoints.solara.map(({locationId,x,y}) => [locationId,x,y]), [
    ["waterfall",275,250],["riders_club",400,130],["funfair",560,350],["windmill",790,185],
    ["delta_isle",825,425],["aquarium",920,660],["eco_drain",525,875],["tv_tower",575,600],
    ["bayside",850,875],["bloomtown",425,675],["studio",200,800],["the_hub",100,425],
    ["archway",360,425],["casa_vista",700,700],
  ]);
});

test("catalog preserves published values and marks absent statistics instead of inventing measurements", () => {
  assert.equal(knowledgeWeapons.length, 80);
  assert.equal(new Set(knowledgeWeapons.map(entry => entry.id)).size, 80);
  for (const entry of knowledgeWeapons) {
    assert.equal(entry.stats.length, 8);
    assert.ok(entry.stats.every(stat => stat.value === null || (Number.isFinite(stat.value) && stat.value > 0)));
    assert.ok(entry.description.length > 20);
  }
  const awm = knowledgeWeapons.find(entry => entry.title === "AWM");
  assert.equal(awm.stats.find(stat => stat.label === "Урон").value, 90);
  assert.equal(awm.stats.find(stat => stat.label === "Магазин").value, 5);
  assert.equal(knowledgeCharacters.length, 65);
  assert.equal(new Set(knowledgeCharacters.map(entry => entry.id)).size, 65);
  for (const entry of knowledgeCharacters) {
    assert.ok(entry.character.biography.length > 50, entry.id);
    assert.ok(entry.character.abilityDescription.length > 20, entry.id);
    assert.match(entry.sourceUrl, /^https:\/\/ff\.garena\.com\/en\/chars\/\d+$/);
    assert.match(entry.character.birthday, /^\d{2}\.\d{2}$/);
    assert.ok(entry.character.age === null || entry.character.age > 0);
  }
  assert.equal(knowledgeCharacters.find(entry => entry.id === "wukong").character.age, null);
  const kelly = knowledgeCharacters.find(entry => entry.id === "kelly").character;
  assert.equal(kelly.awakened, true);
  assert.equal(kelly.parameters.find(parameter => parameter.label === "Урон первого выстрела").value, "106% обычного, то есть +6%");
});
