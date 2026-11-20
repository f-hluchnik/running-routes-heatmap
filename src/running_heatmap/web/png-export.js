"use strict";

/*
 * Render the current map view to a PNG: background, optional basemap tiles, the
 * active view's routes, legend and attribution. Routes are drawn by the very same
 * view code as on screen, only into a bigger canvas.
 */

const EXPORT_SCALE = 2;
const MAX_EXPORT_PIXELS = 8192; // longest side; browsers refuse much larger canvases
const TILE_WAIT_MS = 8000;

class ExportError extends Error {}

/** Resolve once Leaflet has finished loading all visible tiles (or give up). */
async function waitForTiles(map) {
  const pending = () => map.getPane("tilePane").querySelectorAll("img.leaflet-tile:not(.leaflet-tile-loaded)");
  const deadline = performance.now() + TILE_WAIT_MS;
  while (pending().length > 0 && performance.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  // Let the fade-in transition finish so tiles are fully opaque.
  await new Promise((resolve) => setTimeout(resolve, 300));
}

function drawTiles(ctx, map, scale, filter) {
  const origin = map.getContainer().getBoundingClientRect();
  ctx.save();
  if (filter && "filter" in ctx) ctx.filter = filter;
  for (const tile of map.getPane("tilePane").querySelectorAll("img.leaflet-tile-loaded")) {
    const box = tile.getBoundingClientRect();
    // Round outwards by a pixel so neighbouring tiles never leave hairline gaps.
    const x = Math.floor((box.left - origin.left) * scale);
    const y = Math.floor((box.top - origin.top) * scale);
    const w = Math.ceil((box.right - origin.left) * scale) - x;
    const h = Math.ceil((box.bottom - origin.top) * scale) - y;
    ctx.drawImage(tile, x, y, w, h);
  }
  ctx.restore();
}

function drawLegend(ctx, scale, scene, canvasHeight) {
  const width = 180 * scale;
  const height = 52 * scale;
  const x = 16 * scale;
  const y = canvasHeight - height - 28 * scale;

  ctx.save();
  ctx.fillStyle = "rgba(24, 27, 33, 0.92)";
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 10 * scale);
  ctx.fill();

  const bar = ctx.createLinearGradient(x + 12 * scale, 0, x + width - 12 * scale, 0);
  FREQUENCY_RAMP.forEach((colour, i) => bar.addColorStop(i / (FREQUENCY_RAMP.length - 1), colour));
  ctx.fillStyle = bar;
  ctx.beginPath();
  ctx.roundRect(x + 12 * scale, y + 26 * scale, width - 24 * scale, 8 * scale, 4 * scale);
  ctx.fill();

  ctx.font = `${11 * scale}px system-ui, sans-serif`;
  ctx.fillStyle = "#9aa0a6";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("RUNS PER STREET", x + 12 * scale, y + 20 * scale);
  ctx.fillText("1", x + 12 * scale, y + 46 * scale);
  ctx.textAlign = "right";
  ctx.fillText(String(scene.maxFrequency), x + width - 12 * scale, y + 46 * scale);
  ctx.restore();
}

/** OpenStreetMap's licence requires this credit wherever its tiles are shown. */
function drawAttribution(ctx, scale, canvasWidth, canvasHeight) {
  const text = "© OpenStreetMap contributors";
  ctx.save();
  ctx.font = `${11 * scale}px system-ui, sans-serif`;
  const padding = 5 * scale;
  const width = ctx.measureText(text).width + padding * 2;
  const height = 18 * scale;
  ctx.fillStyle = "rgba(24, 27, 33, 0.92)";
  ctx.fillRect(canvasWidth - width, canvasHeight - height, width, height);
  ctx.fillStyle = "#e8eaed";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvasWidth - width + padding, canvasHeight - height / 2);
  ctx.restore();
}

/**
 * Paint the map as it is currently shown onto a new canvas.
 * `options`: { scale, background, basemap (bool), filter, view, scene, style }
 */
async function renderExportCanvas(map, options) {
  const size = map.getSize();
  const scale = Math.min(options.scale, MAX_EXPORT_PIXELS / Math.max(size.x, size.y));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(size.x * scale);
  canvas.height = Math.round(size.y * scale);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = options.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (options.basemap) {
    await waitForTiles(map);
    drawTiles(ctx, map, scale, options.filter);
  }
  options.view.draw(ctx, frameFromMap(map, scale), options.scene, options.style);
  if (options.view.hasLegend) drawLegend(ctx, scale, options.scene, canvas.height);
  if (options.basemap) drawAttribution(ctx, scale, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new ExportError("The browser could not create the image."))),
        "image/png",
      );
    } catch (error) {
      // A canvas containing cross-origin tiles without CORS headers is "tainted".
      reject(new ExportError("The browser blocked exporting the map tiles. Open the map with --serve or switch the basemap off."));
    }
  });
}

function downloadBlob(blob, filename) {
  const link = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function exportPng(map, options, filename) {
  const canvas = await renderExportCanvas(map, options);
  downloadBlob(await canvasToBlob(canvas), filename);
}
