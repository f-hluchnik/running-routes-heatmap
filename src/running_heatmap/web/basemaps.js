"use strict";

/*
 * Basemap choices. OpenStreetMap needs no account or key; its tiles are light, so
 * the variants only differ in the colour filter applied to them (CSS on screen,
 * canvas filter in the PNG export). `--tiles` on the command line adds a custom
 * source, e.g. a provider with your own API key.
 */

const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION = {
  text: "© OpenStreetMap contributors",
  html: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

const FILTER_MUTED = "grayscale(0.85) brightness(1.05) contrast(0.92)"; // routes stand out
const FILTER_DARK = "invert(1) hue-rotate(180deg) grayscale(0.7) brightness(0.9) contrast(0.95)";

const escapeHtml = (text) =>
  text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);

/** All basemaps by id; the first entry ("none") is the default. */
function buildBasemaps(customTiles) {
  const osm = (label, filter) => ({ label, url: OSM_URL, attribution: OSM_ATTRIBUTION, filter });
  const basemaps = {
    none: { label: "None" },
    "osm-muted": osm("OpenStreetMap (muted)", FILTER_MUTED),
    "osm-dark": osm("OpenStreetMap (dark)", FILTER_DARK),
    "osm-original": osm("OpenStreetMap (original)", ""),
  };
  if (customTiles) {
    basemaps.custom = {
      label: "Custom tiles",
      url: customTiles.url,
      attribution: { text: customTiles.attribution, html: escapeHtml(customTiles.attribution) },
      filter: "",
    };
  }
  return basemaps;
}

if (typeof module !== "undefined" && module.exports) module.exports = { buildBasemaps, escapeHtml };
