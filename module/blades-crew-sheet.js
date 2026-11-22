import { BladesSheet } from "./blades-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { BladesHelpers } from "./blades-helpers.js";
import { CLAIM_STATUSES, getHeatLevel, summarizeClaims } from "./copperhead-rules.js";
import { addListEntry, deleteListEntry, labelKey, rollTroubleForClock, startDowntime, updateListEntry } from "./copperhead-automation.js";

const CLAIMS = "system.claims";

/**
 * @extends {BladesSheet}
 */
export class BladesCrewSheet extends BladesSheet {

  /** @override */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["copperhead-county", "sheet", "actor", "crew"],
      template: "systems/copperhead-county/templates/crew-sheet.html",
      width: 940,
      height: 940,
      tabs: [{navSelector: ".tabs", contentSelector: ".tab-content", initial: "claims"}]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  async getData(options) {
    const superData = await super.getData(options);
    const sheetData = superData.data;
    sheetData.owner = superData.owner;
    sheetData.editable = superData.editable;
    sheetData.isGM = game.user.isGM;
	
    // Prepare active effects
    sheetData.effects = BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects);

    // Calculate Turfs amount.
    let turfs_amount = 0;
	let turfs_max = sheetData.system.turf.max;

    sheetData.items.forEach(item => {

      if (item.type === "crew_type") {
        Object.entries(item.system.turfs).forEach(([key, turf]) => {
          if (turf.name === 'BITD.Turf') {
            turfs_amount += (turf.value === true) ? 1 : 0;
          }
        });
      }

    });
	
	turfs_amount = turfs_amount + sheetData.system.turf.bonus;
	if (turfs_amount > turfs_max) {turfs_amount = turfs_max;};
    sheetData.system.turfs_amount = turfs_amount;

    const heatProfile = game.settings.get("copperhead-county", "heatProfile");
    sheetData.heatLevel = getHeatLevel(sheetData.system.heat, heatProfile);

    sheetData.claims = sheetData.system.claims ?? [];
    sheetData.claimsSummary = summarizeClaims(sheetData.claims);
    sheetData.claimStatuses = CLAIM_STATUSES.map((key) => ({ key, label: labelKey("CC.Claim", key) }));
	
	//return data
    return sheetData;
	
  }
  
  /** @override **/
  async _onDropActor(event, droppedActor){
    await super._onDropActor(event, droppedActor);
    if (!this.actor.isOwner) {
      ui.notifications.error(`You do not have sufficient permissions to edit this character. Please speak to your GM if you feel you have reached this message in error.`, {permanent: true});
      return false;
    }
    await this.handleDrop(event, droppedActor);
  }  
  
  /** @override **/
  async handleDrop(event, droppedEntity){
    let droppedEntityFull = await fromUuid(droppedEntity.uuid);
    switch (droppedEntityFull.type) {
      case "npc":
        await BladesHelpers.addAcquaintance(this.actor, droppedEntityFull);
        break;
      case "item":
        break;
      case "crew_type":
        break;
      case "ability":
        break;
      case "class":
        break ;
      default:
        break;
    }
  }
  /* -------------------------------------------- */

  /** @override */
	activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Add Crew Type
    html.find(".crew-class").click(this._onItemAddClick.bind(this));

    // Add a new Cohort
    html.find('.add-item').click(ev => {
      BladesHelpers._addOwnedItem(ev, this.actor);
    });

    // Toggle Turf
    html.find('.turf-select').click( async ev => {
      const element = $(ev.currentTarget).parents(".item");

      let item_id = element.data("itemId")
      let turf_id = $(ev.currentTarget).data("turfId");
      let turf_current_status = $(ev.currentTarget).data("turfStatus");
      let turf_checkbox_name = 'system.turfs.' + turf_id + '.value';

      await this.actor.updateEmbeddedDocuments('Item', [{
        _id: item_id,
        [turf_checkbox_name]: !turf_current_status}]);
      this.render(false);
    });

    // Cohort Block Harm handler
    html.find('.cohort-block-harm input[type="radio"]').change( async ev => {
      const element = $(ev.currentTarget).parents(".item");

      let item_id = element.data("itemId")
      let harm_id = $(ev.currentTarget).val();

      await this.actor.updateEmbeddedDocuments('Item', [{
        _id: item_id,
        "system.harm": [harm_id]}]);
      this.render(false);
    });

    // Add custom contact
    html.find('.add-custom-contact').click(() => {
      BladesHelpers.addCustomContact(this.actor);
    });

    html.find('.cc-crew-trouble-roll').click(() => {
      rollTroubleForClock(this.actor, "system.trouble_clock", this.actor.system.trouble_clock_max, game.i18n.localize("CC.CrewTrouble"));
    });

    html.find('.cc-start-downtime').click(() => startDowntime(this.actor));

    // Claims
    const entryId = (ev) => ev.currentTarget.closest("[data-entry-id]")?.dataset.entryId;
    html.find('.cc-add-claim').click(() => addListEntry(this.actor, CLAIMS, { name: "", category: "", status: "present", notes: "" }));
    html.find('.cc-claim-field').change((ev) => {
      ev.stopPropagation();
      updateListEntry(this.actor, CLAIMS, entryId(ev), { [ev.currentTarget.dataset.field]: ev.currentTarget.value });
    });
    html.find('.cc-claim-delete').click((ev) => deleteListEntry(this.actor, CLAIMS, entryId(ev)));

  }


  /* -------------------------------------------- */
  /*  Form Submission                             */
	/* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {

    // Update the Item
    await super._updateObject(event, formData);

    if (event.target && event.target.name === "system.tier") {
      this.render(true);
    }
  }
  /* -------------------------------------------- */

}
