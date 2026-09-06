#!/usr/bin/env python3
"""
OSINT CLI для ВЕТРАДАР-61: открытые MQTT-брокеры по bbox Ростовской области.

Провайдеры: Shodan (ключ) или Censys (API ID + secret).
Результат: GeoJSON в public/osint/ — импортируется кнопкой
«демо-выгрузка» / вкладкой OSINT в дашборде.

Примеры:
  # Shodan с ключом
  python tools/osint_cli.py --provider shodan --key YOUR_KEY --out mqtt_live.json

  # Censys
  python tools/osint_cli.py --provider censys --key API_ID --secret API_SECRET

  # Демо-файл (без ключа, вымышленные точки)
  python tools/osint_cli.py --demo
"""
import argparse
import json
import sys
import urllib.request
import urllib.parse
import urllib.error
import os
import re

BBOX = {"minLat": 46.2, "maxLat": 49.9, "minLon": 37.1, "maxLon": 44.2}
WEATHER_RE = re.compile(
    r"weather|meteo|temp|humid|esp|esp8266|dht|bme|bmp|sensor|"
    r"weather-station|ws-|atmos", re.I)


def in_bbox(lat, lon):
    return (BBOX["minLat"] <= lat <= BBOX["maxLat"]
            and BBOX["minLon"] <= lon <= BBOX["maxLon"])


def fetch_json(url, timeout=25, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def shodan_scan(key):
    q = urllib.parse.quote('mqtt country:"RU"')
    url = ("https://api.shodan.io/shodan/host/search"
           f"?key={urllib.parse.quote(key)}&query={q}")
    j = fetch_json(url)
    out = []
    for m in j.get("matches", []):
        lat = m.get("latitude")
        lon = m.get("longitude")
        if lat is None or lon is None or not in_bbox(lat, lon):
            continue
        banner = (m.get("data") or "")[:300]
        out.append({
            "ip": m.get("ip_str", "?"),
            "port": m.get("port", 0),
            "lat": lat, "lon": lon,
            "org": m.get("org", "—"),
            "provider": "shodan",
            "label": m.get("product") or "MQTT broker",
            "banner": banner,
            "weatherLike": bool(WEATHER_RE.search(banner)),
        })
    return out


def censys_scan(api_id, secret):
    import base64
    auth = base64.b64encode(f"{api_id}:{secret}".encode()).decode()
    body = json.dumps({
        "q": 'services.mqtt.messages:"" and location.country: "Russia"',
        "per_page": 100,
    }).encode()
    j = fetch_json("https://search.censys.io/api/v2/hosts/search",
                   data=body, headers={
                       "Content-Type": "application/json",
                       "Authorization": f"Basic {auth}"})
    out = []
    for h in j.get("result", {}).get("hits", []):
        loc = h.get("location", {})
        lat = loc.get("latitude")
        lon = loc.get("longitude")
        if lat is None or lon is None or not in_bbox(lat, lon):
            continue
        svc = (h.get("services") or [{}])[0]
        banner = (svc.get("banner") or "")[:300]
        out.append({
            "ip": h.get("ip", "?"),
            "port": svc.get("port", 0),
            "lat": lat, "lon": lon,
            "org": loc.get("asn_description", "—"),
            "provider": "censys",
            "label": svc.get("service_name") or "MQTT",
            "banner": banner,
            "weatherLike": bool(WEATHER_RE.search(banner)),
        })
    return out


def to_geojson(points, note):
    return {
        "type": "FeatureCollection",
        "note": note,
        "features": [{
            "type": "Feature",
            "properties": {k: p[k] for k in
                           ("ip", "port", "org", "provider", "label",
                            "banner", "weatherLike")},
            "geometry": {"type": "Point",
                         "coordinates": [p["lon"], p["lat"]]},
        } for p in points],
    }


def main():
    ap = argparse.ArgumentParser(description="VETRADAR-61 OSINT MQTT CLI")
    ap.add_argument("--provider", choices=["shodan", "censys"], default="shodan")
    ap.add_argument("--key", help="Shodan API key или Censys API ID")
    ap.add_argument("--secret", help="Censys API secret")
    ap.add_argument("--demo", action="store_true",
                    help="использовать демо-выгрузку без ключей")
    ap.add_argument("--out", default="mqtt_live.json",
                    help="имя выходного GeoJSON (в public/osint/)")
    args = ap.parse_args()

    if args.demo:
        src = os.path.join(os.path.dirname(__file__), "..",
                           "public", "osint", "demo_mqtt_points.json")
        with open(src, encoding="utf-8") as f:
            fc = json.load(f)
        print(f"Демо-выгрузка: {len(fc['features'])} точек (вымышленные адреса)")
        out_path = src
    else:
        if args.provider == "shodan":
            if not args.key:
                sys.exit("Нужен --key (Shodan API key)")
            points = shodan_scan(args.key)
            note = f"Shodan live scan, {len(points)} точек в bbox"
        else:
            if not args.key or not args.secret:
                sys.exit("Нужны --key (API ID) и --secret (Censys)")
            points = censys_scan(args.key, args.secret)
            note = f"Censys live scan, {len(points)} точек в bbox"
        fc = to_geojson(points, note)
        out_dir = os.path.join(os.path.dirname(__file__), "..",
                               "public", "osint")
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, args.out)
        weather = sum(1 for p in points if p["weatherLike"])
        print(f"Найдено {len(points)} MQTT-точек, "
              f"погодоподобных: {weather}")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False, indent=2)
    print(f"Записано: {os.path.abspath(out_path)}")
    print("Импорт в дашборд: вкладка OSINT → «демо-выгрузка» "
          "(или переименуйте в demo_mqtt_points.json).")


if __name__ == "__main__":
    main()
