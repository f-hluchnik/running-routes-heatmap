# RH-008 PNG export

**Status:** Done

## Goal
"Export PNG" saves what is on screen, at higher resolution, including the
basemap when it is switched on.

## Acceptance criteria
- Output is 2x the map's pixel size (capped at 8192 px on the long side).
- With the basemap on: waits for tiles to load, composites them with the same
  muting filter, and draws the "(c) OpenStreetMap contributors" credit.
- Frequency view exports its legend too.
- Clear message instead of a silent failure if the browser blocks the tiles
  (page opened from `file://` without CORS).
- Browser tests cover both with and without basemap.

## Decisions
- Tiles are drawn from the DOM `<img>` elements Leaflet already loaded
  (requested with `crossOrigin: "anonymous"`), so no second download.
- Routes use the exact same `view.draw(ctx, frame, ...)` as the live map, only
  with `frame.scale = 2`. No separate export renderer to keep in sync.
- The tile muting filter is one constant (`BASEMAP_FILTER`) used for the CSS
  filter on screen and `ctx.filter` in the export. Browsers without
  `ctx.filter` (older Safari) export unfiltered tiles.

## Refactor notes
- The filter was first duplicated in CSS and JS; now a single JS constant.
- Added `tests/test_frontend.py` (Playwright, auto-skipped when unavailable).
