#!/usr/bin/env python3
"""
Geocode outbreaks to specific municipalities/settlements using Nominatim (OpenStreetMap).
Extracts settlement names from notes/body_text, geocodes them, stores lat/lon.

Strategy:
1. Parse municipality/settlement from notes (for FSVPS)
2. For WAHIS without municipality, use region centroid (fallback)
3. Geocode "settlement, region, Russia" via Nominatim
4. Cache results to avoid re-geocoding
5. Store lat/lon in outbreak data

Rate limit: Nominatim allows 1 req/sec. We process ~250 FSVPS outbreaks.
Total time: ~4-5 minutes.
"""

import json
import re
import time
import urllib.request
import urllib.parse
from pathlib import Path
from collections import defaultdict

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

# Region centroids from our GeoJSON (fallback when no municipality)
# These are approximate centers of Russian regions
# Key = region_geo value (English), Value = (lon, lat)
REGION_CENTROIDS = {
    "Moskva": (37.6173, 55.7558),
    "Moskovskaya": (37.5, 55.5),
    "City of St. Petersburg": (30.3141, 59.9386),
    "Leningrad": (30.5, 59.7),
    "Belgorod": (36.5883, 50.6009),
    "Bryansk": (34.3717, 53.2427),
    "Vladimir": (40.3962, 56.1291),
    "Voronezh": (39.2003, 51.6608),
    "Ivanovo": (40.9714, 57.0004),
    "Kaluga": (36.2613, 54.5139),
    "Kostroma": (40.9266, 57.7665),
    "Kursk": (36.1926, 51.7373),
    "Lipetsk": (39.5704, 52.6088),
    "Oryol": (36.0785, 52.9696), "Orel": (36.0785, 52.9696),
    "Ryazan": (39.7426, 54.6229), "Ryazan'": (39.7426, 54.6229),
    "Smolensk": (31.9993, 54.7826),
    "Tambov": (41.4523, 52.7212),
    "Tver": (35.9023, 56.8627), "Tver'": (35.9023, 56.8627),
    "Tula": (37.6175, 54.1938),
    "Yaroslavl": (39.8736, 57.6265),
    "Arkhangelsk": (40.5169, 64.5394), "Arkhangel'sk": (40.5169, 64.5394),
    "Vologda": (39.8915, 59.2188),
    "Murmansk": (33.4147, 68.9585),
    "Nenets": (55.0, 67.0),
    "Karelia": (33.5, 61.8),
    "Komi": (54.0, 64.0),
    "Kaliningrad": (20.5, 54.7),
    "Pskov": (28.3345, 57.8194),
    "Novgorod": (31.2840, 58.5228),
    "Adygey": (38.9869, 44.6098),
    "Kalmyk": (44.2770, 46.3105),
    "Krasnodar": (38.9769, 45.0235),
    "Astrakhan": (48.0308, 46.3492), "Astrakhan'": (48.0308, 46.3492),
    "Volgograd": (44.5169, 48.7079),
    "Rostov": (39.7015, 47.2313),
    "Dagestan": (47.5, 42.5),
    "Chechnya": (45.7, 43.3),
    "Ingush": (45.0, 43.2),
    "Kabardin-Balkar": (43.5, 43.5),
    "Karachay-Cherkess": (42.0, 43.8),
    "North Ossetia": (44.7, 43.0),
    "Stavropol": (42.0, 45.0), "Stavropol'": (42.0, 45.0),
    "Tatarstan": (52.0, 55.5),
    "Bashkortostan": (56.0, 54.0),
    "Mordovia": (44.0, 54.2),
    "Udmurt": (52.2, 57.0),
    "Chuvash": (47.2, 55.5),
    "Mariy-El": (47.9, 56.6),
    "Kirov": (49.7, 58.6),
    "Nizhny Novgorod": (44.0, 56.3), "Nizhegorod": (44.0, 56.3),
    "Penza": (44.0, 53.2),
    "Samara": (50.2, 53.2),
    "Saratov": (46.0, 51.5),
    "Ulyanovsk": (48.4, 54.3), "Ul'yanovsk": (48.4, 54.3),
    "Chelyabinsk": (61.4, 55.0),
    "Kurgan": (65.3, 55.4),
    "Sverdlovsk": (60.6, 56.8),
    "Tyumen": (65.5, 57.2), "Tyumen'": (65.5, 57.2),
    "Khanty-Mansi": (73.3, 61.0),
    "Yamal-Nenets": (68.0, 67.0),
    "Omsk": (73.3, 55.0),
    "Tomsk": (84.9, 56.5),
    "Novosibirsk": (82.9, 55.0),
    "Kemerovo": (86.0, 54.7),
    "Altay": (84.0, 53.0), "Gorno-Altay": (84.0, 53.0),
    "Altay Krai": (83.7, 52.5),
    "Krasnoyarsk": (92.9, 56.0),
    "Khakass": (90.0, 53.0),
    "Tuva": (94.0, 51.8),
    "Irkutsk": (104.3, 52.3),
    "Buryat": (107.6, 52.2),
    "Zabaykal": (113.5, 52.0), "Chita": (113.5, 52.0),
    "Sakha (Yakutia)": (129.7, 62.0),
    "Amur": (128.0, 50.3),
    "Khabarovsk": (135.0, 48.5),
    "Primor'ye": (132.0, 44.0), "Primorye": (132.0, 44.0),
    "Kamchatka": (159.0, 56.0),
    "Magadan": (150.8, 59.6),
    "Sakhalin": (142.7, 46.9),
    "Sevastopol": (33.5, 44.6),
    "Crimea": (34.2, 45.0),
    "Orenburg": (55.1, 51.8),
}

