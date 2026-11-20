"use strict";

/**
 * A Leaflet layer that paints routes onto a single canvas covering the map.
 * `paint(ctx, frame)` is called whenever the view changes.
 */
class RoutesLayer extends L.Layer {
  constructor(paint) {
    super();
    this._paint = paint;
    this._scheduled = false;
  }

  onAdd(map) {
    this._canvas = L.DomUtil.create("canvas", "routes-canvas", map.getPanes().overlayPane);
    map.on("move zoom resize", this.redraw, this);
    this._render();
  }

  onRemove(map) {
    map.off("move zoom resize", this.redraw, this);
    this._canvas.remove();
  }

  /** Repaint on the next animation frame; many calls in one frame cost a single paint. */
  redraw() {
    if (this._scheduled) return;
    this._scheduled = true;
    requestAnimationFrame(() => {
      this._scheduled = false;
      if (this._map) this._render();
    });
  }

  _render() {
    const map = this._map;
    const pixelRatio = window.devicePixelRatio || 1;
    const size = map.getSize();
    const canvas = this._canvas;

    canvas.width = Math.round(size.x * pixelRatio);
    canvas.height = Math.round(size.y * pixelRatio);
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));

    this._paint(canvas.getContext("2d"), frameFromMap(map, pixelRatio));
  }
}
