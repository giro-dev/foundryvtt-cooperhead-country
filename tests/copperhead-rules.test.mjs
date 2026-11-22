import test from "node:test";
import assert from "node:assert/strict";
import {
  ATTRIBUTE_ACTIONS,
  getActionDice,
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
