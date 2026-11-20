import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
// scene.js expects computeFrequencies as a global, like in the browser page.
globalThis.computeFrequencies = require("../../src/running_heatmap/web/frequency.js").computeFrequencies;
const { buildScene, groupSpansByFrequency } = require("../../src/running_heatmap/web/scene.js");

const route = (runIndex, xs, y = 0) => ({
  runIndex,
  x: Float64Array.from(xs),
  y: new Float64Array(xs.length).fill(y),
});
const xs = (from, to) => Array.from({ length: (to - from) / 5 + 1 }, (_, i) => from + i * 5);

test("spans merge consecutive segments of equal frequency, least frequent first", () => {
  const a = route(0, xs(0, 20));
  const spans = groupSpansByFrequency([a], [Uint16Array.of(1, 1, 2, 2)]);

  assert.deepEqual(
    spans.map(({ frequency, spans: s }) => [frequency, s.map(({ from, to }) => [from, to])]),
    [
      [1, [[0, 2]]],
      [2, [[2, 4]]],
    ],
  );
});

test("the scene counts only visible runs", () => {
  const dataset = { cellSize: 10, routes: [route(0, xs(0, 100)), route(1, xs(0, 100))] };

  assert.equal(buildScene(dataset).maxFrequency, 2);

  const onlyFirst = buildScene(dataset, (runIndex) => runIndex === 0);
  assert.equal(onlyFirst.routes.length, 1);
  assert.equal(onlyFirst.maxFrequency, 1);
});

test("an empty scene has maximum frequency 1 and nothing to draw", () => {
  const scene = buildScene({ cellSize: 10, routes: [route(0, xs(0, 100))] }, () => false);

  assert.deepEqual(scene, { routes: [], levels: [], maxFrequency: 1 });
});
