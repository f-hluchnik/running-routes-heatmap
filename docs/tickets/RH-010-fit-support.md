# RH-010 FIT file support + sport filter

**Status:** Done (backlog item 1)

## Goal
Garmin's full data export is mostly `.fit`. Read those files directly, and keep
cycling/walking activities out of a *running* heatmap.

## Acceptance criteria
- `.fit` and `.gpx` files in the data folder are both loaded (extension match is
  case-insensitive; other files are ignored).
- FIT records without a GPS fix are skipped; activities without GPS (treadmill)
  are skipped with a warning.
- Corrupt or truncated FIT files (bad CRC) are skipped with a warning, never a crash.
- `--sport running` (default) drops activities that declare another sport;
  `--sport any` keeps everything. GPX files declare no sport and are always kept.

## Decisions
- New module `fit_io` mirrors `gpx_io` (one `load_run(path)` per format);
  `loading.load_runs` dispatches on the file suffix. Adding a format = one reader
  and one dictionary entry.
- `fitdecode` runs with CRC checking set to *raise*: its default only warns and
  happily returns garbage from a damaged file.
- Sport comes from the FIT `sport` or `session` message. Garmin trail running is
  `sport=running`, so it is included.
- `MIN_POINTS_PER_SEGMENT` moved to `model` (shared by both readers).
- Tests build FIT files with a ~50 line writer (`tests/fit_writer.py`) instead of
  committing binary fixtures.

## Known limitations
- A FIT file is read as one segment; pauses are not split.
- Garmin's export wraps activities in zip files: unzip them first.
- If the same activity exists as both `.gpx` and `.fit` it is drawn twice.
