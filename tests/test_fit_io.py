from __future__ import annotations

from datetime import UTC, datetime

import numpy as np
import pytest

from running_heatmap.fit_io import load_run

LINE = [(16.60, 49.20), (16.601, 49.201), (16.602, 49.202)]


def test_reads_coordinates_sport_and_start_time(write_fit):
    run = load_run(write_fit("a.fit", LINE, sport="running"))

    assert run is not None
    assert run.name == "a"
    assert run.sport == "running"
    assert run.started_at == datetime(2025, 8, 11, 17, 0, tzinfo=UTC)
    assert run.date == "2025-08-11"
    assert len(run.segments) == 1
    np.testing.assert_allclose(run.segments[0], LINE, atol=1e-6)


def test_sport_is_optional(write_fit):
    run = load_run(write_fit("a.fit", LINE, sport=None))

    assert run is not None
    assert run.sport is None


def test_cycling_is_reported_as_such(write_fit):
    assert load_run(write_fit("a.fit", LINE, sport="cycling")).sport == "cycling"


def test_activity_without_gps_is_skipped(write_fit):
    assert load_run(write_fit("a.fit", [])) is None
    assert load_run(write_fit("b.fit", LINE[:1])) is None


@pytest.mark.parametrize("damage", ["truncate", "flip_byte", "garbage"])
def test_corrupt_files_are_skipped(write_fit, damage):
    path = write_fit("a.fit", LINE)
    data = path.read_bytes()
    path.write_bytes(
        {
            "truncate": data[: len(data) // 2],
            "flip_byte": data[:20] + bytes([data[20] ^ 0xFF]) + data[21:],
            "garbage": b"definitely not a FIT file",
        }[damage]
    )

    assert load_run(path) is None
