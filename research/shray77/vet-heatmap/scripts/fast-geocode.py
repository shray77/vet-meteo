#!/usr/bin/env python3
"""
Fast geocode: assign region centroid + jitter to all outbreaks
without lat/lon. Skips Nominatim entirely (too slow for 1300+ points
in CI — would take 20+ min at 1 req/sec).

This gives every outbreak a position roughly inside its region, with
±0.3° jitter so they don't all stack at the exact centroid. Visually
this is good enough for the heatmap — the user can still click on
each point to see the actual municipality/notes.

Future improvement: run a real Nominatim pass offline (not in CI) and
commit the resulting cache file to the repo.
"""
import json
import random
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = REPO_ROOT / "public/data/outbreaks.json"
REGIONS_TS_PATH = REPO_ROOT / "src/data/regions.ts"

# Region centroids (lon, lat) — same as in geocode.py
REGION_CENTROIDS = {
    "Moskva": (37.6173, 55.7558), "Moskovskaya": (37.5, 55.5),
    "City of St. Petersburg": (30.3141, 59.9386), "Leningrad": (30.5, 59.7),
    "Belgorod": (36.5883, 50.6009), "Bryansk": (34.3717, 53.2427),
    "Vladimir": (40.3962, 56.1291), "Voronezh": (39.2003, 51.6608),
    "Ivanovo": (40.9714, 57.0004), "Kaluga": (36.2613, 54.5139),
    "Kostroma": (40.9266, 57.7665), "Kursk": (36.1926, 51.7373),
    "Lipetsk": (39.5704, 52.6088), "Oryol": (36.0785, 52.9696), "Orel": (36.0785, 52.9696),
    "Ryazan": (39.7426, 54.6229), "Ryazan'": (39.7426, 54.6229),
    "Smolensk": (31.9993, 54.7826), "Tambov": (41.4523, 52.7212),
    "Tver": (35.9023, 56.8627), "Tver'": (35.9023, 56.8627),
    "Tula": (37.6175, 54.1938), "Yaroslavl": (39.8736, 57.6265),
    "Arkhangelsk": (40.5169, 64.5394), "Arkhangel'sk": (40.5169, 64.5394),
    "Vologda": (39.8915, 59.2188), "Murmansk": (33.4147, 68.9585),
    "Nenets": (55.0, 67.0), "Karelia": (33.5, 61.8), "Komi": (54.0, 64.0),
    "Kaliningrad": (20.5, 54.7), "Pskov": (28.3345, 57.8194),
    "Novgorod": (31.2840, 58.5228),
    "Adygey": (38.9869, 44.6098), "Kalmyk": (44.2770, 46.3105),
    "Krasnodar": (38.9769, 45.0235),
    "Astrakhan": (48.0308, 46.3492), "Astrakhan'": (48.0308, 46.3492),
    "Volgograd": (44.5169, 48.7079), "Rostov": (39.7015, 47.2313),
    "Dagestan": (47.5, 42.5), "Chechnya": (45.7, 43.3),
    "Ingush": (45.0, 43.2), "Kabardin-Balkar": (43.5, 43.5),
    "Karachay-Cherkess": (42.0, 43.8), "North Ossetia": (44.7, 43.0),
    "Stavropol": (42.0, 45.0), "Stavropol'": (42.0, 45.0),
    "Tatarstan": (52.0, 55.5), "Bashkortostan": (56.0, 54.0),
    "Mordovia": (44.0, 54.2), "Udmurt": (52.2, 57.0),
    "Chuvash": (47.2, 55.5), "Mariy-El": (47.9, 56.6), "Kirov": (49.7, 58.6),
    "Nizhny Novgorod": (44.0, 56.3), "Nizhegorod": (44.0, 56.3),
    "Samara": (50.15, 53.5), "Orenburg": (55.1, 51.8),
    "Penza": (45.0, 53.0), "Perm": (56.0, 58.0), "Perm'": (56.0, 58.0),
    "Saratov": (46.0, 51.5), "Ulyanovsk": (48.4, 54.3),
    "Kurgan": (64.0, 55.5), "Sverdlovsk": (60.0, 58.0),
    "Tyumen": (65.5, 57.0), "Tyumen'": (65.5, 57.0),
    "Khanty-Mansiy": (73.0, 61.0), "Yamalo-Nenets": (67.0, 67.0),
    "Chelyabinsk": (61.4, 55.0),
    "Altay": (83.0, 52.5), "Altai Republic": (86.0, 51.0),
    "Kemerovo": (87.0, 55.0), "Novosibirsk": (82.9, 55.0),
    "Omsk": (73.3, 55.0), "Tomsk": (84.97, 56.5),
    "Tyva": (93.0, 51.0), "Khakass": (90.0, 53.0),
    "Irkutsk": (104.3, 52.3), "Buryat": (107.0, 52.0),
    "Zabaykalsk": (113.5, 52.0), "Chita": (113.5, 52.0),
    "Sakha": (130.0, 62.0), "Yakutia": (130.0, 62.0),
    "Amur": (127.5, 50.3), "Kamchatka": (160.0, 56.0),
    "Magadan": (150.7, 62.0), "Primorye": (132.0, 44.0),
    "Sakhalin": (143.0, 50.0), "Khabarovsk": (135.4, 48.5),
    "Chukotka": (177.0, 67.0),
    "Sevastopol": (33.5, 44.6), "Crimea": (34.2, 45.0),
}

