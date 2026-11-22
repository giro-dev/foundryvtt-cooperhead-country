---
type: Architecture
title: Copperhead County system architecture
description: Current architecture, implemented data areas, and source-of-truth locations for the independent Foundry system.
status: draft
tags: [foundry-vtt, copperhead-county, architecture, rules]
sources:
  - id: system-manifest
    resource: "Repository file: system.json"
    title: Foundry system manifest
  - id: actor-data-model
    resource: "Repository file: template.json"
    title: Actor and item data model
  - id: rules-module
    resource: "Repository file: module/copperhead-rules.js and tests/copperhead-rules.test.mjs"
    title: Copperhead rules helpers and tests
  - id: sheets
    resource: "Repository files: templates/actor-sheet.html, templates/crew-sheet.html, templates/campaign-sheet.html; module/blades-actor-sheet.js, module/blades-crew-sheet.js, module/blades-campaign-sheet.js"
    title: Current actor sheet implementation
  - id: rules-reference
    resource: "Repository PDFs: docs/CopperheadCounty.pdf and docs/Copperhead County Sheets 04.23.22.pdf; consult the repository to inspect them. The 2022 sheets are preferred when they conflict with the 2021 corebook."
    title: Copperhead County rule references
---

# Copperhead County system architecture

## Summary

This repository adapts an earlier Blades in the Dark Foundry codebase into an independent system with ID `copperhead-county`, targeting Foundry VTT 14. The active code and configuration define behavior; historical Blades names in module filenames and classes are implementation legacy, not a system dependency.

## Implemented structure

- `system.json` identifies the system and declares Foundry compatibility and the English localization.
- `template.json` defines character, crew, campaign, faction, NPC, clock, and item data. Character actions are grouped under Grit, Gumption, and Grace.
- `module/copperhead-rules.js` contains pure rules helpers for action dice/results, resistance stress, Trouble ticks, and edition-specific Heat profiles.
- Character sheets include Drive, Origin, History, Hot/Cold approach, Cash/Bank, Burnout conditions, injuries, and Personal Trouble. Hot/Cold load caps are 6/3.
- Crew sheets currently expose crew identity, reputation, Tier, Cash, Income, Heat, Raid, downtime profile, a Crew Trouble clock, playbook items, and related content slots.
- The campaign actor sheet currently tracks County Tension, its clock, and notes.
- Chat roll templates are adapted for action and resistance rolls; action ratings determine action dice, and resistance stress equals the lowest die.

## Decisions and limits

- Default to the 2022 playbook sheets where they differ from the 2021 corebook: Trouble criticals mark 5 ticks and Heat uses 0/2/4/6/8. World settings expose the 2021 alternatives (4 Trouble ticks; Heat 0/3/6/9).
- Copperhead worlds are independent; do not automatically migrate Blades in the Dark worlds. The old Blades compendium packs remain in the repository but are not declared as system packs.
- This is a partial implementation. Automated campaign/faction Trouble, claim management, downtime procedures, full Copperhead content packs, and Foundry 14 runtime validation remain incomplete. Do not treat present UI fields as automated rules enforcement.
- Manual text and artwork redistribution permissions have not been established; do not add more source-book text or artwork without verifying rights.

## Revision guidance

Update this entry when the system manifest, data model, stable rules decisions, or implemented sheet scope changes. Recheck claims against the listed repository files and the rule PDFs; the code is authoritative for current runtime behavior. The PDFs are references, not licenses to reproduce their text or artwork.
