import test from "node:test";
import assert from "node:assert/strict";
import { calculateMapStatistics } from "../src/lib/competition/map-statistics.ts";
import { isKnownLandingLocation, locationsForMap, mapCatalog } from "../src/lib/competition/map-catalog.ts";
import { playerRoleIds } from "../src/lib/profile/roles.ts";

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
