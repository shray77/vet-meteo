import geopandas as gpd

gdf = gpd.read_file("https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip")
print("Columns:", list(gdf.columns))
# Find Russia
iso_col = None
for c in ["ISO_A2", "iso_a2", "adm0_a3", "ISO_A3", "iso_a3", "adm0_iso_a3"]:
    if c in gdf.columns:
        iso_col = c
        print(f"Using iso column: {c}")
        break

if iso_col:
    # Try different country codes
    for code in ["RU", "RUS", "Russia", "Russian Federation"]:
        match = gdf[gdf[iso_col].astype(str).str.upper() == code.upper()]
        if len(match) > 0:
            print(f"\nCode '{code}' matches {len(match)} features")
            print(match[["name", iso_col]].head(5))
            break

# Also try name-based
name_col = None
for c in ["admin", "ADMIN", "sovereignt"]:
    if c in gdf.columns:
        name_col = c
        break
if name_col:
    match = gdf[gdf[name_col] == "Russia"]
    print(f"\nBy admin name 'Russia': {len(match)} features")
    print(match[["name", name_col]].head(5))
