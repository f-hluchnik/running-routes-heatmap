"""Shared test helpers."""

from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

import pytest

GPX_TEMPLATE = """<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>{name}</name>{segments}</trk>
</gpx>
"""


def gpx_text(*segments: list[tuple[float, float]], name: str = "Test run") -> str:
    """Build a GPX document; each segment is a list of ``(lon, lat)`` tuples."""
    body = "".join(
        "<trkseg>"
        + "".join(
            f'<trkpt lat="{lat}" lon="{lon}"><time>2025-08-11T17:47:{i % 60:02d}Z</time></trkpt>'
            for i, (lon, lat) in enumerate(segment)
        )
        + "</trkseg>"
        for segment in segments
    )
    return GPX_TEMPLATE.format(name=escape(name), segments=body)


@pytest.fixture
def write_gpx(tmp_path: Path):
    """Return a function writing a GPX file into ``tmp_path`` and returning its path."""

    def _write(filename: str, *segments: list[tuple[float, float]], name: str = "Test run") -> Path:
        path = tmp_path / filename
        path.write_text(gpx_text(*segments, name=name), encoding="utf-8")
        return path

    return _write
