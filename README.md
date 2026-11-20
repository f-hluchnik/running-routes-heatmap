# Running routes heatmap

Turn the GPX files of your runs into an interactive map you can explore and export as PNG.

- **Glow view** – every run is a semi-transparent line; streets you run often pile up to solid colour.
- **Frequency view** – streets coloured by how many *different* runs used them (legend included).
- **Optional OpenStreetMap basemap** – on or off with one checkbox.
- **Export PNG** – saves exactly what you see (2x resolution, with legend and the OSM credit if the basemap is on).

The result is a single HTML file that works offline (only the optional basemap tiles need the internet).

## Quick start

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# put your .gpx or .fit files into data/, then:
running-heatmap --serve
```

`--serve` builds `output/heatmap.html`, serves it on <http://127.0.0.1:8000> and opens your browser.
Serving it (instead of double-clicking the file) is what lets OpenStreetMap tiles load, because their servers expect an HTTP referrer.

### Options

| Option | Default | Meaning |
|--------|---------|---------|
| `data_dir` | `data` | folder with `.gpx` and `.fit` files |
| `-o`, `--output` | `output/heatmap.html` | where to write the page |
| `--cell-size METRES` | `10` | how close two runs must be to count as the same street; raise it if GPS noise splits one street into two |
| `--trim-ends METRES` | `0` | hide the start and end of every run, e.g. `--trim-ends 300` to keep your home out of the picture |
| `--sport NAME` | `running` | only use activities of this sport (`any` for all); applies to `.fit` files, GPX files do not state a sport |
| `--serve`, `--port` | off, `8000` | serve the page locally and open it |

## Getting your data from Garmin

Garmin Connect has no one-click "all my runs as GPX" button, so pick one of these:

1. **A few runs (recommended to start).** On <https://connect.garmin.com> in a desktop browser (the mobile app cannot export files): open **Activities**, open a run, click the **gear icon** at the top right and choose **Export to GPX**. Save the file into `data/`.
2. **Everything at once.** In your Garmin account settings open **Data Management → Export Your Data** and request your data. Garmin emails a download link, typically within 1–2 days. The archive contains your activities in the format they were uploaded, mostly `.fit`. Unzip the activity archives (`UploadedFiles_*.zip`) into `data/`; `.fit` files are read directly and other sports such as cycling are skipped automatically.
3. **Bulk GPX with a script.** Community tools such as [`garmin-connect-export`](https://github.com/pe-st/garmin-connect-export) log in with your Garmin account and download all activities as GPX. They are unofficial and may break when Garmin changes its login, so use them at your own risk.

Treadmill and other indoor activities have no GPS track and are skipped automatically.

## Keep your data private

GPS tracks reveal where you live. `data/` and `output/` are git-ignored. If you committed GPX files earlier, stop tracking them with

```bash
git rm -r --cached data/*.gpx
```

They stay in the git history; use `git filter-repo` if you need them gone from there too, and consider `--trim-ends` before sharing a PNG or the HTML.

## How it works

```
GPX files ─► gpx_io ─► geometry ─► frequency ─► dataset (JSON) ─► page (HTML + Leaflet + JS)
```

Python parses and cleans the tracks and counts, for each stretch, how many runs passed nearby. The browser draws everything on one canvas, so the same code produces the screen and the PNG. Details and design decisions are recorded per ticket in [`docs/tickets/`](docs/tickets/README.md).

## Development

```bash
pytest          # unit tests; browser tests run if Playwright is installed
ruff check . && ruff format --check .

pip install -e ".[e2e]" && playwright install chromium   # enable the browser tests
```

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. Leaflet is bundled under its BSD-2-Clause licence (`src/running_heatmap/web/vendor/LICENSE-leaflet`).
