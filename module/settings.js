export const registerSystemSettings = function() {

  game.settings.register("copperhead-county", "troubleCriticalTicks", {
    name: "Copperhead County | Critical Trouble ticks",
    hint: "The 2021 corebook uses 4 ticks; the 2022 playbooks use 5.",
    scope: "world",
    config: true,
    type: Number,
    choices: { 5: "2022 playbooks (default)", 4: "2021 corebook" },
    default: 5
  });

  game.settings.register("copperhead-county", "heatProfile", {
    name: "Copperhead County | Heat thresholds",
    hint: "Choose the Heat labels shown in the reference sheets.",
    scope: "world",
    config: true,
    type: String,
    choices: { sheets2022: "2022 playbooks (0/2/4/6/8)", corebook2021: "2021 corebook (0/3/6/9)" },
    default: "sheets2022"
  });

  /**
   * Track the system version upon which point a migration was last applied
   */
  game.settings.register("copperhead-county", "systemMigrationVersion", {
    name: "System Migration Version",
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });
  
  if (foundry.utils.isNewerVersion(game.version, 12)) {

    game.settings.register('copperhead-county', 'ActionRoll', {
	name: game.i18n.localize('BITD.Settings.Action.Name'),
	hint: game.i18n.localize('BITD.Settings.Action.Hint'),
	config: true,
	default: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
	
    game.settings.register('copperhead-county', 'ClockXP', {
	name: game.i18n.localize('BITD.Settings.ClockXP.Name'),
	hint: game.i18n.localize('BITD.Settings.ClockXP.Hint'),
	config: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
  
	game.settings.register('copperhead-county', 'PublicClocks', {
	name: game.i18n.localize('BITD.Settings.PublicClocks.Name'),
	hint: game.i18n.localize('BITD.Settings.PublicClocks.Hint'),
	config: true,
	scope: 'world',
	type: new foundry.data.fields.BooleanField(),
	requiresReload: true
  });
  
  } //end if for game.version >12
  else {
	  
  const set_array = [
    ['ActionRoll','Action', true],
    ['ClockXP','ClockXP', false],
    ['PublicClocks','PublicClocks', false]
  ];
 
  for (let i=0; i<set_array.length; i++) {
	  
	game.settings.register('copperhead-county', set_array[i][0], {
		name: game.i18n.localize('BITD.Settings.'+set_array[i][1]+'.Name'),
		hint: game.i18n.localize('BITD.Settings.'+set_array[i][1]+'.Hint'),
		config: true,
		scope: 'world',
		type: Boolean,
		default: set_array[i][2],
		requiresReload: true
	});
  }
	  
  }

};
