# RH-011 Frequency analysis in the browser (counts runs, not segments)

**Status:** Done (backlog item 5, and a prerequisite for RH-012)

## Why
Filtering runs in the UI (RH-012) is only correct if the frequencies are
recomputed for the runs that remain. A count made in Python over *all* runs would
show "5 runs here" while only two are visible.

## What changed
- The grid algorithm of RH-004 now lives in `web/frequency.js`. Python no longer
  computes frequencies: `frequency.py` and its tests are gone, and the dataset
  JSON no longer carries per-segment `freq` / `maxFrequency` (the page is ~6 %
  smaller). It now carries `cellSize` (metres).
- New `web/scene.js`: `buildScene(dataset, isRunVisible)` returns the visible
  routes, their frequency levels (spans of equal frequency, least frequent first)
  and the maximum. Views, legend and PNG export draw a *scene*.
- Frequencies are now counted **per run**: a GPX file with several track
  segments over the same street, or a run made of several routes, counts once
  (backlog item 5).
- Cell size is converted from metres to unit-Mercator units at the data's centre
  latitude (error far below GPS noise at city scale).

## Tests
- `tests/js/*.test.mjs` (Node's built-in runner, no dependencies) port every
  RH-004 case and add: several routes of one run count once, tiny coordinates,
  and scene visibility. `tests/test_js.py` runs them from `pytest`.
- Cross-check on the real data: the JS frequency histogram matches the earlier
  Python one to within ~1 % per level.

## Decisions
- Scripts are plain browser scripts; `frequency.js` and `scene.js` end with a
  guarded `module.exports` so Node can test them without a bundler.
- One implementation (JS) instead of two, even though it meant discarding tested
  Python code: duplicated logic would drift.
