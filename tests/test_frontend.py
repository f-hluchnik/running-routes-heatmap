"""Browser smoke tests for the generated page (skipped if Playwright/Chromium is missing)."""

from __future__ import annotations

import struct

import pytest

from running_heatmap.dataset import build_dataset
from running_heatmap.gpx_io import load_run
from running_heatmap.page import render_page
from running_heatmap.tiles import TileSource

sync_api = pytest.importorskip("playwright.sync_api")

VIEWPORT = {"width": 900, "height": 600}
CUSTOM_TILE_HOST = "https://tiles.example.test"
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


def open_page(browser, tmp_path_factory, write_gpx, *, tiles: TileSource | None = None):
    """Build the page for two overlapping runs and open it with OSM and custom tiles mocked."""
    runs = [load_run(write_gpx("a.gpx", EAST)), load_run(write_gpx("b.gpx", NORTH_EAST))]
    html = tmp_path_factory.mktemp("site") / "map.html"
    html.write_text(render_page(build_dataset(runs, tiles=tiles)), encoding="utf-8")

    context = browser.new_context(viewport=VIEWPORT, accept_downloads=True)
    for pattern in ("https://tile.openstreetmap.org/**", f"{CUSTOM_TILE_HOST}/**"):
        context.route(
            pattern,
            lambda route: route.fulfill(
                body=TILE, content_type="image/png", headers={"Access-Control-Allow-Origin": "*"}
            ),
        )
    tab = context.new_page()
    tab.errors = []
    tab.on("pageerror", lambda error: tab.errors.append(str(error)))
    tab.goto(html.as_uri())
    tab.wait_for_selector("canvas.routes-canvas")
    tab.evaluate("document.getElementById('export-options').open = true")  # collapsed by default
    tab.wait_for_timeout(200)
    return context, tab


@pytest.fixture
def page(browser, tmp_path_factory, write_gpx):
    context, tab = open_page(browser, tmp_path_factory, write_gpx)
    yield tab
    context.close()
    assert tab.errors == []


@pytest.fixture
def page_with_custom_tiles(browser, tmp_path_factory, write_gpx):
    tiles = TileSource(f"{CUSTOM_TILE_HOST}/{{z}}/{{x}}/{{y}}.png", "© Example <b>Maps</b>")
    context, tab = open_page(browser, tmp_path_factory, write_gpx, tiles=tiles)
    yield tab
    context.close()
    assert tab.errors == []


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


@pytest.mark.parametrize("basemap", ["osm-muted", "osm-dark", "osm-original"])
def test_basemap_choice_adds_and_removes_tiles(page, basemap):
    page.select_option("#basemap", basemap)
    page.wait_for_selector("img.leaflet-tile-loaded")
    assert "OpenStreetMap" in page.inner_text(".leaflet-control-attribution")

    page.select_option("#basemap", "none")
    assert page.locator("img.leaflet-tile").count() == 0


def test_basemap_styles_differ_only_by_filter(page):
    filter_of = "document.querySelector('.leaflet-tile-pane').style.filter"
    page.select_option("#basemap", "osm-muted")
    muted = page.evaluate(filter_of)
    page.select_option("#basemap", "osm-dark")
    dark = page.evaluate(filter_of)
    page.select_option("#basemap", "osm-original")

    assert "grayscale" in muted
    assert "invert" in dark
    assert page.evaluate(filter_of) == ""


def test_there_is_no_custom_basemap_unless_tiles_were_given(page):
    assert page.locator("#basemap option[value=custom]").count() == 0


def test_custom_tiles_are_offered_and_credited_safely(page_with_custom_tiles):
    page = page_with_custom_tiles

    page.select_option("#basemap", "custom")
    page.wait_for_selector("img.leaflet-tile-loaded")

    attribution = page.inner_text(".leaflet-control-attribution")
    assert "Example <b>Maps</b>" in attribution  # shown as text, not interpreted as HTML
    assert page.locator(".leaflet-control-attribution b").count() == 0
    assert "tiles.example.test" in page.get_attribute("img.leaflet-tile", "src")


