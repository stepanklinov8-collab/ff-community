import assert from "node:assert/strict";
import test from "node:test";
import { contractTermsSchema, legacyContractTermsSchema, defaultTerms, toConstructorTerms } from "../src/modules/contracts/model.ts";
import { resolveEventConditions } from "../src/modules/contracts/financial-terms.ts";

const eventId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const terms = () => defaultTerms(new Date("2026-11-01T12:00:00+03:00"));

test("new constructor stores explicit structured terms without arbitrary prose", () => {
  assert.equal(contractTermsSchema.safeParse(terms()).success, true);
  assert.equal(contractTermsSchema.safeParse({ ...terms(), note: "pay whatever" }).success, false);
  assert.equal(contractTermsSchema.safeParse({ ...terms(), financial: { ...terms().financial, script: "pay()" } }).success, false);
});

test("legacy terms remain readable; conversion preserves amounts and removes only legacy prose", () => {
  const { schemaVersion, financial, ...base } = terms();
  const historical = { ...base, note: "Historical terms" };
  assert.equal(schemaVersion, 2); assert.equal(financial.salary, null);
  assert.equal(legacyContractTermsSchema.safeParse(historical).success, true);
  assert.equal(contractTermsSchema.safeParse(historical).success, false);
  const converted = toConstructorTerms(historical);
  assert.equal(converted.trainingShareBps, historical.trainingShareBps);
  assert.equal("note" in converted, false);
  assert.equal(historical.note, "Historical terms");
});

test("salary allows arbitrary integer day periods but rejects fractions, zero and absent fields", () => {
  for (const periodDays of [1, 9, 37, 365]) assert.equal(contractTermsSchema.safeParse({ ...terms(), financial: { ...terms().financial, salary: { amount: 1000, periodDays } } }).success, true);
  for (const salary of [{ amount: 100, periodDays: 0 }, { amount: 100, periodDays: 0.5 }, { amount: -1, periodDays: 7 }, { amount: 100 }]) {
    assert.equal(contractTermsSchema.safeParse({ ...terms(), financial: { ...terms().financial, salary } }).success, false);
  }
});

test("event override replaces selected fields, preserves other values and respects explicit zero", () => {
  const data = terms(); data.financial.salary = { amount: 1000, periodDays: 9 };
  data.financial.rates.perKill = 10; data.financial.rates.perGame = 50;
  data.financial.eventOverrides = [{ eventId, values: { tournamentShareBps: 3000, perKill: 0 } }];
  const before = structuredClone(data);
  const resolved = resolveEventConditions(data, eventId);
  assert.equal(resolved.tournamentShareBps, 3000); assert.equal(resolved.perKill, 0);
  assert.equal(resolved.perGame, 50); assert.equal(resolved.personalShareBps, 10000);
  assert.equal(resolveEventConditions(data, otherId).tournamentShareBps, 2000);
  assert.deepEqual(data, before, "resolution never mutates the frozen source version");
});

test("conflicting, empty or malformed overrides cannot be saved", () => {
  for (const eventOverrides of [[{ eventId, values: {} }],
    [{ eventId, values: { perKill: 1 } }, { eventId, values: { perKill: 2 } }],
    [{ eventId, values: { perKill: null } }], [{ eventId, values: { salary: 10 } }],
    [{ eventId, values: { personalShareBps: 10001 } }]]) {
    assert.equal(contractTermsSchema.safeParse({ ...terms(), financial: { ...terms().financial, eventOverrides } }).success, false);
  }
});

test("all ranking modes are supported; periods outside the agreement are rejected", () => {
  const data = terms(); data.endsAt = "2026-12-01T12:00:00+03:00";
  const row = { id: eventId, ranking: "organizations", mode: "at_end", top: 3, amount: 250, startsAt: data.startsAt, endsAt: data.endsAt };
  for (const mode of ["at_end", "best", "throughout"]) {
    assert.equal(contractTermsSchema.safeParse({ ...data, financial: { ...data.financial, rankingBonuses: [{ ...row, mode }] } }).success, true);
  }
  for (const rankingBonuses of [[{ ...row, startsAt: "2026-10-01T00:00:00Z" }], [{ ...row, endsAt: "2027-01-01T00:00:00Z" }], [row, row]]) {
    assert.equal(contractTermsSchema.safeParse({ ...data, financial: { ...data.financial, rankingBonuses } }).success, false);
  }
});
