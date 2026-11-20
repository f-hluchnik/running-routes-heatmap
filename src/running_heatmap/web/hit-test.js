"use strict";

/** Squared distance from point (px, py) to the segment (ax, ay)-(bx, by). */
function squaredDistanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const cx = ax + t * dx - px;
  const cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

/**
 * The runs that have a route within `tolerance` of the point (x, y), nearest first.
 * Works directly in unit-Mercator coordinates, so nothing has to be projected to
 * screen space on every mouse move. Each run appears once, with its smallest distance.
 */
function runsNear(routes, x, y, tolerance) {
  const toleranceSquared = tolerance * tolerance;
  const nearest = new Map(); // runIndex -> smallest squared distance
  for (const route of routes) {
    if (!route.bounds.contains(x, y, tolerance)) continue;
    for (let i = 0; i + 1 < route.x.length; i++) {
      const squared = squaredDistanceToSegment(x, y, route.x[i], route.y[i], route.x[i + 1], route.y[i + 1]);
      if (squared <= toleranceSquared && squared < (nearest.get(route.runIndex) ?? Infinity)) {
        nearest.set(route.runIndex, squared);
      }
    }
  }
  return [...nearest]
    .sort(([, a], [, b]) => a - b)
    .map(([runIndex, squared]) => ({ runIndex, distance: Math.sqrt(squared) }));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { runsNear, squaredDistanceToSegment };
}
