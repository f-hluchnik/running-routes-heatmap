"use strict";

/* ---- Configuration ------------------------------------------------------ */

const OSM_TILES = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

const BACKGROUND = "#14161a";
const BASEMAP_FILTER = "grayscale(0.85) brightness(1.05) contrast(0.92)"; // calms OSM colours

/* ---- State -------------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

const state = { view: "glow", basemap: false, width: 3, opacity: 0.5 };
const data = loadDataset(JSON.parse($("heatmap-data").textContent));
const runFilter = new RunFilter(data.runs);
let scene = buildScene(data, (runIndex) => runFilter.isVisible(runIndex));

/* ---- Map ---------------------------------------------------------------- */

const map = L.map("map", { zoomSnap: 0.25, zoomAnimation: false, attributionControl: false });
map.fitBounds(data.bounds, { padding: [40, 40] });
map.getPane("tilePane").style.filter = BASEMAP_FILTER;
L.control.attribution({ prefix: false }).addTo(map);

const basemap = L.tileLayer(OSM_TILES.url, {
  attribution: OSM_TILES.attribution,
  maxZoom: 19,
  crossOrigin: "anonymous", // lets the PNG export read the tiles
});

const routesLayer = new RoutesLayer((ctx, frame) => {
  ctx.clearRect(0, 0, frame.width * frame.scale, frame.height * frame.scale);
  VIEWS[state.view].draw(ctx, frame, scene, state);
}).addTo(map);

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
  if (state.basemap) basemap.addTo(map);
  else basemap.remove();
  routesLayer.redraw();
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

  $("basemap").addEventListener("change", (event) => {
    state.basemap = event.target.checked;
    refresh();
  });
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

/* ---- PNG export --------------------------------------------------------- */

async function exportCurrentView(event) {
  const button = event.currentTarget;
  button.disabled = true;
  showStatus("Rendering…");
  try {
    await exportPng(
      map,
      {
        scale: EXPORT_SCALE,
        background: BACKGROUND,
        basemap: state.basemap,
        filter: BASEMAP_FILTER,
        view: VIEWS[state.view],
        scene,
        style: state,
      },
      `running-heatmap-${state.view}${state.basemap ? "-osm" : ""}.png`,
    );
    showStatus("");
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
