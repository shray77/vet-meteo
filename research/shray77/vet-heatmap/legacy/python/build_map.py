#!/usr/bin/env python3
"""
Build an interactive folium choropleth heatmap of animal disease outbreaks
across Russian administrative regions.

Reads:
  - data/geo/russia_adm1.geojson (region boundaries)
  - data/outbreaks/outbreaks.json (disease outbreak data)

Outputs:
  - docs/index.html (self-contained interactive map)
"""

import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import folium
import geopandas as gpd
import pandas as pd

# ─── Paths ────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
GEO_PATH = DATA_DIR / "geo" / "russia_adm1.geojson"
OUTBREAKS_PATH = DATA_DIR / "outbreaks" / "outbreaks.json"
DOCS_DIR = ROOT / "docs"
DOCS_DIR.mkdir(parents=True, exist_ok=True)

# ─── Region name mapping (Russian → GeoJSON English name) ────────────
REGION_MAP: dict[str, str] = {
    "Москва": "Moscow",
    "Санкт-Петербург": "St. Petersburg",
    "Севастополь": "Sevastopol'",
    "Астраханская область": "Astrakhan",
    "Ростовская область": "Rostov",
    "Челябинская область": "Chelyabinsk",
    "Новосибирская область": "Novosibirsk",
    "Ленинградская область": "Leningrad",
    "Московская область": "Moskva",
    "Саратовская область": "Saratov",
    "Владимирская область": "Vladimir",
    "Тверская область": "Tver",
    "Самарская область": "Samara",
    "Волгоградская область": "Volgograd",
    "Орловская область": "Oryol",
    "Калужская область": "Kaluga",
    "Ульяновская область": "Ulyanovsk",
    "Архангельская область": "Arkhangel'sk",
    "Вологодская область": "Vologda",
    "Томская область": "Tomsk",
    "Амурская область": "Amur",
    "Белгородская область": "Belgorod",
    "Кировская область": "Kirov",
    "Удмуртская Республика": "Udmurt",
    "Пензенская область": "Penza",
    "Тамбовская область": "Tambov",
    "Нижегородская область": "Nizhegorod",
    "Мурманская область": "Murmansk",
    "Иркутская область": "Irkutsk",
    "Псковская область": "Pskov",
    "Новгородская область": "Novgorod",
    "Свердловская область": "Sverdlovsk",
    "Оренбургская область": "Orenburg",
    "Краснодарский край": "Krasnodar",
    "Тюменская область": "Tyumen",
    "Алтайский край": "Altay",
    "Ставропольский край": "Stavropol'",
    "Красноярский край": "Krasnoyarsk",
    "Приморский край": "Primorskiy",
    "Хабаровский край": "Khabarovsk",
    "Забайкальский край": "Zabaykalskiy",
    "Дагестан": "Dagestan",
    "Чеченская Республика": "Chechnya",
    "Кабардино-Балкарская Республика": "Kabardin-Balkar",
    "Ингушетия": "Ingushetiya",
    "Карачаево-Черкесская Республика": "Karachay-Cherkess",
    "Татарстан": "Tatarstan",
    "Республика Татарстан": "Tatarstan",
    "Башкортостан": "Bashkortostan",
    "Республика Мордовия": "Mordovia",
    "Республика Саха (Якутия)": "Saha",
    "Республика Бурятия": "Buryatiya",
    "Республика Коми": "Komi",
    "Республика Марий Эл": "Mari El",
    "Республика Карелия": "Karelia",
    "Хакасия": "Khakasiya",
    "Тыва": "Tyva",
    "Брянская область": "Bryansk",
    "Адыгея": "Adygeya",
    "Калмыкия": "Kalmykiya",
}


def normalize_region(russian_name: str) -> str | None:
    """Map Russian region name to GeoJSON name."""
    if russian_name in REGION_MAP:
        return REGION_MAP[russian_name]
    # Fallback: try direct lowercase
    return russian_name  # Let the merge handle it


