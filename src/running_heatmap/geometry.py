"""Projection and path clean-up in a local metric coordinate system."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import shapely
import shapely.ops

from .model import LonLat

EARTH_RADIUS_M = 6_371_008.8


@dataclass(frozen=True)
class LocalProjection:
    """Equirectangular projection centred on a point.

    Accurate to well under a metre over a city-sized area, which is all a running
    heatmap needs, and it avoids a dependency on ``pyproj``.
    """

    lon0: float
    lat0: float

    @classmethod
    def centred_on(cls, segments: list[LonLat]) -> LocalProjection:
        """Centre the projection on the bounding box of all ``segments``."""
        points = np.concatenate(segments)
        (lon_min, lat_min), (lon_max, lat_max) = points.min(axis=0), points.max(axis=0)
        return cls(lon0=(lon_min + lon_max) / 2, lat0=(lat_min + lat_max) / 2)

    def _metres_per_degree(self) -> np.ndarray:
        per_degree = EARTH_RADIUS_M * np.pi / 180
        return np.array([per_degree * np.cos(np.radians(self.lat0)), per_degree])

    def forward(self, lonlat: LonLat) -> np.ndarray:
        """Convert ``(lon, lat)`` degrees to ``(x, y)`` metres from the centre."""
        return (lonlat - (self.lon0, self.lat0)) * self._metres_per_degree()

    def inverse(self, xy: np.ndarray) -> LonLat:
        """Convert ``(x, y)`` metres back to ``(lon, lat)`` degrees."""
        return xy / self._metres_per_degree() + (self.lon0, self.lat0)


def clean_path(xy: np.ndarray, *, simplify_tolerance: float, max_step: float) -> np.ndarray:
    """Remove GPS jitter and re-sample so no step is longer than ``max_step`` metres.

    Simplifying first drops redundant points (standing still, collinear samples);
    re-sampling afterwards guarantees an even density for the frequency analysis.
    Returns an empty ``(0, 2)`` array for paths with no length.
    """
    line = shapely.LineString(xy)
    if line.length == 0:
        return np.empty((0, 2))
    simplified = line.simplify(simplify_tolerance, preserve_topology=False)
    return shapely.get_coordinates(shapely.segmentize(simplified, max_step))


def path_length(xy: np.ndarray) -> float:
    """Length in metres of the polyline through ``xy``."""
    return float(np.hypot(*np.diff(xy, axis=0).T).sum()) if len(xy) > 1 else 0.0


def trim_ends(xy: np.ndarray, *, start: float, end: float) -> np.ndarray:
    """Cut ``start`` metres off the beginning and ``end`` metres off the end of a path.

    Useful to hide where a run starts and finishes (usually home). Returns an empty
    array if nothing is left.
    """
    if len(xy) < 2 or (start <= 0 and end <= 0):
        return xy
    line = shapely.LineString(xy)
    if start + end >= line.length:
        return np.empty((0, 2))
    kept = shapely.line_merge(shapely.ops.substring(line, start, line.length - end))
    return shapely.get_coordinates(kept)
