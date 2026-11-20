"""Browser smoke tests for the generated page (skipped if Playwright/Chromium is missing)."""

from __future__ import annotations

import struct

import pytest

from running_heatmap.dataset import build_dataset
from running_heatmap.gpx_io import load_run
from running_heatmap.page import render_page

sync_api = pytest.importorskip("playwright.sync_api")

VIEWPORT = {"width": 900, "height": 600}
EAST = [(16.60 + i * 0.0005, 49.2) for i in range(32)]
NORTH_EAST = [(16.60 + i * 0.0005, 49.2 + i * 0.0001) for i in range(32)]
# 1x1 transparent-ish PNG standing in for an OpenStreetMap tile.
TILE = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c6360f8cfc0f01f0005000201a1bd6cd90000000049454e44ae426082"
)


@pytest.fixture(scope="module")
def browser():
    with sync_api.sync_playwright() as playwright:
        try:
            instance = playwright.chromium.launch()
        except sync_api.Error as error:
            pytest.skip(f"Chromium not available: {error}")
        yield instance
        instance.close()


@pytest.fixture
def page(browser, tmp_path_factory, write_gpx):
    runs = [load_run(write_gpx("a.gpx", EAST)), load_run(write_gpx("b.gpx", NORTH_EAST))]
    html = tmp_path_factory.mktemp("site") / "map.html"
    html.write_text(render_page(build_dataset(runs)), encoding="utf-8")

    context = browser.new_context(viewport=VIEWPORT, accept_downloads=True)
    context.route(
        "https://tile.openstreetmap.org/**",
        lambda route: route.fulfill(
            body=TILE,
            content_type="image/png",
            headers={"Access-Control-Allow-Origin": "*"},
        ),
    )
    tab = context.new_page()
    errors: list[str] = []
    tab.on("pageerror", lambda error: errors.append(str(error)))
    tab.goto(html.as_uri())
    tab.wait_for_selector("canvas.routes-canvas")
    tab.wait_for_timeout(200)
    yield tab
    context.close()
    assert errors == []


def painted_pixels(page) -> int:
    return page.evaluate(
        """() => {
            const canvas = document.querySelector("canvas.routes-canvas");
            const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
            return pixels.data.filter((value, i) => i % 4 === 3 && value > 0).length;
        }"""
    )


def png_size(path) -> tuple[int, int]:
    header = path.read_bytes()[:24]
    assert header[:8] == b"\x89PNG\r\n\x1a\n"
    return struct.unpack(">II", header[16:24])


@pytest.mark.parametrize("view", ["glow", "frequency"])
def test_each_view_paints_routes(page, view):
    page.click(f"label:has(input[value={view}])")
    page.wait_for_timeout(200)

    assert painted_pixels(page) > 0


def test_frequency_view_shows_legend_and_hides_opacity(page):
    assert page.is_visible("#opacity-row")
    assert not page.is_visible("#legend")

    page.click("label:has(input[value=frequency])")

    assert page.is_visible("#legend")
    assert not page.is_visible("#opacity-row")


def test_basemap_toggle_adds_and_removes_tiles(page):
    page.check("#basemap")
    page.wait_for_selector("img.leaflet-tile-loaded")
    assert "OpenStreetMap" in page.inner_text(".leaflet-control-attribution")

    page.uncheck("#basemap")
    assert page.locator("img.leaflet-tile").count() == 0


@pytest.mark.parametrize("basemap", [False, True])
def test_png_export_is_twice_the_viewport(page, tmp_path, basemap):
    if basemap:
        page.check("#basemap")
    with page.expect_download() as download:
        page.click("#export")
    target = tmp_path / "export.png"
    download.value.save_as(target)

    assert png_size(target) == (VIEWPORT["width"] * 2, VIEWPORT["height"] * 2)
    assert ("-osm" in download.value.suggested_filename) is basemap


def test_run_filter_recounts_frequencies_and_updates_the_summary(page):
    page.click("label:has(input[value=frequency])")
    assert page.inner_text("#run-count") == "2 of 2"
    assert page.inner_text("#legend-max") == "2"

    page.uncheck("#run-0")

    assert page.inner_text("#run-count") == "1 of 2"
    assert page.inner_text("#legend-max") == "1"  # one run left, so nothing is run twice

    page.click("#runs-all")
    assert page.inner_text("#legend-max") == "2"
    page.click("#runs-none")
    assert page.inner_text("#run-count") == "0 of 2"
    page.wait_for_timeout(100)  # repaint is scheduled on the next animation frame
    assert painted_pixels(page) == 0


def test_date_range_hides_runs_outside_it(page):
    page.fill("#date-from", "2025-08-12")  # both fixture runs are on 2025-08-11
    assert page.inner_text("#run-count") == "0 of 2"

    page.fill("#date-from", "2025-08-11")
    assert page.inner_text("#run-count") == "2 of 2"
