import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { TILE_SIZE, toUnitMercator, frameFromView, frameFittingBounds, cappedScale } = require(
  "../../src/running_heatmap/web/projection.js",
);

const close = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} is not within ${epsilon} of ${expected}`);

/** Where a unit-Mercator point lands on the canvas of `frame`. */
const toCanvas = (frame, x, y) => [
  (x * frame.worldSize - frame.left) * frame.scale,
  (y * frame.worldSize - frame.top) * frame.scale,
];

test("unit Mercator: the equator/prime meridian is the centre; longitude is linear", () => {
  const { x, y } = toUnitMercator(0, 0);
  close(x, 0.5);
  close(y, 0.5);
  close(toUnitMercator(0, 90).x, 0.75);
  assert.ok(toUnitMercator(50, 0).y < 0.5); // north is up: smaller y
});

test("a view's centre lands in the middle of the canvas", () => {
  const frame = frameFromView({ centerX: 0.52, centerY: 0.33, zoom: 12.5, width: 800, height: 500, scale: 2 });

  const [cx, cy] = toCanvas(frame, 0.52, 0.33);

  close(cx, 800);
  close(cy, 500);
  assert.equal(frame.worldSize, TILE_SIZE * 2 ** 12.5);
});

test("fitting bounds: they fill the limiting side minus padding and are centred", () => {
  const bounds = { minX: 0.5, maxX: 0.5 + 0.001, minY: 0.3, maxY: 0.3 + 0.0005 };

  const frame = frameFittingBounds(bounds, 1000, 600, 1, 0.1);

  const [left, top] = toCanvas(frame, bounds.minX, bounds.minY);
  const [right, bottom] = toCanvas(frame, bounds.maxX, bounds.maxY);
  close(right - left, 800, 1e-6); // width-limited: 1000 * (1 - 2 * 0.1)
  assert.ok(bottom - top <= 480 + 1e-6);
  close((left + right) / 2, 500, 1e-6);
  close((top + bottom) / 2, 300, 1e-6);
});

test("fitting a tall box is limited by the height", () => {
  const bounds = { minX: 0.5, maxX: 0.5005, minY: 0.3, maxY: 0.301 };

  const frame = frameFittingBounds(bounds, 1000, 600, 1, 0);

  const [, top] = toCanvas(frame, bounds.minX, bounds.minY);
  const [, bottom] = toCanvas(frame, bounds.maxX, bounds.maxY);
  close(bottom - top, 600, 1e-6);
});

test("fitting a single point falls back to a sensible zoom instead of infinity", () => {
  const frame = frameFittingBounds({ minX: 0.5, maxX: 0.5, minY: 0.5, maxY: 0.5 }, 800, 600);

  assert.equal(frame.zoom, 16);
});

test("scale is capped so the longer side stays within the pixel limit", () => {
  assert.equal(cappedScale(2, 1000, 600, 8192), 2);
  assert.equal(cappedScale(4, 3000, 1000, 8192), 8192 / 3000);
});
