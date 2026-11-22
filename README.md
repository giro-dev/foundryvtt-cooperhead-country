# Copperhead County for Foundry VTT

An independent Foundry VTT system based on the Forged in the Dark rules used by
*Copperhead County*. The initial implementation targets Foundry VTT 14.

## Status

This system is under active development. Character sheets, core crew fields, and a
basic County Tension tracker are adapted. Automated claim management, faction Trouble,
downtime procedures, Copperhead content packs, and complete Foundry 14 runtime
workflows are not yet implemented. Do not use it for an active campaign yet.

The default rule options follow the 2022 character sheets. World settings allow
choosing the 2021 corebook variant for Trouble critical ticks and Heat thresholds.

## Development checks

```sh
node --experimental-default-type=module --test tests/copperhead-rules.test.mjs
```

## Acknowledgements

The original Foundry implementation this project builds on was developed by
Megastruktur, Drew G., Justin Ross, and Dez384. *Copperhead County* is designed
by Jason Eley, with additional writing, editing, and design by Michael Crowley.
The game is based on *Blades in the Dark*, by John Harper, under the Creative
Commons Attribution 3.0 Unported license. See `LICENSE.txt` and `docs/` for the
included source materials and their respective notices.
