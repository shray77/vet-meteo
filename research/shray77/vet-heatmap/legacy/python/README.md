# 🐾 Animal Disease Heatmap — Russia

Interactive choropleth heatmap of animal disease outbreaks across Russian regions.

**Live map:** [shray77.github.io/vet-heatmap](https://shray77.github.io/vet-heatmap/)

![Heatmap preview](https://img.shields.io/badge/map-choropleth-blue) ![Python](https://img.shields.io/badge/Python-3.12-green) ![License](https://img.shields.io/badge/license-MIT-orange)

## Features

- 🗺️ **Interactive map** — hover over any region for outbreak details
- 🔴 **Ongoing outbreaks** — marked with red circle markers
- 🎨 **Multiple basemaps** — Light, Dark, Satellite
- 📊 **Dashboard panel** — total outbreaks, ongoing count, affected regions, disease types
- 🔄 **Auto-updated** via GitHub Actions (Mon & Thu)

## Data Sources

| Source | Type | Coverage |
|--------|------|----------|
| [WOAH WAHIS](https://wahis.woah.org) | Official reports | Global |
| [Rosselkhoznadzor](https://fsvps.gov.ru) | Press releases | Russia |
| [EFSA](https://www.efsa.europa.eu) | AI reports | Europe/Cross-border |

## Region Coverage

85+ administrative subjects of the Russian Federation (republics, krais, oblasts, federal cities).

## Tech Stack

- **Python 3.12** — data pipeline
- **geopandas** — GeoJSON processing
- **folium** — interactive Leaflet maps
- **GitHub Pages** — hosting
- **GitHub Actions** — automated updates

## Project Structure

```
vet-heatmap/
├── .github/workflows/
│   └── update-map.yml      # CI/CD — auto-build map
├── data/
│   ├── geo/
│   │   └── russia_adm1.geojson   # Region boundaries
│   └── outbreaks/
│       └── outbreaks.json         # Disease outbreak data
├── scripts/
│   ├── fetch_geo.py         # Download & prepare GeoJSON
│   └── fetch_wahis.py       # Outbreak data management
├── docs/
│   └── index.html           # Generated map (GitHub Pages)
├── build_map.py             # Main map builder
├── normalize.py             # Region name normalization
├── requirements.txt
└── README.md
```

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Download GeoJSON (Natural Earth ADM1 → Russia)
python scripts/fetch_geo.py

# Generate outbreak data
python scripts/fetch_wahis.py

# Build the map
python build_map.py

# Open in browser
start docs/index.html
```

## Extending to Other Countries

The pipeline is designed for global extensibility:

1. Add country GeoJSON to `data/geo/{country}_adm1.geojson`
2. Add outbreak data to the fetcher script
3. Create a new `build_map_{country}.py` or generalize the builder

## License

MIT — feel free to use and adapt.
