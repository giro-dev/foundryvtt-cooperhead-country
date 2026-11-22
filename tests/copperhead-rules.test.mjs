import test from "node:test";
import assert from "node:assert/strict";
import {
  ATTRIBUTE_ACTIONS,
  advanceClock,
  getDowntimeActivities,
  summarizeClaims,
  getActionDice,
  getAttributeRating,
  getHeatLevel,
  getRollResult,
  getResistanceStress,
  getTroubleTicks,
  HEAT_PROFILES,
} from "../module/copperhead-rules.js";

test("Copperhead attributes contain all twelve actions", () => {
  assert.deepEqual(Object.values(ATTRIBUTE_ACTIONS).map((actions) => actions.length), [4, 4, 4]);
});

test("action ratings determine action dice", () => {
  const actor = { grit: { skills: { fight: { value: 3 } } } };
  assert.equal(getActionDice(actor, "fight"), 3);
  assert.equal(getActionDice(actor, "unlisted"), 0);
});

test("action result bands use highest die and two sixes for a critical", () => {
  assert.equal(getRollResult([1, 3]), "failure");
  assert.equal(getRollResult([2, 4]), "partial-success");
  assert.equal(getRollResult([2, 6]), "success");
  assert.equal(getRollResult([6, 6]), "critical-success");
  assert.equal(getRollResult([]), "failure");
});

test("resistance stress equals the lowest die", () => {
  assert.equal(getResistanceStress([2, 5, 6]), 2);
  assert.equal(getResistanceStress([6, 6]), 6);
});

test("Trouble critical ticks and Heat profiles support both printed editions", () => {
  assert.equal(getTroubleTicks("critical-success"), 5);
  assert.equal(getTroubleTicks("critical-success", 4), 4);
  assert.deepEqual(HEAT_PROFILES.sheets2022, { silent: 0, bumpy: 2, noisy: 4, loud: 6, riotous: 8 });
  assert.deepEqual(HEAT_PROFILES.corebook2021, { silent: 0, bumpy: 3, noisy: 6, loud: 9 });
});

test("attribute rating counts actions with at least one dot plus bonus", () => {
  const attributes = { grit: { bonus: 1, skills: { fight: { value: 2 }, growl: { value: 0 }, handle: { value: 1 }, tread: { value: 0 } } } };
  assert.equal(getAttributeRating(attributes, "grit"), 3);
  assert.equal(getAttributeRating(attributes, "grace"), 0);
});

test("zero-dice rolls use the lowest die and cannot crit", () => {
  assert.equal(getRollResult([6, 6], { zeroDice: true }), "success");
  assert.equal(getRollResult([6, 4], { zeroDice: true }), "partial-success");
  assert.equal(getRollResult([6, 3], { zeroDice: true }), "failure");
});

test("Trouble ticks accept the numeric setting as a string", () => {
  assert.equal(getTroubleTicks("critical-success", "4"), 4);
  assert.equal(getTroubleTicks("failure"), 1);
});

test("Heat level follows the selected profile thresholds", () => {
  assert.equal(getHeatLevel(0), "silent");
  assert.equal(getHeatLevel(3), "bumpy");
  assert.equal(getHeatLevel(8), "riotous");
  assert.equal(getHeatLevel(8, "corebook2021"), "noisy");
  assert.equal(getHeatLevel([9], "corebook2021"), "loud");
});

test("clocks advance, clamp and report when they fill", () => {
  assert.deepEqual(advanceClock(3, 6, 2), { value: 5, filled: false, overflow: 0 });
  assert.deepEqual(advanceClock([4], 6, 5), { value: 6, filled: true, overflow: 3 });
  assert.deepEqual(advanceClock(6, 6, 1), { value: 6, filled: false, overflow: 1 });
  assert.deepEqual(advanceClock(1, 6, -3), { value: 0, filled: false, overflow: 0 });
});

test("downtime activities depend on the crew profile", () => {
  assert.equal(getDowntimeActivities("low"), 1);
  assert.equal(getDowntimeActivities("high"), 2);
  assert.equal(getDowntimeActivities(undefined), 1);
});

test("claims are summarised by status", () => {
  const claims = [{ status: "controlled" }, { status: "present" }, { status: "controlled" }, { status: "bogus" }];
  assert.deepEqual(summarizeClaims(claims), { none: 1, present: 1, controlled: 2 });
  assert.deepEqual(summarizeClaims({ a: { status: "present" } }), { none: 0, present: 1, controlled: 0 });
});
