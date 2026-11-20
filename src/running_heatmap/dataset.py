"""Turning loaded runs into the JSON dataset consumed by the map front-end."""

from __future__ import annotations

import json
from dataclasses import dataclass

import numpy as np

from .frequency import segment_frequencies
from .geometry import LocalProjection, clean_path, path_length, trim_ends
from .model import Run

MAX_STEP = 5.0  # metres; finer sampling gives smoother colour changes along a route
COORDINATE_DECIMALS = 5  # ~1 m; plenty for a map and keeps the page small


@dataclass(frozen=True)
class Settings:
    """Tuning knobs of the data pipeline (all distances in metres)."""

    cell_size: float = 10.0
    simplify_tolerance: float = 1.0
    trim_ends: float = 0.0

    def __post_init__(self) -> None:
        if self.cell_size <= 0:
            raise ValueError("cell_size must be positive")
        if self.simplify_tolerance < 0 or self.trim_ends < 0:
            raise ValueError("distances must not be negative")

    @property
    def max_step(self) -> float:
        """Longest step between points: at least two samples per cell, so none is skipped."""
        return min(MAX_STEP, self.cell_size / 2)


@dataclass(frozen=True)
class Route:
    """A continuous stretch of one run with the frequency of each of its segments."""

    coords: np.ndarray  # (n, 2) as (lat, lon)
    frequency: np.ndarray  # (n - 1,)


@dataclass(frozen=True)
class RunRoutes:
    name: str
    date: str | None
    distance_km: float
    routes: list[Route]


@dataclass(frozen=True)
class Dataset:
    runs: list[RunRoutes]

    @property
    def bounds(self) -> list[list[float]]:
        """``[[south, west], [north, east]]`` around every route."""
        points = np.concatenate([route.coords for run in self.runs for route in run.routes])
        return [points.min(axis=0).tolist(), points.max(axis=0).tolist()]

    @property
    def max_frequency(self) -> int:
        return max(int(route.frequency.max()) for run in self.runs for route in run.routes)

    def to_json(self) -> str:
        """Serialise compactly; coordinates are rounded to :data:`COORDINATE_DECIMALS`."""
        payload = {
            "bounds": self.bounds,
            "maxFrequency": self.max_frequency,
            "runs": [
                {
                    "name": run.name,
                    "date": run.date,
                    "distanceKm": round(run.distance_km, 1),
                    "routes": [
                        {
                            "coords": np.round(route.coords, COORDINATE_DECIMALS).tolist(),
                            "freq": route.frequency.tolist(),
                        }
                        for route in run.routes
                    ],
                }
                for run in self.runs
            ],
        }
        return json.dumps(payload, separators=(",", ":"), ensure_ascii=False)


def build_dataset(runs: list[Run], settings: Settings | None = None) -> Dataset:
    """Clean every run's geometry and annotate each segment with its frequency.

    Raises ``ValueError`` if no run has any distance left to draw.
    """
    settings = settings or Settings()
    projection = LocalProjection.centred_on([s for run in runs for s in run.segments])
    cleaned = [_clean_run(run, projection, settings) for run in runs]

    paths = [path for _, paths in cleaned for path in paths]
    frequencies = iter(segment_frequencies(paths, cell_size=settings.cell_size))

    run_routes = []
    for run, (distance, run_paths) in zip(runs, cleaned, strict=True):
        routes = [
            Route(coords=projection.inverse(path)[:, ::-1], frequency=next(frequencies))
            for path in run_paths
        ]
        if routes:
            run_routes.append(RunRoutes(run.name, run.date, distance / 1000, routes))

    if not run_routes:
        raise ValueError("No run has any distance to draw")
    return Dataset(run_routes)


def _clean_run(
    run: Run, projection: LocalProjection, settings: Settings
) -> tuple[float, list[np.ndarray]]:
    """Return the run's distance in metres and its cleaned, trimmed, non-empty paths."""
    paths = [
        clean_path(
            projection.forward(segment),
            simplify_tolerance=settings.simplify_tolerance,
            max_step=settings.max_step,
        )
        for segment in run.segments
    ]
    distance = sum(path_length(path) for path in paths)

    last = len(paths) - 1
    trimmed = [
        trim_ends(
            path,
            start=settings.trim_ends if i == 0 else 0.0,
            end=settings.trim_ends if i == last else 0.0,
        )
        for i, path in enumerate(paths)
    ]
    return distance, [path for path in trimmed if len(path) >= 2]
