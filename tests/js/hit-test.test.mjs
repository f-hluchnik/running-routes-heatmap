import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { runsNear, squaredDistanceToSegment } = require("../../src/running_heatmap/web/hit-test.js");

/** A route with the `bounds` helper the real Route class provides. */
function route(runIndex, points) {
  const x = Float64Array.from(points.map(([px]) => px));
  const y = Float64Array.from(points.map(([, py]) => py));
  const bounds = {
    contains: (px, py, margin) =>
      px >= Math.min(...x) - margin &&
      px <= Math.max(...x) + margin &&
      py >= Math.min(...y) - margin &&
      py <= Math.max(...y) + margin,
  };
  return { runIndex, x, y, bounds };
}

test("distance to a segment: perpendicular, beyond an end, degenerate", () => {
  assert.equal(squaredDistanceToSegment(5, 3, 0, 0, 10, 0), 9); // above the middle
  assert.equal(squaredDistanceToSegment(13, 4, 0, 0, 10, 0), 25); // beyond the end: 3-4-5
  assert.equal(squaredDistanceToSegment(3, 4, 0, 0, 0, 0), 25); // zero-length segment
});

test("finds runs within the tolerance, nearest first, each once", () => {
  const routes = [
    route(0, [[0, 0], [10, 0], [10, 10]]),
    route(1, [[0, 2], [10, 2]]),
    route(2, [[0, 50], [10, 50]]),
  ];

  const hits = runsNear(routes, 5, 1, 3);

  assert.deepEqual(hits.map((hit) => hit.runIndex), [0, 1]); // 1 away vs 1 away: ties keep order
  assert.deepEqual(hits.map((hit) => Number(hit.distance.toFixed(3))), [1, 1]);
});

test("a run with several routes near the point is reported once with its closest distance", () => {
  const routes = [route(0, [[0, 3], [10, 3]]), route(0, [[0, 1], [10, 1]])];

  const hits = runsNear(routes, 5, 0, 5);

  assert.equal(hits.length, 1);
  assert.equal(hits[0].distance, 1);
});

test("nothing is returned when no run is close enough", () => {
  assert.deepEqual(runsNear([route(0, [[0, 0], [10, 0]])], 5, 4, 3), []);
  assert.deepEqual(runsNear([], 0, 0, 3), []);
});

test("points just outside a route's bounding box are still found within tolerance", () => {
  const hits = runsNear([route(0, [[0, 0], [10, 0]])], 12, 0, 3);

  assert.deepEqual(hits.map((hit) => hit.runIndex), [0]);
});

test("single-point routes cannot be hit", () => {
  assert.deepEqual(runsNear([route(0, [[1, 1]])], 1, 1, 3), []);
});
