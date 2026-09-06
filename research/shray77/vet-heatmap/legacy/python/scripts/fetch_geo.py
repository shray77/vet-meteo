#!/usr/bin/env python3
"""
Download and prepare GeoJSON for Russian administrative regions (ADM1).

Uses Natural Earth Admin 1 - States/Provinces as the base data source,
then filters for Russia only and normalizes region names to match
our disease dataset.

Output: data/geo/russia_adm1.geojson
"""

import sys
from pathlib import Path

import geopandas as gpd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
GEO_DIR = DATA_DIR / "geo"
GEO_DIR.mkdir(parents=True, exist_ok=True)

# Natural Earth ADM1 - 10m resolution
NE_URL = "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip"


def download_ne_adm1() -> Path:
    """Download Natural Earth ADM1 and filter Russia only."""
    out_path = GEO_DIR / "russia_adm1.geojson"

    if out_path.exists() and out_path.stat().st_size > 100_000:
        print(f"[skip] {out_path} already exists ({out_path.stat().st_size:,} bytes)")
        return out_path

    print(f"[download] Natural Earth ADM1 from {NE_URL}...")
    gdf = gpd.read_file(NE_URL)
    print(f"[info] Loaded {len(gdf)} features total")

    # Filter Russia (iso_a2 = 'RU')
    russia = gdf[gdf["iso_a2"] == "RU"].copy()
    print(f"[info] Found {len(russia)} Russian regions")

    if len(russia) == 0:
        print("[error] No Russian regions found in Natural Earth data!", file=sys.stderr)
        sys.exit(1)

    # Simplify geometry to reduce file size (preserve ~1km accuracy)
    russia["geometry"] = russia["geometry"].simplify(tolerance=0.005, preserve_topology=True)

    # Rename for our pipeline
    russia = russia.rename(columns={"name": "shapeName", "name_ru": "shapeName_ru"})

    # Keep only needed columns
    keep_cols = [c for c in ["shapeName", "shapeName_ru", "iso_a2", "admin", "geometry"] if c in russia.columns]
    russia = russia[keep_cols]

    # Ensure CRS is WGS84 (EPSG:4326) for folium
    russia = russia.to_crs(epsg=4326)

    russia.to_file(out_path, driver="GeoJSON")
    print(f"[ok] Saved {len(russia)} regions to {out_path} ({out_path.stat().st_size:,} bytes)")
    return out_path


if __name__ == "__main__":
    download_ne_adm1()
