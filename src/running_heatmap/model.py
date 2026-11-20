"""Domain objects shared by the pipeline stages."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

import numpy as np

LonLat = np.ndarray
"""Array of shape ``(n, 2)`` holding ``(longitude, latitude)`` in degrees."""


@dataclass(frozen=True, eq=False)
class Run:
    """One recorded activity: a name, a start time and one or more GPS segments."""

    name: str
    started_at: datetime | None
    segments: tuple[LonLat, ...]

    @property
    def date(self) -> str | None:
        """ISO date (``YYYY-MM-DD``) the run started on, if known."""
        return self.started_at.date().isoformat() if self.started_at else None
