"use strict";

/**
 * Group consecutive segments of equal frequency into spans of vertices, then
 * collect the spans of all routes by frequency, least frequent first. Drawing in
 * that order puts the most-run streets on top.
 */
function groupSpansByFrequency(routes, frequencies) {
  const levels = new Map();
  routes.forEach((route, routeIndex) => {
    const freq = frequencies[routeIndex];
    let from = 0;
    for (let i = 1; i <= freq.length; i++) {
      if (i < freq.length && freq[i] === freq[from]) continue;
      if (!levels.has(freq[from])) levels.set(freq[from], []);
      levels.get(freq[from]).push({ route, from, to: i });
      from = i;
    }
  });
  return [...levels]
    .sort(([a], [b]) => a - b)
    .map(([frequency, spans]) => ({ frequency, spans }));
}

/**
 * What the views draw: the visible routes plus their frequency levels.
 * Frequencies are recomputed for just the visible runs, so the colours always
 * describe what is on screen.
 */
function buildScene(dataset, isRunVisible = () => true) {
  const routes = dataset.routes.filter((route) => isRunVisible(route.runIndex));
  const frequencies = computeFrequencies(routes, dataset.cellSize);
  const levels = groupSpansByFrequency(routes, frequencies);
  const maxFrequency = levels.length > 0 ? levels[levels.length - 1].frequency : 1;
  return { routes, levels, maxFrequency };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { groupSpansByFrequency, buildScene };
}
