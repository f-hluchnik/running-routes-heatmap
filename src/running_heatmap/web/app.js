"use strict";

/* ---- Configuration ------------------------------------------------------ */

const HOVER_TOLERANCE_PX = 8; // how close the pointer must be to a route
const MAX_TOOLTIP_RUNS = 5;

const BACKGROUND = "#14161a";

/* ---- State -------------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

const state = {
  view: "glow",
  basemap: "none",
  width: 3,
  opacity: 0.5,
  exportExtent: "view", // "view" (what is on screen) or "all" (fit every shown run)
  exportScale: 2,
  exportTransparent: false,
};
const dataJson = JSON.parse($("heatmap-data").textContent);
const data = loadDataset(dataJson);
const basemaps = buildBasemaps(dataJson.tiles);
const runFilter = new RunFilter(data.runs);
let scene = buildScene(data, (runIndex) => runFilter.isVisible(runIndex));

/* ---- Map ---------------------------------------------------------------- */

const map = L.map("map", { zoomSnap: 0.25, zoomAnimation: false, attributionControl: false });
fitDataInView();
L.control.attribution({ prefix: false }).addTo(map);

const tileLayers = {}; // created on first use, by basemap id

let hoveredRuns = []; // run indexes under the pointer, nearest first; shown on screen only

const routesLayer = new RoutesLayer((ctx, frame) => {
  ctx.clearRect(0, 0, frame.width * frame.scale, frame.height * frame.scale);
  VIEWS[state.view].draw(ctx, frame, scene, state);
  if (hoveredRuns.length > 0) drawHighlight(ctx, frame, scene, hoveredRuns[0], state);
}).addTo(map);

/** Fit all routes into the map, leaving room for the control panel beside them. */
function fitDataInView() {
  const panel = $("panel");
  const wideScreen = map.getSize().x > 700;
  const panelSpace = wideScreen ? panel.offsetWidth + 16 : 0;
  map.fitBounds(data.bounds, { paddingTopLeft: [40, 40], paddingBottomRight: [40 + panelSpace, 40] });
}

/* ---- Keeping the page in sync with the state ----------------------------- */

/** Recount frequencies for the visible runs (call after the filter changes). */
function rebuildScene() {
  scene = buildScene(data, (runIndex) => runFilter.isVisible(runIndex));
  $("legend-max").textContent = scene.maxFrequency;
  const visible = runFilter.visibleRuns();
  $("run-count").textContent = `${visible.length} of ${data.runs.length}`;
  data.runs.forEach((_, runIndex) => {
    $(`run-${runIndex}`).closest("li").classList.toggle("out-of-range", !runFilter.inDateRange(runIndex));
    $(`run-${runIndex}`).checked = runFilter.isSwitchedOn(runIndex);
  });
  refresh();
}

/** Apply view/basemap changes and repaint. */
function refresh() {
  const view = VIEWS[state.view];
  $("opacity-row").hidden = !view.usesOpacity;
  $("legend").hidden = !view.hasLegend;
  routesLayer.redraw();
}

/** Show the selected basemap (or none) and apply its colour filter. */
function applyBasemap() {
  Object.values(tileLayers).forEach((layer) => layer.remove());
  const basemap = basemaps[state.basemap];
  map.getPane("tilePane").style.filter = basemap.filter ?? "";
  if (!basemap.url) return;
  tileLayers[state.basemap] ??= L.tileLayer(basemap.url, {
    attribution: basemap.attribution.html,
    maxZoom: 19,
    crossOrigin: "anonymous", // lets the PNG export read the tiles
  });
  tileLayers[state.basemap].addTo(map);
}

/** Basemap tiles and a transparent background exclude each other. */
function syncTransparencyOption() {
  const hasBasemap = state.basemap !== "none";
  $("export-transparent").disabled = hasBasemap;
  $("export-transparent").checked = state.exportTransparent && !hasBasemap;
}

