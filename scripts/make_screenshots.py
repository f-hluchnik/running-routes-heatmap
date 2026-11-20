#!/usr/bin/env python3
"""Regenerate the README screenshots from the synthetic sample data.

Needs the browser extras: ``pip install -e ".[e2e]" && playwright install chromium``.

    python scripts/make_screenshots.py
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SAMPLE_DATA = ROOT / "examples" / "sample-data"
IMAGES = ROOT / "docs" / "images"
VIEWPORT = {"width": 1280, "height": 800}
SHOTS = {"glow": "glow.png", "frequency": "frequency.png"}


def main() -> None:
    IMAGES.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        page_file = Path(temp) / "heatmap.html"
        subprocess.run(
            [sys.executable, "-m", "running_heatmap", str(SAMPLE_DATA), "-o", str(page_file)],
            check=True,
            cwd=ROOT,
        )
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page(viewport=VIEWPORT)
            page.goto(page_file.as_uri())
            page.wait_for_selector("canvas.routes-canvas")
            for view, filename in SHOTS.items():
                page.click(f"label:has(input[value={view}])")
                page.wait_for_timeout(300)  # repaint happens on the next animation frame
                page.screenshot(path=IMAGES / filename)
                print(IMAGES / filename)
            browser.close()


if __name__ == "__main__":
    main()
