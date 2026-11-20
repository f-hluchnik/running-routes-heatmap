"use strict";

/*
 * Views: each one knows how to paint all routes onto a canvas for a given frame.
 * They only use the 2D-context API and `frame`, never the map, so the exact same
 * code draws the live map and the exported PNG.
 */

const GLOW_COLOUR = "255, 108, 64"; // RGB triple, combined with the opacity setting

/** Lines look better slightly thinner when zoomed out and thicker when zoomed in. */
function lineWidth(style, frame) {
  return style.width * Math.pow(2, (frame.zoom - 14) * 0.25) * frame.scale;
}

function tracePolyline(ctx, route, from, to) {
  ctx.moveTo(route.sx[from], route.sy[from]);
  for (let i = from + 1; i <= to; i++) ctx.lineTo(route.sx[i], route.sy[i]);
}

/** Every run is one semi-transparent stroke, so busier streets pile up to solid colour. */
const glowView = {
  label: "Glow",
  usesOpacity: true,
  draw(ctx, frame, data, style) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = lineWidth(style, frame);
    ctx.strokeStyle = `rgba(${GLOW_COLOUR}, ${style.opacity})`;
    for (const route of data.routes) {
      projectRoute(route, frame);
      ctx.beginPath();
      tracePolyline(ctx, route, 0, route.x.length - 1);
      ctx.stroke();
    }
  },
};

const EDGE_COLOUR = "rgba(0, 0, 0, 0.4)";
const EDGE_WIDTH = 1.5; // CSS pixels added to the line width for the edge

/**
 * Streets coloured by how many different runs used them. Opaque lines, drawn from
 * least to most frequent, each with a thin dark edge so pale colours stay readable
 * on a light basemap.
 */
const frequencyView = {
  label: "Frequency",
  usesOpacity: false,
  hasLegend: true,
  draw(ctx, frame, data, style) {
    for (const route of data.routes) projectRoute(route, frame);
    ctx.lineJoin = "round";
    const width = lineWidth(style, frame);
    for (const { frequency, spans } of data.levels) {
      ctx.beginPath();
      for (const { route, from, to } of spans) tracePolyline(ctx, route, from, to);
      // Butt caps on the edge: round ones leave dark dots where the colour changes.
      ctx.lineCap = "butt";
      ctx.lineWidth = width + EDGE_WIDTH * frame.scale;
      ctx.strokeStyle = EDGE_COLOUR;
      ctx.stroke();
      ctx.lineCap = "round";
      ctx.lineWidth = width;
      ctx.strokeStyle = frequencyColour(frequency, data.maxFrequency);
      ctx.stroke();
    }
  },
};

const VIEWS = { glow: glowView, frequency: frequencyView };
