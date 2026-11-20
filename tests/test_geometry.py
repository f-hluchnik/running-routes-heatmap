from __future__ import annotations

import numpy as np
import pytest

from running_heatmap.geometry import LocalProjection, clean_path, path_length, trim_ends


def test_projection_round_trips():
    projection = LocalProjection(lon0=16.6, lat0=49.2)
    lonlat = np.array([[16.59, 49.19], [16.61, 49.21]])

    np.testing.assert_allclose(projection.inverse(projection.forward(lonlat)), lonlat)


def test_projection_gives_metres():
    projection = LocalProjection(lon0=16.6, lat0=49.2)

    east, north = projection.forward(np.array([[16.6 + 0.001, 49.2 + 0.001]]))[0]

    assert north == pytest.approx(111.2, rel=0.01)  # 0.001 deg latitude ~ 111 m
    assert east == pytest.approx(111.2 * np.cos(np.radians(49.2)), rel=0.01)


def test_projection_centres_on_bounding_box():
    projection = LocalProjection.centred_on([np.array([[16.0, 49.0], [17.0, 50.0]])])

    assert (projection.lon0, projection.lat0) == (16.5, 49.5)


def test_clean_path_splits_long_steps_and_keeps_endpoints():
    xy = np.array([[0.0, 0.0], [100.0, 0.0]])

    cleaned = clean_path(xy, simplify_tolerance=1.0, max_step=5.0)

    assert np.diff(cleaned[:, 0]).max() <= 5.0 + 1e-9
    np.testing.assert_allclose(cleaned[[0, -1]], xy)


def test_clean_path_drops_jitter_below_tolerance():
    xy = np.array([[0.0, 0.0], [5.0, 0.3], [10.0, -0.3], [15.0, 0.2], [20.0, 0.0]])

    cleaned = clean_path(xy, simplify_tolerance=1.0, max_step=100.0)

    assert len(cleaned) == 2


def test_clean_path_of_standing_still_is_empty():
    xy = np.zeros((4, 2))

    assert clean_path(xy, simplify_tolerance=1.0, max_step=5.0).shape == (0, 2)


def test_path_length():
    assert path_length(np.array([[0, 0], [3, 4], [3, 14]])) == pytest.approx(15.0)
    assert path_length(np.array([[0.0, 0.0]])) == 0.0


def test_trim_ends_cuts_distance_from_both_ends():
    xy = np.array([[0.0, 0.0], [100.0, 0.0]])

    trimmed = trim_ends(xy, start=10.0, end=20.0)

    np.testing.assert_allclose(trimmed, [[10.0, 0.0], [80.0, 0.0]])


def test_trim_ends_follows_corners():
    xy = np.array([[0.0, 0.0], [50.0, 0.0], [50.0, 50.0]])

    trimmed = trim_ends(xy, start=20.0, end=20.0)

    np.testing.assert_allclose(trimmed, [[20.0, 0.0], [50.0, 0.0], [50.0, 30.0]])


def test_trim_ends_without_trimming_returns_input_and_too_short_paths_vanish():
    xy = np.array([[0.0, 0.0], [10.0, 0.0]])

    assert trim_ends(xy, start=0, end=0) is xy
    assert trim_ends(xy, start=6, end=6).shape == (0, 2)
