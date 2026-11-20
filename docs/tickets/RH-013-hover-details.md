# RH-013 Run details on hover

**Status:** Done (backlog item 6)

## Goal
Point at a route and see which run(s) it is.

## Acceptance criteria
- Within 8 screen pixels of a visible route, a tooltip lists the runs there
  (name, date, distance; nearest first and in bold; at most 5, then "+ n more").
- The nearest run is highlighted (thin white line on a dark halo, so frequency
  colours stay visible).
- Hidden runs (filtered out) cannot be hovered. The tooltip flips at the right
  and bottom edges and hides when the pointer leaves, drags or zooms.
- The highlight is screen-only: it never appears in the PNG export.

## Decisions
- Hit testing (`hit-test.js`, `runsNear`) works in unit-Mercator space: the
  pointer is converted once and the tolerance scaled by the world size, so
  nothing is projected per mouse move. Routes carry a bounding box for quick
  rejection. Pure functions, covered by Node tests.
- Tooltip text is set with `textContent` (run names come from user files).
- Hover changes are compared with the previous hit list, so repainting only
  happens when the set of runs actually changes.

## Refactor notes
- First version highlighted every run under the pointer, which hid the frequency
  colours on busy streets; now only the nearest run is highlighted while the
  tooltip still lists all of them.

## Limitations
- No hover on touch screens.
