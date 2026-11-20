"""Reading a Garmin FIT file into a :class:`~running_heatmap.model.Run`."""

from __future__ import annotations

import logging
from pathlib import Path

import fitdecode
import numpy as np

from .model import MIN_POINTS_PER_SEGMENT, Run

logger = logging.getLogger(__name__)

_DEGREES_PER_SEMICIRCLE = 180 / 2**31
_SPORT_MESSAGES = ("sport", "session")


def load_run(path: Path) -> Run | None:
    """Parse one FIT file; return ``None`` if it is invalid or has no GPS track."""
    points: list[tuple[float, float]] = []
    started_at = None
    sport = None

    try:
        with fitdecode.FitReader(path, check_crc=fitdecode.CrcCheck.RAISE) as reader:
            for frame in reader:
                if not isinstance(frame, fitdecode.FitDataMessage):
                    continue
                if frame.name == "record":
                    position = _position(frame)
                    if position is not None:
                        points.append(position)
                        started_at = started_at or frame.get_value("timestamp", fallback=None)
                elif frame.name in _SPORT_MESSAGES:
                    sport = sport or frame.get_value("sport", fallback=None)
    except (fitdecode.FitError, OSError) as error:
        logger.warning("Cannot read %s: %s", path.name, error)
        return None

    if len(points) < MIN_POINTS_PER_SEGMENT:
        return None
    return Run(
        name=path.stem,
        started_at=started_at,
        segments=(np.array(points, dtype=float),),
        sport=str(sport) if sport else None,
    )


def _position(record: fitdecode.FitDataMessage) -> tuple[float, float] | None:
    """The record's ``(lon, lat)`` in degrees, or ``None`` if it has no GPS fix."""
    lat = record.get_value("position_lat", fallback=None)
    lon = record.get_value("position_long", fallback=None)
    if lat is None or lon is None:
        return None
    return lon * _DEGREES_PER_SEMICIRCLE, lat * _DEGREES_PER_SEMICIRCLE
