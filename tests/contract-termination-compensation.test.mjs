import assert from "node:assert/strict";
import test from "node:test";
import {
  terminationCompensationSchema,
  previewTerminationCompensation as preview,
  describeTerminationCompensation as describe,
} from "../src/modules/contracts/termination-compensation.ts";

const snapshot = { at: "2026-10-29T12:00:00+03:00", playerValue: 15000, contractDebt: 6000 };
const combined = { kind: "combined", amount: 1000, basisPoints: 1000,
  base: { kind: "player_value" }, selection: "maximum" };

test("fixed and no compensation do not pay the underlying debt a second time", () => {
  assert.equal(preview({ kind: "none" }, snapshot).amount, 0);
  assert.equal(preview({ kind: "fixed", amount: 1000 }, snapshot).amount, 1000);
});

test("percentage uses the selected base, never a sum of all bases", () => {
  for (const [base, expected] of [
    [{ kind: "specified", amount: 20000 }, 2000],
    [{ kind: "player_value" }, 1500],
    [{ kind: "contract_debt" }, 600],
  ]) {
    assert.equal(preview({ kind: "percent", basisPoints: 1000, base }, snapshot).amount, expected);
  }
});

test("combined maximum and minimum choose one amount, never add both", () => {
  assert.equal(preview(combined, snapshot).amount, 1500);
  assert.equal(preview({ ...combined, selection: "minimum" }, snapshot).amount, 1000);
  assert.equal(preview(combined, { ...snapshot, playerValue: 5000 }).amount, 1000);
  assert.equal(preview({ ...combined, selection: "minimum" }, { ...snapshot, playerValue: 5000 }).amount, 500);
});

test("equal and zero bases have well-defined minimum/maximum results", () => {
  for (const selection of ["maximum", "minimum"]) {
    assert.equal(preview({ ...combined, selection }, { ...snapshot, playerValue: 10000 }).amount, 1000);
  }
  assert.equal(preview(combined, { ...snapshot, playerValue: 0 }).amount, 1000);
  assert.equal(preview({ ...combined, selection: "minimum" }, { ...snapshot, playerValue: 0 }).amount, 0);
});

test("percentage money is exact at the supported upper boundary, flooring final coins", () => {
  const result = preview({ kind: "percent", basisPoints: 9999,
    base: { kind: "specified", amount: 999999999999 } }, snapshot);
  assert.equal(result.amount, 999899999999);
  assert.equal(preview({ kind: "percent", basisPoints: 3333,
    base: { kind: "specified", amount: 10 } }, snapshot).amount, 3);
});

test("constructor rejects missing selection, prose, unknown bases and malformed money", () => {
  const { selection, ...missingSelection } = combined;
  assert.equal(selection, "maximum");
  for (const rule of [missingSelection, { ...combined, selection: "sum" },
    { ...combined, note: "pay more" }, { ...combined, amount: -1 },
    { ...combined, amount: 0.5 }, { ...combined, basisPoints: 10001 },
    { ...combined, base: { kind: "other_contract_debt" } },
    { ...combined, base: { kind: "player_value", amount: 999 } }]) {
    assert.equal(terminationCompensationSchema.safeParse(rule).success, false);
  }
});

test("snapshot must be valid and output retains the valuation timestamp", () => {
  assert.throws(() => preview(combined, { ...snapshot, at: "yesterday" }));
  assert.throws(() => preview(combined, { ...snapshot, contractDebt: -1 }));
  assert.throws(() => preview(combined, { ...snapshot, playerValue: Infinity }));
  const frozen = Object.freeze({ ...snapshot });
  assert.equal(preview(combined, frozen).at, snapshot.at);
  assert.deepEqual(frozen, snapshot);
});

test("prepared text states selected comparison and basis without arbitrary conditions", () => {
  assert.match(describe(combined), /большее/);
  assert.match(describe(combined), /стоимости игрока/);
  assert.match(describe({ ...combined, selection: "minimum" }), /меньшее/);
  assert.match(describe({ ...combined, base: { kind: "contract_debt" } }), /без самой компенсации/);
  assert.match(describe(combined), /не складываются/);
  assert.throws(() => describe({ ...combined, note: "override" }));
});
