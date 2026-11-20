"""Reading a GPX file into a :class:`~running_heatmap.model.Run`."""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

import gpxpy
import gpxpy.gpx
import numpy as np
from gpxpy.gpx import GPXException

from .model import MIN_POINTS_PER_SEGMENT, Run

logger = logging.getLogger(__name__)


def load_run(path: Path) -> Run | None:
    """Parse one GPX file; return ``None`` if it is invalid or has no track."""
    try:
        with path.open(encoding="utf-8") as handle:
            gpx = gpxpy.parse(handle)
    except (GPXException, UnicodeDecodeError) as error:
        logger.warning("Cannot read %s: %s", path.name, error)
        return None

    segments = tuple(
        coords
        for track in gpx.tracks
        for segment in track.segments
        if len(coords := _segment_coords(segment)) >= MIN_POINTS_PER_SEGMENT
    )
    if not segments:
        return None

    name = next((track.name for track in gpx.tracks if track.name), path.stem)
    return Run(name=name, started_at=_start_time(gpx), segments=segments)


def _segment_coords(segment: gpxpy.gpx.GPXTrackSegment) -> np.ndarray:
    return np.array([(p.longitude, p.latitude) for p in segment.points], dtype=float).reshape(-1, 2)


def _start_time(gpx: gpxpy.gpx.GPX) -> datetime | None:
    start, _ = gpx.get_time_bounds()
    return start or gpx.time
