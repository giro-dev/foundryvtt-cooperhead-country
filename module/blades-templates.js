/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
import { loadHandlebarsTemplates } from "./compat.js";

export const preloadHandlebarsTemplates = async function() {

  // Define template paths to load
  const templatePaths = [

    // Actor Sheet Partials
    "systems/copperhead-county/templates/parts/coins.html",
    "systems/copperhead-county/templates/parts/attributes.html",
    "systems/copperhead-county/templates/parts/turf-list.html",
    "systems/copperhead-county/templates/parts/cohort-block.html",
    "systems/copperhead-county/templates/parts/factions.html",
    "systems/copperhead-county/templates/parts/active-effects.html",
    "systems/copperhead-county/templates/parts/trouble-track.html",
  ];

  // Load the template parts
  return loadHandlebarsTemplates(templatePaths);
};
