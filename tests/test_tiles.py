from __future__ import annotations

import json

import pytest

from running_heatmap.cli import main
from running_heatmap.dataset import build_dataset
from running_heatmap.gpx_io import load_run
from running_heatmap.tiles import TileSource

URL = "https://tiles.example.test/{z}/{x}/{y}.png?key=abc"
TRACK = [(16.60 + i * 0.0005, 49.2) for i in range(32)]


def test_valid_source_is_accepted_with_optional_placeholders():
    TileSource(URL, "© Example")
    TileSource("http://{s}.tiles.test/{z}/{x}/{y}{r}.png", "© Example")


@pytest.mark.parametrize(
    ("url", "attribution", "message"),
    [
        ("ftp://tiles.test/{z}/{x}/{y}.png", "© E", "http"),
        ("https://tiles.test/{z}/{x}.png", "© E", "{y}"),
        ("javascript:alert({z}{x}{y})", "© E", "http"),
        (URL, "  ", "attribution"),
    ],
)
def test_invalid_sources_are_rejected(url, attribution, message):
    with pytest.raises(ValueError, match=message.replace("{", r"\{").replace("}", r"\}")):
        TileSource(url, attribution)


def test_dataset_json_carries_the_tile_source(write_gpx):
    run = load_run(write_gpx("a.gpx", TRACK))

    with_tiles = json.loads(build_dataset([run], tiles=TileSource(URL, "© Example")).to_json())
    without = json.loads(build_dataset([run]).to_json())

    assert with_tiles["tiles"] == {"url": URL, "attribution": "© Example"}
    assert without["tiles"] is None


def test_cli_passes_tiles_through(write_gpx, tmp_path, capsys):
    write_gpx("a.gpx", TRACK)
    output = tmp_path / "map.html"

    code = main([str(tmp_path), "-o", str(output), "--tiles", URL, "--tiles-attribution", "© Ex"])

    assert code == 0
    assert "tiles.example.test" in output.read_text(encoding="utf-8")


@pytest.mark.parametrize("extra", [["--tiles", URL], ["--tiles-attribution", "© Ex"]])
def test_cli_requires_tiles_and_attribution_together(write_gpx, tmp_path, extra):
    write_gpx("a.gpx", TRACK)

    with pytest.raises(SystemExit) as exit_info:
        main([str(tmp_path), "-o", str(tmp_path / "m.html"), *extra])

    assert exit_info.value.code == 2


def test_cli_reports_an_invalid_tile_url(write_gpx, tmp_path, capsys):
    write_gpx("a.gpx", TRACK)

    code = main(
        [
            str(tmp_path),
            "-o",
            str(tmp_path / "m.html"),
            "--tiles",
            "nope",
            "--tiles-attribution",
            "x",
        ]
    )

    assert code == 1
    assert "Tile URL" in capsys.readouterr().err
