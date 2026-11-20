"use strict";

/*
 * Render a frame to a PNG: background, optional basemap tiles, the active view's
 * routes, legend and attribution. Routes are drawn by the very same view code as
 * on screen, only into a canvas of the requested size.
 */

const MAX_EXPORT_PIXELS = 8192; // longest side; browsers refuse much larger canvases

class ExportError extends Error {}

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

/** Tile providers' licences require this credit wherever their tiles are shown. */
function drawAttribution(ctx, text, scale, canvasWidth, canvasHeight) {
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
 * Paint `options.frame` onto a new canvas.
 * `options`: { frame, background (CSS colour or null for transparent),
 *              basemap (an entry of `basemaps`, or null), view, scene, style }
 * Returns { canvas, failedTiles }.
 */
async function renderExportCanvas(options) {
  const { frame, basemap } = options;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(frame.width * frame.scale);
  canvas.height = Math.round(frame.height * frame.scale);
  const ctx = canvas.getContext("2d");

  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  let failedTiles = 0;
  if (basemap) {
    try {
      failedTiles = await drawTiles(ctx, basemap, frame);
    } catch (error) {
      throw error instanceof TileLoadError ? new ExportError(error.message) : error;
    }
  }
  options.view.draw(ctx, frame, options.scene, options.style);
  if (options.view.hasLegend) drawLegend(ctx, frame.scale, options.scene, canvas.height);
  if (basemap) drawAttribution(ctx, basemap.attribution.text, frame.scale, canvas.width, canvas.height);
  return { canvas, failedTiles };
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new ExportError("The browser could not create the image."))),
        "image/png",
      );
    } catch {
      // A canvas with cross-origin tiles that sent no CORS headers is "tainted".
      reject(new ExportError("The browser blocked exporting the map tiles: this tile server does not allow it. Switch the basemap off or use another one."));
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

/** Render and download. Returns the number of map tiles that could not be loaded. */
async function exportPng(options, filename) {
  const { canvas, failedTiles } = await renderExportCanvas(options);
  downloadBlob(await canvasToBlob(canvas), filename);
  return failedTiles;
}
