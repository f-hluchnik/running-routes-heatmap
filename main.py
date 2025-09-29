import gpxpy
import geopandas as gpd
from shapely.geometry import LineString
import matplotlib.pyplot as plt
from pathlib import Path

data_folder = Path("data")

runs = []

for gpx_file in data_folder.glob("*.gpx"):
    with open(gpx_file, "r") as f:
        gpx = gpxpy.parse(f)

    coords = []
    for track in gpx.tracks:
        for segment in track.segments:
            for point in segment.points:
                coords.append((point.longitude, point.latitude))
    
    if coords:
        runs.append(LineString(coords))

gdf = gpd.GeoDataFrame(geometry=runs, crs="EPSG:4326")
gdf.plot(figsize=(8, 8))
plt.title("All runs")
plt.show()
