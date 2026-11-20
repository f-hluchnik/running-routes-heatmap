"""Assembling the self-contained HTML page (data + Leaflet + front-end code)."""

from __future__ import annotations

import re
from importlib.resources import files

from .dataset import Dataset

_WEB = files("running_heatmap") / "web"

_STYLES = ("vendor/leaflet.css", "app.css")
# Order matters: later scripts use the globals declared by earlier ones.
_SCRIPTS = (
    "vendor/leaflet.js",
    "projection.js",
    "data.js",
    "frequency.js",
    "scene.js",
    "colour.js",
    "views.js",
    "routes-layer.js",
    "png-export.js",
    "app.js",
)

_PLACEHOLDER = re.compile(r"<!--@(\w+)-->")


def render_page(dataset: Dataset) -> str:
    """Return one HTML document that works offline (except for optional map tiles)."""
    values = {
        "styles": "\n".join(_read(name) for name in _STYLES),
        "data": _embeddable_json(dataset.to_json()),
        "scripts": "\n".join(_script_tag(name) for name in _SCRIPTS),
    }
    # A single pass, so text inside an inserted value is never mistaken for a placeholder.
    return _PLACEHOLDER.sub(lambda match: values[match[1]], _read("template.html"))


def _read(name: str) -> str:
    return (_WEB / name).read_text(encoding="utf-8")


def _script_tag(name: str) -> str:
    return f"<script>\n{_read(name)}\n</script>"


def _embeddable_json(payload: str) -> str:
    """Make JSON safe inside a ``<script>`` element (no ``</script>`` or ``<!--``)."""
    return payload.replace("<", "\\u003c")
