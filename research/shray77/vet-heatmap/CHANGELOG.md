# Changelog

All notable changes to **ВетКарта** are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-06-19

### Added
- 🗺️ Interactive choropleth map of 85 Russian regions (Natural Earth ADM1, simplified 40%)
- 📍 68 outbreak markers color-coded by disease, pulsing animation for ongoing
- 🛡️ Risk zones layer (3/10/30 km WOAH standard) around active outbreaks
- 🔍 Filter panel: disease chips, species multiselect, status toggle, date range, search
- 🔗 URL-shareable state (filters sync to query string)
- 📊 Epi curve (weekly stacked bars by disease)
- 🦠 16 disease profiles: R₀, incubation, transmission routes, susceptible species,
  WOAH quarantine zones, observation/restriction days, vaccine availability,
  zoonotic flag, clinical signs, RF regulatory references
- 📅 Quarantine calculator with 6 milestone timeline + TXT export
- 📚 Disease profile drawer with full WOAH/RF reference per disease
- 📋 Outbreaks table with sortable columns, search, status filter, CSV export
- 📱 PWA: manifest.webmanifest, vetkart-sw.js service worker, offline cache,
  install prompt, update banner, offline indicator
- 🌙 Light/dark/system theme with veterinary green primary
- ⌨️ Keyboard shortcuts: ? (about), f (filters), c (calculator), r (reset), t (theme), / (search)
- ℹ️ About dialog with project info, sources, tech stack, disclaimer
- 🤖 Multi-source scraper scaffold:
  - `fsvps.ts` — REAL scraper, indexes 93 daily PDF situation reports from fsvps.gov.ru
  - `wahis.ts` — stub (Playwright needed for Angular SPA session token)
  - `efsa.ts` — stub (Cloudflare 403, needs Playwright)
  - `curated.ts` — fallback dataset (68 outbreaks)
  - `merge.ts` — 7-day bucket dedupe with source priority fsvps>wahis>efsa>curated
- 🔄 CI/CD:
  - `update-data.yml` — cron Mon/Thu 06:00 UTC, runs scraper, commits if changed, triggers deploy
  - `deploy.yml` — on push to main, builds + deploys to GitHub Pages
- 🌐 Region metadata for 87 regions: population, livestock density (pigs/cattle/poultry), federal district, ISO code
- 📖 Comprehensive README, LICENSE, TODO docs for v2 PDF/WAHIS/EFSA integration

### Technical
- **Stack**: Next.js 16 (static export) + TypeScript + Tailwind CSS 4 + shadcn/ui + MapLibre GL
- **Map**: MapLibre GL with CartoDB Positron/Negron and Esri Satellite basemaps
- **Charts**: Recharts (epi curve)
- **PWA**: Custom service worker (no Workbox dependency)
- **Hosting**: GitHub Pages (zero cost)
- **Old Python pipeline** preserved in `legacy/` for reference

## [Unreleased]

### Planned
- PDF-парсинг fsvps daily situation reports (see `scripts/scrape/docs/TODO-pdf-parsing.md`)
- WAHIS integration via Playwright (see `scripts/scrape/docs/TODO-wahis.md`)
- EFSA ADIS integration via Playwright (see `scripts/scrape/docs/TODO-efsa.md`)
- SIR simulation in browser (sliders for R₀/density/incubation)
- GPS nearest-outbreaks feature ("near you" on mobile)
- Push notifications (VAPID keys)
- Localization RU/EN toggle
- CSV import for veterinary inspectors (own data)
- Real livestock density from Rosstat/VNIIZZh open data
