"""A tiny local web server, so map tiles get a proper HTTP referrer."""

from __future__ import annotations

import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"


def serve(page: Path, *, port: int, open_browser: bool = True) -> None:
    """Serve the directory containing ``page`` until interrupted with Ctrl-C."""
    handler = partial(_QuietHandler, directory=str(page.parent))
    with ThreadingHTTPServer((HOST, port), handler) as server:
        url = f"http://{HOST}:{server.server_port}/{page.name}"
        print(f"Serving {url}  (Ctrl-C to stop)")
        if open_browser:
            webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print()


class _QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        """Do not log every request to the terminal."""
