#!/usr/bin/env python3
"""Generate the synthetic sample runs in ``examples/sample-data``.

The runs follow a made-up street grid, so they contain no real person's
movements. They are reproducible: the same seed always gives the same files.

    python scripts/make_sample_data.py [output_dir]
"""

from __future__ import annotations

import heapq
import itertools
import math
import random
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import gpxpy.gpx

SEED = 42
CENTRE_LAT, CENTRE_LON = 51.0, 10.0  # an arbitrary spot; the town below is fictional
COLUMNS, ROWS = 14, 10
BLOCK_M = 110.0  # distance between neighbouring crossings
JITTER_M = 18.0  # makes the grid look like real, slightly crooked streets
BLOCKED_SHARE = 0.15  # fraction of streets that do not exist
SAMPLE_SECONDS = 4  # one GPS fix every 4 s keeps the files small
PACE_M_PER_S = 3.0
GPS_NOISE_M = 2.5
RUN_DAYS = (  # (days after the first run, run name)
    (0, "Easy run"), (3, "Evening run"), (6, "Park loop"), (10, "Long run"), (13, "Easy run"),
    (17, "Park loop"), (21, "Tempo run"), (24, "Easy run"), (28, "Long run"), (31, "Park loop"),
)  # fmt: skip
FIRST_RUN = datetime(2025, 5, 3, 7, 30, tzinfo=UTC)
EARTH_RADIUS_M = 6_371_008.8

Node = tuple[int, int]
Point = tuple[float, float]  # metres east, metres north of the town's south-west corner


class Town:
    """A jittered street grid with some streets removed (but still connected)."""

    def __init__(self, rng: random.Random) -> None:
        self.rng = rng
        self.position = {
            (column, row): (
                column * BLOCK_M + rng.uniform(-JITTER_M, JITTER_M),
                row * BLOCK_M + rng.uniform(-JITTER_M, JITTER_M),
            )
            for column in range(COLUMNS)
            for row in range(ROWS)
        }
        self.streets: dict[Node, set[Node]] = {node: set() for node in self.position}
        for column, row in self.position:
            for step in ((1, 0), (0, 1)):
                other = (column + step[0], row + step[1])
                if other in self.position:
                    self._link((column, row), other)
        self._remove_some_streets()

    def _link(self, a: Node, b: Node) -> None:
        self.streets[a].add(b)
        self.streets[b].add(a)

    def _is_connected(self) -> bool:
        start = next(iter(self.streets))
        seen, todo = {start}, [start]
        while todo:
            for neighbour in self.streets[todo.pop()]:
                if neighbour not in seen:
                    seen.add(neighbour)
                    todo.append(neighbour)
        return len(seen) == len(self.streets)

    def _remove_some_streets(self) -> None:
        edges = sorted((a, b) for a, others in self.streets.items() for b in others if a < b)
        for index in range(len(edges) - 1, 0, -1):  # Fisher-Yates, stable across Python versions
            swap = int(self.rng.random() * (index + 1))
            edges[index], edges[swap] = edges[swap], edges[index]
        for a, b in edges[: int(len(edges) * BLOCKED_SHARE)]:
            self.streets[a].discard(b)
            self.streets[b].discard(a)
            if not self._is_connected():
                self._link(a, b)

    def distance(self, a: Node, b: Node) -> float:
        (ax, ay), (bx, by) = self.position[a], self.position[b]
        return math.hypot(ax - bx, ay - by)

    def shortest_path(self, start: Node, goal: Node, wobble: dict[tuple[Node, Node], float]):
        """Dijkstra over street lengths, each scaled by a per-run factor so routes vary."""
        queue = [(0.0, start, [start])]
        settled: set[Node] = set()
        while queue:
            cost, node, path = heapq.heappop(queue)
            if node == goal:
                return path
            if node in settled:
                continue
            settled.add(node)
            for neighbour in sorted(self.streets[node]):
                if neighbour not in settled:
                    length = self.distance(node, neighbour) * wobble[(node, neighbour)]
                    heapq.heappush(queue, (cost + length, neighbour, [*path, neighbour]))
        raise RuntimeError("town is not connected")


