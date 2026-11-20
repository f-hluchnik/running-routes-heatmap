# RH-015 Export options: extent, resolution, transparent background

**Status:** Done (backlog item 4)

## Goal
Export something other than "the screen at 2x": fit all shown runs, pick the
resolution, or get a transparent PNG to drop onto your own design.

## Acceptance criteria
- "Export options" panel: **Area** (current view / all shown runs), **Resolution**
  (1x-4x) with a live pixel-size preview, **Transparent background**.
- "All shown runs" frames the visible runs (respecting filters) with a 6 % margin,
  whatever the screen currently shows. Output keeps the window's aspect ratio.
- The longer side is capped at 8192 px (the preview shows the capped size).
- Transparent background is disabled while a basemap is selected (tiles are opaque).
- With a basemap, tiles are fetched by the export itself, so the export no longer
  depends on what is loaded on screen. Unreachable tiles give a clear message;
  a few missing tiles still export, with a warning.
- Exports needing more than 600 tiles are refused with advice (be kind to tile servers).

## Decisions
- **Own tile renderer** (`tile-renderer.js`) replaces reading Leaflet's DOM
  `<img>`s: a pure `tileGrid(frame)` picks the zoom matching the output
  resolution and positions every tile; `tileUrl` expands `{z}{x}{y}{s}{r}`.
  Tiles wrap at the date line. The same colour filter as on screen is applied.
- Frames are built by pure helpers in `projection.js` (`frameFromView`,
  `frameFittingBounds`, `cappedScale`); the live map just supplies one of them.
  Everything is covered by Node tests; the browser tests check real exports
  (sizes, transparency, the area actually drawn).
- `scene.bounds` (visible routes) feeds "all shown runs".

## Refactor notes
- Removed the old DOM-scraping tile code and the tile wait/poll loop.
- `exportPng` now takes one options object containing a ready-made frame, so
  `png-export.js` knows nothing about the map.
- Review fix: the options sit in a collapsed `<details>`; browser tests open it.
