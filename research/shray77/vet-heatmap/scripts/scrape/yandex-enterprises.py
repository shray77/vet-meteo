#!/usr/bin/env python3
"""
OSINT: Agricultural enterprises in Russia via Yandex.Maps.

Yandex.Maps has far better coverage of Russian businesses than OSM —
many small/medium farms, meat plants, and feed mills are listed in
Yandex Business but not tagged in OSM at all.

This script:
  1. Opens yandex.ru/maps with a search query
  2. Waits for the business list to load
  3. Scrolls through result pages
  4. Extracts: name, address, lat/lon, rubric, phone (when available)
  5. Saves partial results after each city × category

Search strategy:
  - For each of top-30 Russian cities, run 5 category searches:
    "свиноводческий комплекс", "птицефабрика", "мясокомбинат",
    "скотокомплекс", "комбикормовый завод"
  - Each search returns up to ~50 results (Yandex limit)
  - Total: 30 × 5 × ~30 = ~4500 raw hits, dedup → ~1500 unique

Output: public/data/enterprises-yandex.json
This is SEPARATE from enterprises.json (OSM) — they're merged in
the frontend at runtime.

USAGE:
  python3 scripts/scrape/yandex-enterprises.py
  python3 scripts/scrape/yandex-enterprises.py --cities 5 --categories 2  # quick test
"""

import argparse
import json
import re
import time
from pathlib import Path
from urllib.parse import quote_plus

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUT_PATH = REPO_ROOT / "public/data/enterprises-yandex.json"

# Top-30 Russian cities by population + agricultural significance.
# Larger cities have more surrounding agricultural enterprises.
CITIES = [
    ("Москва", 55.7558, 37.6173),
    ("Санкт-Петербург", 59.9386, 30.3141),
    ("Новосибирск", 55.0084, 82.9357),
    ("Екатеринбург", 56.8389, 60.6057),
    ("Казань", 55.8304, 49.0661),
    ("Нижний Новгород", 56.2965, 43.9361),
    ("Челябинск", 55.1644, 61.4368),
    ("Красноярск", 56.0153, 92.8932),
    ("Самара", 53.2415, 50.2212),
    ("Уфа", 54.7388, 55.9721),
    ("Ростов-на-Дону", 47.2357, 39.7015),
    ("Краснодар", 45.0355, 38.9753),
    ("Омск", 54.9885, 73.3242),
    ("Воронеж", 51.6608, 39.2003),
    ("Пермь", 58.0105, 56.2502),
    ("Волгоград", 48.7080, 44.5133),
    ("Белгород", 50.5956, 36.5873),  # pig farming hub
    ("Воронежская область", 51.6608, 39.2003),  # rural area
    ("Тамбов", 52.7212, 41.4523),  # pig farming
    ("Курск", 51.7373, 36.1926),
    ("Липецк", 52.6088, 39.5994),
    ("Орёл", 52.9685, 36.0637),
    ("Тула", 54.1938, 37.6190),
    ("Рязань", 54.6269, 39.6916),
    ("Пенза", 53.1959, 45.0157),
    ("Саратов", 51.5336, 46.0343),
    ("Иркутск", 52.2978, 104.2964),
    ("Барнаул", 53.3468, 83.7768),
    ("Тюмень", 57.1522, 65.5272),
    ("Ставрополь", 45.0445, 41.9691),
]

# Search queries — Yandex understands natural language better than OSM
CATEGORIES = [
    ("свиноводческий комплекс", "pig_farm"),
    ("птицефабрика", "poultry_farm"),
    ("мясокомбинат", "meat_plant"),
    ("скотокомплекс КРС", "cattle_farm"),
    ("комбикормовый завод", "feed_mill"),
]


def is_in_russia(lat, lon):
    """Strict Russia filter — Yandex sometimes returns nearby foreign results."""
    if 42 <= lat <= 82 and 28 <= lon <= 180:
        return True
    if 54 <= lat <= 56 and 19 <= lon <= 23:  # Kaliningrad
        return True
    return False


