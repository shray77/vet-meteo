# TODO — ВетКарта (vet-heatmap)

## 🔴 High Priority — Data

### 1. fsvps historical archive (236 reports, 2023-2024)
- **Status:** Ready to implement
- **What:** fsvps.gov.ru has 236 archived daily reports for 2023-2024 on `/jepizooticheskaja-situacija/rossija/operativnye-informacionnye-soobshhenija/`
- **How:** Add "historical mode" to `fsvps.ts` — scrape the archive page for all report links, download PDFs, parse with existing parser (already fixed for \uf0d8)
- **Impact:** ~500+ outbreaks instead of 198 (2 years of data instead of 6 months)
- **Effort:** ~2 hours
- **Files:** `scripts/scrape/sources/fsvps.ts`, `scripts/scrape/run-all.ts`

### 2. WAHIS integration via Playwright
- **Status:** Stub exists (`scripts/scrape/sources/wahis.ts`)
- **What:** WOAH WAHIS at wahis.woah.org — Angular SPA, needs session token
- **How:** Use Playwright headless browser → navigate to wahis.woah.org → intercept XHR requests to capture session token → replay against REST API `/api/v1.0/events?country=RU`
- **Impact:** Official WOAH notifications for Russia, global context
- **Effort:** ~1 day
- **Needs:** `bun add playwright && bunx playwright install chromium`
- **CI:** Add `bunx playwright install --with-deps chromium` to GitHub Actions
- **Files:** `scripts/scrape/sources/wahis.ts`, `.github/workflows/update-data.yml`
- **TODO doc:** `scripts/scrape/docs/TODO-wahis.md`

### 3. EFSA ADIS via Playwright
- **Status:** Stub exists (`scripts/scrape/sources/efsa.ts`)
- **What:** EFSA Animal Disease Information System — Cloudflare 403 on direct requests
- **How:** Playwright with realistic browser fingerprint → navigate to ADIS dashboard → export CSV
- **Impact:** EU cross-border risk assessment
- **Effort:** ~4-6 hours
- **Files:** `scripts/scrape/sources/efsa.ts`
- **TODO doc:** `scripts/scrape/docs/TODO-efsa.md`

### 4. Telegram channel @vetrfru (VetIS.News)
- **Status:** Not started
- **What:** Public Telegram channel with veterinary alerts, accessible via `t.me/s/vetrfru`
- **How:** Scrape `t.me/s/vetrfru` HTML → parse messages for disease keywords + regions
- **Impact:** Real-time alerts (faster than fsvps PDF reports)
- **Effort:** ~2 hours
- **Files:** new `scripts/scrape/sources/telegram.ts`

### 5. ProMED-mail RSS
- **Status:** Not started
- **What:** International Society for Infectious Diseases posts animal disease alerts
- **How:** Parse RSS feed from promedmail.org → filter for animal diseases + Russia
- **Impact:** International perspective on Russian outbreaks
- **Effort:** ~1 hour
- **Files:** new `scripts/scrape/sources/promed.ts`

## 🟡 Medium Priority — Features

