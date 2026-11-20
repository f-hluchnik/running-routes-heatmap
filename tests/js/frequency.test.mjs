import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { computeFrequencies } = require("../../src/running_heatmap/web/frequency.js");

const CELL = 10;

/** A straight east-west route of one run, with a point every `step` units. */
function line(runIndex, x0, x1, y = 0, step = 5) {
  const xs = [];
  for (let x = x0; x <= x1 + step / 2; x += step) xs.push(x);
  return { runIndex, x: Float64Array.from(xs), y: new Float64Array(xs.length).fill(y) };
}

const frequencies = (...routes) => computeFrequencies(routes, CELL).map((f) => [...f]);
const repeat = (value, times) => Array(times).fill(value);

test("a single run has frequency one everywhere", () => {
  const [freq] = frequencies(line(0, 0, 100));
  assert.deepEqual(freq, repeat(1, 20));
});

test("identical runs count each other", () => {
  const [first, second] = frequencies(line(0, 0, 100), line(1, 0, 100));
  assert.deepEqual(first, repeat(2, 20));
  assert.deepEqual(second, repeat(2, 20));
});

test("partial overlap counts only the shared stretch (with one cell of tolerance)", () => {
  const [first, second] = frequencies(line(0, 0, 100), line(1, 50, 150));
  assert.deepEqual(first.slice(0, 8), repeat(1, 8)); // x < 40
  assert.deepEqual(first.slice(-8), repeat(2, 8)); // x > 60
  assert.deepEqual(second.slice(0, 8), repeat(2, 8));
  assert.deepEqual(second.slice(-6), repeat(1, 6)); // x > 120
});

test("GPS noise within a cell still counts as the same road", () => {
  const [first, second] = frequencies(line(0, 0, 100, 0), line(1, 0, 100, 6));
  assert.deepEqual(first, repeat(2, 20));
  assert.deepEqual(second, repeat(2, 20));
});

test("parallel roads far apart stay separate", () => {
  const [first, second] = frequencies(line(0, 0, 100, 0), line(1, 0, 100, 40));
  assert.deepEqual(first, repeat(1, 20));
  assert.deepEqual(second, repeat(1, 20));
});

test("a run doubling back over itself counts once", () => {
  const out = line(0, 0, 100);
  const back = line(0, 0, 100);
  back.x.reverse();
  const results = frequencies(out, back);
  assert.deepEqual(results[0], repeat(1, 20));
  assert.deepEqual(results[1], repeat(1, 20));
});

test("several routes of the same run count once, not once per route", () => {
  const [first, second, other] = frequencies(line(0, 0, 100), line(0, 0, 100), line(1, 0, 100));
  assert.deepEqual(first, repeat(2, 20));
  assert.deepEqual(second, repeat(2, 20));
  assert.deepEqual(other, repeat(2, 20));
});

test("works far from the origin and with tiny unit-Mercator-like coordinates", () => {
  const shift = (route, dx, dy, k) => ({
    runIndex: route.runIndex,
    x: route.x.map((v) => v * k + dx),
    y: route.y.map((v) => v * k + dy),
  });
  const k = 1e-6; // coordinates ~1e-4, cell size scaled alike
  const routes = [shift(line(0, 0, 100), 0.4, 0.3, k), shift(line(1, 0, 100), 0.4, 0.3, k)];
  const [first] = computeFrequencies(routes, CELL * k).map((f) => [...f]);
  assert.deepEqual(first, repeat(2, 20));
});

test("degenerate inputs", () => {
  assert.deepEqual(computeFrequencies([], CELL), []);
  const single = { runIndex: 0, x: Float64Array.of(1), y: Float64Array.of(1) };
  const empty = { runIndex: 1, x: new Float64Array(0), y: new Float64Array(0) };
  assert.deepEqual(computeFrequencies([single, empty], CELL).map((f) => f.length), [0, 0]);
  const results = frequencies(empty, line(2, 0, 20));
  assert.deepEqual(results, [[], repeat(1, 4)]);
});
