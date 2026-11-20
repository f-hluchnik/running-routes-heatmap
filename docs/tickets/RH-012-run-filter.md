# RH-012 Date range and per-run filter in the UI

**Status:** Done (backlog item 2)

## Goal
Show only some of the runs: a time window ("this autumn") or hand-picked runs.

## Acceptance criteria
- "Runs" panel: one checkbox per run (date, name, distance), All / None shortcuts,
  and From / To date inputs limited to the dates present in the data.
- A run is shown when it is checked **and** inside the date range (inclusive; an
  open end is allowed; undated runs always pass the date range). Runs outside the
  range are dimmed in the list but keep their checkbox state.
- Frequencies, legend maximum and the "x of y" counter are recomputed for the
  visible runs only, so colours always describe what is on screen.
- PNG export uses the filtered scene.

## Decisions
- Filter logic is a small pure class (`run-filter.js`, `RunFilter`) with Node
  unit tests; `app.js` only wires it to the DOM.
- Dates are compared as ISO strings; no date parsing needed.
- Checkbox and date range are independent (instead of the range toggling
  checkboxes), so clearing the range restores exactly what you had picked.

## Refactor notes
- `app.js` had grown into a flat script; it is now organised as configuration,
  state, map, `rebuildScene()` (after filter changes) / `refresh()` (after view
  changes), controls, export, start-up.
- Review fix: the date inputs overflowed the panel; the `<details>` marker sat
  outside the panel padding.
