from __future__ import annotations

import numpy as np

from running_heatmap.frequency import segment_frequencies

CELL = 10.0


def line(x0: float, x1: float, y: float = 0.0, step: float = 5.0) -> np.ndarray:
    xs = np.arange(x0, x1 + step / 2, step)
    return np.column_stack([xs, np.full_like(xs, y)])


def test_single_path_has_frequency_one_everywhere():
    (freq,) = segment_frequencies([line(0, 100)], cell_size=CELL)

    assert freq.shape == (20,)
    assert set(freq) == {1}


def test_identical_paths_count_each_other():
    first, second = segment_frequencies([line(0, 100), line(0, 100)], cell_size=CELL)

    assert set(first) == set(second) == {2}


def test_partial_overlap_counts_only_shared_stretch():
    first, second = segment_frequencies([line(0, 100), line(50, 150)], cell_size=CELL)

    # The comparison tolerates about one cell (10 m) at the ends of the shared stretch.
    assert first[:8].tolist() == [1] * 8  # x < 40: only the first run
    assert first[-8:].tolist() == [2] * 8  # x > 60: shared
    assert second[:8].tolist() == [2] * 8
    assert second[-6:].tolist() == [1] * 6  # x > 120: only the second run


def test_gps_noise_within_a_cell_still_counts_as_the_same_road():
    first, second = segment_frequencies([line(0, 100, y=0), line(0, 100, y=6)], cell_size=CELL)

    assert set(first) == set(second) == {2}


def test_parallel_roads_far_apart_are_separate():
    first, second = segment_frequencies([line(0, 100, y=0), line(0, 100, y=40)], cell_size=CELL)

    assert set(first) == set(second) == {1}


def test_run_doubling_back_counts_once():
    out_and_back = np.vstack([line(0, 100), line(100, 0)])

    (freq,) = segment_frequencies([out_and_back], cell_size=CELL)

    assert set(freq) == {1}


def test_works_with_negative_coordinates():
    shifted = [line(-200, -100, y=-300), line(-200, -100, y=-300)]

    first, _ = segment_frequencies(shifted, cell_size=CELL)

    assert set(first) == {2}


def test_degenerate_inputs():
    empty = np.empty((0, 2))
    single = np.array([[1.0, 1.0]])

    assert [f.size for f in segment_frequencies([empty, single], cell_size=CELL)] == [0, 0]
    assert segment_frequencies([], cell_size=CELL) == []
    results = segment_frequencies([empty, line(0, 20)], cell_size=CELL)
    assert results[0].size == 0
    assert results[1].tolist() == [1] * 4
