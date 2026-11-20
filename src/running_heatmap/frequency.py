"""How many different runs pass along each stretch of every route."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

_NEIGHBOUR_OFFSETS = np.array([(dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)])


def segment_frequencies(paths: list[np.ndarray], *, cell_size: float) -> list[np.ndarray]:
    """Count, for every segment of every path, the distinct paths running alongside it.

    Space is divided into square cells of ``cell_size`` metres. A path *covers* a cell
    if one of its points lies in it or in one of the eight surrounding cells, which
    makes the comparison tolerant to GPS noise of about one cell. The frequency of a
    segment is the number of paths covering the cell of its midpoint, including its
    own path (so it is always at least 1). A path that doubles back over itself still
    counts once.

    Each path must be an ``(n, 2)`` array of metres whose steps do not exceed
    ``cell_size`` (see :func:`running_heatmap.geometry.clean_path`).
    Returns one integer array of length ``n - 1`` per path (empty for paths with
    fewer than two points).
    """
    usable = [path for path in paths if len(path) >= 2]
    if not usable:
        return [np.zeros(0, dtype=np.int64) for _ in paths]

    grid = _Grid.fitting(usable, cell_size)
    coverage = np.concatenate([np.unique(grid.neighbourhood(path)) for path in usable])
    covered_keys, covering_runs = np.unique(coverage, return_counts=True)

    return [
        covering_runs[np.searchsorted(covered_keys, grid.keys(_midpoints(path)))]
        if len(path) >= 2
        else np.zeros(0, dtype=np.int64)
        for path in paths
    ]


@dataclass(frozen=True)
class _Grid:
    """Square grid whose cells are identified by a single integer key."""

    cell_size: float
    origin: np.ndarray  # cell coordinates of the key-space origin
    stride: int  # distance between neighbouring columns in key space

    @classmethod
    def fitting(cls, paths: list[np.ndarray], cell_size: float) -> _Grid:
        """A grid covering all ``paths`` with a one-cell margin for neighbour lookups."""
        cells = np.floor(np.concatenate(paths) / cell_size).astype(np.int64)
        origin = cells.min(axis=0) - 1
        stride = int(cells[:, 1].max() - origin[1]) + 2
        return cls(cell_size=cell_size, origin=origin, stride=stride)

    def keys(self, xy: np.ndarray) -> np.ndarray:
        """Keys of the cells containing the points ``xy`` (metres)."""
        column, row = (np.floor(xy / self.cell_size).astype(np.int64) - self.origin).T
        return column * self.stride + row

    def neighbourhood(self, xy: np.ndarray) -> np.ndarray:
        """Keys of the cells containing ``xy`` and of their eight neighbours."""
        offsets = _NEIGHBOUR_OFFSETS @ (self.stride, 1)
        return (self.keys(xy)[:, None] + offsets).ravel()


def _midpoints(path: np.ndarray) -> np.ndarray:
    return (path[:-1] + path[1:]) / 2