/* ---- Controls ----------------------------------------------------------- */

/** One radio button per entry in VIEWS, so adding a view needs no markup change. */
function buildViewSwitcher() {
  for (const [id, view] of Object.entries(VIEWS)) {
    const radio = Object.assign(document.createElement("input"), {
      type: "radio",
      name: "view",
      value: id,
      checked: id === state.view,
    });
    radio.addEventListener("change", () => {
      state.view = id;
      refresh();
    });
    const text = Object.assign(document.createElement("span"), { textContent: view.label });
    const label = document.createElement("label");
    label.append(radio, text);
    $("views").append(label);
  }
}

/** One checkbox row per run, plus the date range and All/None shortcuts. */
function buildRunFilter() {
  data.runs.forEach((run, runIndex) => {
    const checkbox = Object.assign(document.createElement("input"), {
      type: "checkbox",
      id: `run-${runIndex}`,
      checked: true,
    });
    checkbox.addEventListener("change", () => {
      runFilter.setSwitchedOn(runIndex, checkbox.checked);
      rebuildScene();
    });
    const text = (className, content) =>
      Object.assign(document.createElement("span"), { className, textContent: content });
    const label = document.createElement("label");
    label.title = run.name;
    label.append(checkbox, text("name", `${run.date ?? "undated"}  ${run.name}`), text("km", `${run.distanceKm.toFixed(1)} km`));
    const item = document.createElement("li");
    item.append(label);
    $("run-list").append(item);
  });

  const dates = data.runs.map((run) => run.date).filter(Boolean).sort();
  $("date-range").hidden = dates.length === 0;
  for (const input of [$("date-from"), $("date-to")]) {
    input.min = dates[0] ?? "";
    input.max = dates[dates.length - 1] ?? "";
    input.addEventListener("change", () => {
      runFilter.setDateRange($("date-from").value, $("date-to").value);
      rebuildScene();
    });
  }
  $("runs-all").addEventListener("click", () => {
    runFilter.setAllSwitchedOn(true);
    rebuildScene();
  });
  $("runs-none").addEventListener("click", () => {
    runFilter.setAllSwitchedOn(false);
    rebuildScene();
  });
}

function bindControls() {
  $("summary").textContent = `${data.runs.length} runs · ${data.totalKm.toFixed(1)} km`;
  $("legend-bar").style.background = rampGradient();
  $("width").value = state.width;
  $("opacity").value = state.opacity;

  for (const [id, basemap] of Object.entries(basemaps)) {
    $("basemap").append(new Option(basemap.label, id));
  }
  $("basemap").addEventListener("change", (event) => {
    state.basemap = event.target.value;
    applyBasemap();
    syncTransparencyOption();
    updateExportSize();
  });
  $("export-extent").addEventListener("change", (event) => {
    state.exportExtent = event.target.value;
  });
  $("export-scale").value = state.exportScale;
  $("export-scale").addEventListener("change", (event) => {
    state.exportScale = Number(event.target.value);
    updateExportSize();
  });
  $("export-transparent").addEventListener("change", (event) => {
    state.exportTransparent = event.target.checked;
  });
  map.on("resize", updateExportSize);
  $("width").addEventListener("input", (event) => {
    state.width = Number(event.target.value);
    refresh();
  });
  $("opacity").addEventListener("input", (event) => {
    state.opacity = Number(event.target.value);
    refresh();
  });
  $("export").addEventListener("click", exportCurrentView);
}

/* ---- Hover details ------------------------------------------------------ */

