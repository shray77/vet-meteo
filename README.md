# ВЕТМЕТЕО (vet-meteo) / ВетРадар-61

**Продвинутый метеопрогноз для ветеринарных служб: 16 станций Ростовской области, «сейчас + 7 дней», тепловые/холодовые стрессы, трансмиссивные и инвазионные модели, эпиднадзор, АЧС-география, OSINT.**

[![stations](https://github.com/shray77/vet-meteo/actions/workflows/stations.yml/badge.svg)](https://github.com/shray77/vet-meteo/actions/workflows/stations.yml)
[![daily-outlook](https://github.com/shray77/vet-meteo/actions/workflows/daily-outlook.yml/badge.svg)](https://github.com/shray77/vet-meteo/actions/workflows/daily-outlook.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Стек: **Next.js 16 · TypeScript · Tailwind · Leaflet**. Живые данные без единого API-ключа:
Open-Meteo (+ их ансамбль ECMWF), METAR NOAA, GitHub Actions как «крона» опроса станций.

---

## Что это

ГИС-прототип ветеринарии Ростовской области. Слева — карта (THI-круги станций, реки,
КГЛ-районы, коридор АЧС, аэрозоль-плюм), снизу — **прогноз-скраббер 0…167 ч** (карта
перекрашивается по выбранному часу), справа — панель из 7 вкладок:
Сводка · Прогноз · Станции · Ансамбль · АЧС · Надзор · OSINT.

## Пайплайн данных

```
                        ┌─────────────────────────────────────────────┐
                        │  GITHUB ACTIONS (этот репозиторий)          │
                        │  stations.yml — каждый час:                 │
                        │   METAR (NOAA) + Open-Meteo × 16 станций    │
                        │   → data/latest.json                        │
                        │   → data/snapshots/YYYY-MM-DD.json          │
                        │  daily-outlook.yml — 06:00 МСК:             │
                        │   7-дневный дайджест → data/outlook.json    │
                        └──────────────────┬──────────────────────────┘
                                           │ raw.githubusercontent (CDN, без ключа)
веб-приложение (Next.js) ◄─────────────────┘
   ├─ живой прогноз: Open-Meteo напрямую из браузера юзера (свой IP → без лимитов)
   ├─ ансамбль ECMWF: ensemble-api.open-meteo.com (p10/p50/p90, P(THI>80))
   ├─ METAR: через /api/metar (серверный прокси, кэш 10 мин)
   └─ архив Actions: data/latest.json + снапшоты (история THI, спарклайны)
```

Три режима честно помечены бейджами: `live Open-Meteo` / `Open-Meteo через прокси` /
`синтетика (sandbox)` — фолбэк-цепочка не врёт о происхождении данных.

## Математические модели

### Биоклимат (src/lib/models/)

| Модель | Формула / идея | Пороги |
|---|---|---|
| **THI КРС** (NRC—Yousef) | `THI = (1.8·T+32) − (0.55−0.0055·RH)(1.8·T−26)` | 68 / 72 / 80 / 90 |
| Потери удоя | Ravagnolo: `−0.25 кг/ед THI > 72` | |
| **THI птицы** | `0.6·Tdb + 0.4·Twb` (Twb — Stull 2011) | 70 / 75 / 80 |
| **THI свиноматок** | NRC-THI, сдвинутые пороги | 72 / 78 / 84 |
| **WCI** холод КРС | `(10.45 + 10√v − v)(33 − T)`, v м/с | 600 / 1000 / 1400 |
| **HLI** (по мотивам Gaughan&Mader) | `THI + 0.35·(TG−Tdb) − 1.4·WS`, `TG = Tdb + 0.016·SWR` | 70 / 80 / 90 |
| **AHL** накопление | `AHL_t = 0.98·AHL_{t−1} + max(0, HLI−77)` | 30 / 80 / 150 |
| VPD | Tetens: `es(T)(1 − RH/100)` | гигрометрия клещей/миджсов |

### Трансмиссивные/инвазионные (parasites.ts, advanced.ts)

| Модель | Механика |
|---|---|
| **Клещи GDD₁₀** | накопленные градусо-дни: Hyalomma (КГЛ-вектор) / Dermacentor |
| **КГЛ-риск** | GDD + эндемичность района + сухость (Hyalomma ксерофил) |
| **Фасциолёз** | влагостат `Σ(P − 0.8·ET₀)` (Hargreaves ET₀), зоны low/med/high |
| **Дирофиляриоз HDU** | `Σ(Tmean − 14)` при T>14; L3 инфективны ≈ 130 HDU (Knight & Lok) |
| **ВЗН/Culex** | GDD₁₀ + оптимум 25±6°С + увлажнение → score 0–100 |
| **Culicoides** | midge-days `Σ(Tmean − 13)⁺`; окно передачи при Tmean ≥ 15 (EFSA-подход) |

### АЧС (asf.ts, plume.ts)

- **Suitability-сетка 0.1°** (рельеф+вода+леса) → **Дейкстра** → коридор волны кабана
  (12 км/ночь × 20 ночей), зоны 5/20/100 км по регламенту.
- **Аэрозоль-плюм** (Gloster-подход): почасовой вынос пухов из очага по прогнозному
  ветру, экспоненциальный распад (период полураспада — пресет болезни), накопление
  дозы в сетке 0.05°.

### Эпиднадзор (surveillance.ts)

| Алгоритм | Реализация |
|---|---|
| **EARS C1/C2/C3** | `(x−μ₇)/√μ₇`; μ₃ с лагом 2; сумма отклонений 3 дн; watch ≥ 2, alarm ≥ 3 |
| **Фаррингтон-скоринг** | log-линейный базлайн 42 дн + верхняя 95% граница |
| **Rt (Cori 2013)** | гамма-апостериор `Γ(1+ΣI, 1/5+ΣΛ)`, SI 14±7 дн, CI 2.5–97.5% (Вилсон–Хилферти) |
| **Кульдорфф скан** | круговой Пуассон, окна центры×радиусы, LLR + Монте-Карло 199 реплик |

Демо-ряды (60 дней, волна с 44-го дня) детерминированы сидом — механика алгоритмов
проверяема, подмена на реальные суточные counts ВетИС не меняет ни строчки.

### Топо-модуль (topo.ts, geo/rostov.ts)

Псевдо-DEM гауссами (Калачская возв., Донская гряда, Ергени, Манычская впадина) →
уклон/экспозиция → **застой холодного воздуха** (ночные минимумы в котловинах) и
**ветровая экспозиция** → поправки T/RH/ветра к почасовому прогнозу. Прод-замена: SRTM 30 м.

### Ансамбль (ensemble.ts)

Open-Meteo **ensemble API** (ECMWF IFS 0.25°, 51 член, без ключа): THImax p10/p50/p90
и `P(THImax > 72/80)` по дням. Если ансамбль недоступен — локальная пертурбация
детерминированного прогноза (σ растёт с горизонтом), честно помечается `пертурбация`.

## Кучка метеостанций + GitHub Actions

`data/stations.json` — реестр (16 станций + 6 METAR-аэропортов). `stations.yml` ходит
каждый час: METAR + мульти-точечный Open-Meteo запрос → THI/BRD-лайт → коммит
`data/latest.json` + почасовой снапшот дня. История хранится 30 дней, потом режется.
Сайт читает архив напрямую с `raw.githubusercontent.com` (CDN, CORS `*`) — бейдж
«АРХИВ Actions ✓» и спарклайны THI на вкладке «Станции».

## Запуск

```bash
bun install
bun run dev        # http://localhost:3000
bun run lint       # eslint
node tools/fetch_stations.mjs   # локальный прогон опроса станций (пишет data/)
```

Архив можно перенаправить на свой форк: `NEXT_PUBLIC_ARCHIVE_BASE=https://raw.githubusercontent.com/<user>/<repo>/main`.

## OSINT (опционально)

`tools/osint_cli.py` — открытые MQTT-брокеры по bbox области (Shodan/Censys, ключ
в аргументах) → GeoJSON в `public/osint/` → слой на карте. Демо-выгрузка в репо.
Ключи в UI не сохраняются. **Легитимность:** только открытое сканирование индексов,
собственных беннеров брокеров; не подключаемся к чужим устройствам.

## Подложки карты

OpenTopoMap (CC-BY-SA) и **Esri World Dark Gray Canvas** — оба без ключей и регистраций.
CARTO сознательно выпилен: их политика басемапов требует регистрации/API-ключа.

## Структура

```
src/lib/geo/rostov.ts      точки/реки/КГЛ-районы/DEM/демо-АЧС
src/lib/topo/topo.ts        уклон, coldPool, ветровая экспозиция
src/lib/models/             thi · brd · parasites · asf · advanced · surveillance · ensemble · plume
src/lib/field-data.ts       Open-Meteo → прокси → синтетика
src/lib/archive.ts          чтение data/ с raw.githubusercontent
src/lib/assessment.ts       пайплайн: погода → топо → модели → триггеры
src/components/vetradar/    GisMap · TimeScrubber · RightPanel(7 вкладок) · StationTable ·
                            EnsembleChart · SurveillancePanel · StressBlocks · Gauges · …
tools/fetch_stations.mjs    hourly-опрос для Actions
tools/outlook.mjs           суточный дайджест
.github/workflows/           stations.yml · daily-outlook.yml
data/                        latest.json · snapshots/ · stations.json (генерится Actions)
```

## Дисклеймер

Прототип для демонстрации пайплайна. Реки/леса/DEM — схематичные; очаги АЧС, ряды
заболеваемости и OSINT-точки — ДЕМО-данные. Решения о ветмероприятиях принимаются
по официальным регламентам и реальным данным ВетИС/Россельхознадзора, а не по этой карте.