@pytest.mark.parametrize("basemap", ["none", "osm-dark"])
def test_png_export_is_twice_the_viewport(page, tmp_path, basemap):
    page.select_option("#basemap", basemap)
    with page.expect_download() as download:
        page.click("#export")
    target = tmp_path / "export.png"
    download.value.save_as(target)

    assert png_size(target) == (VIEWPORT["width"] * 2, VIEWPORT["height"] * 2)
    assert (basemap in download.value.suggested_filename) is (basemap != "none")


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


def route_screen_point(page) -> tuple[float, float]:
    """A point on the first run's route, in page coordinates."""
    return page.evaluate(
        """() => {
            const route = data.routes[0];
            const mid = Math.floor(route.x.length / 2);
            const frame = frameFromMap(map);
            const box = map.getContainer().getBoundingClientRect();
            return [route.x[mid] * frame.worldSize - frame.left + box.left,
                    route.y[mid] * frame.worldSize - frame.top + box.top];
        }"""
    )


def test_hovering_a_route_shows_run_details(page):
    x, y = route_screen_point(page)

    page.mouse.move(x, y)

    tooltip = page.locator("#tooltip")
    tooltip.wait_for(state="visible")
    assert "Test run" in tooltip.inner_text()
    assert "2025-08-11" in tooltip.inner_text()
    assert "km" in tooltip.inner_text()


def test_tooltip_hides_when_the_pointer_leaves_the_route(page):
    x, y = route_screen_point(page)
    page.mouse.move(x, y)
    page.locator("#tooltip").wait_for(state="visible")

    page.mouse.move(x, y + 150)

    assert not page.is_visible("#tooltip")


def export(page, tmp_path, name="export.png"):
    with page.expect_download() as download:
        page.click("#export")
    target = tmp_path / name
    download.value.save_as(target)
    return target


@pytest.mark.parametrize("scale", [1, 3, 4])
def test_export_resolution_is_selectable_and_previewed(page, tmp_path, scale):
    page.select_option("#export-scale", str(scale))
    expected = (VIEWPORT["width"] * scale, VIEWPORT["height"] * scale)
    assert page.inner_text("#export-size") == f"{expected[0]} \u00d7 {expected[1]} px"

    assert png_size(export(page, tmp_path)) == expected


def test_export_can_cover_all_shown_runs_instead_of_the_current_view(page, tmp_path):
    from PIL import Image

    page.evaluate("map.setView([49.2, 16.6078], 19)")  # so close that the runs run off the screen
    page.wait_for_timeout(200)
    page.check("#export-transparent")

    def drawn_area(path):
        """Bounding box of the non-transparent pixels, and the image width."""
        alpha = Image.open(path).convert("RGBA").getchannel("A")
        return alpha.point(lambda value: 255 if value else 0).getbbox(), alpha.width

    (left, _, right, _), width = drawn_area(export(page, tmp_path, "view.png"))
    assert (left, right) == (0, width)  # the routes cross the whole image

    page.select_option("#export-extent", "all")
    (left, _, right, _), width = drawn_area(export(page, tmp_path, "all.png"))
    assert 0 < left < width * 0.1  # whole runs, with a small margin on both sides
    assert width * 0.9 < right < width


def test_transparent_background_has_transparent_pixels(page, tmp_path):
    from PIL import Image

    page.check("#export-transparent")

    corner = Image.open(export(page, tmp_path)).convert("RGBA").getpixel((0, 0))

    assert corner[3] == 0


def test_opaque_background_by_default(page, tmp_path):
    from PIL import Image

    corner = Image.open(export(page, tmp_path)).convert("RGBA").getpixel((0, 0))

    assert corner == (0x14, 0x16, 0x1A, 255)


def test_transparent_background_is_unavailable_with_a_basemap(page):
    page.check("#export-transparent")

    page.select_option("#basemap", "osm-muted")
    assert page.is_disabled("#export-transparent")
    assert not page.is_checked("#export-transparent")

    page.select_option("#basemap", "none")
    assert page.is_enabled("#export-transparent")


def test_export_reports_unreachable_tiles_instead_of_downloading(page):
    page.context.route("https://tile.openstreetmap.org/**", lambda route: route.abort())
    page.select_option("#basemap", "osm-muted")

    page.click("#export")
    page.wait_for_function("document.getElementById('status').textContent.includes('No map tiles')")

    assert page.locator("#status.error").count() == 1
    assert page.is_enabled("#export")