def load_data() -> tuple[gpd.GeoDataFrame, list[dict]]:
    """Load GeoJSON and outbreak data."""
    if not GEO_PATH.exists():
        print(f"[error] GeoJSON not found: {GEO_PATH}", file=sys.stderr)
        print("[hint] Run: python scripts/fetch_geo.py", file=sys.stderr)
        sys.exit(1)

    if not OUTBREAKS_PATH.exists():
        print(f"[error] Outbreaks not found: {OUTBREAKS_PATH}", file=sys.stderr)
        print("[hint] Run: python scripts/fetch_wahis.py", file=sys.stderr)
        sys.exit(1)

    gdf = gpd.read_file(GEO_PATH)
    print(f"[info] Loaded {len(gdf)} regions from GeoJSON")

    with open(OUTBREAKS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    outbreaks = data["outbreaks"]
    print(f"[info] Loaded {len(outbreaks)} outbreaks")
    return gdf, outbreaks


def aggregate_by_region(outbreaks: list[dict]) -> pd.DataFrame:
    """Aggregate outbreak data by region for choropleth coloring."""
    # Map all outbreaks to GeoJSON region names
    region_data: dict[str, dict] = defaultdict(lambda: {
        "total_outbreaks": 0,
        "total_cases": 0,
        "total_deaths": 0,
        "diseases": set(),
        "latest_date": "",
    })

    for ob in outbreaks:
        geo_name = normalize_region(ob["region"])
        if not geo_name:
            continue

        rd = region_data[geo_name]
        rd["total_outbreaks"] += 1
        rd["total_cases"] += ob.get("cases", 0)
        rd["total_deaths"] += ob.get("deaths", 0)
        rd["diseases"].add(ob.get("disease", "Unknown"))
        if ob.get("date", "") > rd["latest_date"]:
            rd["latest_date"] = ob["date"]

    # Convert to DataFrame
    rows = []
    for region, stats in region_data.items():
        rows.append({
            "region": region,
            "outbreaks": stats["total_outbreaks"],
            "cases": stats["total_cases"],
            "deaths": stats["total_deaths"],
            "diseases": ", ".join(sorted(stats["diseases"])),
            "latest": stats["latest_date"],
        })

    return pd.DataFrame(rows)


def build_map(gdf: gpd.GeoDataFrame, stats_df: pd.DataFrame) -> folium.Map:
    """Build the interactive folium map."""

    # ─── Base map ─────────────────────────────────────────────────────
    m = folium.Map(
        location=[55.0, 50.0],
        zoom_start=3,
        tiles=None,
        control_scale=True,
    )

    # CartoDB Positron (clean, light)
    folium.TileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        attr='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> '
             '&copy; <a href="https://carto.com/">CARTO</a>',
        name="Light",
        max_zoom=19,
    ).add_to(m)

    # Dark theme option
    folium.TileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        attr='&copy; OSM &copy; CARTO',
        name="Dark",
        max_zoom=19,
    ).add_to(m)

    # Satellite option
    folium.TileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        attr='&copy; Esri',
        name="Satellite",
        max_zoom=19,
    ).add_to(m)

    # ─── Identify the GeoJSON name column ──────────────────────────────
    name_col = "shapeName" if "shapeName" in gdf.columns else "name"

    # Build name-to-stats lookup (case-insensitive)
    stats_lookup: dict[str, dict] = {}
    for _, row in stats_df.iterrows():
        stats_lookup[row["region"].lower()] = row.to_dict()

    # Add stats columns to GeoDataFrame
    gdf["outbreak_count"] = 0
    gdf["disease_list"] = ""
    gdf["total_cases"] = 0
    gdf["total_deaths"] = 0
    gdf["latest_date"] = ""

    for idx, feat in gdf.iterrows():
        feat_name = str(feat[name_col]).strip().lower()
        if feat_name in stats_lookup:
            stats = stats_lookup[feat_name]
            gdf.at[idx, "outbreak_count"] = stats.get("outbreaks", 0)
            gdf.at[idx, "disease_list"] = stats.get("diseases", "")
            gdf.at[idx, "total_cases"] = stats.get("cases", 0)
            gdf.at[idx, "total_deaths"] = stats.get("deaths", 0)
            gdf.at[idx, "latest_date"] = stats.get("latest", "")

    # ─── Choropleth layer ─────────────────────────────────────────────
    # Use JSON string from file (not GeoDataFrame) to ensure properties survive
    geo_json_str = GEO_PATH.read_text(encoding="utf-8")
    choropleth = folium.Choropleth(
        geo_data=json.loads(geo_json_str),
        data=gdf,
        columns=[name_col, "outbreak_count"],
        key_on=f"feature.properties.{name_col}",
        fill_color="YlOrRd",
        fill_opacity=0.7,
        line_opacity=0.3,
        line_weight=1,
        name="Outbreak Density",
        legend_name="Number of Disease Outbreaks",
        highlight=True,
    )
    choropleth.add_to(m)

    # ─── Tooltip layer (rich popups) ──────────────────────────────────
    def style_function(feature):
        return {
            "fillOpacity": 0.05,
            "color": "#333333",
            "weight": 1,
        }

    def highlight_function(feature):
        return {
            "weight": 3,
            "color": "#ff3333",
            "fillOpacity": 0.4,
        }

    # Add GeoJSON with tooltips
    tooltip_gj = folium.GeoJson(
        gdf,
        style_function=style_function,
        highlight_function=highlight_function,
        tooltip=folium.GeoJsonTooltip(
            fields=[name_col, "outbreak_count", "total_cases", "total_deaths", "disease_list", "latest_date"],
            aliases=["Region", "Outbreaks", "Total Cases", "Deaths", "Diseases", "Latest Outbreak"],
            localize=False,
            sticky=True,
            labels=True,
            style=(
                "background-color: rgba(30, 30, 30, 0.9);"
                "color: #f0f0f0;"
                "font-family: 'Segoe UI', Arial, sans-serif;"
                "font-size: 13px;"
                "padding: 10px;"
                "border-radius: 6px;"
                "line-height: 1.6;"
            ),
        ),
    )
    tooltip_gj.add_to(m)

    # ─── Marker for regions with active (ongoing) outbreaks ────────────
    # Load full outbreak data for markers
    with open(OUTBREAKS_PATH, "r", encoding="utf-8") as f:
        full_data = json.load(f)

    ongoing = [ob for ob in full_data["outbreaks"] if ob.get("status") == "Ongoing"]
    if ongoing:
        ongoing_group = folium.FeatureGroup(name="Ongoing Outbreaks")

        for ob in ongoing:
            geo_name = normalize_region(ob["region"])
            if not geo_name:
                continue

            # Find centroid of region from GeoDataFrame
            match = gdf[gdf[name_col].str.lower() == geo_name.lower()]
            if match.empty:
                continue

            centroid = match.geometry.iloc[0].centroid
            lat, lon = centroid.y, centroid.x

            popup_html = folium.Popup(
                f"""
                <div style="width:280px; font-family:'Segoe UI',sans-serif;">
                    <h4 style="margin:0 0 8px; color:#c0392b;">🔴 {ob['disease']}</h4>
                    <table style="font-size:13px; width:100%;">
                        <tr><td><b>Region:</b></td><td>{ob['region']}</td></tr>
                        <tr><td><b>Date:</b></td><td>{ob['date']}</td></tr>
                        <tr><td><b>Species:</b></td><td>{ob['species']}</td></tr>
                        <tr><td><b>Cases:</b></td><td>{ob['cases']}</td></tr>
                        <tr><td><b>Deaths:</b></td><td>{ob['deaths']}</td></tr>
                        <tr><td><b>Status:</b></td><td><span style="color:#e74c3c;font-weight:bold;">Ongoing</span></td></tr>
                        <tr><td><b>Source:</b></td><td>{ob['source']}</td></tr>
                    </table>
                </div>
                """,
                max_width=300,
            )

            folium.CircleMarker(
                location=[lat, lon],
                radius=8 + min(ob.get("cases", 1) * 0.01, 12),
                color="#e74c3c",
                fillColor="#e74c3c",
                fillOpacity=0.6,
                weight=2,
                popup=popup_html,
                tooltip=folium.Tooltip(f"🔴 {ob['disease']} — {ob['region']}"),
            ).add_to(ongoing_group)

        ongoing_group.add_to(m)

    # ─── Disease filter buttons (using folium plugins style) ──────────
    # Group diseases by type for potential filtering
    disease_groups: dict[str, folium.FeatureGroup] = {}
    for ob in full_data["outbreaks"]:
        group_name = ob.get("disease_group", "Other")
        if group_name not in disease_groups:
            disease_groups[group_name] = folium.FeatureGroup(name=f"🦠 {group_name}")

    # ─── Layer control ─────────────────────────────────────────────────
    folium.LayerControl(collapsed=True, position="topright").add_to(m)

    # ─── Title and info panel ─────────────────────────────────────────
    total_ob = len(full_data["outbreaks"])
    ongoing_count = len(ongoing)
    regions_affected = gdf[gdf["outbreak_count"] > 0].shape[0]
    total_regions = len(gdf)
    diseases_count = len(set(ob["disease"] for ob in full_data["outbreaks"]))
    updated = full_data.get("updated", datetime.now().strftime("%Y-%m-%d"))

    title_html = f"""
    <div style="
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 9999;
        background: rgba(15, 15, 25, 0.92);
        padding: 16px 20px;
        border-radius: 12px;
        color: #f0f0f0;
        font-family: 'Segoe UI', Arial, sans-serif;
        max-width: 340px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        backdrop-filter: blur(8px);
    ">
        <div style="font-size: 20px; font-weight: 700; margin-bottom: 2px; color: #fff;">
            🐾 Animal Disease Heatmap
        </div>
        <div style="font-size: 12px; color: #aaa; margin-bottom: 12px;">
            Russian Federation — Interactive Outbreak Map
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
            <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 8px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: #e74c3c;">{total_ob}</div>
                <div style="color: #bbb;">Total Outbreaks</div>
            </div>
            <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 8px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: #f39c12;">{ongoing_count}</div>
                <div style="color: #bbb;">Ongoing</div>
            </div>
            <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 8px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: #3498db;">{regions_affected}/{total_regions}</div>
                <div style="color: #bbb;">Regions Affected</div>
            </div>
            <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 8px; text-align: center;">
                <div style="font-size: 22px; font-weight: 700; color: #2ecc71;">{diseases_count}</div>
                <div style="color: #bbb;">Disease Types</div>
            </div>
        </div>
        <div style="font-size: 10px; color: #777; margin-top: 10px; text-align: center;">
            Data: WOAH WAHIS / Rosselkhoznadzor · Updated: {updated}<br>
            <a href="https://github.com/shray77/vet-heatmap" style="color: #66aaff; text-decoration: none;">
                GitHub</a> ·
            <a href="https://www.woah.org" style="color: #66aaff; text-decoration: none;">
                WOAH
            </a>
        </div>
    </div>
    """
    m.get_root().html.add_child(folium.Element(title_html))

    # ─── Fullscreen plugin ────────────────────────────────────────────
    fullscreen_css = """
    <style>
        .leaflet-control-fullscreen { display: none; }
    </style>
    """
    m.get_root().html.add_child(folium.Element(fullscreen_css))

    return m


def main():
    print("=" * 60)
    print("  🐾 Animal Disease Heatmap — Map Builder")
    print("=" * 60)

    gdf, outbreaks = load_data()
    stats_df = aggregate_by_region(outbreaks)

    print(f"\n[info] Regions with outbreaks: {len(stats_df)}")
    print(f"[info] Top 5 regions by outbreaks:")
    for _, row in stats_df.nlargest(5, "outbreaks").iterrows():
        print(f"      {row['region']}: {row['outbreaks']} outbreaks ({row['cases']} cases)")

    m = build_map(gdf, stats_df)

    output_path = DOCS_DIR / "index.html"
    m.save(str(output_path))
    size = output_path.stat().st_size
    print(f"\n[ok] Map saved to {output_path} ({size:,} bytes, {size/1024/1024:.1f} MB)")
    print(f"[ok] Open in browser: file:///{output_path}")


if __name__ == "__main__":
    main()