/** List the runs under the pointer and highlight the nearest one on the map. */
function showHover(event) {
  const point = map.mouseEventToContainerPoint(event.originalEvent);
  const { lat, lng } = map.containerPointToLatLng(point);
  const { x, y } = toUnitMercator(lat, lng);
  const tolerance = HOVER_TOLERANCE_PX / frameFromMap(map).worldSize;
  const hits = runsNear(scene.routes, x, y, tolerance);

  const hit = hits.map(({ runIndex }) => runIndex);
  const changed = hit.length !== hoveredRuns.length || hit.some((runIndex, i) => runIndex !== hoveredRuns[i]);
  hoveredRuns = hit;
  if (changed) {
    routesLayer.redraw();
    renderTooltip(hits.map(({ runIndex }) => data.runs[runIndex]));
  }
  placeTooltip(point);
}

function hideHover() {
  if (hoveredRuns.length === 0) return;
  hoveredRuns = [];
  $("tooltip").hidden = true;
  routesLayer.redraw();
}

function renderTooltip(runs) {
  const tooltip = $("tooltip");
  tooltip.replaceChildren();
  tooltip.hidden = runs.length === 0;
  const span = (className, text) => Object.assign(document.createElement("span"), { className, textContent: text });
  for (const run of runs.slice(0, MAX_TOOLTIP_RUNS)) {
    const row = document.createElement("div");
    row.className = "run";
    row.append(span("run-name", run.name), span("run-meta", `${run.date ?? "undated"} · ${run.distanceKm.toFixed(1)} km`));
    tooltip.append(row);
  }
  if (runs.length > MAX_TOOLTIP_RUNS) tooltip.append(span("more", `+ ${runs.length - MAX_TOOLTIP_RUNS} more`));
}

/** Keep the tooltip beside the pointer, flipping it at the right and bottom edges. */
function placeTooltip(point) {
  const tooltip = $("tooltip");
  if (tooltip.hidden) return;
  const size = map.getSize();
  const offset = 14;
  const left = point.x + offset + tooltip.offsetWidth > size.x ? point.x - offset - tooltip.offsetWidth : point.x + offset;
  const top = point.y + offset + tooltip.offsetHeight > size.y ? point.y - offset - tooltip.offsetHeight : point.y + offset;
  tooltip.style.left = `${Math.max(left, 0)}px`;
  tooltip.style.top = `${Math.max(top, 0)}px`;
}

map.on("mousemove", showHover);
map.on("mouseout dragstart zoomstart", hideHover);

/* ---- PNG export --------------------------------------------------------- */

/** The area and resolution the next export will use. */
function exportFrame() {
  const size = map.getSize();
  const scale = cappedScale(state.exportScale, size.x, size.y, MAX_EXPORT_PIXELS);
  if (state.exportExtent === "all" && scene.bounds) {
    return frameFittingBounds(scene.bounds, size.x, size.y, scale);
  }
  return frameFromMap(map, scale);
}

function updateExportSize() {
  const { width, height, scale } = exportFrame();
  $("export-size").textContent = `${Math.round(width * scale)} \u00d7 ${Math.round(height * scale)} px`;
}

async function exportCurrentView(event) {
  const button = event.currentTarget;
  button.disabled = true;
  showStatus("Rendering\u2026");
  try {
    const basemap = state.basemap === "none" ? null : basemaps[state.basemap];
    const failedTiles = await exportPng(
      {
        frame: exportFrame(),
        background: state.exportTransparent && !basemap ? null : BACKGROUND,
        basemap,
        view: VIEWS[state.view],
        scene,
        style: state,
      },
      `running-heatmap-${state.view}${basemap ? `-${state.basemap}` : ""}.png`,
    );
    showStatus(failedTiles > 0 ? `Saved, but ${failedTiles} map tiles could not be loaded.` : "");
  } catch (error) {
    showStatus(error instanceof ExportError ? error.message : "Export failed.", true);
    if (!(error instanceof ExportError)) console.error(error);
  } finally {
    button.disabled = false;
  }
}

function showStatus(message, isError = false) {
  const status = $("status");
  status.textContent = message;
  status.classList.toggle("error", isError);
}

/* ---- Start -------------------------------------------------------------- */

buildViewSwitcher();
buildRunFilter();
bindControls();
rebuildScene();
updateExportSize();
