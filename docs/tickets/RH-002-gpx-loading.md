# RH-002 GPX loading into domain model

**Status:** Done

## Goal
Read GPX files into a small domain model that the rest of the pipeline uses.

## Acceptance criteria
- `load_runs(dir)` returns `Run` objects sorted by file name.
- Broken XML, empty tracks and single-point tracks are skipped with a log warning.
- Track segments are kept separate so pauses/gaps are never drawn as a line.
- Verified against the 8 real Garmin files in `data/`.

## Decisions
- `Run` holds `(lon, lat)` numpy arrays, one per GPX segment. Elevation, time per
  point and heart rate are deliberately ignored: a heatmap does not need them.

## Refactor notes
- Added the missing return type on `_start_time`; kept `load_run` free of
  file-system globbing so it is easy to test.
