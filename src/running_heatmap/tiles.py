"""A user-supplied map tile source (``--tiles``)."""

from __future__ import annotations

from dataclasses import dataclass

_REQUIRED_PLACEHOLDERS = ("{z}", "{x}", "{y}")


@dataclass(frozen=True)
class TileSource:
    """A raster tile server in the usual ``{z}/{x}/{y}`` URL-template form.

    ``{s}`` (subdomain) and ``{r}`` (retina suffix) are supported as well.
    Tile providers' licences nearly always require crediting them, so an
    attribution text is mandatory; it is shown on the map and in exported PNGs.
    """

    url: str
    attribution: str

    def __post_init__(self) -> None:
        if not self.url.startswith(("http://", "https://")):
            raise ValueError("Tile URL must start with http:// or https://")
        missing = [name for name in _REQUIRED_PLACEHOLDERS if name not in self.url]
        if missing:
            raise ValueError(f"Tile URL is missing the placeholders {', '.join(missing)}")
        if not self.attribution.strip():
            raise ValueError("Tile attribution must not be empty")
