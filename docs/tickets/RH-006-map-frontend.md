# RH-006 Map frontend: map, glow view, optional OSM

**Status:** Done

## Goal
An interactive map with the first view ("Glow": semi-transparent lines that add
up) and an optional OpenStreetMap basemap.

## Acceptance criteria
- Map opens fitted to all routes on a dark, plain background.
- **Glow** view: each run is one semi-transparent stroke; overlapping runs
  accumulate towards solid colour. Line width and opacity are adjustable.
- "OpenStreetMap basemap" checkbox adds/removes tiles (muted to grey so the
  routes stand out) and shows the required OSM attribution.
- Routes are drawn on one canvas that follows pan/zoom (repainted at most once
  per animation frame) and is sharp on high-DPI screens.
- Routes line up with Leaflet's own projection (checked: < 0.5 px difference).
- No console errors; works from `file://` (tiles need `--serve`, see RH-005).

## Front-end structure (plain scripts, inlined in this order)
| File | Responsibility |
|------|----------------|
| `projection.js` | Web-Mercator maths, `frameFromMap`, `projectRoute` |
| `data.js` | Parse dataset into typed arrays (`Route`, `loadDataset`) |
| `views.js` | `VIEWS` registry; each view paints routes onto any canvas context |
| `routes-layer.js` | Leaflet layer: canvas sizing, repaint scheduling |
| `app.js` | State, controls, wiring |

## Decisions
- **Own canvas layer instead of Leaflet polylines.** ~20k vertices per frame are
  trivial for canvas, per-run alpha stacking is exact, and (RH-008) the same
  `draw(ctx, frame, ...)` code can render a PNG at any resolution.
- Views never touch the map; they only receive a `frame` (zoom, scale, world
  size, offset). That is what makes export possible.
- `zoomAnimation: false`: the canvas is repainted on every zoom step instead of
  hiding routes during an animated zoom.
- Leaflet is vendored; its CSS references marker/layer icons we do not use, so
  those relative image URLs are intentionally left dangling.

## Refactor notes
- View radio buttons are generated from the `VIEWS` registry, so adding a view
  does not require markup changes.
- Slider defaults come from `state`, not duplicated in the HTML.
- Moved the glow colour constant above its use and restyled Leaflet's zoom and
  attribution controls (the default white ones clashed with the dark panel).
