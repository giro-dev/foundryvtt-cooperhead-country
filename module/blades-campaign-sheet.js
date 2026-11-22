import { BladesSheet } from "./blades-sheet.js";
import { TROUBLE_TYPES } from "./copperhead-rules.js";
import { addListEntry, deleteListEntry, labelKey, rollTrouble, tickActorClock, tickListClock, updateListEntry } from "./copperhead-automation.js";

const TROUBLES = "system.troubles";
export const CLOCK_SIZES = [4, 6, 8, 10, 12];

export class BladesCampaignSheet extends BladesSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["copperhead-county", "sheet", "actor", "campaign"],
      template: "systems/copperhead-county/templates/campaign-sheet.html",
      width: 620,
      height: 620,
    });
  }

  /** @override */
  async getData(options) {
    const context = await super.getData(options);
    context.editable = this.options.editable;
    context.clockSizes = CLOCK_SIZES;
    context.troubleTypes = TROUBLE_TYPES.map((key) => ({ key, label: labelKey("CC.TroubleType", key) }));
    context.troubles = (this.actor.system.troubles ?? []).map((entry) => ({ ...entry, typeLabel: labelKey("CC.TroubleType", entry.type) }));
    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.options.editable) return;
    const entryId = (ev) => ev.currentTarget.closest("[data-entry-id]")?.dataset.entryId;

    html.find(".cc-tension-tick").click((ev) => {
      const ticks = Number(ev.currentTarget.dataset.ticks) || 1;
      tickActorClock(this.actor, "system.tension_clock", this.actor.system.tension_clock_max, ticks, game.i18n.localize("CC.TensionClock"));
    });
    html.find(".cc-add-trouble").click((ev) => {
      const type = ev.currentTarget.dataset.type;
      addListEntry(this.actor, TROUBLES, { name: "", type, value: 0, max: 6 });
    });
    html.find(".cc-track-tick").click((ev) => tickListClock(this.actor, TROUBLES, entryId(ev), Number(ev.currentTarget.dataset.ticks) || 0));
    html.find(".cc-track-roll").click(async (ev) => {
      const id = entryId(ev);
      const entry = this.actor.system.troubles.find((e) => e.id === id);
      const ticks = await rollTrouble(entry?.name || game.i18n.localize(labelKey("CC.TroubleType", entry?.type ?? "crew")));
      if (ticks !== null) await tickListClock(this.actor, TROUBLES, id, ticks);
    });
    html.find(".cc-entry-field").change((ev) => {
      ev.stopPropagation();
      const { field, dtype } = ev.currentTarget.dataset;
      const value = dtype === "Number" ? Number(ev.currentTarget.value) : ev.currentTarget.value;
      const changes = { [field]: value };
      if (field === "max") {
        const entry = this.actor.system.troubles.find((e) => e.id === entryId(ev));
        changes.value = Math.min(Number(entry?.value) || 0, value);
      }
      updateListEntry(this.actor, TROUBLES, entryId(ev), changes);
    });
    html.find(".cc-entry-delete").click((ev) => deleteListEntry(this.actor, TROUBLES, entryId(ev)));
  }
}