def parse_yandex_results(page, city_name, category_query, ent_type):
    """Extract business cards from a Yandex.Maps search results page.

    Page structure (as of 2026-07):
      li.search-snippet-view  ← top-level card container
        ├── div.search-business-snippet-view
        │   ├── div.search-business-snippet-view__content
        │   │   ├── a[href*="/org/.../"]  ← TITLE (NOT ending in /reviews/)
        │   │   ├── div.search-business-snippet-view__rating-and-awards
        │   │   │   └── a[href*="/reviews/"]  ← skip these
        │   │   └── div with address
        │   └── ...
    """
    results = []

    # Junk names that aren't real businesses (UI labels leaked through)
    JUNK_NAMES = {
        "фото", "обзор", "отзывы", "адрес", "особенности", "похожие места",
        "сайт", "телефон", "маршрут", "подробнее", "сохранить", "поделиться",
        "ещё", "еще", "открыто", "закрыто", "рейтинг",
        "как добраться", "подробнее об организации",
        "вы владелец этой организации?", "больше не работает",
        "часы работы", "средняя цена",
    }
    JUNK_SUBSTRINGS = [
        "отзыв", "как добраться", "вы владелец", "больше не работает",
        "подробнее об", "часы работы", "средняя цена",
        "особенности организации", "похожие организации",
        "оценок", "рейтинг", "график работы",
    ]

    # Find all top-level business cards
    cards = page.query_selector_all("li.search-snippet-view")
    if not cards:
        # Fallback to older selector
        cards = page.query_selector_all("[data-testid='search-business-snippet-view']")

    seen_coords = set()
    seen_org_ids = set()

    for card in cards:
        try:
            # Find the title link: a[href*="/org/"] that does NOT end in /reviews/
            title_links = card.query_selector_all("a[href*='/org/']")
            name_el = None
            href = ""
            org_id = ""
            for link in title_links:
                h = link.get_attribute("href") or ""
                if "/reviews/" in h:
                    continue  # skip rating/review links
                if not h.startswith("/maps/org/"):
                    continue
                name_el = link
                href = h
                break

            if not name_el:
                continue

            name = name_el.inner_text().strip()
            if not name or len(name) < 3:
                continue

            # Extract org id from href like /maps/org/svinovodcheskiy_kompleks/187535263300/
            m = re.search(r"/org/[^/]+/(\d+)", href)
            if m:
                org_id = m.group(1)
                if org_id in seen_org_ids:
                    continue
                seen_org_ids.add(org_id)

            # Clean name
            name = name.split("\n")[0].strip()[:200]
            name_lower = name.lower()

            # Skip junk
            if name_lower in JUNK_NAMES:
                continue
            if any(junk in name_lower for junk in JUNK_SUBSTRINGS):
                continue
            if not re.search(r"[А-ЯЁа-яёA-Za-z]", name):
                continue
            # Skip if name starts with rating-like text
            if re.match(r"^\d+[,.]?\d*\s*(оценок|отзыв)", name_lower):
                continue

            # Extract address — Yandex puts it in a div with class containing 'address' or in the business content
            address = ""
            # Try multiple address selectors
            for addr_sel in [
                "[class*='address']",
                ".search-business-snippet-view__address",
                "[class*='business-snippet'] [class*='ink']",
            ]:
                try:
                    addr_el = card.query_selector(addr_sel)
                    if addr_el:
                        addr_text = addr_el.inner_text().strip()
                        first_line = addr_text.split("\n")[0].strip()
                        if (first_line and len(first_line) > 5
                            and first_line.lower() not in JUNK_NAMES
                            and (re.search(r"\d", first_line)
                                 or any(w in first_line.lower() for w in
                                        ["улица", "ул.", "проспект", "пр.", "шоссе", "ш.",
                                         "область", "край", "республика", "город", "г.",
                                         "поселок", "село", "деревня", "станция"]))):
                            address = first_line[:300]
                            break
                except Exception:
                    continue

            # Extract rubric
            rubric = category_query
            try:
                rubric_el = card.query_selector("[class*='rubric'], [class*='category']")
                if rubric_el:
                    r = rubric_el.inner_text().strip().split("\n")[0].strip()[:100]
                    if r and r.lower() not in JUNK_NAMES and not any(j in r.lower() for j in JUNK_SUBSTRINGS):
                        rubric = r
            except Exception:
                pass

            # Coordinates — Yandex.Maps doesn't expose them in the search list.
            # We'll geocode the address later in the main loop.
            lat, lon = None, None

            # Dedup by coords if available
            if lat is not None and lon is not None:
                key = (round(lat, 4), round(lon, 4))
                if key in seen_coords:
                    continue
                seen_coords.add(key)

            # Build display name: if name is generic (like "Свиноводческий комплекс"),
            # append the city to disambiguate multiple enterprises with same name.
            GENERIC_NAMES = {
                "свиноводческий комплекс", "птицефабрика", "мясокомбинат",
                "скотокомплекс", "комбикормовый завод", "ферма",
            }
            display_name = name
            if name_lower in GENERIC_NAMES and address:
                # Use first 4 words of address as disambiguator
                addr_short = " ".join(address.split(",")[:2])[:50]
                display_name = f"{name} ({addr_short})"

            results.append({
                "id": f"yandex-{org_id}" if org_id else f"yandex-{abs(hash(name + city_name)):x}",
                "name": display_name,
                "type": ent_type,
                "lat": lat,
                "lon": lon,
                "address": address,
                "city": city_name,
                "rubric": rubric,
                "source": "yandex",
            })
        except Exception:
            continue

    return results


