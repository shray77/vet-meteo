#!/usr/bin/env python3
"""
Normalize disease outbreak data to match GeoJSON region names.

Maps region names from disease data (Russian) to the names used in
Natural Earth GeoJSON for Russian ADM1 boundaries.

Both Natural Earth and Rosselkhoznadzor use transliterated/English
names for some regions, while our disease data uses official Russian
names. This script bridges the gap.
"""

import json
import sys
from pathlib import Path

import geopandas as gpd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
GEO_DIR = DATA_DIR / "geo"
OUT_DIR = DATA_DIR / "outbreaks"

# Mapping: Russian name (from disease data) → Natural Earth name (in GeoJSON)
# Natural Earth uses English transliterations for Russian regions
REGION_MAP: dict[str, str] = {
    # Federal cities
    "Москва": "Moscow",
    "Санкт-Петербург": "St. Petersburg",
    "Севастополь": "Sevastopol'",

    # Oblasts (English: Oblast/Region)
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

    # Krais (English: Kray/Krai)
    "Краснодарский край": "Krasnodar",
    "Тюменская область": "Tyumen",
    "Алтайский край": "Altay",
    "Ставропольский край": "Stavropol'",
    "Красноярский край": "Krasnoyarsk",
    "Приморский край": "Primorskiy",
    "Хабаровский край": "Khabarovsk",
    "Забайкальский край": "Zabaykalskiy",

    # Republics
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

    # Other
    "Брянская область": "Bryansk",
    "Адыгея": "Adygeya",
    "Калмыкия": "Kalmykiya",
}


def load_geojson_names() -> dict[str, str]:
    """Load all region names from GeoJSON and return {normalized: geo_name}."""
    geo_path = GEO_DIR / "russia_adm1.geojson"
    gdf = gpd.read_file(geo_path)

    # Build reverse lookup: lowercase english name → actual name
    name_col = "shapeName" if "shapeName" in gdf.columns else "name"
    names = {}
    for name in gdf[name_col]:
        names[name.strip().lower()] = name.strip()

    return names


def normalize_region(russian_name: str, geo_names: dict[str, str]) -> str | None:
    """Map a Russian region name to the GeoJSON name."""
    # Direct lookup
    if russian_name in REGION_MAP:
        target = REGION_MAP[russian_name]
        if target.lower() in geo_names:
            return geo_names[target.lower()]

    # Try direct lowercase match
    if russian_name.lower() in geo_names:
        return geo_names[russian_name.lower()]

    # Try removing "область", "край", "Республика" etc.
    import re
    shortened = re.sub(r"\s+(область|край|округ|Республика|АО|Автономная область)", "",
                       russian_name, flags=re.IGNORECASE).strip()
    if shortened.lower() in geo_names:
        return geo_names[shortened.lower()]

    # Partial match
    for geo_lower, geo_name in geo_names.items():
        if shortened.lower() in geo_lower or geo_lower in shortened.lower():
            return geo_name

    return None


if __name__ == "__main__":
    from fetch_wahis import load_outbreaks

    outbreaks = load_outbreaks()
    geo_names = load_geojson_names()

    print(f"GeoJSON regions: {len(geo_names)}")
    unmatched = []
    for ob in outbreaks:
        geo_name = normalize_region(ob["region"], geo_names)
        if geo_name:
            ob["region_geo"] = geo_name
        else:
            unmatched.append(ob["region"])

    if unmatched:
        unique = sorted(set(unmatched))
        print(f"\n[warn] {len(unique)} unmatched regions:")
        for r in unique:
            print(f"  - {r}")
        print(f"\nGeoJSON names available:")
        for name in sorted(geo_names.values()):
            print(f"  - {name}")
    else:
        print("\n[ok] All regions matched!")
