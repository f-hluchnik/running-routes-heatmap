"use strict";

/** One continuous stretch of a run, ready for fast drawing. */
class Route {
  constructor(coords, freq, runIndex) {
    const n = coords.length;
    this.runIndex = runIndex;
    this.freq = Uint16Array.from(freq); // one value per segment: n - 1
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

/**
 * Group consecutive segments of equal frequency into spans of vertices, then
 * collect the spans of all routes by frequency, least frequent first. Drawing in
 * that order puts the most-run streets on top.
 */
function groupSpansByFrequency(routes) {
  const levels = new Map();
  for (const route of routes) {
    let from = 0;
    for (let i = 1; i <= route.freq.length; i++) {
      if (i < route.freq.length && route.freq[i] === route.freq[from]) continue;
      const frequency = route.freq[from];
      if (!levels.has(frequency)) levels.set(frequency, []);
      levels.get(frequency).push({ route, from, to: i });
      from = i;
    }
  }
  return [...levels]
    .sort(([a], [b]) => a - b)
    .map(([frequency, spans]) => ({ frequency, spans }));
}

/** Parse the embedded dataset into runs, a flat list of routes and frequency levels. */
function loadDataset(json) {
  const routes = json.runs.flatMap((run, runIndex) =>
    run.routes.map((route) => new Route(route.coords, route.freq, runIndex)),
  );
  return {
    runs: json.runs,
    routes,
    levels: groupSpansByFrequency(routes),
    bounds: json.bounds,
    maxFrequency: json.maxFrequency,
    totalKm: json.runs.reduce((sum, run) => sum + run.distanceKm, 0),
  };
}