def geocode_address(page, address, city_name):
    """Fallback: geocode an address via Yandex.Maps geocoder.
    Used when business cards don't expose coords directly.
    Returns (lat, lon) or (None, None)."""
    try:
        full_query = f"{address}, {city_name}"
        url = f"https://geocode-maps.yandex.ru/1.x/?geocode={quote_plus(full_query)}&format=json&results=1"
        # Use page.evaluate to make the request from browser context
        # (avoids CORS / auth issues)
        result = page.evaluate(
            """async (url) => {
                const r = await fetch(url);
                return await r.text();
            }""",
            url,
        )
        data = json.loads(result)
        members = data.get("response", {}).get("GeoObjectCollection", {}).get("featureMember", [])
        if members:
            point = members[0]["GeoObject"]["Point"]["pos"].split()
            if len(point) == 2:
                lon, lat = float(point[0]), float(point[1])
                return lat, lon
    except Exception:
        pass
    return None, None


def save_partial(results, city_name, category):
    """Save partial results so progress isn't lost if script crashes."""
    existing = []
    if OUTPUT_PATH.exists():
        try:
            existing = json.loads(OUTPUT_PATH.read_text()).get("enterprises", [])
        except Exception:
            existing = []

    # Merge: dedup by id
    seen = {e["id"] for e in existing}
    for r in results:
        if r["id"] not in seen:
            existing.append(r)
            seen.add(r["id"])

    output = {
        "updated": time.strftime("%Y-%m-%d"),
        "sources": ["yandex"],
        "total": len(existing),
        "enterprises": existing,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"    [partial] {len(existing)} total enterprises saved")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cities", type=int, default=0, help="Limit to N cities (0 = all)")
    parser.add_argument("--categories", type=int, default=0, help="Limit to N categories (0 = all)")
    parser.add_argument("--headless", action="store_true", default=True, help="Run headless")
    parser.add_argument("--no-headless", dest="headless", action="store_false")
    parser.add_argument("--scroll-pages", type=int, default=3, help="Max scroll pages per search")
    args = parser.parse_args()

    cities = CITIES[:args.cities] if args.cities > 0 else CITIES
    categories = CATEGORIES[:args.categories] if args.categories > 0 else CATEGORIES

    print(f"=== Yandex.Maps Enterprise Scraper ===")
    print(f"  Cities: {len(cities)}, Categories: {len(categories)}")
    print(f"  Total searches: {len(cities) * len(categories)}")
    print(f"  Estimated time: {len(cities) * len(categories) * 12}s = {len(cities) * len(categories) * 12 / 60:.1f} min\n")

    from playwright.sync_api import sync_playwright

    all_results = []

    with sync_playwright() as p:
        # Use Chromium with stealth settings to bypass Yandex bot detection.
        # Yandex detects default Playwright/Puppeteer fingerprints and serves
        # empty results or captchas. These args + UA help but aren't perfect.
        browser = p.chromium.launch(
            headless=args.headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-infobars",
                "--window-size=1280,900",
                "--disable-dev-shm-usage",
                # Realistic Chrome flags
                "--enable-features=NetworkService,NetworkServiceInProcess",
                "--disable-extensions",
                "--disable-default-apps",
                "--disable-component-extensions-with-background-pages",
            ],
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.126 Safari/537.36",
            locale="ru-RU",
            timezone_id="Europe/Moscow",
            extra_http_headers={
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "DNT": "1",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "Cache-Control": "max-age=0",
            },
        )

        # Inject stealth script to mask webdriver property — Yandex checks
        # navigator.webdriver === true and blocks if so.
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['ru-RU', 'ru', 'en'] });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5].map(i => ({
                    name: 'Plugin ' + i,
                    filename: 'plugin' + i + '.so',
                    description: 'Plugin ' + i,
                })),
            });
            // Override Chrome runtime to look real
            window.chrome = { runtime: {} };
            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) =>
                parameters.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission })
                    : originalQuery(parameters);
        """)
        # Block images/fonts/stylesheets for speed (we only need text data)
        context.route("**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,css}",
                      lambda route: route.abort())

        page = context.new_page()
        # Set reasonable timeouts
        page.set_default_timeout(30000)
        page.set_default_navigation_timeout(45000)

        for city_name, city_lat, city_lon in cities:
            for query, ent_type in categories:
                search_text = f"{query} {city_name}"
                print(f"\n  [{city_name}] {query} ({ent_type})")

                try:
                    # Build Yandex.Maps search URL with city center + zoom
                    # ll=lon,lat ; z=zoom (8 = city area)
                    url = (
                        f"https://yandex.ru/maps/?text={quote_plus(search_text)}"
                        f"&ll={city_lon}%2C{city_lat}&z=8"
                    )
                    page.goto(url, wait_until="domcontentloaded")

                    # Wait for either the business list OR a "no results" message
                    try:
                        page.wait_for_selector(
                            "[data-testid='search-business-snippet-view'], "
                            ".search-business-snippet-view, "
                            "a[href*='/org/'], "
                            "[class*='search-empty']",
                            timeout=15000,
                        )
                    except Exception:
                        print(f"    ✗ no results (timeout)")
                        continue

                    # Scroll the results panel to load more
                    results_panel = None
                    for sel in ["[class*='search-list']", "[class*='scroll']", ".sidebar"]:
                        try:
                            el = page.query_selector(sel)
                            if el:
                                results_panel = el
                                break
                        except Exception:
                            continue

                    if results_panel:
                        for _ in range(args.scroll_pages):
                            try:
                                results_panel.evaluate("el => el.scrollBy(0, 800)")
                                page.wait_for_timeout(1500)
                            except Exception:
                                break

                    # Parse results
                    hits = parse_yandex_results(page, city_name, query, ent_type)
                    print(f"    → {len(hits)} raw results")

                    # Geocode any entries without coords (rate-limited)
                    needs_geo = [h for h in hits if h["lat"] is None and h.get("address")]
                    if needs_geo:
                        print(f"    geocoding {len(needs_geo)} entries without coords…")
                        for h in needs_geo[:10]:  # limit to 10 per search to avoid rate limit
                            lat, lon = geocode_address(page, h["address"], city_name)
                            if lat is not None:
                                h["lat"] = lat
                                h["lon"] = lon
                                page.wait_for_timeout(800)  # be nice to Yandex

                    # Filter to Russia
                    ru_hits = [h for h in hits if h["lat"] is not None and is_in_russia(h["lat"], h["lon"])]
                    no_coords = [h for h in hits if h["lat"] is None]
                    print(f"    → {len(ru_hits)} with RU coords, {len(no_coords)} without coords")

                    all_results.extend(ru_hits)
                    all_results.extend(no_coords)  # keep them too — frontend can show in list

                    save_partial(all_results, city_name, query)

                    # Be nice to Yandex — 5-10s randomized delay between
                    # searches. Yandex blocks rapid-fire requests, so we
                    # need longer delays than the previous 3-5s.
                    delay = 5 + (hash(search_text) % 6)  # 5-10s, varied
                    page.wait_for_timeout(delay * 1000)

                except Exception as e:
                    print(f"    ✗ error: {e}")
                    continue

        browser.close()

    # Final stats
    print(f"\n=== FINAL ===")
    print(f"Total: {len(all_results)}")
    by_type = {}
    by_city = {}
    for e in all_results:
        by_type[e["type"]] = by_type.get(e["type"], 0) + 1
        by_city[e.get("city", "?")] = by_city.get(e.get("city", "?"), 0) + 1
    print("By type:")
    for t, n in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  {t}: {n}")
    print("\nBy city (top 10):")
    for c, n in sorted(by_city.items(), key=lambda x: -x[1])[:10]:
        print(f"  {c}: {n}")


if __name__ == "__main__":
    main()
