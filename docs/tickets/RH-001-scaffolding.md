# RH-001 Project scaffolding & tooling

**Status:** Done

## Goal
Replace the single-script prototype with an installable package that has tests
and linting, and keep personal GPS data out of git.

## Acceptance criteria
- `src/` layout, `pyproject.toml` with runtime and dev dependencies.
- `pytest` and `ruff` run from the repo root.
- `data/` and `output/` contents are git-ignored (folders kept with `.gitkeep`).

## Decisions
- **Dropped geopandas and matplotlib.** They are heavy and the interactive map
  does the rendering. Runtime deps are now `gpxpy`, `numpy`, `shapely`.
- **Leaflet is vendored** (`web/vendor/`) so the generated HTML works offline.
- **Existing GPX files stay tracked until you untrack them:** run
  `git rm -r --cached data/*.gpx` once. They remain in git history; rewrite
  history (e.g. `git filter-repo`) if that matters to you.

## Refactor notes
Nothing to refactor yet (configuration only).
