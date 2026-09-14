import assert from "node:assert/strict";
import {
  calculateFixedOdds,
  isBettingOddsAvailable,
  roundHalfUpToHundredths,
} from "../src/lib/betting-odds.ts";
import { classifyBettingDatabaseError } from "../src/lib/betting-errors.ts";
import { isEventEffectivelyPublished } from "../src/lib/event-publication.ts";

assert.equal(roundHalfUpToHundredths(1.1049), 1.10);
assert.equal(roundHalfUpToHundredths(1.105), 1.11);
assert.equal(roundHalfUpToHundredths(2.675), 2.68);
assert.equal(isBettingOddsAvailable(1.099999), false);
assert.equal(isBettingOddsAvailable(1.10), true);

const unavailable = calculateFixedOdds({
  marketType: "win",
  selectionValue: "win",
  teamRating: 100,
  opponentRating: 1,
  averageKills: 10,
  averagePlace: 1,
  sampleSize: 20,
});
assert.equal(unavailable.eligible, false);
assert.equal(unavailable.offeredOdds, null);

const exactThreshold = calculateFixedOdds({
  marketType: "kills_over",
  selectionValue: "over",
  line: 5.5,
  teamRating: 50,
  averageKills: 5.5,
  averagePlace: 6,
  sampleSize: 20,
});
assert.equal(exactThreshold.eligible, true);
assert.ok(exactThreshold.offeredOdds !== null && exactThreshold.offeredOdds >= 1.10);

assert.equal(isEventEffectivelyPublished({ is_published: true, publish_at: null }), true);
assert.equal(isEventEffectivelyPublished({ is_published: false, publish_at: "2026-09-14T10:00:00Z" }, Date.parse("2026-09-14T11:00:00Z")), true);
assert.equal(isEventEffectivelyPublished({ is_published: false, publish_at: "2026-09-14T12:00:00Z" }, Date.parse("2026-09-14T11:00:00Z")), false);

assert.deepEqual(classifyBettingDatabaseError({ message: "Insufficient balance" }), {
  code: "INSUFFICIENT_BALANCE",
  message: "Недостаточно монет",
  status: 409,
});
assert.equal(classifyBettingDatabaseError({ code: "23505", message: "duplicate key value" }).code, "DUPLICATE_BET");
assert.equal(classifyBettingDatabaseError({ code: "XX000", message: "unexpected" }).code, "BET_DATABASE_XX000");

console.log("Betting odds verification passed");
