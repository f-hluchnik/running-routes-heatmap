from __future__ import annotations

import numpy as np

from running_heatmap.gpx_io import load_run

LINE = [(16.60, 49.20), (16.601, 49.201), (16.602, 49.202)]


def test_load_run_reads_coordinates_name_and_start(write_gpx):
    run = load_run(write_gpx("a.gpx", LINE, name="Morning"))

    assert run is not None
    assert run.name == "Morning"
    assert run.started_at is not None
    assert len(run.segments) == 1
    np.testing.assert_allclose(run.segments[0], LINE)


def test_segments_are_kept_separate(write_gpx):
    run = load_run(write_gpx("a.gpx", LINE, LINE[::-1]))

    assert run is not None
    assert len(run.segments) == 2


def test_run_without_track_points_is_skipped(write_gpx):
    assert load_run(write_gpx("empty.gpx")) is None
    assert load_run(write_gpx("single.gpx", [(16.6, 49.2)])) is None


def test_invalid_xml_is_skipped(tmp_path):
    broken = tmp_path / "broken.gpx"
    broken.write_text("<gpx><oops>", encoding="utf-8")

    assert load_run(broken) is None
