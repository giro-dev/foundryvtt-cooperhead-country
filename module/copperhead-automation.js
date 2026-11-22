import { bladesRoll } from "./blades-roll.js";
import { generateRandomId } from "./compat.js";
import { openFormDialog } from "./lib/dialog-compat.js";
import { advanceClock, getDowntimeActivities, getTroubleTicks } from "./copperhead-rules.js";

const SYSTEM_ID = "copperhead-county";

const capitalize = (key) => key.charAt(0).toUpperCase() + key.slice(1);
export const labelKey = (prefix, key) => `${prefix}${capitalize(key)}`;

function escapeHtml(value) {
  return foundry.utils.escapeHTML?.(String(value ?? "")) ?? String(value ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function postChat(actor, content) {
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content });
}

/** Ask for a dice pool and roll a Trouble roll. Returns the rolled ticks, or null if cancelled. */
export async function rollTrouble(label) {
  const options = [0, 1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n === 2 ? "selected" : ""}>${n}d</option>`).join("");
  const form = await openFormDialog({
    title: `${game.i18n.localize("CC.TroubleRoll")}: ${label}`,
    content: `<form><div class="form-group"><label>${game.i18n.localize("BITD.RollNumberOfDice")}</label><select name="qty">${options}</select></div></form>`,
    okLabel: game.i18n.localize("BITD.Roll"),
    cancelLabel: game.i18n.localize("Cancel"),
  });
  if (!form) return null;
  const { status } = await bladesRoll(Number(form.qty) || 0, "CC.TroubleRoll", "", "", label);
  return getTroubleTicks(status, game.settings.get(SYSTEM_ID, "troubleCriticalTicks"));
}

/** Advance a clock stored at `path` on `actor`, posting a notice when it fills. */
export async function tickActorClock(actor, path, max, ticks, label) {
  const result = advanceClock(foundry.utils.getProperty(actor, path), max, ticks);
  await actor.update({ [path]: result.value });
  if (result.filled) await announceFilledClock(actor, label);
  return result;
}

export async function announceFilledClock(actor, label) {
  return postChat(actor, `<p><strong>${escapeHtml(label)}</strong>: ${game.i18n.localize("CC.ClockFilled")}</p>`);
}

/** Roll Trouble and tick the clock at `path`. */
export async function rollTroubleForClock(actor, path, max, label) {
  const ticks = await rollTrouble(label);
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

export async function logDowntimeActivity(actor, activity) {
  const downtime = actor.system.downtime ?? {};
  const used = Number(downtime.used) || 0;
  const allowance = getDowntimeAllowance(actor);
  if (used >= allowance) {
    ui.notifications.warn(game.i18n.localize("CC.DowntimeNoActivities"));
    return;
  }
  const label = game.i18n.localize(labelKey("CC.Downtime", activity));
  await actor.update({ "system.downtime.used": used + 1 });
  await postChat(actor, `<p>${game.i18n.format("CC.DowntimeActivityTaken", { name: escapeHtml(actor.name), activity: label, used: used + 1, allowance })}</p>`);
}

export function getCrewMembers(crew) {
  return game.actors.filter((actor) => actor.type === "character" && actor.system?.crew?.some((entry) => entry.id === crew.id));
}

/** Reset downtime activity counters for every member of the crew. */
export async function startDowntime(crew) {
  const members = getCrewMembers(crew);
  for (const member of members) await member.update({ "system.downtime.used": 0 });
  const allowance = getDowntimeActivities(crew.system.profile);
  const profile = game.i18n.localize(crew.system.profile === "high" ? "CC.ProfileHigh" : "CC.ProfileLow");
  const names = members.map((m) => escapeHtml(m.name)).join(", ") || "—";
  await postChat(crew, `<p>${game.i18n.format("CC.DowntimeStarted", { crew: escapeHtml(crew.name), profile, allowance })}</p><p>${names}</p>`);
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
  if (result.filled) await announceFilledClock(actor, entry.name || game.i18n.localize(labelKey("CC.TroubleType", entry.type)));
  return result;
}
