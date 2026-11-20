import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { buildBasemaps, escapeHtml } = require("../../src/running_heatmap/web/basemaps.js");

test("the default is no basemap, followed by OpenStreetMap variants", () => {
  const ids = Object.keys(buildBasemaps(null));

  assert.deepEqual(ids, ["none", "osm-muted", "osm-dark", "osm-original"]);
});

test("every tile basemap has a url template, a credit and a filter", () => {
  for (const [id, basemap] of Object.entries(buildBasemaps(null))) {
    if (id === "none") continue;
    assert.match(basemap.url, /\{z\}.*\{x\}.*\{y\}|\{z\}.*\{y\}.*\{x\}/);
    assert.match(basemap.attribution.text, /OpenStreetMap/);
    assert.equal(typeof basemap.filter, "string");
  }
});

test("a custom tile source is appended and its credit cannot inject markup", () => {
  const custom = { url: "https://t.example/{z}/{x}/{y}.png", attribution: '<img src=x onerror="1"> & Co' };

  const basemaps = buildBasemaps(custom);

  assert.equal(Object.keys(basemaps).at(-1), "custom");
  assert.equal(basemaps.custom.url, custom.url);
  assert.equal(basemaps.custom.attribution.text, custom.attribution);
  assert.ok(!basemaps.custom.attribution.html.includes("<"));
  assert.ok(!basemaps.custom.attribution.html.includes('"'));
});

test("escapeHtml escapes the five dangerous characters", () => {
  assert.equal(escapeHtml(`&<>"'`), "&#38;&#60;&#62;&#34;&#39;");
});