def pick(rng: random.Random, items: list[Node]) -> Node:
    return items[int(rng.random() * len(items))]


def plan_run(town: Town, rng: random.Random, home: Node, favourites: list[Node]) -> list[Node]:
    """A loop from home through one favourite place and a couple of random ones."""
    wobble = {(a, b): rng.uniform(0.9, 1.35) for a, others in town.streets.items() for b in others}
    nodes = sorted(town.position)
    stops = [pick(rng, favourites)] + [pick(rng, nodes) for _ in range(1 + int(rng.random() * 2))]
    route = [home]
    for stop in [*stops, home]:
        route += town.shortest_path(route[-1], stop, wobble)[1:]
    return route


def walk(town: Town, rng: random.Random, route: list[Node]) -> list[Point]:
    """GPS fixes along the route at a steady pace, with measurement noise."""
    corners = [town.position[node] for node in route]
    lengths = [math.dist(a, b) for a, b in itertools.pairwise(corners)]
    step = PACE_M_PER_S * SAMPLE_SECONDS

    points, edge, edge_start = [], 0, 0.0
    for fix in range(int(sum(lengths) // step) + 1):
        distance = fix * step
        while edge_start + lengths[edge] < distance:  # move on to the street we are on now
            edge_start += lengths[edge]
            edge += 1
        t = (distance - edge_start) / lengths[edge]
        (ax, ay), (bx, by) = corners[edge], corners[edge + 1]
        points.append((ax + (bx - ax) * t, ay + (by - ay) * t))
    return [(x + rng.gauss(0, GPS_NOISE_M), y + rng.gauss(0, GPS_NOISE_M)) for x, y in points]


def to_lat_lon(point: Point) -> tuple[float, float]:
    x, y = point[0] - COLUMNS * BLOCK_M / 2, point[1] - ROWS * BLOCK_M / 2
    lat = CENTRE_LAT + math.degrees(y / EARTH_RADIUS_M)
    lon = CENTRE_LON + math.degrees(x / (EARTH_RADIUS_M * math.cos(math.radians(CENTRE_LAT))))
    return lat, lon


def to_gpx(name: str, start: datetime, points: list[Point]) -> str:
    gpx = gpxpy.gpx.GPX()
    gpx.time = start
    track = gpxpy.gpx.GPXTrack(name=name)
    segment = gpxpy.gpx.GPXTrackSegment()
    for i, point in enumerate(points):
        lat, lon = to_lat_lon(point)
        segment.points.append(
            gpxpy.gpx.GPXTrackPoint(
                round(lat, 6), round(lon, 6), time=start + timedelta(seconds=i * SAMPLE_SECONDS)
            )
        )
    track.segments.append(segment)
    gpx.tracks.append(track)
    return gpx.to_xml()


def generate(output: Path) -> list[Path]:
    """Write the sample GPX files to ``output`` and return their paths."""
    rng = random.Random(SEED)
    town = Town(rng)
    home = (COLUMNS // 2, ROWS // 2)
    favourites = [(COLUMNS - 3, ROWS - 3), (2, 2), (COLUMNS - 3, 2)]  # "park", "river", "hill"

    output.mkdir(parents=True, exist_ok=True)
    paths = []
    for index, (days, name) in enumerate(RUN_DAYS, start=1):
        route = plan_run(town, rng, home, favourites)
        start = FIRST_RUN + timedelta(days=days)
        path = output / f"run_{index:02d}.gpx"
        path.write_text(to_gpx(name, start, walk(town, rng, route)), encoding="utf-8")
        paths.append(path)
    return paths


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("examples/sample-data")
    for written in generate(target):
        print(written)
