"use strict";

/*
 * How many different runs pass along each stretch of every route.
 *
 * Space is divided into square cells. A run *covers* a cell if one of its points
 * lies in that cell or one of the eight around it, which tolerates GPS noise of
 * about one cell. The frequency of a segment is the number of runs covering the
 * cell of its midpoint, including its own run (so it is always at least 1). A run
 * that doubles back, or that is made of several routes, still counts once.
 *
 * Routes must have steps no longer than the cell size; the Python pipeline
 * guarantees that.
 */

const EARTH_CIRCUMFERENCE_M = 2 * Math.PI * 6371008.8;
const NEIGHBOUR_OFFSETS = [-1, 0, 1];

/** Convert a cell size in metres to unit-Mercator units at the given latitude. */
function cellSizeInUnits(cellSizeMetres, latitude) {
  return cellSizeMetres / (EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180));
}

/** Integer cell grid over the given routes, with one key per cell. */
function gridFor(routes, cellSize) {
  let minColumn = Infinity;
  let minRow = Infinity;
  let maxRow = -Infinity;
  for (const route of routes) {
    for (let i = 0; i < route.x.length; i++) {
      minColumn = Math.min(minColumn, Math.floor(route.x[i] / cellSize));
      const row = Math.floor(route.y[i] / cellSize);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
    }
  }
  // One extra cell of margin on every side keeps neighbour keys unique and positive.
  const stride = maxRow - minRow + 3;
  const originColumn = minColumn - 1;
  const originRow = minRow - 1;
  return {
    key: (x, y) =>
      (Math.floor(x / cellSize) - originColumn) * stride + (Math.floor(y / cellSize) - originRow),
    neighbourOffsets: NEIGHBOUR_OFFSETS.flatMap((dx) => NEIGHBOUR_OFFSETS.map((dy) => dx * stride + dy)),
  };
}

/** Number of runs covering each cell: Map(cell key -> count). */
function countRunsPerCell(routes, grid) {
  const routesByRun = new Map();
  for (const route of routes) {
    if (!routesByRun.has(route.runIndex)) routesByRun.set(route.runIndex, []);
    routesByRun.get(route.runIndex).push(route);
  }

  const runsPerCell = new Map();
  for (const runRoutes of routesByRun.values()) {
    const touched = new Set();
    for (const route of runRoutes) {
      for (let i = 0; i < route.x.length; i++) touched.add(grid.key(route.x[i], route.y[i]));
    }
    const covered = new Set();
    for (const key of touched) {
      for (const offset of grid.neighbourOffsets) covered.add(key + offset);
    }
    for (const key of covered) runsPerCell.set(key, (runsPerCell.get(key) ?? 0) + 1);
  }
  return runsPerCell;
}

/**
 * Frequency of every segment of every route.
 * `routes`: objects with `runIndex` and unit-Mercator `x`, `y` arrays.
 * Returns one Uint16Array (length n - 1) per route, in the same order.
 */
function computeFrequencies(routes, cellSize) {
  const usable = routes.filter((route) => route.x.length >= 2);
  if (usable.length === 0) return routes.map(() => new Uint16Array(0));

  const grid = gridFor(usable, cellSize);
  const runsPerCell = countRunsPerCell(usable, grid);

  return routes.map((route) => {
    const frequencies = new Uint16Array(Math.max(route.x.length - 1, 0));
    for (let i = 0; i < frequencies.length; i++) {
      const midX = (route.x[i] + route.x[i + 1]) / 2;
      const midY = (route.y[i] + route.y[i + 1]) / 2;
      frequencies[i] = runsPerCell.get(grid.key(midX, midY));
    }
    return frequencies;
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { computeFrequencies, cellSizeInUnits };
}
