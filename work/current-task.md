# Traspàs de feina

Actualitzat: 2026-11-22. Aquest resum és context provisional, no una autorització per ampliar l'abast. Contrasta'l amb l'estat actual del repositori i amb les instruccions de la persona.

## Objectiu i abast

Implementar un sistema Foundry VTT independent per a *Copperhead County*, adaptant el codi existent de Blades in the Dark sense convertir automàticament mons Blades. Objectiu: Foundry VTT 14; compatibilitat anterior només si no complica el desenvolupament. Prioritzar les fitxes de 2022 i oferir opcions on difereixin del llibre de 2021. No redistribuir text ni art dels manuals sense verificar-ne els permisos.

## Pla original aprovat i decisions

La persona va aprovar començar i després continuar. Pla per fases:

1. Separar identitat, configuració i dades del sistema respecte de Blades.
2. Adaptar les regles i fitxa de personatge: accions/atributs, tirades, resistència, Burnout, lesions, càrrega i finances.
3. Adaptar crew i sistemes de campanya: Heat, Trouble, Raid, County Tension, claims, faccions i cohorts.
4. Implementar procediments de downtime i fluxos restants; revisar i crear contingut/compendis propis només amb permisos clars.
5. Validar amb Foundry 14 i corregir errors funcionals/de presentació.

Decisions acordades i encara vigents:

- ID del sistema `copperhead-county`; no migrar mons Blades automàticament.
- Per defecte, Trouble crític = 5 ticks i Heat 2022 = 0/2/4/6/8. Configuració mundial ofereix 2021: 4 ticks i Heat 0/3/6/9.
- Dotze accions en Grit, Gumption i Grace; màxim de rating 4.
- L'estrès de resistència és el resultat del dau més baix, substituint `6 - highest` de Blades.
- No declarar els packs antics de Blades al manifest del sistema. Directoris antics encara presents al repositori no són contingut Copperhead aprovat.

## Estat actual

### Feina executada

- `system.json`: sistema independent, Foundry mínim 14, només idioma anglès declarat i sense packs Blades declarats.
- `template.json`: dades Copperhead de personatge i crew, i model bàsic de campanya County Tension; conserva camps legacy que encara poden ser requerits per components existents.
- `module/copperhead-rules.js` i `tests/copperhead-rules.test.mjs`: helpers purs i cinc proves de regles.
- Fitxa de personatge i `module/blades-actor-sheet.js`: Drive, Origin, History, Looks/Pronouns, Hot/Cold, límit de càrrega 6/3, Cash/Bank, Burnout, lesions i Personal Trouble.
- Tirades: accions basades en rating d'acció, resistència pel dau més baix; s'han tret opcions de Vice, Threat, Edge i Acquire Asset de les interfícies de tirada adaptades.
- Fitxa de crew: reputació/Tier, Cash, Income, Heat, Raid, perfil de downtime, rellotge Crew Trouble, playbook i espais de contingut relacionat.
- Afegits `module/blades-campaign-sheet.js` i `templates/campaign-sheet.html` per a County Tension, el rellotge i notes.
- CSS namespace i localització anglesa adaptats; README i `knowledge/architecture/copperhead-system.md` actualitzats.

### Validació executada

- `just test`: 31 passats, 3 omesos perquè PowerShell no és disponible.
- Proves Node `node --experimental-default-type=module --test tests/copperhead-rules.test.mjs`: 5/5 passades.
- Sintaxi de tots els mòduls JS, JSON de manifest/model/localització i `git diff --check`: passats a l'última validació.
- Auditoria de claus `CC.*` usades a templates: sense claus absents.

### Revisió posterior (correccions)

- Resistència: el pool és el rating d'atribut (accions amb almenys un punt + bonus), no només el bonus.
- Tirades 0d: es llegeix el dau més baix i no poden ser crítiques (`getRollResult(..., { zeroDice: true })`).
- Tirada de Trouble al Dice Roller amb ticks segons el setting `troubleCriticalTicks`.
- Nivell de Heat a la fitxa de crew segons el setting `heatProfile` (`getHeatLevel`).
- Burnout: els "teeth" reflecteixen les condicions marcades i no se'n poden marcar més que `burnout.max`.
- Bugs: ids de rellotges amb `}` sobrant, `createListOfActions` començava amb `undefined`, `multiboxes` depenia de `RegExp.escape`, `getData` async sense `await`.
- CI `.github/workflows/test.yml`: tests de regles, sintaxi JS, JSON i compilació de plantilles Handlebars.

### Pendents, ordre suggerit

1. **Smoke test Foundry 14** (bloquejat fins a disposar d'instància): crear personatge/crew/campaign, obrir fitxes, guardar camps i rellotges, fer tirada d'acció i resistència, verificar Burnout/lesions i canviar approach.
2. **Revisar contractes de dades i plantilles**: confirmar especialment formularis d'arrays d'injuries/clock, codi de sheet Foundry 14, lògica de perfil low/high i coherència dels models crew/campaign contra PDF i fulls 2022.
3. **Campanya/faccions**: Trouble personal/crew/police/faction, clocks de facció, County Tension clock i conseqüències; ara només hi ha camps/clocks bàsics, no automatització ni tracker complet.
4. **Claims/crew**: modelar categories, presents/controlats, income/profit, Turf/Tier i upgrades amb les dades Copperhead en lloc de dependre de crew items heretats de Blades.
5. **Downtime**: perfils Low/High i límits d'activitats, Buy Stuff, R&R, Project, Put in Work, Recover, Income/Wrap-Up i procediments de Raid/arrest.
6. **Contingut i llicències**: revisar drets abans d'afegir text/art/compendis; substituir els packs Blades no aptes per contingut propi autoritzat.
7. Reexecutar validacions i revisar el diff abans de donar per acabada cada fase.

## Problemes o riscos coneguts

- No s'ha pogut provar en Foundry VTT 14; comprovacions de sintaxi i unitàries no garanteixen renderització Handlebars ni cicle de vida de documents.
- El crew sheet reutilitza subsistemes/items de la base Blades; poden quedar referències de regles i dades que requereixin adaptació.
- La configuració de Heat/Trouble existeix, però no hi ha encara flux complet de resolució de feina/downtime.
- Permisos de redistribució de text i art dels manuals no verificats.
- Els canvis del projecte són al working tree i no estan commitats; hi ha també fitxers untracked del harness. No descartar ni netejar canvis aliens.

## Següent pas i preguntes pendents

Primer, completar la revisió de coherència del codi i després smoke test quan hi hagi Foundry 14. Si s'implementa una fase que canviï l'experiència o el model de dades (especialment claims/downtime), refinar els criteris amb la persona i obtenir aprovació del pla concret abans d'editar. No afegir contingut publicable de manuals sense confirmació de permisos.

Fonts de treball: `knowledge/architecture/copperhead-system.md`; `system.json`; `template.json`; `module/copperhead-rules.js`; `templates/`; `docs/CopperheadCounty.pdf`; `docs/Copperhead County Sheets 04.23.22.pdf`. Els PDFs són referències locals i no concedeixen drets de reproducció.
