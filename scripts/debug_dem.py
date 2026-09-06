#!/usr/bin/env python3
"""debug_dem.py — сверка: узлы dem.json vs прямая выборка из terrarium-тайлов."""
import json
import math
import urllib.request
from io import BytesIO

from PIL import Image

UA = {"User-Agent": "vet-meteo-dem-debug/1.0"}


def tile2deg(x, y, z):
    n = 2 ** z
    lon = x / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lat, lon


def merc_y(lat):
    return (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0


def get_grid(z, x, y):
    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        img = Image.open(BytesIO(r.read())).convert("RGB")
    px = img.load()
    w, h = img.size
    return [[px[i, j][0] * 256 + px[i, j][1] + px[i, j][2] / 256.0 - 32768
             for i in range(w)] for j in range(h)], *tile2deg(x, y, z), *tile2deg(x + 1, y + 1, z)


dem = json.load(open("/home/z/my-project/src/lib/geo/dem.json"))
min_lat, min_lon, max_lat, max_lon = dem["bbox"]
step, rows, cols, z = dem["step"], dem["rows"], dem["cols"], dem["z"]


def grid_at(lat, lon):
    """Читаем значение узла dem.json по ближайшему узлу (индексы сетки)."""
    r = (max_lat - lat) / step
    c = (lon - min_lon) / step
    return z[int(round(r))][int(round(c))], int(round(r)), int(round(c))


def tiles_for(lat, lon):
    """Тайлы z8, накрывающие точку (нужен и соседний ряд)."""
    n = 2 ** 8
    xt = int((lon + 180) / 360 * n)
    yt = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    ts = []
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            ts.append(get_grid(8, xt + dx, yt + dy))
    return ts


def sample(tiles, lat, lon, win=3):
    for grid, lat0, lon0, lat1, lon1 in tiles:
        if lat1 <= lat <= lat0 and lon0 <= lon <= lon1:
            h, w = len(grid), len(grid[0])
            fy = (merc_y(lat0) - merc_y(lat)) / (merc_y(lat0) - merc_y(lat1)) * (h - 1)
            fx = (lon - lon0) / (lon1 - lon0) * (w - 1)
            vals = []
            for ddy in range(-(win // 2), win // 2 + 1):
                for ddx in range(-(win // 2), win // 2 + 1):
                    yy = min(h - 1, max(0, int(fy) + ddy))
                    xx = min(w - 1, max(0, int(fx) + ddx))
                    vals.append(grid[yy][xx])
            return sum(vals) / len(vals)
    return None


pts = [(47.21, 38.93, "Таганрог"), (47.05, 40.0, "узел билин."),
       (47.14, 39.75, "Батайск"), (48.92, 40.40, "Миллерово")]
for lat, lon, name in pts:
    tiles = tiles_for(lat, lon)
    print(f"{name} ({lat},{lon}): тайлы {[(t[1], t[2], t[3], t[4]) for t in tiles][:4]}")
    direct = sample(tiles, lat, lon)
    g, ri, ci = grid_at(lat, lon)
    node_lat = max_lat - ri * step
    node_lon = min_lon + ci * step
    node_direct = sample(tiles, node_lat, node_lon)
    print(f"  прямая выборка: {direct if direct is None else round(direct, 1)} м")
    print(f"  узел сетки z[{ri}][{ci}] (lat {node_lat}, lon {node_lon}): grid={g}  тайл={node_direct if node_direct is None else round(node_direct, 1)}")
