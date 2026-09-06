# TODO: EFSA ADIS интеграция

## Контекст

`scripts/scrape/sources/efsa.ts` — stub. EFSA ADIS отдаёт HTTP 403 на обычный curl (Cloudflare).

## Подход

### Шаг 1: Playwright с realistic fingerprint

```typescript
import { chromium } from "playwright";

async function getEfsaData() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
    locale: "en-US",
    viewport: { width: 1920, height: 1080 },
  });

  // Mask webdriver property
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();
  await page.goto("https://www.efsa.europa.eu/en/data/animal-disease-information-system-adis", {
    waitUntil: "networkidle",
  });

  // Export CSV via the dashboard "Export" button
  await page.click('button:has-text("Export")');
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click('a:has-text("CSV")'),
  ]);
  const csvPath = `/tmp/efsa-${Date.now()}.csv`;
  await download.saveAs(csvPath);

  await browser.close();
  return csvPath;
}
```

### Шаг 2: CSV парсинг

```typescript
import { parse } from "csv-parse/sync";

function parseEfsaCsv(csvPath: string): RawArticle[] {
  const content = fs.readFileSync(csvPath, "utf-8");
  const records = parse(content, { columns: true, delimiter: "," });
  return records
    .filter((r) => r.country === "Russia" || r.country === "Russian Federation")
    .map((r) => ({
      source: "efsa",
      url: "https://www.efsa.europa.eu/en/data/animal-disease-information-system-adis",
      title: `${r.disease} in ${r.region}`,
      published_at: r.outbreakDate,
      body_text: r.notes || "",
      detected_disease: r.disease,
      detected_region: r.region,
      detected_species: r.species,
      detected_cases: parseInt(r.cases) || undefined,
      detected_deaths: parseInt(r.deaths) || undefined,
    }));
}
```

### Шаг 3: Соседние страны (для cross-border risk)

EFSA покрывает ЕС, что полезно для оценки риска заноса из соседних стран:
- Беларусь, Украина, Казахстан, Грузия, Армения, Азербайджан

```typescript
const NEIGHBOURING_COUNTRIES = [
  "Belarus", "Ukraine", "Kazakhstan", "Georgia", "Armenia", "Azerbaijan",
  "Russian Federation", "Russia",
];
```

## Риски

1. **Cloudflare bot detection** — может потребоваться stealth plugin.
2. **Структура CSV** — может меняться. Решение: валидация схемы.
3. **Дубликаты** — EFSA может дублировать WOAH (они обмениваются данными). Решение: уже покрыто в `merge.ts`.
4. **Rate limiting** — рекомендуется 1 запрос в 30 секунд.

## Оценка

- ~4-6 часов на реализацию
- ~2 часа на debugging Cloudflare обхода
- Итого: ~1 рабочий день
