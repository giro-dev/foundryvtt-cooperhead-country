import { bladesRoll } from "./blades-roll.js";
import { BladesHelpers } from "./blades-helpers.js";
import { openFormDialog } from "./lib/dialog-compat.js";
import { getAttributeRating } from "./copperhead-rules.js";

/**
 * Extend the basic Actor
 * @extends {Actor}
 */
export class BladesActor extends Actor {

  /** @override */
  static async create(data, options={}) {

    data.prototypeToken = data.prototypeToken || {};

    // For Crew and Character set the Token to sync with charsheet.
    switch (data.type) {
      case 'character':
      case 'crew':
      case '\uD83D\uDD5B clock':
	  case 'npc':
	  case 'factions':
        data.prototypeToken.actorLink = true;
        break;
    }

    return super.create(data, options);
  }

  /** @override */
  getRollData() {
    const rollData = super.getRollData();

    rollData.dice_amount = this.getAttributeDiceToThrow();

    return rollData;
  }

  /* -------------------------------------------- */
  /**
   * Calculate Attribute Dice to throw.
   */
  getAttributeDiceToThrow() {

    // Action rolls use the action rating; resistance rolls use the attribute
    // rating (actions with at least one dot, plus any bonus).
    let dice_amount = {};

    for (var attribute_name in this.system.attributes) {
      dice_amount[attribute_name] = getAttributeRating(this.system.attributes, attribute_name);
      for (var skill_name in this.system.attributes[attribute_name].skills) {
        dice_amount[skill_name] = parseInt(this.system.attributes[attribute_name].skills[skill_name]['value']) || 0;
      }
    }

    return dice_amount;
  }

  /* -------------------------------------------- */

  _getCrewActor() {
    const crewInfo = this.system?.crew?.[0];
    if (!crewInfo?.id) return null;
    const crewActor = game.actors.get(crewInfo.id);
    return crewActor ?? null;
  }

  /* -------------------------------------------- */

  async rollAttributePopup(attribute_name, defaultDice = 0) {

    // const roll = new Roll("1d20 + @abilities.wis.mod", actor.getRollData());
    let attribute_label = BladesHelpers.getRollLabel(attribute_name);

    const sanitizedDefaultDice = (() => {
      const numeric = Number(defaultDice);
      if (Number.isNaN(numeric)) return 0;
      return Math.max(0, Math.min(Math.floor(numeric), 10));
    })();

    let content = `
        <h2>${game.i18n.localize('BITD.Roll')} ${game.i18n.localize(attribute_label)}</h2>
        <form class="bitd-roll-dialog">
          <div class="form-group">
            <label>${game.i18n.localize('BITD.Modifier')}:</label>
            <select id="mod" name="mod">
              ${this.createListOfDiceMods(-3,+3,0)}
            </select>
          </div>`;
    if (BladesHelpers.isAttributeAction(attribute_name)) {
      content += `
        <fieldset class="form-group" style="display:grid; gap:0.5em;">
          <legend>${game.i18n.localize("BITD.RollType")}</legend>
          <div style="display:grid; grid-template-columns:auto auto auto; gap:0.5em 1em; align-items:center;">
            <label><input type="radio" id="actionRoll" name="rollSelection" value="actionRoll" checked> ${game.i18n.localize("BITD.ActionRoll")}</label>
            <span><label>${game.i18n.localize('BITD.Position')}:</label> <select id="pos" name="pos"><option value="controlled">${game.i18n.localize('BITD.PositionControlled')}</option><option value="risky" selected>${game.i18n.localize('BITD.PositionRisky')}</option><option value="desperate">${game.i18n.localize('BITD.PositionDesperate')}</option></select></span>
            <span><label>${game.i18n.localize('BITD.Effect')}:</label> <select id="fx" name="fx"><option value="limited">${game.i18n.localize('BITD.EffectLimited')}</option><option value="standard" selected>${game.i18n.localize('BITD.EffectStandard')}</option><option value="great">${game.i18n.localize('BITD.EffectGreat')}</option></select></span>
          </div>
          <div style="display:grid; grid-template-columns:auto auto auto; column-gap:0.5em; row-gap:0.4em; align-items:center;">
            <label><input type="radio" id="fortune" name="rollSelection" value="fortune"> ${game.i18n.localize("BITD.Fortune")}</label>
            <span style="grid-column:2 / 4;"></span>
            <label><input type="radio" id="gatherInfo" name="rollSelection" value="gatherInfo"> ${game.i18n.localize("BITD.GatherInformation")}</label>
            <span style="grid-column:2 / 4;"></span>
            <label><input type="radio" id="engagement" name="rollSelection" value="engagement"> ${game.i18n.localize("BITD.Engagement")}</label>
            <label style="margin:0; justify-self:end; white-space:nowrap;">${game.i18n.localize("BITD.RollNumberOfDice")}:</label>
            <select id="qty" name="qty" style="width:auto; min-width:4.5em; justify-self:start;">${Array.from({ length: 11 }, (_, i) => { const selected = i === sanitizedDefaultDice ? " selected" : ""; return `<option value="${i}"${selected}>${i}d</option>`; }).join("")}</select>
          </div>
        </fieldset>
            `;
      } else {
        content += `
            <input id="pos" name="pos" type="hidden" value="">
            <input id="fx" name="fx" type="hidden" value="">`;
    }
    content += `
        <div className="form-group">
          <label>${game.i18n.localize('BITD.Notes')}:</label>
          <input id="note" name="note" type="text" value="">
        </div><br/>
       </form>
      `;
    const dialogResult = await openFormDialog({
      title: `${game.i18n.localize('BITD.Roll')} ${game.i18n.localize(attribute_label)}`,
      content,
      okLabel: game.i18n.localize('BITD.Roll'),
      cancelLabel: game.i18n.localize('Close'),
      defaultButton: "ok",
    });

    if (!dialogResult) {
      return;
    }

    const modifier = Number(dialogResult.mod ?? 0) || 0;
    const note = dialogResult.note ?? "";
    const rollData = this.getRollData();
    const actionDiceAmount = rollData.dice_amount[attribute_name] + modifier;

    if (!BladesHelpers.isAttributeAction(attribute_name)) {
      await this.rollAttribute(attribute_name, modifier, "", "", note);
      return;
    }

    const rollSelection = dialogResult.rollSelection ?? "actionRoll";
    const effect = dialogResult.fx ?? "standard";
    const position = dialogResult.pos ?? "risky";

    switch (rollSelection) {
      case "actionRoll":
        await this.rollAttribute(attribute_name, modifier, position, effect, note);
        break;
      case "fortune":
        await bladesRoll(actionDiceAmount, "BITD.Fortune", "", "", note, "");
        break;
      case "gatherInfo":
        await bladesRoll(actionDiceAmount, "BITD.GatherInformation", "", "", note, "");
        break;
      case "engagement": {
        const engagementDice = Number(dialogResult.qty ?? sanitizedDefaultDice) || 0;
        await bladesRoll(engagementDice, "BITD.Engagement", "", "", note, "");
        break;
      }
      default:
        await this.rollAttribute(attribute_name, modifier, position, effect, note);
        break;
    }

  }

