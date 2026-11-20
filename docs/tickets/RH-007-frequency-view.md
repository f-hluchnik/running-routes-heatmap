# RH-007 Frequency colour view + legend

**Status:** Done

## Goal
Second view: colour streets by how many different runs used them.

## Acceptance criteria
- "Frequency" view next to "Glow"; opacity slider hidden (lines are opaque).
- Colour ramp blue -> violet -> pink -> orange -> yellow, log-scaled so 1 vs 2
  runs is as visible as 10 vs 20.
- Most-run streets are drawn on top; each line has a thin dark edge so pale
  colours stay readable on the OSM basemap.
- Legend ("Runs per street", 1 ... max) shown only in this view.

## Decisions
- Segments of equal frequency are merged into *spans* once at load
  (`groupSpansByFrequency`), then drawn level by level: one path and two strokes
  per level instead of one per segment.
- The ramp lives in `colour.js` and also feeds the legend gradient and the PNG
  legend, so colours cannot drift apart.

## Refactor notes
- Edge constants moved above the view that uses them.
- Found in review: round caps on the dark edge stroke left dots where colour
  changes. The edge now uses butt caps, the colour stroke keeps round caps.