# RU → EN mapping from regions.ts (lazy-loaded)
_RU_TO_EN: dict[str, str] | None = None


def get_ru_to_en_map() -> dict[str, str]:
    global _RU_TO_EN
    if _RU_TO_EN is not None:
        return _RU_TO_EN
    content = REGIONS_TS_PATH.read_text()
    mapping: dict[str, str] = {}
    # Look for "Russian name": "English shapeName" pairs in REGION_MAP
    for m in re.finditer(r'"([^"]+)":\s*"([^"]+)"', content):
        ru, en = m.group(1), m.group(2)
        # Heuristic: Russian name contains Cyrillic
        if any('\u0400' <= ch <= '\u04ff' for ch in ru):
            mapping[ru] = en
    _RU_TO_EN = mapping
    return mapping


def get_centroid(region_geo: str, region_ru: str) -> tuple[float, float] | None:
    """Get (lon, lat) centroid for a region."""
    if region_geo and region_geo in REGION_CENTROIDS:
        return REGION_CENTROIDS[region_geo]
    # Try Russian name → English shapeName mapping
    if region_ru:
        ru_to_en = get_ru_to_en_map()
        en = ru_to_en.get(region_ru)
        if en and en in REGION_CENTROIDS:
            return REGION_CENTROIDS[en]
        # Try direct match (some RU names == EN keys)
        if region_ru in REGION_CENTROIDS:
            return REGION_CENTROIDS[region_ru]
    return None


def main():
    data = json.loads(DATA_PATH.read_text())
    outbreaks = data["outbreaks"]

    ru_to_en = get_ru_to_en_map()
    print(f"Region map: {len(ru_to_en)} RU→EN mappings")

    already_has = 0
    geocoded_centroid = 0
    no_coords = 0

    for o in outbreaks:
        # Skip if already has valid coords
        lat = o.get("lat")
        lon = o.get("lon")
        if isinstance(lat, (int, float)) and isinstance(lon, (int, float)) and not (lat == 0 and lon == 0):
            already_has += 1
            continue

        region_geo = o.get("region_geo", "")
        region_ru = o.get("region", "")

        centroid = get_centroid(region_geo, region_ru)
        if centroid:
            # Deterministic jitter based on outbreak id — same id always
            # gets same offset, so re-runs don't shuffle points.
            rng = random.Random(o.get("id", 0))
            offset_lat = rng.uniform(-0.3, 0.3)
            offset_lon = rng.uniform(-0.3, 0.3)
            o["lat"] = centroid[1] + offset_lat
            o["lon"] = centroid[0] + offset_lon
            o["geocode_source"] = "region_centroid"
            geocoded_centroid += 1
        else:
            no_coords += 1

    print(f"\nResults:")
    print(f"  Already had coords:   {already_has}")
    print(f"  Region centroid+jitter: {geocoded_centroid}")
    print(f"  No coords (region=?): {no_coords}")

    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"\nWritten {len(outbreaks)} outbreaks to {DATA_PATH}")


if __name__ == "__main__":
    main()
