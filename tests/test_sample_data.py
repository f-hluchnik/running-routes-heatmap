"""The committed sample data must be loadable and match its generator."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import numpy as np
import pytest

from running_heatmap.dataset import build_dataset
from running_heatmap.loading import load_runs

ROOT = Path(__file__).resolve().parent.parent
SAMPLE_DATA = ROOT / "examples" / "sample-data"


@pytest.fixture(scope="module")
def generator():
    spec = importlib.util.spec_from_file_location(
        "make_sample_data", ROOT / "scripts" / "make_sample_data.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_sample_data_loads_and_builds_a_dataset():
    runs = load_runs(SAMPLE_DATA)

    dataset = build_dataset(runs)

    assert len(runs) == 10
    assert all(run.date for run in runs)
    assert 20 < sum(run.distance_km for run in dataset.runs) < 40


def test_committed_sample_data_is_up_to_date(generator, tmp_path):
    generator.generate(tmp_path)

    committed, fresh = load_runs(SAMPLE_DATA), load_runs(tmp_path)

    assert [run.name for run in committed] == [run.name for run in fresh]
    for old, new in zip(committed, fresh, strict=True):
        np.testing.assert_allclose(old.segments[0], new.segments[0], atol=1e-5)


def test_generator_is_deterministic(generator, tmp_path):
    first = generator.generate(tmp_path / "a")
    second = generator.generate(tmp_path / "b")

    assert [path.read_bytes() for path in first] == [path.read_bytes() for path in second]


def test_sample_runs_share_streets(generator, tmp_path):
    """Runs start from one home and favour a few places, so some streets are repeated."""
    runs = load_runs(SAMPLE_DATA)
    starts = np.array([run.segments[0][0] for run in runs])

    assert np.ptp(starts, axis=0).max() < 0.001  # all within ~70 m of each other
