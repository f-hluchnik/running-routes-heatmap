"use strict";

/** One continuous stretch of a run, ready for fast drawing. */
class Route {
  constructor(coords, runIndex) {
    const n = coords.length;
    this.runIndex = runIndex;
    this.x = new Float64Array(n); // unit-Mercator position
    this.y = new Float64Array(n);
    this.sx = new Float64Array(n); // screen position, refilled by projectRoute()
    this.sy = new Float64Array(n);
    coords.forEach(([lat, lon], i) => {
      const point = toUnitMercator(lat, lon);
      this.x[i] = point.x;
      this.y[i] = point.y;
    });
  }
}

/** Parse the embedded dataset into runs and a flat list of routes. */
function loadDataset(json) {
  const [[south, west], [north, east]] = json.bounds;
  const routes = json.runs.flatMap((run, runIndex) =>
    run.routes.map((coords) => new Route(coords, runIndex)),
  );
  return {
    runs: json.runs,
    routes,
    bounds: json.bounds,
    cellSize: cellSizeInUnits(json.cellSize, (south + north) / 2),
    totalKm: json.runs.reduce((sum, run) => sum + run.distanceKm, 0),
  };
}
