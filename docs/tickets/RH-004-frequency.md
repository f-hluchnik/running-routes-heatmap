# RH-004 Frequency analysis

**Status:** Done

## Goal
For every stretch of every route, know how many *different* runs went there. This
drives the "colour by frequency" view.

## Acceptance criteria
- `segment_frequencies(paths, cell_size=...)` returns one int array per path, one
  value per segment, always >= 1 for real segments.
- Tolerates GPS noise of about one cell; parallel roads far apart stay separate.
- A run that doubles back counts once; degenerate inputs do not crash.
- Real data (8 runs, ~20k points) is processed in ~15 ms.

## Decisions
- **Grid hashing instead of geometric buffering.** Cells are integer keys,
  coverage is a 3x3 dilation, counting is one `np.unique`. O(n log n), no
  spatial index needed.
- Default cell size is 10 m (CLI option `--cell-size`). Smaller = stricter
  matching, larger = merges neighbouring streets.
- Consequence of the 3x3 tolerance: the shared stretch of two runs is reported up
  to ~10 m longer at each end. Acceptable visually, documented in a test.

## Refactor notes
- The first draft mixed key encoding and counting in one function with empty-array
  special cases. Extracted a frozen `_Grid` (fits itself to the data, encodes
  cell keys, expands neighbourhoods) so `segment_frequencies` reads top-down.
- Segment midpoints are computed from real coordinates, not from cell indices.
