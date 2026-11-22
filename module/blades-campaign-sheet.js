import { BladesSheet } from "./blades-sheet.js";

export class BladesCampaignSheet extends BladesSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["copperhead-county", "sheet", "actor", "campaign"],
      template: "systems/copperhead-county/templates/campaign-sheet.html",
      width: 620,
      height: 520,
    });
  }
}
