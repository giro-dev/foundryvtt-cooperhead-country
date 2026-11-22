import { bladesRoll } from "./blades-roll.js";
import { generateRandomId } from "./compat.js";
import { openFormDialog } from "./lib/dialog-compat.js";
import {
  advanceClock, advanceTension, getBailCost, getDowntimeActivities, getDowntimeIncome, getInnocenceDice,
  getInnocenceOutcome, getLowProfileHeatLoss, getProjectTicks, getRecoverOutcome, getTroubleTicks,
} from "./copperhead-rules.js";

const SYSTEM_ID = "copperhead-county";

const capitalize = (key) => key.charAt(0).toUpperCase() + key.slice(1);
export const labelKey = (prefix, key) => `${prefix}${capitalize(key)}`;

function escapeHtml(value) {
  return foundry.utils.escapeHTML?.(String(value ?? "")) ?? String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function postChat(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

const num = (value) => Number(Array.isArray(value) ? value[0] : value) || 0;
const loc = (key) => game.i18n.localize(key);

function diceSelect(name, selected, max = 6) {
  const options = Array.from({ length: max + 1 }, (_, n) => `<option value="${n}" ${n === selected ? "selected" : ""}>${n}d</option>`).join("");
  return `<div class="form-group"><label>${loc("BITD.RollNumberOfDice")}</label><select name="${name}">${options}</select></div>`;
}

const checkbox = (name, label) => `<div class="form-group"><label>${loc(label)}</label><input type="checkbox" name="${name}"></div>`;
const isChecked = (value) => value === true || value === "on" || value === "true";

/**
 * Ask for a dice pool and roll a Trouble roll. `dice` is the suggested pool
 * (Burnout, Tier, Raid or faction Tier); a crew-related death adds +1d and a faction at war +1d.
 * Returns the rolled ticks, or null if cancelled.
 */
export async function rollTrouble(label, { dice = 2, type = "" } = {}) {
  const extras = checkbox("death", "CC.TroubleDeathBonus") + (type === "faction" ? checkbox("war", "CC.TroubleWarBonus") : "");
  const form = await openFormDialog({
    title: `${loc("CC.TroubleRoll")}: ${label}`,
    content: `<form>${diceSelect("qty", Math.min(6, Math.max(0, num(dice))))}${extras}</form>`,
    okLabel: loc("BITD.Roll"),
    cancelLabel: loc("Cancel"),
  });
  if (!form) return null;
  const qty = (Number(form.qty) || 0) + (isChecked(form.death) ? 1 : 0) + (isChecked(form.war) ? 1 : 0);
  const { status } = await bladesRoll(qty, "CC.TroubleRoll", "", "", label);
  return getTroubleTicks(status, game.settings.get(SYSTEM_ID, "troubleCriticalTicks"));
}

/** Advance a clock stored at `path` on `actor`, posting a notice when it fills. */
export async function tickActorClock(actor, path, max, ticks, label) {
  const result = advanceClock(foundry.utils.getProperty(actor, path), max, ticks);
  await actor.update({ [path]: result.value });
  if (result.filled) await announceFilledClock(actor, label, result.fills);
  return result;
}

export async function announceFilledClock(actor, label, fills = 1) {
  const times = fills > 1 ? ` (×${fills})` : "";
  return postChat(actor, `<p><strong>${escapeHtml(label)}</strong>: ${loc("CC.ClockFilled")}${times}</p>`);
}

/** Roll Trouble and tick the clock at `path`. */
export async function rollTroubleForClock(actor, path, max, label, options = {}) {
  const ticks = await rollTrouble(label, options);
  if (ticks === null) return null;
  return tickActorClock(actor, path, max, ticks, label);
}

/* -------------------------------------------- */
/*  Downtime                                    */
/* -------------------------------------------- */

export function getCharacterCrew(actor) {
  const crewId = actor.system?.crew?.[0]?.id;
  return crewId ? game.actors.get(crewId) ?? null : null;
}

export function getDowntimeAllowance(actor) {
  return getDowntimeActivities(getCharacterCrew(actor)?.system?.profile);
}

function rollDice(roll) {
  return roll.terms[0].results.map((r) => r.result);
}

async function confirmExtraActivity(actor) {
  if (num(actor.system.cash) < 1) {
    ui.notifications.warn(loc("CC.DowntimeNoActivities"));
    return false;
  }
  const form = await openFormDialog({
    title: loc("CC.Downtime"),
    content: `<form><p>${loc("CC.DowntimeExtraActivity")}</p><input type="hidden" name="ok" value="1"></form>`,
    okLabel: loc("CC.DowntimePayCash"),
    cancelLabel: loc("Cancel"),
  });
  if (!form) return false;
  await actor.update({ "system.cash": num(actor.system.cash) - 1 });
  return true;
}

async function askActivityDice(title, { dice = 1, extra = "" } = {}) {
  const form = await openFormDialog({
    title,
    content: `<form>${extra}${diceSelect("qty", Math.min(6, Math.max(0, num(dice))))}${checkbox("help", "CC.DowntimeHelp")}</form>`,
    okLabel: loc("BITD.Roll"),
    cancelLabel: loc("Cancel"),
  });
  if (!form) return null;
  return { ...form, qty: (Number(form.qty) || 0) + (isChecked(form.help) ? 1 : 0) };
}

const DOWNTIME_EFFECTS = {
  /** Price comparison is a judgement call; just record the activity. */
  async buyStuff() {
    return { message: "" };
  },

  /** Roll Bank; clear stress equal to the highest die. Overindulging if it exceeds current stress. */
  async rnr(actor, label) {
    const form = await askActivityDice(label, { dice: actor.system.bank });
    if (!form) return null;
    const { roll, zeromode } = await bladesRoll(form.qty, "", "", "", label);
    const dice = rollDice(roll);
    const relief = zeromode ? Math.min(...dice) : Math.max(...dice);
    const stress = num(actor.system.stress?.value);
    await actor.update({ "system.stress.value": Math.max(0, stress - relief), "system.downtime.rnr": true });
    let message = game.i18n.format("CC.DowntimeRnrResult", { relief: Math.min(relief, stress) });
    if (relief > stress) message += ` ${loc("CC.DowntimeRnrOverindulge")}`;
    return { message };
  },

  /** Roll an action and tick a project clock (1/2/3/5 ticks). */
  async project(actor, label) {
    const projects = actor.system.projects ?? [];
    const options = projects.map((p) => `<option value="${p.id}">${escapeHtml(p.name || loc("CC.Project"))}</option>`).join("");
    const extra = projects.length ? `<div class="form-group"><label>${loc("CC.Project")}</label><select name="project">${options}</select></div>` : `<p>${loc("CC.ProjectNone")}</p>`;
    const form = await askActivityDice(label, { dice: 1, extra });
    if (!form) return null;
    const { status } = await bladesRoll(form.qty, "", "", "", label);
    const ticks = getProjectTicks(status);
    const entry = projects.find((p) => p.id === form.project);
    if (entry) await tickListClock(actor, "system.projects", entry.id, ticks);
    return { message: game.i18n.format("CC.ProjectTicks", { ticks, project: escapeHtml(entry?.name || loc("CC.Project")) }) };
  },

  /** +1 Cash for the character or the crew. */
  async putInWork(actor, label) {
    const crew = getCharacterCrew(actor);
    let target = actor;
    if (crew) {
      const form = await openFormDialog({
        title: label,
        content: `<form><div class="form-group"><label>${loc("CC.DowntimeCashTo")}</label><select name="target"><option value="self">${escapeHtml(actor.name)}</option><option value="crew">${escapeHtml(crew.name)}</option></select></div></form>`,
        okLabel: loc("CC.DowntimePutInWork"),
        cancelLabel: loc("Cancel"),
      });
      if (!form) return null;
      if (form.target === "crew") target = crew;
    }
    const gained = await addCash(target, 1);
    return { message: game.i18n.format("CC.CashGained", { name: escapeHtml(target.name), cash: gained }) };
  },

  /** Roll Bank (medical help) or 0d (leave it to luck; doesn't use an activity). */
  async recover(actor, label) {
    const extra = `<div class="form-group"><label>${loc("CC.RecoverMethod")}</label><select name="method"><option value="bank">${loc("CC.RecoverBank")}</option><option value="luck">${loc("CC.RecoverLuck")}</option></select></div>`;
    const form = await askActivityDice(label, { dice: actor.system.bank, extra });
    if (!form) return null;
    const luck = form.method === "luck";
    const { status } = await bladesRoll(luck ? 0 : form.qty, "", "", "", label);
    return { message: loc(labelKey("CC.Recover", getRecoverOutcome(status))), free: luck };
  },
};

/** Add Cash to a character (`system.cash`) or crew (`system.cash.value`), clamped to its max. Returns Cash added. */
export async function addCash(actor, amount) {
  const isCrew = actor.type === "crew";
  const path = isCrew ? "system.cash.value" : "system.cash";
  const max = Number(isCrew ? actor.system.cash?.max : actor.system.cash_max) || Infinity;
  const current = num(foundry.utils.getProperty(actor, path));
  const next = Math.min(max, current + amount);
  await actor.update({ [path]: next });
  if (next - current < amount) ui.notifications.warn(game.i18n.format("CC.CashCapped", { name: actor.name, max }));
  return next - current;
}

export async function logDowntimeActivity(actor, activity) {
  const used = Number(actor.system.downtime?.used) || 0;
  const allowance = getDowntimeAllowance(actor);
  const exhausted = used >= allowance;
  // Leaving recovery to luck (0d) does not use an activity, so it never needs an extra one.
  if (exhausted && activity !== "recover" && !(await confirmExtraActivity(actor))) return;
  const label = loc(labelKey("CC.Downtime", activity));
  const result = await DOWNTIME_EFFECTS[activity]?.(actor, label);
  if (!result) return;
  if (exhausted && activity === "recover" && !result.free) ui.notifications.warn(loc("CC.DowntimeNoActivities"));
  const nextUsed = result.free ? used : used + 1;
  if (nextUsed !== used) await actor.update({ "system.downtime.used": nextUsed });
  const taken = game.i18n.format("CC.DowntimeActivityTaken", { name: escapeHtml(actor.name), activity: label, used: nextUsed, allowance });
  await postChat(actor, `<p>${taken}</p>${result.message ? `<p>${result.message}</p>` : ""}`);
}

export function getCrewMembers(crew) {
  return game.actors.filter((actor) => actor.type === "character" && actor.system?.crew?.some((entry) => entry.id === crew.id));
}

export function isRaidFull(crew) {
  return num(crew.system.raid) >= (Number(crew.system.raid_max) || 4);
}

/** Start downtime: reset activities; Low profile sheds 6 − Tier Heat, High keeps Heat. */
export async function startDowntime(crew) {
  if (isRaidFull(crew)) {
    ui.notifications.warn(loc("CC.RaidNoDowntime"));
    return;
  }
  const members = getCrewMembers(crew);
  for (const member of members) await member.update({ "system.downtime.used": 0, "system.downtime.rnr": false });
  const high = crew.system.profile === "high";
  const lines = [game.i18n.format("CC.DowntimeStarted", {
    crew: escapeHtml(crew.name), profile: loc(high ? "CC.ProfileHigh" : "CC.ProfileLow"), allowance: getDowntimeActivities(crew.system.profile),
  })];
  if (!high) {
    const heat = num(crew.system.heat);
    const next = Math.max(0, heat - getLowProfileHeatLoss(crew.system.tier));
    await crew.update({ "system.heat": next });
    lines.push(game.i18n.format("CC.DowntimeHeatLost", { lost: heat - next, heat: next }));
  }
  lines.push(members.map((m) => escapeHtml(m.name)).join(", ") || "—");
  await postChat(crew, lines.map((l) => `<p>${l}</p>`).join(""));
}

/** Income & Wrap-Up: crew gains Income + Tier Cash; members who skipped R&R take stress equal to Burnout. */
export async function endDowntime(crew) {
  const lines = [game.i18n.format("CC.DowntimeEnded", { crew: escapeHtml(crew.name) })];
  const income = getDowntimeIncome(crew.system.income, crew.system.tier);
  const gained = await addCash(crew, income);
  lines.push(game.i18n.format("CC.CashGained", { name: escapeHtml(crew.name), cash: gained }));
  for (const member of getCrewMembers(crew)) {
    if (member.system.downtime?.rnr) continue;
    const burnout = Object.values(member.system.burnout?.conditions ?? {}).filter(Boolean).length;
    if (!burnout) continue;
    const stress = num(member.system.stress?.value);
    const next = Math.min(Number(member.system.stress?.max) || 9, stress + burnout);
    await member.update({ "system.stress.value": next });
    lines.push(game.i18n.format("CC.DowntimeNoRnrStress", { name: escapeHtml(member.name), stress: next - stress }));
  }
  await postChat(crew, lines.map((l) => `<p>${l}</p>`).join(""));
}

/* -------------------------------------------- */
/*  Raids, arrests and County Tension           */
/* -------------------------------------------- */

export async function announceRaid(crew) {
  const bail = getBailCost(crew.system.tier, num(crew.system.raid));
  return postChat(crew, `<p><strong>${loc("CC.Raided")}</strong></p><p>${game.i18n.format("CC.RaidProcedure", { crew: escapeHtml(crew.name), bail })}</p>`);
}

/** Assert Your Innocence: roll half Bank (rounded down). */
export async function assertInnocence(actor) {
  const label = loc("CC.AssertInnocence");
  const { status } = await bladesRoll(getInnocenceDice(actor.system.bank), "", "", "", label);
  return postChat(actor, `<p><strong>${escapeHtml(actor.name)}</strong>: ${loc(labelKey("CC.Innocence", getInnocenceOutcome(status)))}</p>`);
}

export async function tickTension(campaign, ticks) {
  const system = campaign.system;
  const result = advanceTension(num(system.county_tension), num(system.tension_clock), system.tension_clock_max, ticks, Number(system.county_tension_max) || 4);
  await campaign.update({ "system.county_tension": result.level, "system.tension_clock": result.clock });
  if (result.change) {
    const key = result.change > 0 ? "CC.TensionRises" : "CC.TensionFalls";
    await postChat(campaign, `<p>${game.i18n.format(key, { level: result.level })}</p><p>${loc(`CC.TensionLevel${result.level}`)}</p>`);
  }
  return result;
}

/* -------------------------------------------- */
/*  List helpers (claims, Trouble tracks)       */
/* -------------------------------------------- */

export async function addListEntry(actor, path, entry) {
  const list = foundry.utils.deepClone(foundry.utils.getProperty(actor, path) ?? []);
  list.push({ id: generateRandomId(), ...entry });
  await actor.update({ [path]: list });
}

export async function updateListEntry(actor, path, id, changes) {
  const list = foundry.utils.deepClone(foundry.utils.getProperty(actor, path) ?? []);
  const entry = list.find((e) => e.id === id);
  if (!entry) return null;
  Object.assign(entry, changes);
  await actor.update({ [path]: list });
  return entry;
}

export async function deleteListEntry(actor, path, id) {
  const list = (foundry.utils.getProperty(actor, path) ?? []).filter((e) => e.id !== id);
  await actor.update({ [path]: list });
}

/** Tick (or untick) a Trouble track stored in a list. */
export async function tickListClock(actor, path, id, ticks) {
  const entry = (foundry.utils.getProperty(actor, path) ?? []).find((e) => e.id === id);
  if (!entry) return null;
  const result = advanceClock(entry.value, entry.max, ticks);
  await updateListEntry(actor, path, id, { value: result.value });
  const label = entry.name || loc(entry.type ? labelKey("CC.TroubleType", entry.type) : "CC.Project");
  if (result.filled) await announceFilledClock(actor, label, result.fills);
  return result;
}
