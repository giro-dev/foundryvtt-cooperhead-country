import { renderHandlebarsTemplate as renderTemplate } from "./compat.js";
import { openFormDialog } from "./lib/dialog-compat.js";
import { getResistanceStress } from "./copperhead-rules.js";

/**
 * Roll Dice.
 * @param {int} dice_amount
 * @param {string} attribute_name
 * @param {string} position
 * @param {string} effect
 */
export async function bladesRoll(dice_amount, attribute_name = "", position = "risky", effect = "standard", note = "", current_stress, current_crew_tier) {

  // ChatMessage.getSpeaker(controlledToken)
  let zeromode = false;

  if ( dice_amount < 0 ) { dice_amount = 0; }
  if ( dice_amount === 0 ) { zeromode = true; dice_amount = 2; }

	let r = new Roll( `${dice_amount}d6`, {} );

	// show 3d Dice so Nice if enabled
	await r.evaluate();
	await showChatRollMessage(r, zeromode, attribute_name, position, effect, note, current_stress, current_crew_tier);

}

/**
 * Shows Chat message.
 *
 * @param {Roll} r
 * @param {Boolean} zeromode
 * @param {String} attribute_name
 * @param {string} position
 * @param {string} effect
 */
async function showChatRollMessage(r, zeromode, attribute_name = "", position = "", effect = "", note = "", current_stress, current_crew_tier) {
  let speaker = ChatMessage.getSpeaker();
  let rolls = (r.terms)[0].results;
  let attribute_label = BladesHelpers.getRollLabel(attribute_name);

  // Retrieve Roll status.
  let roll_status = getBladesRollStatus(rolls, zeromode);
  let edge = false;
  if (roll_status == 'critical-success') {edge = true;}

  let result;
  
  // Check and log if Dice Configuration is Manual
  let method = {};
  method.type = (r.terms)[0].method;
  if( method.type ) {
    method.icon = CONFIG.Dice.fulfillment.methods[method.type].icon;
    method.label = CONFIG.Dice.fulfillment.methods[method.type].label;
  }

  if (BladesHelpers.isAttributeAction(attribute_name)) {
    let position_localize = '';
    switch (position) {
      case 'controlled':
        position_localize = 'BITD.PositionControlled'
        break;
      case 'desperate':
        position_localize = 'BITD.PositionDesperate'
        break;
      case 'risky':
      default:
        position_localize = 'BITD.PositionRisky'
    }

    let effect_localize = '';
    switch (effect) {
      case 'limited':
        effect_localize = 'BITD.EffectLimited'
        break;
      case 'great':
        effect_localize = 'BITD.EffectGreat'
        break;
      case 'standard':
      default:
        effect_localize = 'BITD.EffectStandard'
    }

    result = await renderTemplate("systems/copperhead-county/templates/chat/action-roll.html", {rolls: rolls, zeromode: zeromode, method: method, roll_status: roll_status, attribute_label: attribute_label, position: position, position_localize: position_localize, effect: effect, effect_localize: effect_localize, note: note, edge: edge});
  }
  // Check for Resistance roll
  else if (BladesHelpers.isAttributeAttribute(attribute_name)) {
    let stress = getBladesRollStress(rolls, zeromode);
    result = await renderTemplate("systems/copperhead-county/templates/chat/resistance-roll.html", {rolls: rolls, zeromode: zeromode, method: method, roll_status: roll_status, attribute_label: attribute_label, stress: stress, note: note, edge: edge});
  }
  // Check for Gather Information roll
  else if (attribute_name == 'BITD.GatherInformation') {
    result = await renderTemplate("systems/copperhead-county/templates/chat/gather-info-roll.html", {rolls: rolls, zeromode: zeromode, method: method, roll_status: roll_status, attribute_label: attribute_label, note: note, edge: edge});
  }
  // Check for Engagement roll
  else if (attribute_name == 'BITD.Engagement') {
    result = await renderTemplate("systems/copperhead-county/templates/chat/engagement-roll.html", {rolls: rolls, zeromode: zeromode, method: method, roll_status: roll_status, attribute_label: attribute_label, note: note, edge: edge});
  }
  // Fortune roll if not specified
  else {
    result = await renderTemplate("systems/copperhead-county/templates/chat/fortune-roll.html", {rolls: rolls, zeromode: zeromode, method: method, roll_status: roll_status, attribute_label: "BITD.Fortune", note: note, edge: edge});
  }

  let messageData;
  if (game.version >= 12) {
	  messageData = {
		speaker: speaker,
		content: result,
		rolls: [r]
	}
  } else {
	  messageData = {
		speaker: speaker,
		content: result,
		type: CONST.CHAT_MESSAGE_TYPES.ROLL,
		rolls: [r]
	}
  }

  ChatMessage.create(messageData);
}

