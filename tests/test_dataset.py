from __future__ import annotations

import json

import pytest

from running_heatmap.dataset import Settings, build_dataset
from running_heatmap.gpx_io import load_run

# ~1.1 km due east at latitude 49.2 (0.0155 deg of longitude).
EAST = [(16.60 + i * 0.0005, 49.2) for i in range(32)]
NORTH = [(16.60, 49.2 + i * 0.0003) for i in range(32)]


def runs_from(write_gpx, *tracks):
    return [
        load_run(write_gpx(f"{i}.gpx", track, name=f"run {i}")) for i, track in enumerate(tracks)
    ]


def test_dataset_reports_distance_date_and_frequency(write_gpx):
    dataset = build_dataset(runs_from(write_gpx, EAST, EAST))

    first = dataset.runs[0]
    assert first.name == "run 0"
    assert first.date == "2025-08-11"
    assert first.distance_km == pytest.approx(1.13, abs=0.03)
    assert set(first.routes[0].frequency) == {2}
    assert dataset.max_frequency == 2


def test_runs_going_different_ways_have_frequency_one_except_near_the_shared_corner(write_gpx):
    dataset = build_dataset(runs_from(write_gpx, EAST, NORTH))

    freq = dataset.runs[0].routes[0].frequency
    assert freq[0] == 2  # both runs start at the same point
    assert freq[-1] == 1


def test_json_is_compact_and_complete(write_gpx):
    dataset = build_dataset(runs_from(write_gpx, EAST))

    payload = json.loads(dataset.to_json())

    route = payload["runs"][0]["routes"][0]
    assert len(route["freq"]) == len(route["coords"]) - 1
    lat, lon = route["coords"][0]
    assert (lat, lon) == pytest.approx((49.2, 16.6), abs=1e-4)
    (south, west), (north, east) = payload["bounds"]
    assert south <= lat <= north
    assert west <= lon <= east
    assert payload["maxFrequency"] == 1
    assert " " not in dataset.to_json().split('"name"')[0]  # separators are compact


def test_trim_ends_shortens_routes(write_gpx):
    runs = runs_from(write_gpx, EAST)

    full = build_dataset(runs).runs[0].routes[0].coords
    trimmed = build_dataset(runs, Settings(trim_ends=200.0)).runs[0].routes[0].coords

    assert len(trimmed) < len(full)
    assert trimmed[:, 1].min() > full[:, 1].min()
    assert trimmed[:, 1].max() < full[:, 1].max()


def test_run_entirely_inside_trim_zone_is_dropped(write_gpx):
    runs = runs_from(write_gpx, EAST, EAST[:3])  # second run is only ~70 m long

    dataset = build_dataset(runs, Settings(trim_ends=100.0))

    assert [run.name for run in dataset.runs] == ["run 0"]


def test_nothing_left_to_draw_is_an_error(write_gpx):
    with pytest.raises(ValueError, match="No run"):
        build_dataset(runs_from(write_gpx, EAST), Settings(trim_ends=1000.0))


@pytest.mark.parametrize(
    "kwargs",
    [{"cell_size": 0.0}, {"trim_ends": -1.0}, {"simplify_tolerance": -0.5}],
)
def test_invalid_settings_are_rejected(kwargs):
    with pytest.raises(ValueError):
        Settings(**kwargs)


def test_sampling_step_is_capped_and_always_finer_than_a_cell():
    assert Settings().max_step == 5.0
    assert Settings(cell_size=4.0).max_step == 2.0
