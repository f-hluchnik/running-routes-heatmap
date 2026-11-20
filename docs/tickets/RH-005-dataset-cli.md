# RH-005 Dataset export, HTML builder & CLI

**Status:** Done

## Goal
One command turns a folder of GPX files into a single, self-contained HTML map.

```
running-heatmap [data_dir] [-o output/heatmap.html] [--cell-size 10] [--trim-ends 0] [--serve]
```

## Acceptance criteria
- `build_dataset` cleans geometry, annotates each segment with its frequency,
  and serialises compact JSON (coordinates rounded to ~1 m).
- `render_page` embeds data, Leaflet and front-end code in one HTML file that
  works offline (only map tiles need the network).
- Run names cannot break out of the embedded `<script>` (tested with
  `</script>` in a name).
- `--trim-ends` hides the start/end of each run (privacy around home).
- `--serve` serves the page on `http://127.0.0.1:8000` and opens the browser.
- The old prototype `main.py` is removed; the CLI replaces it.

## Decisions
- JSON lives inside `<script type="application/json">`; `<` is escaped as
  `<`. Placeholders are filled in a single regex pass so inserted
  JS/CSS can never be re-interpreted as a placeholder.
- `--serve` exists because OpenStreetMap's tile servers expect an HTTP
  referrer, which a page opened from `file://` does not send.
- Known limitation: each GPX *segment* counts as one path in the frequency
  analysis. Garmin exports one segment per activity, so this is fine in practice.

## Refactor notes
- `max_step` was a user-facing knob with a cross-validation against `cell_size`
  and a helper in the CLI. It is now a derived property
  (`min(5 m, cell_size / 2)`), so invalid combinations cannot exist.
- `Run.date` moved onto the model; `build_dataset` no longer takes a mutable
  default argument.