/**
 * Get status of the Roll.
 *  - failure
 *  - partial-success
 *  - success
 *  - critical-success
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollStatus(rolls, zeromode = false) {

  // Sort roll values from lowest to highest.
  let sorted_rolls = rolls.map(i => i.result).sort();

  let roll_status = "failure"

  if (sorted_rolls[0] === 6 && zeromode) {
    roll_status = "success";
  }
  else {
    let use_die;
    let prev_use_die = false;

    if (zeromode) {
      use_die = sorted_rolls[0];
    }
    else {
      use_die = sorted_rolls[sorted_rolls.length - 1];

      if (sorted_rolls.length - 2 >= 0) {
        prev_use_die = sorted_rolls[sorted_rolls.length - 2]
      }
    }

    // 1,2,3 = failure
    if (use_die <= 3) {
      roll_status = "failure";
    }
    // if 6 - check the prev highest one.
    else if (use_die === 6) {
      // 6,6 - critical success
      if (prev_use_die && prev_use_die === 6) {
        roll_status = "critical-success";
      }
      // 6 - success
      else {
        roll_status = "success";
      }
    }
    // else (4,5) = partial success
    else {
      roll_status = "partial-success";
    }

  }

  return roll_status;

}
/**
 * Get stress of the Roll.
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollStress(rolls, zeromode = false) {
  const dice = rolls.map((die) => die.result);
  return getResistanceStress(dice, zeromode ? dice : null);

}

/**
 * Get stress cleared with a Vice Roll.
 * @param {Array} rolls
 * @param {Boolean} zeromode
 */
export function getBladesRollVice(rolls, zeromode = false) {
  // Sort roll values from lowest to highest.
  let sorted_rolls = rolls.map(i => i.result).sort();
  let use_die;

  if (zeromode) {
    use_die = sorted_rolls[0];
  }
  else {
    use_die = sorted_rolls[sorted_rolls.length - 1];
  }

  return use_die;

}


/**
 * Call a Roll popup.
 */
export async function simpleRollPopup() {
  const content = `
      <h2>${game.i18n.localize("BITD.RollSomeDice")}</h2>
      <form class="bitd-simple-roll-dialog">
        <div class="form-group">
          <label>${game.i18n.localize("BITD.RollNumberOfDice")}:</label>
          <select id="qty" name="qty">
            ${Array(11).fill().map((item, i) => `<option value="${i}">${i}d</option>`).join('')}
          </select>
        </div>
        <fieldset class="form-group">
          <legend>Roll Types</legend>
          <div style="display:grid; grid-template-columns:auto auto auto; column-gap:0.5em; row-gap:0.4em; align-items:center;">
            <label><input type="radio" id="fortune" name="rollSelection" value="fortune" checked=true> ${game.i18n.localize("BITD.Fortune")}</label>
            <span style="grid-column:2 / 4;"></span>
            <label><input type="radio" id="gatherInfo" name="rollSelection" value="gatherInfo"> ${game.i18n.localize("BITD.GatherInformation")}</label>
            <span style="grid-column:2 / 4;"></span>
            <label><input type="radio" id="engagement" name="rollSelection" value="engagement"> ${game.i18n.localize("BITD.Engagement")}</label>
            <span style="grid-column:2 / 4;"></span>
          </div>
        </fieldset>
        <div className="form-group">
          <label>${game.i18n.localize('BITD.Notes')}:</label>
          <input id="note" name="note" type="text" value="">
        </div><br/>
      </form>
    `;

  const formResult = await openFormDialog({
    title: `Simple Roll`,
    content,
    okLabel: `Roll`,
    cancelLabel: game.i18n.localize('Cancel'),
  });

  if (!formResult) {
    return;
  }

  let diceQty = Number(formResult.qty ?? 0) || 0;
  const note = formResult.note ?? "";
  const selection = formResult.rollSelection ?? "fortune";

  switch (selection) {
    case 'gatherInfo':
      await bladesRoll(diceQty,"BITD.GatherInformation","","",note,"");
      break;
    case 'engagement':
      await bladesRoll(diceQty,"BITD.Engagement","","",note,"");
      break;
    default:
      await bladesRoll(diceQty,"","","",note,"");
      break;
  }
}
