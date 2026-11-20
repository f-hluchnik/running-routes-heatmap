"use strict";

const OSM_TILES = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

const BACKGROUND = "#14161a";
const BASEMAP_FILTER = "grayscale(0.85) brightness(1.05) contrast(0.92)"; // calms OSM colours

const state = { view: "glow", basemap: false, width: 3, opacity: 0.5 };

const data = loadDataset(JSON.parse(document.getElementById("heatmap-data").textContent));
let scene = buildScene(data);

const map = L.map("map", { zoomSnap: 0.25, zoomAnimation: false, attributionControl: false });
map.fitBounds(data.bounds, { padding: [40, 40] });

map.getPane("tilePane").style.filter = BASEMAP_FILTER;

const basemap = L.tileLayer(OSM_TILES.url, {
  attribution: OSM_TILES.attribution,
  maxZoom: 19,
  crossOrigin: "anonymous", // lets the PNG export read the tiles
});

const routesLayer = new RoutesLayer((ctx, frame) => {
  ctx.clearRect(0, 0, frame.width * frame.scale, frame.height * frame.scale);
  VIEWS[state.view].draw(ctx, frame, scene, state);
}).addTo(map);

L.control.attribution({ prefix: false }).addTo(map);

/* ---- Controls ---------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

function update() {
  const view = VIEWS[state.view];
  $("opacity-row").hidden = !view.usesOpacity;
  $("legend").hidden = !view.hasLegend;
  if (state.basemap) basemap.addTo(map);
  else basemap.remove();
  routesLayer.redraw();
}

$("summary").textContent =
  `${data.runs.length} runs · ${data.totalKm.toFixed(1)} km`;

$("legend-bar").style.background = rampGradient();
$("legend-max").textContent = scene.maxFrequency;
$("width").value = state.width;
$("opacity").value = state.opacity;

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
      update();
    });
    const text = Object.assign(document.createElement("span"), { textContent: view.label });
    const label = document.createElement("label");
    label.append(radio, text);
    $("views").append(label);
  }
}

buildViewSwitcher();
$("basemap").addEventListener("change", (event) => {
  state.basemap = event.target.checked;
  update();
});
$("width").addEventListener("input", (event) => {
  state.width = Number(event.target.value);
  update();
});
$("opacity").addEventListener("input", (event) => {
  state.opacity = Number(event.target.value);
  update();
});

update();

/* ---- PNG export -------------------------------------------------------- */

$("export").addEventListener("click", async (event) => {
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
});

function showStatus(message, isError = false) {
  const status = $("status");
  status.textContent = message;
  status.classList.toggle("error", isError);
}
