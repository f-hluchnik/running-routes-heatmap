"use strict";

/*
 * Draws map tiles onto any canvas for any frame, independent of the live map.
 * This is what lets the PNG export cover another area or resolution than the
 * screen shows.
 */

const MAX_TILE_ZOOM = 19;
const MAX_TILES = 600; // keeps an export from hammering the tile server
const SUBDOMAINS = "abc";

class TileLoadError extends Error {}

/** Expand a `{z}/{x}/{y}` URL template; `{s}` picks a subdomain, `{r}` is left empty. */
function tileUrl(template, z, x, y) {
  return template
    .replace("{s}", SUBDOMAINS[Math.abs(x + y) % SUBDOMAINS.length])
    .replace("{r}", "")
    .replace("{z}", z)
    .replace("{x}", x)
    .replace("{y}", y);
}

/**
 * The tiles needed to cover `frame`, with where to draw each one on the canvas.
 * Tiles come from the zoom level whose size is closest to the output resolution.
 * Horizontally the world repeats, so `x` is wrapped into range for the URL while
 * the drawing position keeps going.
 */
function tileGrid(frame) {
  const z = Math.max(0, Math.min(MAX_TILE_ZOOM, Math.round(frame.zoom + Math.log2(frame.scale))));
  const tilesPerSide = Math.pow(2, z);
  const size = (frame.worldSize * frame.scale) / tilesPerSide; // tile size on the canvas
  const left = frame.left * frame.scale;
  const top = frame.top * frame.scale;
  const right = left + frame.width * frame.scale;
  const bottom = top + frame.height * frame.scale;

  const tiles = [];
  for (let row = Math.max(0, Math.floor(top / size)); row <= Math.min(tilesPerSide - 1, Math.floor(bottom / size)); row++) {
    for (let column = Math.floor(left / size); column <= Math.floor(right / size); column++) {
      const wrapped = ((column % tilesPerSide) + tilesPerSide) % tilesPerSide;
      tiles.push({ z, x: wrapped, y: row, dx: column * size - left, dy: row * size - top, size });
    }
  }
  return tiles;
}

function loadImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous"; // otherwise the canvas could not be exported
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/**
 * Draw the basemap's tiles for `frame` onto `ctx`.
 * Returns how many tiles failed to load (they are left empty).
 */
async function drawTiles(ctx, basemap, frame) {
  const tiles = tileGrid(frame);
  if (tiles.length > MAX_TILES) {
    throw new TileLoadError(`This export needs ${tiles.length} map tiles; choose a lower resolution or switch the basemap off.`);
  }
  const images = await Promise.all(tiles.map((tile) => loadImage(tileUrl(basemap.url, tile.z, tile.x, tile.y))));

  ctx.save();
  if (basemap.filter && "filter" in ctx) ctx.filter = basemap.filter;
  let failed = 0;
  tiles.forEach((tile, i) => {
    if (!images[i]) {
      failed += 1;
      return;
    }
    // Round outwards by a pixel so neighbouring tiles never leave hairline gaps.
    const x = Math.floor(tile.dx);
    const y = Math.floor(tile.dy);
    ctx.drawImage(images[i], x, y, Math.ceil(tile.dx + tile.size) - x, Math.ceil(tile.dy + tile.size) - y);
  });
  ctx.restore();

  if (failed === tiles.length) {
    throw new TileLoadError("No map tiles could be loaded. Check your internet connection, or open the map with --serve.");
  }
  return failed;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { tileUrl, tileGrid, MAX_TILES };
}
