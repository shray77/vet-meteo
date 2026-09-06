# 🐾 ВетКарта — эпизоотическая обстановка России

Профессиональный PWA-инструмент для ветеринарных специалистов: интерактивная карта вспышек болезней животных, зоны риска по стандартам ВОЗЖ, калькулятор карантина, эпидкривые.

**Live:** [shray77.github.io/vet-heatmap](https://shray77.github.io/vet-heatmap/)

![Map type](https://img.shields.io/badge/map-choropleth%20%2B%20markers-blue) ![PWA](https://img.shields.io/badge/PWA-installable-success) ![Lang](https://img.shields.io/badge/UI-RU-red) ![License](https://img.shields.io/badge/license-MIT-orange)

## Возможности

### 🗺️ Карта
- **Хороплет плотности вспышек** по 85 регионам РФ
- **Маркеры вспышек** — цвет по болезни, размер по числу случаев, пульсация для активных
- **Зоны риска 3/10/30 км** вокруг активных очагов (WOAH Terrestrial Code)
- 3 базовых слоя: Light, Dark, Satellite
- Popups с детальной информацией о вспышке

### 📊 Аналитика
- **Фильтры**: болезнь / вид животных / статус / период / поиск
- **Эпидкривая** — стек-бары по ISO-неделям, цвет по болезни
- **Статистика**: всего вспышек, активных, затронуто регионов, типов болезней
- URL-shareable state — можно отправить коллеге ссылку с применёнными фильтрами

### 🦠 Справочник болезней (51 профиль, Приказ МСХ №62)
Полный перечень заразных и иных болезней животных по Приказу Минсельхоза РФ №62 от 09.03.2011 (ред. 2020):

**Свиноводство:** АЧС, КЧС, РРСС, Рожа свиней, Болезнь Тешена, ВБС, ТГС
**КРС:** Ящур, Сибирская язва, Блютунг, Бруцеллёз, Туберкулёз КРС, ЧМЖ, УЗД, Лейкоз, BVD, ИРТ, Паратуберкулёз, Эмкар, Оспа овец/коз, КПП, ЗКГ, Пастереллёз, BSE, Скрепи
**Птицеводство:** Грипп птиц (HPAI), Ньюкасл, Сальмонеллёз, Гамборо, Марек, ИЛТ, ИБ, ССЯ-76, Пуллороз, ВГБК, Миксоматоз
**Лошади:** Бешенство, ЛЗН, ИАЛ, Сап, ВАЛ, Грипп лошадей, Мыт, Случная болезнь
**Пчёлы:** Варроатоз, Нозематоз, Американский/Европейский гнилец
**Зооантропонозы:** Лептоспироз, Лихорадка Ку, Туляремия, Листериоз, Эхинококкоз, Токсоплазмоз, Иерсиниоз

Для каждой болезни с полным профилем (34 из 51):
- R₀ (базовое репродуктивное число, min-max диапазон)
- Инкубационный период (min-max)
- Пути передачи (4-6 маршрутов)
- Восприимчивые виды
- Зоны защиты / наблюдения / ограничения (км, по WOAH)
- Сроки наблюдения и ограничения (дни)
- Клинические признаки (6 типичных)
- Меры борьбы
- Ссылки на WOAH Terrestrial Code и НПА РФ

Остальные 17 болезней имеют aliases + labels для распознавания скрепером, с fallback-карточкой в drawer.

### 📅 Калькулятор карантина
Выберите болезнь + дату обнаружения → получите таймлайн:
- День 0: Изоляция, уведомление
- День N (инкуб. min): начало окна инкубации
- День 7: завершение эпизоотологического расследования
- День N (инкуб. max): конец окна инкубации
- День N (минимальный срок ограничений): возможное снятие карантина
- День N (наблюдение): восстановление благополучия

Экспорт протокола в TXT для отчётов.

### 📱 PWA
- Устанавливается на телефон/десктоп как нативное приложение
- Работает **офлайн** — кэширует app shell, данные, базовые тайлы карты
- Баннеры: install prompt, update available, offline indicator
- Безопасные зоны iOS (notch, home indicator)

## Технологии

| Слой | Технология | Зачем |
|------|------------|-------|
| Frontend | **Next.js 16** (static export) + TypeScript | SSG → GitHub Pages, zero cost |
| Map | **MapLibre GL JS** + CartoDB/Esri tiles | Free, mobile-friendly, vector-ready |
| UI | **Tailwind 4** + **shadcn/ui** + **lucide-react** | Material 3 + iOS HIG hybrid |
| Charts | **Recharts** | Эпидкривая |
| PWA | Custom **service worker** + manifest | Offline-first |
| Data | JSON в репо + Bun скрипты | Zero-backend |
| CI/CD | **GitHub Actions** | Cron scraper + auto-deploy |
| Hosting | **GitHub Pages** | Zero cost |

## Источники данных

| Источник | Статус | Покрытие |
|----------|--------|----------|
| [fsvps.gov.ru](https://fsvps.gov.ru) | ✅ Реально работает (индексация PDF-сводок) | Россия, ежедневно |
| [WOAH WAHIS](https://wahis.woah.org) | ⏳ Stub (нужен Playwright для Angular SPA) | Глобально |
| [EFSA ADIS](https://www.efsa.europa.eu) | ⏳ Stub (Cloudflare 403, нужен Playwright) | Европа |
| Curated | ✅ 68 вспышек (fallback) | Россия, 2024-2025 |

Скрапер запускается по cron Mon/Thu 06:00 UTC (09:00 МСК). При изменении `outbreaks.json` автоматически триггерит пересборку и деплой.

## Локальный запуск

```bash
# Установить зависимости
bun install

# Dev-сервер
bun run dev
# → http://localhost:3000

# Production build (static export в /out/)
NODE_ENV=production CI=true bun run build

# Запустить скрапер вручную
bun run scripts/scrape/run-all.ts

# Lint
bun run lint
```

## Структура проекта

```
vet-heatmap/
├── .github/workflows/
│   ├── update-data.yml          # Cron-скрапер (Mon/Thu 06:00 UTC)
│   └── deploy.yml               # Auto-deploy на GitHub Pages
├── public/
│   ├── data/
│   │   ├── outbreaks.json       # 68 вспышек (генерируется скрапером)
│   │   └── russia_regions.geojson # 85 регионов РФ + метаданные
│   ├── icons/                   # PWA-иконки (192/512/maskable)
│   ├── manifest.webmanifest     # PWA manifest
│   └── sw.js                    # Service worker
├── scripts/
│   ├── preprocess-geo.ts        # Чистит и обогащает GeoJSON
│   ├── generate-icons.py        # Генерирует PWA-иконки из SVG
│   └── scrape/
│       ├── sources/
│       │   ├── fsvps.ts         # Реальный скрапер fsvps.gov.ru
│       │   ├── wahis.ts         # Stub (Playwright TODO)
│       │   ├── efsa.ts          # Stub (Playwright TODO)
│       │   └── curated.ts       # Fallback из legacy-датасета
│       ├── merge.ts             # 7-day bucket dedupe
│       └── run-all.ts           # Оркестратор
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout, ThemeProvider, metadata
│   │   └── page.tsx             # Main page (карта + сайдбар + фильтры)
│   ├── components/
│   │   ├── outbreak-map.tsx     # MapLibre карта (хороплет + маркеры + зоны)
│   │   ├── filter-panel.tsx     # Фильтры (disease/species/status/date/search)
│   │   ├── epi-curve.tsx        # Эпидкривая (Recharts)
│   │   ├── stats-bar.tsx        # Топ-статистика
│   │   ├── disease-profile-drawer.tsx  # Справочник болезни
│   │   ├── quarantine-calculator.tsx   # Калькулятор карантина
│   │   ├── pwa-banners.tsx      # Install/update/offline баннеры
│   │   └── theme-toggle.tsx     # Light/dark/system
│   ├── data/
│   │   ├── disease-profiles.ts  # 16 болезней (R0, инкуб., WOAH зоны, НПА)
│   │   ├── diseases-normalize.ts # Алиасы болезней (RU/EN/abbrev)
│   │   └── regions.ts           # 87 регионов РФ + метаданные
│   ├── lib/
│   │   ├── filters.ts           # FilterState + URL-синхронизация
│   │   ├── colors.ts            # Палитра болезней
│   │   ├── use-data.ts          # Загрузка outbreaks.json + geojson
│   │   └── use-pwa.ts           # SW registration + install prompt
│   └── types/domain.ts          # Доменные типы (Outbreak, DiseaseProfile, ...)
├── legacy/                      # Старый Python-пайплайн (для истории)
├── next.config.ts               # Static export + basePath /vet-heatmap
├── tsconfig.json
├── package.json
└── README.md
```

## Roadmap (v2+)

- [ ] **PDF-парсинг fsvps** — извлечение вспышек из ежедневных PDF-сводок
- [ ] **WAHIS через Playwright** — реальная интеграция с WOAH API
- [ ] **EFSA ADIS через Playwright** — обход Cloudflare 403
- [ ] **SIR-симуляция** — слайдеры R₀/плотности/инкубационного → прогноз по региону
- [ ] **GPS-ближайшие очаги** — «рядом с тобой N очагов в радиусе 50 км»
- [ ] **Push-уведомления** — подписка на регион/болезнь (VAPID)
- [ ] **Локализация RU/EN** — переключатель языков
- [ ] **Импорт CSV** — вет.инспектор может загрузить свои данные
- [ ] **Реальные плотности животных** — Rosstat/VNIIZZh открытые данные

## Лицензия

MIT — пользуйтесь и адаптируйте свободно.

## Безопасность данных

- Все источники — публичные пресс-релизы и официальные сайты
- Скрапер идентифицирует себя реальным User-Agent
- Никаких персональных данных не собирается и не хранится
- PWA работает полностью клиентски, без бэкенда

---

Сделано с ❤️ для ветеринарного сообщества России.
