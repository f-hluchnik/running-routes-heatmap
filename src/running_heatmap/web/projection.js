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
 * Describe the map's current view as a drawing frame.
 * `scale` multiplies every length, so a frame can render at higher resolution.
 */
function frameFromMap(map, scale = 1) {
  const zoom = map.getZoom();
  const worldSize = TILE_SIZE * Math.pow(2, zoom);
  const topLeft = map.getPixelBounds().min;
  const size = map.getSize();
  return {
    zoom,
    scale,
    worldSize,
    left: topLeft.x,
    top: topLeft.y,
    width: size.x,
    height: size.y,
  };
}

/** Fill the route's screen-space buffers for `frame` (in CSS pixels times `frame.scale`). */
function projectRoute(route, frame) {
  const { worldSize, left, top, scale } = frame;
  for (let i = 0; i < route.x.length; i++) {
    route.sx[i] = (route.x[i] * worldSize - left) * scale;
    route.sy[i] = (route.y[i] * worldSize - top) * scale;
  }
}
