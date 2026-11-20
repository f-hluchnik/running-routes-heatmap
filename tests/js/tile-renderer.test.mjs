import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { frameFromView } = require("../../src/running_heatmap/web/projection.js");
const { tileUrl, tileGrid } = require("../../src/running_heatmap/web/tile-renderer.js");

test("tileUrl fills in z, x, y and picks a subdomain", () => {
  assert.equal(tileUrl("https://t.test/{z}/{x}/{y}.png", 12, 2200, 1400), "https://t.test/12/2200/1400.png");
  assert.equal(tileUrl("https://{s}.t.test/{z}/{x}/{y}{r}.png", 3, 1, 2), "https://a.t.test/3/1/2.png");
  assert.match(tileUrl("https://{s}.t.test/{z}/{x}/{y}.png", 3, 1, 1), /^https:\/\/[abc]\.t\.test/);
});

test("the tile grid covers the frame and picks the zoom that matches the resolution", () => {
  // Zoom 12 at 2x resolution: 256 * 2^12 * 2 px per world => zoom-13 tiles of ~256 px.
  const frame = frameFromView({ centerX: 0.52, centerY: 0.33, zoom: 12, width: 800, height: 500, scale: 2 });

  const tiles = tileGrid(frame);

  assert.ok(tiles.every((tile) => tile.z === 13));
  assert.ok(tiles.every((tile) => Math.abs(tile.size - 256) < 1e-6));
  const canvasWidth = 800 * 2;
  const canvasHeight = 500 * 2;
  assert.ok(Math.min(...tiles.map((t) => t.dx)) <= 0);
  assert.ok(Math.max(...tiles.map((t) => t.dx + t.size)) >= canvasWidth);
  assert.ok(Math.min(...tiles.map((t) => t.dy)) <= 0);
  assert.ok(Math.max(...tiles.map((t) => t.dy + t.size)) >= canvasHeight);
});

test("tiles tile the plane without gaps or overlaps", () => {
  const frame = frameFromView({ centerX: 0.4, centerY: 0.4, zoom: 10.3, width: 600, height: 400, scale: 1 });

  const tiles = tileGrid(frame);
  const columns = [...new Set(tiles.map((t) => t.dx))].sort((a, b) => a - b);

  columns.slice(1).forEach((dx, i) => assert.ok(Math.abs(dx - columns[i] - tiles[0].size) < 1e-6));
  assert.equal(new Set(tiles.map((t) => `${t.x},${t.y}`)).size, tiles.length);
});

test("tiles wrap around the date line and stay inside the world vertically", () => {
  const frame = frameFromView({ centerX: 0.001, centerY: 0.001, zoom: 3, width: 800, height: 800, scale: 1 });

  const tiles = tileGrid(frame);

  assert.ok(tiles.every((tile) => tile.x >= 0 && tile.x < 8));
  assert.ok(tiles.every((tile) => tile.y >= 0 && tile.y < 8));
  assert.ok(tiles.some((tile) => tile.dx < 0)); // drawn left of the origin, URL wrapped
});

test("the tile zoom is capped at the maximum", () => {
  const frame = frameFromView({ centerX: 0.5, centerY: 0.5, zoom: 19, width: 200, height: 200, scale: 4 });

  assert.ok(tileGrid(frame).every((tile) => tile.z === 19));
});
