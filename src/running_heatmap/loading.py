"""Loading every supported activity file from a folder."""

from __future__ import annotations

import logging
from collections.abc import Callable
from pathlib import Path

from . import fit_io, gpx_io
from .model import Run

logger = logging.getLogger(__name__)

_READERS: dict[str, Callable[[Path], Run | None]] = {
    ".gpx": gpx_io.load_run,
    ".fit": fit_io.load_run,
}
SUPPORTED_SUFFIXES = tuple(_READERS)


def load_runs(directory: Path, *, sport: str | None = None) -> list[Run]:
    """Load all ``.gpx`` and ``.fit`` files in ``directory``, sorted by file name.

    Unreadable files and files without a GPS track are skipped with a warning.
    With ``sport`` set (e.g. ``"running"``), activities that declare a different
    sport are left out; activities that declare none (GPX) are always kept.
    """
    runs = []
    for path in sorted(directory.iterdir()):
        reader = _READERS.get(path.suffix.lower())
        if reader is None:
            continue
        run = reader(path)
        if run is None:
            logger.warning("Skipping %s: no usable track points", path.name)
        elif sport and run.sport not in (None, sport):
            logger.info("Skipping %s: it is a %s activity", path.name, run.sport)
        else:
            runs.append(run)
    return runs
