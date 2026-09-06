# ВЕТМЕТЕО (vet-meteo) / ВетРадар-61

**Продвинутый метеопрогноз для ветеринарных служб: 16 станций Ростовской области, «сейчас + 7 дней», тепловые/холодовые стрессы, трансмиссивные и инвазионные модели, эпиднадзор, АЧС-география, OSINT.**

[![stations](https://github.com/shray77/vet-meteo/actions/workflows/stations.yml/badge.svg)](https://github.com/shray77/vet-meteo/actions/workflows/stations.yml)
[![daily-outlook](https://github.com/shray77/vet-meteo/actions/workflows/daily-outlook.yml/badge.svg)](https://github.com/shray77/vet-meteo/actions/workflows/daily-outlook.yml)
[![weekly-digest](https://github.com/shray77/vet-meteo/actions/workflows/weekly-digest.yml/badge.svg)](https://github.com/shray77/vet-meteo/actions/workflows/weekly-digest.yml)
[![pages](https://github.com/shray77/vet-meteo/actions/workflows/pages.yml/badge.svg)](https://github.com/shray77/vet-meteo/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Стек: **Next.js 16 · TypeScript · Tailwind · Leaflet**. Живые данные без единого API-ключа:
Open-Meteo (+ их ансамбль ECMWF), METAR NOAA, GitHub Actions как «крона» опроса станций.

---

## Что это

ГИС-прототип ветеринарии Ростовской области. Слева — карта (THI-круги станций, реки,
КГЛ-районы, коридор АЧС, аэрозоль-плюм), снизу — **прогноз-скраббер 0…167 ч** (карта
перекрашивается по выбранному часу), справа — панель из 7 вкладок:
Сводка · Прогноз · Станции · Ансамбль · АЧС · Надзор · OSINT.

## Дашборд на GitHub Pages

**https://shray77.github.io/vet-meteo/** — «пост диспетчера»: статический файл
`docs/index.html` (GitHub Pages → ветка `main`, папка `/docs`, `.nojekyll`) плюс
кураторный `docs/data/outbreaks.json`. Читает те же `data/*.json` с
`raw.githubusercontent.com` прямо из браузера юзера, автообновление каждые 5 минут.
Внутри: KPI-сводка, **интерактивная карта Leaflet** (подложки БЕЗ ключей и вотермарок:
тёмная Esri Dark Gray / OpenTopoMap / OSM / спутник Esri — переключатель слоёв; круги
станций с THI-раскраской и попапами, слой вспышек WAHIS/ФСВПС — только Ростовская
обл., 2019+; при недоступности CDN — фолбэк на координатную схему), таблица со
спарклайнами THI
за 72 ч, тепловая сетка прогноза на 7 дней, **график истории THI/THIadj за 72 ч**
по выбранной станции, METAR и суточный дайджест. Время — везде МСК. Обновляется
сам — по мере того как Actions коммитят новые срезы в `data/`.

## Пайплайн данных

```
                        ┌─────────────────────────────────────────────┐
                        │  GITHUB ACTIONS (этот репозиторий)          │
                        │  stations.yml — ежечасно (7-я мин UTC):   │
                        │   METAR + Open-Meteo × 16 станций + SWR     │
                        │   → latest.json + snapshots/ + TG-алерты    │
                        │  daily-outlook.yml — 06:17 МСК:             │
                        │   7-дневный дайджест → outlook.json + TG    │
                        │  weekly-digest.yml — вс 06:47 МСК:          │
                        │   итоги недели → weekly.json + TG           │
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

## Telegram-алерты (опционально)

Все воркфлоу умеют слать сводки в Telegram, но без секретов тихо пропускают
(воркфлоу остаётся зелёным). Чтобы включить:

1. Создай бота у **@BotFather** → получишь токен вида `123456:ABC-DEF...`.
2. Напиши боту любое сообщение (или добавь его в группу и напиши туда).
3. Узнай свой `chat_id` у **@userinfobot** (для группы — отрицательный).
4. В **Settings → Secrets and variables → Actions → New repository secret** добавь:
   - `TG_BOT_TOKEN` — токен бота;
   - `TG_CHAT_ID` — id чата.

Что приходит: ежечасные алерты по фронту — THI≥80 / THIadj≥80 / BRD≥75
(дедупликация: срабатывание → эскалация → «снято», состояние в
`data/alerts-state.json`), суточный дайджест 06:17 МСК и итоги недели
в 06:47 воскресенья.

## Математические модели

### Биоклимат (src/lib/models/)

| Модель | Формула / идея | Пороги |
|---|---|---|
| **THI КРС** (NRC—Yousef) | `THI = (1.8·T+32) − (0.55−0.0055·RH)(1.8·T−26)` | 68 / 72 / 80 / 90 |
| **THIadj** (Mader 2006) | `4.51 + THI − 1.992·WS + 0.0068·SR` (SR — Вт/м², WS — м/с) | те же, дневные условия |
| Потери удоя | Ravagnolo & Misztal 2000: `−0.2 кг/ед THI > 72` | |
| **THI птицы** | `0.6·Tdb + 0.4·Twb` (Twb — Stull 2011, RH в %) | 70 / 75 / 80 |
| **THI свиноматок** | NRC-THI, сдвинутые пороги | 72 / 78 / 84 |
| **WCI** холод КРС | `(10.45 + 10√v − v)(33 − T)`, v м/с | 600 / 1000 / 1400 |
| **HLI** (Gaughan et al. 2008) | `BG≥25°: 8.62 + 0.38·RH + 1.55·BG − 0.5·WS + e^(2.4−WS)`; `BG<25°: 1.3 + …`; `BG ≈ Tdb + 0.016·SWR` | 78 (86 аккл.) |
| **AHL** накопление | `AHL_t = 0.98·AHL_{t−1} + max(0, HLI−78)`, зоны Gaughan | 1 / 10 / 50 / 100 |
| VPD | Tetens: `es(T)(1 − RH/100)` | гигрометрия клещей/миджсов |

> Ревизия моделей 2026-09-07 (сверка с первоисточниками): добавлен THIadj
> (Mader et al. 2006, JAS 84:712) — считается в CI и на дашборде; потери удоя
> исправлены 0.25→0.2 кг/ед (Ravagnolo & Misztal 2000, JDS 83:109); HLI заменён
> на каноническую двухчастную формулу Gaughan et al. 2008 (JAS 86:329), порог
> AHL 77→78; фиксирован Tw (Stull 2011: RH в процентах, а не долях — раньше
> занижал на ~10° и ломал THI птицы); ET₀ Hargreaves теперь с астрономическим
> Ra по FAO-56 (была грубая синусоида по месяцу). Опорные точки — `scripts/test_models.ts`.

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

**Реальный DEM**: SRTM через AWS Terrain (terrarium-тайлы, без ключа), сборка
`scripts/build_dem.py` → `src/lib/geo/dem.json` — сетка 0,05° (~5,5 км), 73×141 узлов,
точечная выборка + despike 120 м против радарных шипов над лиманами. Валидация —
сверка с независимым SRTM90 (opentopodata.org): контрольные точки в степи ±10 м,
города в речных долинах ±25–65 м (честный предел разрешения сетки). Высоты 16 точек
мониторинга — из SRTM90. Дальше как раньше: уклон/экспозиция → **застой холодного
воздуха** (ночные минимумы в котловинах) и **ветровая экспозиция** → поправки
T/RH/ветра к почасовому прогнозу.

### Ансамбль (ensemble.ts)

Open-Meteo **ensemble API** (ECMWF IFS 0.25°, 51 член, без ключа): THImax p10/p50/p90
и `P(THImax > 72/80)` по дням. Если ансамбль недоступен — локальная пертурбация
детерминированного прогноза (σ растёт с горизонтом), честно помечается `пертурбация`.

## Кучка метеостанций + GitHub Actions

`data/stations.json` — реестр (16 станций + 6 METAR-аэропортов). `stations.yml` ходит
каждый час (7-я минута — вне пика нагрузки GitHub): METAR + мульти-точечный Open-Meteo запрос → THI/BRD-лайт → коммит
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

**Без ключей и вотермарок**: Esri World Dark Gray (база + подписи), OpenTopoMap
(CC-BY-SA), OSM Standard, Esri World Imagery — переключатель слоёв прямо на карте.
CARTO сознательно выпилен: анонимный доступ к их басемапам теперь отдаёт тайлы
с вотермаркой «API KEY REQUIRED». Фирменный флаг Leaflet в атрибуции заменён на
текстовую ссылку (`setPrefix`).

## Структура

```
src/lib/geo/rostov.ts      точки/реки/КГЛ-районы/реальный SRTM-DEM/демо-АЧС
src/lib/geo/dem.json        SRTM 0,05° 73×141 (сборка scripts/build_dem.py)
src/lib/topo/topo.ts        уклон, coldPool, ветровая экспозиция
src/lib/models/             thi · brd · parasites · asf · advanced · surveillance · ensemble · plume
src/lib/field-data.ts       Open-Meteo → прокси → синтетика
src/lib/archive.ts          чтение data/ с raw.githubusercontent
src/lib/assessment.ts       пайплайн: погода → топо → модели → триггеры
src/components/vetradar/    GisMap · TimeScrubber · RightPanel(7 вкладок) · StationTable ·
                            EnsembleChart · SurveillancePanel · StressBlocks · Gauges · …
tools/fetch_stations.mjs    hourly-опрос для Actions (THI + THIadj Mader)
tools/outlook.mjs           суточный дайджест
tools/alerts.mjs            Telegram-алерты по фронту (THI/THIadj/BRD)
tools/weekly.mjs            недельный итог по архиву снапшотов
tools/curate_outbreaks.mjs  курация вспышек WAHIS/ФСВПС → docs/data/
.github/workflows/           stations · daily-outlook · weekly-digest · pages
data/                        latest.json · snapshots/ · stations.json · alerts-state.json
                             (генерится Actions)
docs/                        статический дашборд GitHub Pages + кураторные данные вспышек
```

## Дисклеймер

Прототип для демонстрации пайплайна. Рельеф — реальный SRTM-DEM (0,05°), но реки/
леса — схематичные; очаги АЧС на полной версии, ряды заболеваемости и OSINT-точки —
ДЕМО-данные; вспышки на дашборде — куративный бэкап WAHIS/ФСВПС (только Ростовская
обл., 2019+). Решения о ветмероприятиях принимаются по официальным регламентам и
реальным данным ВетИС/Россельхознадзора, а не по этой карте.