  /* -------------------------------------------- */

  async rollAttribute(attribute_name = "", additional_dice_amount = 0, position, effect, note) {

    let dice_amount = 0;
    if (attribute_name !== "") {
      let roll_data = this.getRollData();
      dice_amount += roll_data.dice_amount[attribute_name];
    }
    else {
      dice_amount = 1;
    }
    dice_amount += additional_dice_amount;

    await bladesRoll(dice_amount, attribute_name, position, effect, note, this.system.stress.value);
  }


  /* -------------------------------------------- */

  /**
   * Create <options> for available actions
   *  which can be performed.
   */
  createListOfActions() {

    let text = "", attribute, skill;
    let attributes = this.system.attributes;

    for ( attribute in attributes ) {

      const skills = attributes[attribute].skills;

      text += `<optgroup label="${attribute} Actions">`;
      text += `<option value="${attribute}">${attribute} (Resist)</option>`;

      for ( skill in skills ) {
        text += `<option value="${skill}">${skill}</option>`;
      }

      text += `</optgroup>`;

    }

    return text;

  }

  /* -------------------------------------------- */

  /**
   * Creates <options> modifiers for dice roll.
   *
   * @param {int} rs
   *  Min die modifier
   * @param {int} re
   *  Max die modifier
   * @param {int} s
   *  Selected die
   */
  createListOfDiceMods(rs, re, s) {

    var text = ``;
    var i = 0;

    if ( s == "" ) {
      s = 0;
    }

    for ( i  = rs; i <= re; i++ ) {
      var plus = "";
      if ( i >= 0 ) { plus = "+" };
      text += `<option value="${i}"`;
      if ( i == s ) {
        text += ` selected`;
      }

      text += `>${plus}${i}d</option>`;
    }

    return text;

  }

  /* -------------------------------------------- */
  getComputedAttributes() {
    let attributes = this.system.attributes;
    for( const a in attributes ) {
      for( const s in attributes[a].skills ) {
        if (attributes[a].skills[s].max === undefined) attributes[a].skills[s].max = 4;
		
		//include Active Effect alterations to skill minimums
        if( attributes[a].skills[s].value <= attributes[a].skills[s].min ) { 
          attributes[a].skills[s].value = attributes[a].skills[s].min;
        }
      }
    }
    //check for mastery
    if (this.getHasMastery()) {
      for( const b in attributes ) {
        for( const t in attributes[b].skills ) {
          if (attributes[b].skills[t].max === 3) {
            attributes[b].skills[t].max = 4;
          }
        }
      }
    }
    return attributes;
  }

  getMaxStress() {
    let max_stress = this.system.stress.max;
    const crew_actor = this._getCrewActor();
    if (crew_actor) {
      const bonus = Number(crew_actor?.system?.scoundrel?.add_stress);
      if (Number.isFinite(bonus)) {
        max_stress += bonus;
      }
    }
    return max_stress;
  }

  getMaxTrauma() {
    let max_trauma = this.system.trauma.max;
    const crew_actor = this._getCrewActor();
    if (crew_actor) {
      const bonus = Number(crew_actor?.system?.scoundrel?.add_trauma);
      if (Number.isFinite(bonus)) {
        max_trauma += bonus;
      }
    }
    return max_trauma;
  }

  getHasMastery(){
    const crew_actor = this._getCrewActor();
    if (!crew_actor) {
      return false;
    }
    return Boolean(crew_actor?.system?.scoundrel?.mastery);
  }
  
  getHealingMin(){
	let current_healing = parseInt(this.system.healing_clock.value);
	if (current_healing < this.system.healing_clock.min) {
		current_healing = this.system.healing_clock.min;
	}
	return current_healing;
  }

	
}
