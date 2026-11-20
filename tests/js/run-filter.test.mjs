import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { RunFilter } = require("../../src/running_heatmap/web/run-filter.js");

const runs = [
  { name: "a", date: "2025-08-11", distanceKm: 5 },
  { name: "b", date: "2025-09-01", distanceKm: 10 },
  { name: "c", date: "2025-09-30", distanceKm: 15 },
  { name: "undated", date: null, distanceKm: 1 },
];
const visible = (filter) => filter.visibleRuns().map((run) => run.name);

test("everything is visible by default", () => {
  assert.deepEqual(visible(new RunFilter(runs)), ["a", "b", "c", "undated"]);
});

test("runs can be switched off and on individually", () => {
  const filter = new RunFilter(runs);
  filter.setSwitchedOn(1, false);
  assert.deepEqual(visible(filter), ["a", "c", "undated"]);
  filter.setSwitchedOn(1, true);
  assert.deepEqual(visible(filter), ["a", "b", "c", "undated"]);
});

test("all/none switches every run at once", () => {
  const filter = new RunFilter(runs);
  filter.setAllSwitchedOn(false);
  assert.deepEqual(visible(filter), []);
  filter.setAllSwitchedOn(true);
  assert.equal(visible(filter).length, 4);
});

test("the date range is inclusive and either end may be open", () => {
  const filter = new RunFilter(runs);
  filter.setDateRange("2025-09-01", "2025-09-30");
  assert.deepEqual(visible(filter), ["b", "c", "undated"]);
  filter.setDateRange("", "2025-08-31");
  assert.deepEqual(visible(filter), ["a", "undated"]);
  filter.setDateRange("2025-09-15", "");
  assert.deepEqual(visible(filter), ["c", "undated"]);
});

test("a run must pass both the switch and the date range", () => {
  const filter = new RunFilter(runs);
  filter.setDateRange("2025-09-01", "");
  filter.setSwitchedOn(2, false);
  assert.deepEqual(visible(filter), ["b", "undated"]);
  assert.equal(filter.isSwitchedOn(0), true); // still switched on, just out of range
  assert.equal(filter.inDateRange(0), false);
});
