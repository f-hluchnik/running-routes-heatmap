from __future__ import annotations

from datetime import UTC, datetime

import numpy as np

from running_heatmap.model import Run

SEGMENT = (np.zeros((2, 2)),)


def test_date_is_iso_formatted():
    run = Run("x", datetime(2025, 1, 2, 23, 30, tzinfo=UTC), SEGMENT)

    assert run.date == "2025-01-02"


def test_date_is_none_when_start_time_is_unknown():
    assert Run("x", None, SEGMENT).date is None
