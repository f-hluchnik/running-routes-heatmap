# RH-016 Synthetic sample data + README screenshots

**Status:** Done (backlog item 7)

## Goal
Let anyone try the tool without their own GPS data, and show it in the README
without publishing a real person's routes.

## Acceptance criteria
- `examples/sample-data/` holds 10 synthetic GPX runs (~240 KB):
  `running-heatmap examples/sample-data --serve` works out of the box.
- `scripts/make_sample_data.py` regenerates them reproducibly (seeded; only
  `random()`, `uniform()` and `gauss()` are used so the sequence is stable across
  Python versions).
- `scripts/make_screenshots.py` regenerates `docs/images/glow.png` and
  `frequency.png` from the sample data (headless Chromium).
- README shows both views.
- Tests: the committed files load and build a dataset, match the generator
  (compared by coordinates with a tolerance, not bytes), the generator is
  deterministic, and all runs start from the same "home".

## How the data is made
A fictional 14 x 10 street grid (110 m blocks, crossings jittered by up to 18 m,
15 % of streets removed while keeping the town connected). Each run is a loop from
one home crossing through one of three favourite places and 1-2 random ones,
following shortest paths with per-run street-length noise so routes vary but
favourites form busy corridors. GPS fixes every 4 s at 3 m/s with 2.5 m noise.
Located at an arbitrary point (51.0 N, 10.0 E); the street layout does not match
OpenStreetMap, so use the sample data without a basemap.

## Decisions
- Scripts live in `scripts/`, outside the package: they are development tools,
  not part of the product.
- Screenshots are shown without a basemap (no network in CI, and no copyright
  question about map tiles in the README).

## Refactor notes
- First draft of `walk()` tracked leftover distance between streets with two
  conflicting variables; rewritten to place fixes by distance along the whole
  route.
- While regenerating screenshots I noticed the panel hid part of the map and the
  date inputs were truncated: the initial fit now leaves room for the panel
  (`fitDataInView`) and the panel is 256 px wide.
