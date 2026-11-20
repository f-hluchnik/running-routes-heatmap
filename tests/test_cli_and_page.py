from __future__ import annotations

import json
import re

from running_heatmap.cli import main
from running_heatmap.dataset import build_dataset
from running_heatmap.gpx_io import load_run
from running_heatmap.page import render_page

TRACK = [(16.60 + i * 0.0005, 49.2) for i in range(32)]


def embedded_data(html: str) -> dict:
    match = re.search(
        r'<script id="heatmap-data" type="application/json">(.*?)</script>', html, re.S
    )
    assert match
    return json.loads(match[1])


def test_page_embeds_data_and_all_assets(write_gpx):
    dataset = build_dataset([load_run(write_gpx("a.gpx", TRACK))])

    html = render_page(dataset)

    assert embedded_data(html)["runs"][0]["name"] == "Test run"
    assert "Leaflet 1.9.4" in html  # vendored, no CDN needed
    assert "<!--@" not in html
    assert "https://unpkg.com" not in html


def test_run_names_cannot_break_out_of_the_data_script(write_gpx):
    path = write_gpx("a.gpx", TRACK, name="</script><script>alert(1)</script>")

    html = render_page(build_dataset([load_run(path)]))

    assert embedded_data(html)["runs"][0]["name"] == "</script><script>alert(1)</script>"
    assert html.count("<script>alert(1)") == 0


def test_cli_writes_the_page(write_gpx, tmp_path, capsys):
    write_gpx("a.gpx", TRACK)
    output = tmp_path / "out" / "map.html"

    code = main([str(tmp_path), "-o", str(output)])

    assert code == 0
    assert "heatmap-data" in output.read_text(encoding="utf-8")
    assert "1 runs" in capsys.readouterr().out


def test_cli_fails_cleanly_without_data(tmp_path, capsys):
    code = main([str(tmp_path), "-o", str(tmp_path / "map.html")])

    assert code == 1
    assert "No usable .gpx or .fit files" in capsys.readouterr().err


def test_cli_reports_invalid_options(write_gpx, tmp_path, capsys):
    write_gpx("a.gpx", TRACK)

    code = main([str(tmp_path), "-o", str(tmp_path / "m.html"), "--trim-ends", "5000"])

    assert code == 1
    assert "No run has any distance" in capsys.readouterr().err


def test_cli_filters_by_sport(write_fit, tmp_path, capsys):
    write_fit("run.fit", TRACK)
    write_fit("ride.fit", TRACK, sport="cycling")

    assert main([str(tmp_path), "-o", str(tmp_path / "running.html")]) == 0
    assert "1 runs" in capsys.readouterr().out

    assert main([str(tmp_path), "-o", str(tmp_path / "all.html"), "--sport", "any"]) == 0
    assert "2 runs" in capsys.readouterr().out