### 6. Timeline slider on map
- **What:** Date range slider at bottom of map — drag to see outbreaks appear/disappear over time
- **How:** Add a date range slider component → filter outbreaks by date → re-render markers
- **Impact:** Visual wow-effect, helps understand temporal dynamics
- **Effort:** ~3 hours
- **Needs:** Historical data (item #1) for full effect
- **Files:** new `src/components/timeline-slider.tsx`, modify `src/app/page.tsx`

### 7. Push notifications (VAPID)
- **What:** User subscribes to region/disease → push notification when new outbreak detected
- **How:** Web Push API + VAPID keys (free, self-hosted) → GitHub Action checks for new outbreaks → sends push
- **Impact:** Real-time alerts for field vets
- **Effort:** ~3 hours
- **Needs:** VAPID key generation (can be done with `npx web-push generate-vapid-keys`)
- **Files:** new `src/lib/push.ts`, new API route (but static export... needs workaround)
- **Problem:** Static export can't have API routes — need alternative (GitHub Action sends push directly, or use a free push service)

### 8. Export PDF report
- **What:** Button "Сформировать отчёт" → generates PDF with map screenshot, table, statistics
- **How:** jsPDF + html2canvas → capture map + table → generate PDF
- **Impact:** Vets can generate official-looking reports for inspections
- **Effort:** ~3 hours
- **Files:** new `src/components/report-generator.tsx`

### 9. Disease comparison tool
- **What:** Select 2-3 diseases → side-by-side comparison: R₀, incubation, lethality, geography, trends
- **How:** New dialog with comparison table + overlapping charts
- **Impact:** Helps vets prioritize which disease poses biggest threat
- **Effort:** ~2 hours
- **Files:** new `src/components/disease-comparison.tsx`

### 10. Livestock density heatmap layer
- **What:** Toggle layer on map showing pig/cattle/poultry density per region
- **How:** MapLibre fill layer using `pigs_per_km2` / `cattle_per_km2` from REGION_PROPERTIES
- **Impact:** Visualizes where susceptible populations are concentrated
- **Effort:** ~1 hour
- **Data already available:** `REGION_PROPERTIES` in `src/data/regions.ts`

### 11. Multi-disease risk score map
- **What:** Composite risk score per region = Σ (density × R₀ × susceptible_fraction)
- **How:** Calculate per region, show as choropleth layer
- **Impact:** Shows regions at risk from MULTIPLE diseases simultaneously
- **Effort:** ~2 hours

### 12. Federal district grouping
- **What:** Group regions by federal district (ЦФО, СЗФО, ЮФО, etc.) in filters and hotspot list
- **How:** Use `federal_district` field from REGION_PROPERTIES
- **Impact:** Vets work at district level, not individual regions
- **Effort:** ~1 hour
- **Data already available:** `federal_district` in `REGION_PROPERTIES`

## 🟢 Low Priority — Polish

### 13. Red overlay night mode
- **What:** Red-filtered dark mode for night-time field work (preserves night vision)
- **How:** CSS filter: sepia(1) hue-rotate(-50deg) on body
- **Effort:** ~30 min

### 14. Geocode toponyms from PDF text
- **What:** Extract district/village names from fsvps PDF text → geocode via Nominatim/Photon → precise coordinates
- **How:** NER on PDF text → Nominatim API (free, rate-limited) → lat/lon
- **Impact:** Precise marker positions instead of region centroids
- **Effort:** ~4 hours
- **Problem:** Nominatim rate limit (1 req/sec) → slow for 200+ lookups

### 15. Cloudflare Pages alternative deploy
- **What:** Deploy to Cloudflare Pages as alternative to GitHub Pages
- **Why:** Better CDN for RU traffic, free unlimited requests
- **Effort:** ~30 min setup

### 16. Snapshot tests
- **What:** Snapshot tests for key components (map, table, calculator, parser)
- **How:** Vitest + @testing-library/react
- **Effort:** ~2 hours

### 17. Regional vet management reports
- **What:** Scrape regional vet service websites (e.g., irkobl.ru/sites/vet/) for more detailed outbreak data
- **Impact:** More granular data (specific farms, case numbers)
- **Effort:** ~1 day (each region has different site structure)

### 18. FGIS SIRANO integration
- **What:** Federal system for early warning — lab confirmations with case numbers
- **Problem:** sirano.vetrf.ru requires login
- **Effort:** Unknown (may need credentials from user)

## 📊 Data Quality Issues

### 19. 100% outbreaks without precise coordinates
- All 198 outbreaks use region centroid (bbox center), not precise lat/lon
- Markers overlap in center of each region
- Fix: item #14 (geocode toponyms) or item #2 (WAHIS has coordinates)

### 20. 66% outbreaks without case/death counts
- fsvps gives quarantine orders, not case numbers
- Only curated (68 records) have cases/deaths
- Fix: deeper PDF text parsing or FGIS SIRANO (item #18)

### 21. Only 6 months of historical data
- Current: Dec 2025 — Jun 2026
- Fix: item #1 (fsvps historical, 236 reports for 2023-2024)

## 🏗 Technical Debt

### 22. Prisma/SQLite unused
- Installed but not used — data stored as JSON
- Could use for: faster filtering, full-text search, indexed queries
- Effort: ~2 hours to set up, but static export can't use server-side DB

### 23. No tests
- Zero tests in the project
- Priority: parser tests (most fragile part), component snapshot tests

### 24. Dependencies bloat
- 60+ dependencies, many unused (dnd-kit, mdxeditor, react-syntax-highlighter, etc.)
- Could reduce bundle size by removing unused ones
