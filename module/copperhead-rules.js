/** Rules shared by Copperhead County character and campaign sheets. */

export const ATTRIBUTE_ACTIONS = Object.freeze({
  grit: Object.freeze(["fight", "growl", "handle", "tread"]),
  gumption: Object.freeze(["connect", "direct", "reckon", "survey"]),
  grace: Object.freeze(["creep", "fix", "hunt", "hustle"]),
});

export function getActionDice(attributes, action) {
  for (const [attribute, actions] of Object.entries(ATTRIBUTE_ACTIONS)) {
    if (actions.includes(action)) return Math.max(0, Number(attributes?.[attribute]?.skills?.[action]?.value) || 0);
  }
  return 0;
}

/** Attribute rating for resistance: one die per action with at least one dot, plus any bonus. */
export function getAttributeRating(attributes, attribute) {
  const data = attributes?.[attribute];
  if (!data) return 0;
  const actions = ATTRIBUTE_ACTIONS[attribute] ?? Object.keys(data.skills ?? {});
  const rated = actions.filter((action) => (Number(data.skills?.[action]?.value) || 0) > 0).length;
  return Math.max(0, rated + (Number(data.bonus) || 0));
}

/**
 * Return the Forged-in-the-Dark result band for a list of d6 results.
 * With zeroDice, the two dice are read by their lowest result and cannot crit.
 */
export function getRollResult(results, { zeroDice = false } = {}) {
  if (!Array.isArray(results) || results.length === 0) return "failure";
  const dice = results.map(Number);
  if (dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6)) {
    throw new RangeError("Roll results must be integers from 1 to 6.");
  }
  if (zeroDice) {
    const lowest = Math.min(...dice);
    if (lowest <= 3) return "failure";
    return lowest <= 5 ? "partial-success" : "success";
  }
  const highest = Math.max(...dice);
  if (highest <= 3) return "failure";
  if (highest <= 5) return "partial-success";
  return dice.filter((die) => die === 6).length > 1 ? "critical-success" : "success";
}

/** Resistance stress is based on the lowest die, not 6 minus the highest. */
export function getResistanceStress(results, zeroDiceResult = null) {
  if (!Array.isArray(results) || results.length === 0) {
    if (zeroDiceResult === null) throw new RangeError("A zero-die resistance roll needs its two dice results.");
    results = zeroDiceResult;
  }
  const dice = results.map(Number);
  if (dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6)) {
    throw new RangeError("Roll results must be integers from 1 to 6.");
  }
  return Math.min(...dice);
}

export function getTroubleTicks(result, criticalTicks = 5) {
  criticalTicks = Number(criticalTicks);
  if (![4, 5].includes(criticalTicks)) throw new RangeError("Critical Trouble ticks must be 4 or 5.");
  if (result === "critical-success") return criticalTicks;
  if (result === "success") return 3;
  if (result === "partial-success") return 2;
  return 1;
}

export const HEAT_PROFILES = Object.freeze({
  sheets2022: Object.freeze({ silent: 0, bumpy: 2, noisy: 4, loud: 6, riotous: 8 }),
  corebook2021: Object.freeze({ silent: 0, bumpy: 3, noisy: 6, loud: 9 }),
});

/** Return the highest Heat label whose threshold the current Heat has reached. */
export function getHeatLevel(heat, profile = "sheets2022") {
  const thresholds = HEAT_PROFILES[profile] ?? HEAT_PROFILES.sheets2022;
  const value = Math.max(0, Number(heat) || 0);
  let level = "silent";
  for (const [label, threshold] of Object.entries(thresholds)) {
    if (value >= threshold) level = label;
  }
  return level;
}

export const TROUBLE_TYPES = Object.freeze(["personal", "crew", "police", "faction"]);
export const CLAIM_STATUSES = Object.freeze(["none", "present", "controlled"]);
export const DOWNTIME_ACTIVITIES = Object.freeze(["buyStuff", "rnr", "project", "putInWork", "recover"]);
export const DOWNTIME_ACTIVITIES_BY_PROFILE = Object.freeze({ low: 1, high: 2 });

/** Advance a clock by ticks, clamped to [0, max]. */
export function advanceClock(value, max, ticks = 1) {
  const size = Math.max(1, Number(max) || 1);
  const current = Math.min(size, Math.max(0, Number(value) || 0));
  const raw = current + (Number(ticks) || 0);
  const next = Math.min(size, Math.max(0, raw));
  return { value: next, filled: next >= size && current < size, overflow: Math.max(0, raw - size) };
}

/** Downtime activities a character may take per downtime for the crew profile. */
export function getDowntimeActivities(profile = "low") {
  return DOWNTIME_ACTIVITIES_BY_PROFILE[profile] ?? DOWNTIME_ACTIVITIES_BY_PROFILE.low;
}

/** Count claims by status; unknown statuses count as "none". */
export function summarizeClaims(claims = []) {
  const summary = Object.fromEntries(CLAIM_STATUSES.map((status) => [status, 0]));
  for (const claim of Array.isArray(claims) ? claims : Object.values(claims ?? {})) {
    const status = CLAIM_STATUSES.includes(claim?.status) ? claim.status : "none";
    summary[status] += 1;
  }
  return summary;
}
