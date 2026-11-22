import {BladesSheet} from "./blades-sheet.js";
import {BladesActiveEffect} from "./blades-active-effect.js";
import {BladesHelpers} from "./blades-helpers.js";
import { enrichHTML } from "./compat.js";
import { DOWNTIME_ACTIVITIES } from "./copperhead-rules.js";
import { addListEntry, assertInnocence, deleteListEntry, getCharacterCrew, getDowntimeAllowance, labelKey, logDowntimeActivity, rollTroubleForClock, tickListClock, updateListEntry } from "./copperhead-automation.js";
import { CLOCK_SIZES } from "./blades-campaign-sheet.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {BladesSheet}
 */
export class BladesActorSheet extends BladesSheet {

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["copperhead-county", "sheet", "actor", "pc"],
            template: "systems/copperhead-county/templates/actor-sheet.html",
            width: 790,
            height: 890,
            tabs: [{navSelector: ".tabs", contentSelector: ".tab-content", initial: "abilities"}]
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

        // Loadout is capped by the approach chosen for the job: Hot 6, Cold 3.
        let loadout = 0;
        sheetData.items.forEach(i => {
            loadout += (i.type === "item") ? parseInt(i.system.load) || 0 : 0;
        });
        sheetData.system.loadout = Math.max(0, loadout);
        sheetData.system.load_max = sheetData.system.approach === "hot" ? 6 : 3;

        sheetData.system.description = await enrichHTML(sheetData.system.description, {
            secrets: sheetData.owner,
            async: true
        });

        // Apply action maxima and any active-effect adjustments.
        sheetData.system.attributes = this.actor.getComputedAttributes();

        // Burnout is derived from the marked conditions, not entered by hand.
        const burnoutConditions = sheetData.system.burnout?.conditions ?? {};
        sheetData.system.burnout.value = Object.values(burnoutConditions).filter(Boolean).length;
        sheetData.burnoutFull = sheetData.system.burnout.value >= (Number(sheetData.system.burnout.max) || 0);
        sheetData.system.stress.max = this.actor.getMaxStress();

        const downtimeUsed = Number(sheetData.system.downtime?.used) || 0;
        const downtimeAllowance = getDowntimeAllowance(this.actor);
        sheetData.downtime = {
            used: downtimeUsed,
            allowance: downtimeAllowance,
            exhausted: downtimeUsed >= downtimeAllowance,
            hasCrew: Boolean(getCharacterCrew(this.actor)),
            activities: DOWNTIME_ACTIVITIES.map((key) => ({ key, label: labelKey("CC.Downtime", key) })),
            rnr: Boolean(sheetData.system.downtime?.rnr),
        };
        sheetData.projects = sheetData.system.projects ?? [];
        sheetData.clockSizes = CLOCK_SIZES;

        return sheetData;
    }

    /** @override **/
    async _onDropItem(event, droppedItem) {
        await super._onDropItem(event, droppedItem);
        if (!this.actor.isOwner) {
            ui.notifications.error(`You do not have sufficient permissions to edit this character. Please speak to your GM if you feel you have reached this message in error.`, {permanent: true});
            return false;
        }
        await this.handleDrop(event, droppedItem);
    }

    /** @override **/
    async _onDropActor(event, droppedActor) {
        await super._onDropActor(event, droppedActor);
        if (!this.actor.isOwner) {
            ui.notifications.error(`You do not have sufficient permissions to edit this character. Please speak to your GM if you feel you have reached this message in error.`, {permanent: true});
            return false;
        }
        await this.handleDrop(event, droppedActor);
    }

    /** @override **/
    async handleDrop(event, droppedEntity) {
        let droppedEntityFull = await fromUuid(droppedEntity.uuid);
        switch (droppedEntityFull.type) {
            case "npc":
                await BladesHelpers.addAcquaintance(this.actor, droppedEntityFull);
                break;
            case "crew":
                await BladesHelpers.addCrew(this.actor, droppedEntityFull);
                break;
            case "item":
                break;
            case "ability":
                break;
            case "class":
                break;
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

        // Remove Crew from character sheet
        html.find('.crew-delete').click(ev => {
            const element = $(ev.currentTarget).parents(".item");
            let crewId = element.data("itemId");
            BladesHelpers.removeCrew(this.actor, crewId);
        });

        // Add custom contact
        html.find('.add-custom-contact').click(() => {
            BladesHelpers.addCustomContact(this.actor);
        });

        html.find('.cc-personal-trouble-roll').click(() => {
            const trouble = this.actor.system.personal_trouble;
            const burnout = Object.values(this.actor.system.burnout?.conditions ?? {}).filter(Boolean).length;
            rollTroubleForClock(this.actor, "system.personal_trouble.value", trouble?.max ?? 6, game.i18n.localize("CC.PersonalTrouble"), { dice: burnout });
        });

        html.find('.cc-downtime-activity').click((ev) => logDowntimeActivity(this.actor, ev.currentTarget.dataset.activity));
        html.find('.cc-downtime-reset').click(() => this.actor.update({ "system.downtime.used": 0, "system.downtime.rnr": false }));
        html.find('.cc-assert-innocence').click(() => assertInnocence(this.actor));

        // Projects
        const PROJECTS = "system.projects";
        const entryId = (ev) => ev.currentTarget.closest("[data-entry-id]")?.dataset.entryId;
        html.find('.cc-add-project').click(() => addListEntry(this.actor, PROJECTS, { name: "", value: 0, max: 8 }));
        html.find('.cc-project-tick').click((ev) => tickListClock(this.actor, PROJECTS, entryId(ev), Number(ev.currentTarget.dataset.ticks) || 0));
        html.find('.cc-project-field').change((ev) => {
            ev.stopPropagation();
            const { field, dtype } = ev.currentTarget.dataset;
            const value = dtype === "Number" ? Number(ev.currentTarget.value) : ev.currentTarget.value;
            const changes = { [field]: value };
            if (field === "max") {
                const entry = (this.actor.system.projects ?? []).find((e) => e.id === entryId(ev));
                changes.value = Math.min(Number(entry?.value) || 0, value);
            }
            updateListEntry(this.actor, PROJECTS, entryId(ev), changes);
        });
        html.find('.cc-project-delete').click((ev) => deleteListEntry(this.actor, PROJECTS, entryId(ev)));

        // Burnout conditions drive the number of marked Burnout boxes.
        html.find('input[name^="system.burnout.conditions."]').change(async () => {
            const conditions = {};
            html.find('input[name^="system.burnout.conditions."]').each((_, input) => {
                const key = input.name.split('.').pop();
                conditions[key] = input.checked;
            });
            await this.actor.update({
                'system.burnout.conditions': conditions,
                'system.burnout.value': Object.values(conditions).filter(Boolean).length
            });
        });

        // Switching approach changes the loadout cap immediately.
        html.find('select[name="system.approach"]').change(async (event) => {
            const approach = event.currentTarget.value;
            await this.actor.update({ 'system.approach': approach });
            this.render(false);
        });

    }

}
