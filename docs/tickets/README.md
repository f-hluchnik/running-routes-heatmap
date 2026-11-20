# Tickets

Work is split into small tickets, done in order. Each ticket file records the
goal, acceptance criteria, what was done and the refactor that followed, so a new
session or contributor can pick up from here.

| ID | Title | Status |
|----|-------|--------|
| [RH-001](RH-001-scaffolding.md) | Project scaffolding & tooling | Done |
| [RH-002](RH-002-gpx-loading.md) | GPX loading into domain model | Done |
| [RH-003](RH-003-geometry.md) | Geometry: projection, simplify, resample | Done |
| [RH-004](RH-004-frequency.md) | Frequency analysis | Done |
| [RH-005](RH-005-dataset-cli.md) | Dataset export, HTML builder & CLI | Done |
| [RH-006](RH-006-map-frontend.md) | Map frontend: glow view, optional OSM | Done |
| [RH-007](RH-007-frequency-view.md) | Frequency colour view + legend | Done |
| [RH-008](RH-008-png-export.md) | PNG export | Done |
| [RH-009](RH-009-docs.md) | Docs incl. Garmin download guide | Done |

Backlog (not scheduled): see [BACKLOG.md](BACKLOG.md).

## Architecture in one paragraph

Python does the data work, the browser does the drawing. `gpx_io` parses GPX into
`Run` objects; `geometry` projects them to local metres and resamples them;
`frequency` counts how many distinct runs pass near each segment; `dataset`
serialises that to JSON; `page` embeds the JSON, Leaflet and the front-end code
into one self-contained HTML file. The front-end draws routes on a canvas layer
so the exact same drawing code can render the PNG export.
