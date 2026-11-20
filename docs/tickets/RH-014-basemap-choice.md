# RH-014 Basemap style choice + CLI tile options

**Status:** Done (backlog item 3)

## Goal
More than one basemap, and a way to use other tile providers.

## Acceptance criteria
- "Basemap" select: None (default), OpenStreetMap (muted), OpenStreetMap (dark),
  OpenStreetMap (original), and "Custom tiles" when `--tiles` was given.
- `--tiles URL --tiles-attribution TEXT` adds a custom source. URL templates
  support `{z} {x} {y}` (required) plus `{s}` and `{r}`; both options must be
  given together, because providers' licences require a visible credit.
- The credit of the chosen basemap is shown on the map and in PNG exports.
- The attribution text is escaped before it goes into the page (it comes from the
  command line); the tile URL must be http(s).

## Decisions
- **No built-in CARTO presets.** CARTO's raster tiles now need a free API key
  (https://carto.com/basemaps/apikey/); without one they show a watermark. The
  custom option covers it: put your key in the URL, e.g.
  `--tiles "https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=YOUR_KEY" --tiles-attribution "© OpenStreetMap contributors © CARTO"`.
- Light / muted / dark are the same OSM tiles with a colour filter (a CSS
  `filter` on screen, `ctx.filter` in the export), so they need no extra
  provider, key or credit.
- Basemaps live in a registry (`basemaps.js`): label, URL, credit (html + text),
  filter. The export reads the same entry, so screen and PNG cannot disagree.
- `TileSource` (Python) validates the options once; the front-end trusts nothing
  anyway and escapes the credit.

## Not verified
- The dark filter (`invert` + `hue-rotate`) was tested for wiring, not for looks
  on real OSM tiles: the development sandbox had no network access. Tune
  `FILTER_DARK` in `basemaps.js` to taste.

## Refactor notes
- The boolean `state.basemap` became an id; one tile layer is created lazily per
  id, and `applyBasemap()` is separate from `refresh()` so moving a slider never
  reloads tiles.
