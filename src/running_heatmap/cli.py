"""Command-line interface: ``running-heatmap [DATA_DIR] [options]``."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from .dataset import Settings, build_dataset
from .loading import load_runs
from .page import render_page
from .server import serve
from .tiles import TileSource

DEFAULT_SETTINGS = Settings()
ANY_SPORT = "any"


def main(argv: list[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    runs = load_runs(args.data_dir, sport=None if args.sport == ANY_SPORT else args.sport)
    if not runs:
        print(f"No usable .gpx or .fit files found in {args.data_dir}/", file=sys.stderr)
        return 1

    try:
        dataset = build_dataset(
            runs,
            Settings(cell_size=args.cell_size, trim_ends=args.trim_ends),
            _tile_source(args, parser),
        )
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_page(dataset), encoding="utf-8")
    print(f"Wrote {args.output} ({len(dataset.runs)} runs)")

    if args.serve:
        serve(args.output, port=args.port)
    return 0


def _tile_source(args: argparse.Namespace, parser: argparse.ArgumentParser) -> TileSource | None:
    if args.tiles is None:
        if args.tiles_attribution is not None:
            parser.error("--tiles-attribution needs --tiles")
        return None
    if args.tiles_attribution is None:
        parser.error("--tiles needs --tiles-attribution (tile providers require a credit)")
    return TileSource(url=args.tiles, attribution=args.tiles_attribution)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="running-heatmap",
        description="Build an interactive heatmap of your running routes from GPX files.",
    )
    parser.add_argument(
        "data_dir",
        nargs="?",
        type=Path,
        default=Path("data"),
        help="folder with .gpx and .fit files",
    )
    parser.add_argument(
        "-o", "--output", type=Path, default=Path("output/heatmap.html"), help="HTML file to write"
    )
    parser.add_argument(
        "--cell-size",
        type=float,
        default=DEFAULT_SETTINGS.cell_size,
        metavar="METRES",
        help="how close two runs must be to count as the same route (default: %(default)g)",
    )
    parser.add_argument(
        "--trim-ends",
        type=float,
        default=DEFAULT_SETTINGS.trim_ends,
        metavar="METRES",
        help="hide this much of the start and end of every run, e.g. around your home",
    )
    parser.add_argument(
        "--sport",
        default="running",
        help='only use activities of this sport, or "any" for all (default: %(default)s); '
        "GPX files do not state a sport and are always used",
    )
    parser.add_argument(
        "--tiles",
        metavar="URL",
        help="extra basemap offered in the page, e.g. 'https://tiles.example.com/{z}/{x}/{y}.png' "
        "(also supports {s} and {r}); include your API key in the URL if the provider needs one",
    )
    parser.add_argument(
        "--tiles-attribution",
        metavar="TEXT",
        help='credit for --tiles, e.g. "© OpenStreetMap contributors © CARTO"',
    )
    parser.add_argument(
        "--serve",
        action="store_true",
        help="serve the map on localhost and open it (needed for OpenStreetMap tiles to load)",
    )
    parser.add_argument("--port", type=int, default=8000, help="port for --serve (default: 8000)")
    return parser
