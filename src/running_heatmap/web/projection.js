"use strict";

/*
 * Web-Mercator maths shared by the on-screen layer and the PNG export.
 *
 * A "frame" describes one rendering target: where the map is looking and how big
 * the canvas is. Routes are stored in unit-Mercator coordinates (0..1) so that
 * projecting them to any frame is a multiply and a subtract.
 */

const TILE_SIZE = 256;

/** Longitude/latitude in degrees -> Web-Mercator in the unit square. */
function toUnitMercator(lat, lon) {
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: (lon + 180) / 360,
    y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI),
  };
}

/**
 * A frame for a view centred on (`centerX`, `centerY`) in unit-Mercator coordinates.
 * `width` and `height` are in CSS pixels; `scale` multiplies every length, so one
 * frame description can render at higher resolution.
 */
function frameFromView({ centerX, centerY, zoom, width, height, scale = 1 }) {
  const worldSize = TILE_SIZE * Math.pow(2, zoom);
  return {
    zoom,
    scale,
    worldSize,
    left: centerX * worldSize - width / 2,
    top: centerY * worldSize - height / 2,
    width,
    height,
  };
}

/** Describe the map's current view as a drawing frame. */
function frameFromMap(map, scale = 1) {
  const size = map.getSize();
  const topLeft = map.getPixelBounds().min;
  const frame = frameFromView({ centerX: 0, centerY: 0, zoom: map.getZoom(), width: size.x, height: size.y, scale });
  // Use Leaflet's own offset: it is what the tiles are positioned with.
  return { ...frame, left: topLeft.x, top: topLeft.y };
}

const FALLBACK_ZOOM = 16; // for a single point, which has no extent to fit
const MAX_FIT_ZOOM = 19;

/**
 * The frame that shows `bounds` ({minX, maxX, minY, maxY} in unit-Mercator) as
 * large as possible inside `width` x `height`, keeping `padding` (a fraction of
 * each side) free around it.
 */
function frameFittingBounds(bounds, width, height, scale = 1, padding = 0.06) {
  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  const fit = Math.min(
    (width * (1 - 2 * padding)) / (spanX * TILE_SIZE),
    (height * (1 - 2 * padding)) / (spanY * TILE_SIZE),
  );
  return frameFromView({
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerY: (bounds.minY + bounds.maxY) / 2,
    zoom: Number.isFinite(fit) ? Math.min(Math.log2(fit), MAX_FIT_ZOOM) : FALLBACK_ZOOM,
    width,
    height,
    scale,
  });
}

/** The largest scale <= `requested` that keeps the longer side within `maxPixels`. */
function cappedScale(requested, width, height, maxPixels) {
  return Math.min(requested, maxPixels / Math.max(width, height));
}

/** Fill the route's screen-space buffers for `frame` (in CSS pixels times `frame.scale`). */
function projectRoute(route, frame) {
  const { worldSize, left, top, scale } = frame;
  for (let i = 0; i < route.x.length; i++) {
    route.sx[i] = (route.x[i] * worldSize - left) * scale;
    route.sy[i] = (route.y[i] * worldSize - top) * scale;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TILE_SIZE, toUnitMercator, frameFromView, frameFittingBounds, cappedScale };
}
