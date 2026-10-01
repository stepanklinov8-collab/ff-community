import test from "node:test";
import assert from "node:assert/strict";
import { calculateMapStatistics } from "../src/lib/competition/map-statistics.ts";
import { isKnownLandingLocation, locationsForMap } from "../src/lib/competition/map-catalog.ts";
import { playerRoleIds } from "../src/lib/profile/roles.ts";

test("map statistics use played games, first places and only recorded landing locations", () => {
  const rows = [
    { map: "bermuda", played: true, place: 1, landingLocation: "Peak", teamId: "team" },
    { map: "bermuda", played: true, place: 4, landingLocation: "Peak", teamId: "team" },
    { map: "bermuda", played: true, place: 6, landingLocation: "Factory", teamId: "team" },
    { map: "bermuda", played: false, place: null, landingLocation: null, teamId: "team" },
  ];
  const [stat] = calculateMapStatistics(rows);
  assert.equal(stat.games, 3);
  assert.equal(stat.firstPlaces, 1);
  assert.equal(stat.winPercent, 33.33);
  assert.equal(stat.averagePlace, 3.67);
  assert.deepEqual(stat.favoriteLocations, [{ location: "Peak", games: 2, percent: 66.67 }]);
});

test("landing locations are restricted to the selected map and roles remain a finite allowlist", () => {
  assert.ok(locationsForMap("bermuda").includes("Peak"));
  assert.equal(isKnownLandingLocation("bermuda", "Peak"), true);
  assert.equal(isKnownLandingLocation("bermuda", "Stadium"), false);
  assert.equal(isKnownLandingLocation("bermuda", null), true);
  assert.equal(playerRoleIds.has("healer"), true);
  assert.equal(playerRoleIds.has("captain"), false);
});