# Resolve all paths relative to the repo root (parent of scripts/).
# Hardcoded absolute paths broke GitHub Actions runs because the runner
# checks out to /home/runner/work/<repo>/<repo>/, not /home/z/...
REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / "public/data/outbreaks.json"
REGIONS_TS_PATH = REPO_ROOT / "src/data/regions.ts"

# Cache file (gitignored — see .gitignore)
CACHE_PATH = REPO_ROOT / "scripts/.cache/geocode_cache.json"

def load_cache():
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text())
    return {}

def save_cache(cache):
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, indent=2, ensure_ascii=False))

def geocode_nominatim(query: str) -> tuple[float, float] | None:
    """Geocode a place name via Nominatim."""
    params = urllib.parse.urlencode({
        "q": query,
        "format": "json",
        "limit": 1,
        "countrycodes": "ru",
        "accept-language": "ru",
    })
    url = f"{NOMINATIM_URL}?{params}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "VetHeatmap/1.0 (veterinary epidemiology dashboard)",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        if data and len(data) > 0:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        pass
    return None

def extract_settlements_from_text(text: str) -> list[str]:
    """Extract settlement names from text."""
    settlements = []
    # Match "с. Name", "д. Name", "пос. Name", "г. Name", "ст. Name", "х. Name"
    for m in re.finditer(r'(?:с|д|пос|г|ст|х|аул)\.\s+([А-Я][а-яё\-]+)', text):
        settlements.append(m.group(1))
    # Match "район Name" or "Name район"
    for m in re.finditer(r'([А-Я][а-яё\-]+(?:ский|ая|ое|ий)\s+(?:район|м\.о\.|муниципальный округ))', text):
        settlements.append(m.group(1))
    return settlements

def get_region_centroid(region_geo: str, region_ru: str = "") -> tuple[float, float] | None:
    """Get region centroid from our lookup table."""
    # Try region_geo first
    coords = REGION_CENTROIDS.get(region_geo)
    if coords:
        return coords
    # Try Russian name → English mapping
    if region_ru:
        import re
        content = REGIONS_TS_PATH.read_text()
        for m in re.finditer(r'"([^"]+)":\s*"([^"]+)"', content):
            if m.group(1) == region_ru:
                coords = REGION_CENTROIDS.get(m.group(2))
                if coords:
                    return coords
    return None

def main():
    data = json.loads(DATA_PATH.read_text())
    outbreaks = data["outbreaks"]

    cache = load_cache()
    geocoded = 0
    using_centroid = 0
    no_coords = 0

    print(f"Geocoding {len(outbreaks)} outbreaks...")
    print(f"Cached lookups: {len(cache)}")

    for i, o in enumerate(outbreaks):
        # Skip if already has coordinates
        if o.get("lat") and o.get("lon"):
            geocoded += 1
            continue

        # 1. Try municipality from parsed data
        municipality = o.get("municipality")
        region = o.get("region", "")
        region_geo = o.get("region_geo", "")

        # 2. Try extracting settlements from notes
        notes = o.get("notes", "")
        settlements = o.get("settlements") or extract_settlements_from_text(notes)

        # 3. Build geocode query
        query = None
        if municipality:
            query = f"{municipality}, {region}, Россия"
        elif settlements:
            query = f"{settlements[0]}, {region}, Россия"

        coords = None
        if query:
            # Check cache
            if query in cache:
                coords = cache[query]
            else:
                coords = geocode_nominatim(query)
                cache[query] = coords
                time.sleep(1.1)  # Nominatim rate limit: 1 req/sec

        if coords:
            o["lat"] = coords[0]
            o["lon"] = coords[1]
            o["geocode_source"] = "nominatim"
            geocoded += 1
        else:
            # Fallback: region centroid (try both region_geo and Russian name)
            centroid = get_region_centroid(region_geo, region)
            if centroid:
                # Add small random offset to avoid all markers stacking at exact center
                import random
                random.seed(o.get("id", 0))
                offset_lat = random.uniform(-0.3, 0.3)
                offset_lon = random.uniform(-0.3, 0.3)
                o["lat"] = centroid[1] + offset_lat
                o["lon"] = centroid[0] + offset_lon
                o["geocode_source"] = "region_centroid"
                using_centroid += 1
            else:
                no_coords += 1

        if (i + 1) % 50 == 0:
            print(f"  Progress: {i+1}/{len(outbreaks)} (geocoded={geocoded}, centroid={using_centroid}, none={no_coords})")

    print(f"\nResults:")
    print(f"  Geocoded (Nominatim): {geocoded}")
    print(f"  Region centroid: {using_centroid}")
    print(f"  No coordinates: {no_coords}")

    # Save cache
    save_cache(cache)
    print(f"Cache saved: {len(cache)} entries")

    # Write data
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"Written {len(outbreaks)} outbreaks to {DATA_PATH}")

if __name__ == "__main__":
    main()
