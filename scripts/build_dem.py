#!/usr/bin/env python3
"""
build_dem.py — сборка реального DEM для Ростовской области из AWS Terrain
Terrarium-тайлов (SRTM, без ключа, без лимитов).

Тайл: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png
Декод: elev = R*256 + G + B/256 - 32768 (метры).

Выход: src/lib/geo/dem.json — компактная сетка 0.05° (~5.5 км) с боксом,
плюс печать реальных высот для 16 точек мониторинга (для rostov.ts).
"""
import json
import math
import os
import urllib.request
from io import BytesIO

from PIL import Image

Z = 8  # 0.0055°/px — избыточно для сетки 0.05°, усредняем окно 3×3
BBOX = (46.2, 37.2, 49.8, 44.2)  # minLat, minLon, maxLat, maxLon (область + запас)
STEP = 0.05
OUT = "/home/z/my-project/src/lib/geo/dem.json"
UA = {"User-Agent": "vet-meteo-dem-builder/1.0 (github.com/shray77/vet-meteo)"}


def deg2tile(lat, lon, z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    lat_r = math.radians(lat)
    y = (1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n
    return x, y


def tile2deg(x, y, z):
    n = 2 ** z
    lon = x / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lat, lon


def fetch_tile(z, x, y):
    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    img = Image.open(BytesIO(data)).convert("RGB")
    w, h = img.size
    px = img.load()
    grid = [[px[i, j][0] * 256 + px[i, j][1] + px[i, j][2] / 256.0 - 32768
             for i in range(w)] for j in range(h)]
    # гео-привязка тайла: верхний левый угол
    lat0, lon0 = tile2deg(x, y, z)
    lat1, lon1 = tile2deg(x + 1, y + 1, z)
    return grid, lat0, lon0, lat1, lon1


def merc_y(lat):
    """Нормализованная Web-Mercator y-координата (0=полюс, 1=юг)."""
    return (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0


def sample(tiles, lat, lon):
    """Точечная выборка из тайла (ближайший пиксель).

    ВАЖНО: y в тайле линейно по MERCATOR, а не по широте — считаем через merc_y.
    Усреднение 3×3 НЕ используем: на 5.5-км сетке оно размазывает реальные
    стены долин (±50 м) — шум SRTM (±3 м) безвреден, шипы гасит despike().
    """
    best = None
    for grid, lat0, lon0, lat1, lon1 in tiles:
        if lat1 <= lat <= lat0 and lon0 <= lon <= lon1:
            h = len(grid)
            w = len(grid[0])
            fy = (merc_y(lat0) - merc_y(lat)) / (merc_y(lat0) - merc_y(lat1)) * (h - 1)
            fx = (lon - lon0) / (lon1 - lon0) * (w - 1)
            return grid[round(fy)][round(fx)]
    return best


def despike(rows, thresh=120, passes=1):
    """Точечная замена выбросов: узел заменяется медианой 3×3 соседей, только
    если отклоняется сильнее порога. Порог 120 м: радарные шипы над лиманами
    (279 м над водой) умирают, а реальные стены долин (до ~100 м/узел) живут."""
    h, w = len(rows), len(rows[0])
    cur = [row[:] for row in rows]
    for _ in range(passes):
        nxt = [row[:] for row in cur]
        for i in range(h):
            for j in range(w):
                vals = []
                for di in (-1, 0, 1):
                    for dj in (-1, 0, 1):
                        ii, jj = min(h - 1, max(0, i + di)), min(w - 1, max(0, j + dj))
                        if not (di == 0 and dj == 0):
                            vals.append(cur[ii][jj])
                vals.sort()
                med = vals[len(vals) // 2]
                if abs(cur[i][j] - med) > thresh:
                    nxt[i][j] = med
        cur = nxt
    return cur


def validate(rows):
    """Сверка с независимым SRTM90 (opentopodata.org). Возврат: список расхождений."""
    checks = [
        (47.21, 38.93, "Таганрог"), (47.20, 38.90, "Миус лиман"),
        (47.23, 39.72, "Ростов"), (47.14, 39.75, "Батайск"),
        (48.92, 40.40, "Миллерово"), (47.52, 40.83, "Семикаракорск"),
        (47.71, 40.21, "Шахты"), (46.48, 41.54, "Сальск"),
        (48.17, 40.80, "Белая Калитва"), (47.85, 40.90, "Усть-Донецкий"),
        (49.62, 41.72, "Вёшенская"), (48.35, 41.83, "Морозовск"),
        (47.42, 40.09, "Новочеркасск"), (47.11, 39.42, "Азов"),
        (47.51, 42.15, "Волгодонск"), (46.85, 40.30, "Зерноград"),
        (47.63, 41.09, "Константиновск"), (47.0, 42.0, "степь (контроль)"),
        (48.6, 42.3, "степь (контроль)"), (46.4, 43.5, "Маныч (контроль)"),
    ]
    locs = "|".join(f"{la},{lo}" for la, lo, _ in checks)
    url = f"https://api.opentopodata.org/v1/srtm90m?locations={locs}"
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.loads(r.read())
    diffs = []
    for res, (la, lo, name) in zip(data["results"], checks):
        ours = grid_val(rows, la, lo)
        ref = res["elevation"]
        diffs.append((name, ours, ref, ours - ref))
    return diffs


def grid_val(rows, lat, lon):
    """Билинейно из сетки (как demElevation в TS)."""
    min_lat, min_lon, max_lat, _ = BBOX
    c = min(len(rows[0]) - 1, max(0, (lon - min_lon) / STEP))
    r = min(len(rows) - 1, max(0, (max_lat - lat) / STEP))
    i = min(len(rows) - 2, int(r))
    j = min(len(rows[0]) - 2, int(c))
    fy, fx = r - i, c - j
    v = (rows[i][j] * (1 - fy) * (1 - fx) + rows[i + 1][j] * fy * (1 - fx)
         + rows[i][j + 1] * (1 - fy) * fx + rows[i + 1][j + 1] * fy * fx)
    return round(v)


def main():
    x0, y0 = deg2tile(BBOX[0], BBOX[1], Z)  # юго-запад (в дробных)
    x1, y1 = deg2tile(BBOX[2], BBOX[3], Z)  # северо-восток
    xs = range(int(x0), int(x1) + 1)
    ys = range(int(y1), int(y0) + 1)  # y растёт на юг
    print(f"tiles z{Z}: x {list(xs)} y {list(ys)}")

    tiles = []
    for x in xs:
        for y in ys:
            t = fetch_tile(Z, x, y)
            tiles.append(t)
            print(f"  ok {x}/{y}: {len(t[0])}x{len(t[0][0])} "
                  f"[{t[1]:.2f},{t[2]:.2f} → {t[3]:.2f},{t[4]:.2f}]")

    # сетка
    nlat = int(round((BBOX[2] - BBOX[0]) / STEP)) + 1
    nlon = int(round((BBOX[3] - BBOX[1]) / STEP)) + 1
    rows = []
    miss = 0
    for i in range(nlat):
        lat = BBOX[2] - i * STEP  # с севера на юг
        row = []
        for j in range(nlon):
            lon = BBOX[1] + j * STEP
            v = sample(tiles, lat, lon)
            if v is None:
                v, miss = 0, miss + 1
            row.append(int(round(v)))
        rows.append(row)

    # выбросы: узел != медиана 3×3 более чем на 120 м → заменяем медианой
    rows = despike(rows)
    # жёсткий диапазон (Кумо-Манычская впадина реально ниже уровня моря)
    rows = [[min(500, max(-30, v)) for v in row] for row in rows]

    dem = {
        "src": "AWS Terrain Tiles (SRTM, terrarium z8, точечная выборка) + despike 120 м, валидация opentopodata SRTM90",
        "bbox": list(BBOX),
        "step": STEP,
        "rows": nlat,
        "cols": nlon,
        "z": rows,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(dem, f, separators=(",", ":"))
    size = os.path.getsize(OUT)
    print(f"OK: {nlat}x{nlon}={nlat * nlon} точек, пропусков {miss}, {size} байт → {OUT}")

    # статистика
    flat = [v for r in rows for v in r]
    print(f"высоты: min {min(flat)} max {max(flat)} mean {sum(flat) / len(flat):.0f}")

    # высоты точек мониторинга для rostov.ts — ИЗ ФИНАЛЬНОЙ СЕТКИ
    fps = {
        "Ростов-на-Дону": (47.23, 39.72), "Таганрог": (47.21, 38.93),
        "Шахты": (47.71, 40.21), "Волгодонск": (47.51, 42.15),
        "Новочеркасск": (47.42, 40.09), "Батайск": (47.14, 39.75),
        "Азов": (47.11, 39.42), "Сальск": (46.48, 41.54),
        "Миллерово": (48.92, 40.40), "Морозовск": (48.35, 41.83),
        "Белая Калитва": (48.17, 40.80), "Зерноград": (46.85, 40.30),
        "Семикаракорск": (47.52, 40.83), "Константиновск": (47.63, 41.09),
        "Вёшенская": (49.62, 41.72), "Усть-Донецкий": (47.85, 40.90),
    }
    print("\n— точки мониторинга (из финальной сетки):")
    for name, (la, lo) in fps.items():
        print(f'  {name}: {grid_val(rows, la, lo)} м')

    # валидация против opentopodata (SRTM90, независимый источник)
    try:
        diffs = validate(rows)
        print("\n— валидация vs opentopodata SRTM90:")
        bad = 0
        for name, ours, ref, d in diffs:
            flag = "OK" if abs(d) <= 15 else "!!"
            if abs(d) > 15:
                bad += 1
            print(f"  {flag} {name}: наш={ours} SRTM90={ref} Δ={d:+.0f}")
        if bad:
            print(f"ВНИМАНИЕ: {bad} точек с |Δ|>15 м")
    except Exception as e:
        print("валидация пропущена:", e)


if __name__ == "__main__":
    main()
