# RH-017 GitHub Actions CI

**Status:** Done (backlog item 8)

## Goal
Every push to `main` and every pull request runs the whole safety net.

## What runs
`.github/workflows/ci.yml`, on Python 3.11 (the minimum supported version) and
3.13, with Node 22:

1. `pip install -e ".[dev,e2e]"` and `playwright install --with-deps chromium`
2. `ruff check .` and `ruff format --check .`
3. `pytest` - Python unit tests, the JavaScript unit tests (`node --test`, run by
   `tests/test_js.py`) and the Playwright browser tests (tiles are mocked, so no
   network access is needed).

## Decisions
- Read-only token (`permissions: contents: read`); superseded runs on the same
  ref are cancelled.
- One job doing everything keeps the setup simple; split it if it gets slow
  (currently ~20 s of tests).
- Not run locally: I could validate the YAML syntax and run every step on Python
  3.13, but not on 3.11 or on GitHub's runners. Check the first run of this
  workflow.
