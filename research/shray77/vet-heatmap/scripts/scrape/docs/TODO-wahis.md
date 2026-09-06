# TODO: WAHIS (WOAH) интеграция через Playwright

## Контекст

`scripts/scrape/sources/wahis.ts` — это stub. WOAH WAHIS это Angular SPA, требует session-token, прямой REST-доступ возвращает BAD_REQUEST.

## Подход

### Шаг 1: Установить Playwright

```bash
bun add -d playwright
bunx playwright install chromium
```

### Шаг 2: Захват session token

```typescript
import { chromium } from "playwright";

async function getWahisSession(): Promise<{ cookies: string; token: string }> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture API calls
  let token = "";
  page.on("request", (req) => {
    const auth = req.headers()["authorization"];
    if (auth && auth.startsWith("Bearer")) token = auth;
  });

  await page.goto("https://wahis.woah.org/", { waitUntil: "networkidle" });
  // Wait for SPA to boot and make first authenticated API call
  await page.waitForTimeout(5000);

  const cookies = await context.cookies();
  const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  await browser.close();
  return { cookies: cookieStr, token };
}
```

### Шаг 3: Использовать token для REST

```typescript
async function fetchEvents(session: { cookies: string; token: string }): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://wahis.woah.org/api/v1.0/events?pageSize=500&pageNumber=${page}&country=RU`,
      {
        headers: {
          Authorization: session.token,
          Cookie: session.cookies,
          Accept: "application/json",
        },
      },
    );
    const data = await res.json();
    if (!data.data?.length) break;
    all.push(...data.data);
    if (data.data.length < 500) break;
    page++;
  }
  return all;
}
```

### Шаг 4: Map → RawArticle

```typescript
function mapWahisEvent(event: any): RawArticle {
  return {
    source: "wahis",
    url: `https://wahis.woah.org/#/event/${event.id}`,
    title: `${event.disease?.nameEn} in ${event.region} / ${event.department}`,
    published_at: event.startDate,
    body_text: event.summary || "",
    detected_disease: event.disease?.nameEn,
    detected_region: event.department,
    detected_species: event.species?.nameCommon,
    detected_cases: event.cases,
    detected_deaths: event.deaths,
  };
}
```

### Шаг 5: GitHub Actions

Playwright требует браузер. В `.github/workflows/update-data.yml` добавить:

```yaml
- name: Install Playwright browsers
  run: bunx playwright install --with-deps chromium
```

## Риски

1. **Token expiry** — session может жить 1-24 часа. Решение: получать свежий каждый запуск.
2. **Изменения API** — WOAH может менять endpoint'ы. Решение: версионирование + alerts.
3. **Captcha** — WOAH может её добавить. Решение:複杂но, возможно потребуется 2captcha.
4. **Rate limiting** — пока не наблюдался, но добавить задержки 500мс.

## Оценка

- ~6-8 часов на полную реализацию с тестами
- ~2 часа на debugging Playwright в CI окружении
- Итого: ~1 рабочий день
