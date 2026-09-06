# TODO: PDF-парсинг fsvps.gov.ru

## Контекст

Скрапер `scripts/scrape/sources/fsvps.ts` уже успешно:
1. Загружает страницу `https://fsvps.gov.ru/jepizooticheskaja-situacija/rossija/operativnye-informacionnye-soobshhenija/`
2. Извлекает 93+ PDF-сводок (по одной на рабочий день)
3. Сохраняет их URL + даты в `.cache/fsvps-pdfs.json`

Чего НЕ хватает: распарсить содержимое PDF в структурированные outbreak-записи.

## Структура PDF-сводки

Типичная ежедневная сводка fsvps (файл вида `19.06.2026г.pdf`) содержит:

```
Оперативная информация по эпизоотической ситуации на территории РФ
по состоянию на 19 июня 2026 г.

За истекшие сутки зарегистрированы:
1. АЧС среди диких кабанов в Тверской области, Бельский район,
   в 5 км от д. ... Пало 12 голов, заражено 18.
2. Бешенство у лисы в Брянской области, ... Пало 1 голова.
...

Не зарегистрированы случаи заболевания:
- Грипп птиц
- Ящур
...
```

## Предлагаемый подход

### Шаг 1: Выбор библиотеки

Варианты:
- **`pdfjs-dist`** (Mozilla, pure JS, работает в Bun) — РЕКОМЕНДУЕТСЯ
- `pdf-parse` (Node.js, простой, но менее точный)
- `pdf2json` (быстрый, но хрупкий)

### Шаг 2: Скачивание PDF

```typescript
async function downloadPdf(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 ..." },
  });
  return Buffer.from(await res.arrayBuffer());
}
```

### Шаг 3: Извлечение текста

```typescript
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

async function extractText(pdfBuffer: Buffer): Promise<string> {
  const doc = await pdfjs.getDocument({ data: pdfBuffer }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => item.str).join(" ") + "\n";
  }
  return text;
}
```

### Шаг 4: Регулярки для извлечения вспышек

Структура сводки предсказуема. Шаблоны для извлечения:

```typescript
// Каждая вспышка — отдельный пункт нумерованного списка
const OUTBREAK_BLOCK = /(\d+)\.\s+([А-Я][а-яё]+(?:\s+(?:чума|ящур|грипп)[^,.]+)?),?\s+([^,.]+),?\s+/g;

// Болезнь + регион + район
const DISEASE_REGION = /(АЧС|КЧС|ящур|бешенств[ао]|сибирская язва|грипп птиц|блютунг|у[зз]елковый дерматит)\b.*?(в\s+([А-Я][а-яё]+(?:\s+(?:область|край|Республика))?))/i;

// Числа павших/заражённых
const CASUALTIES = /(пало|заражено|инфицировано|заболело|выявлено)\s+(\d+)\s*(голов|животных|птиц|особей)?/gi;

// Вид животного
const SPECIES = /(крупн\w*\s+рогат\w*\s+скот|мелк\w*\s+рогат\w*\s+скот|свин[ьи]|дик\w+\s+кабан\w*|птиц\w*|кон\w*|лошад\w*|овец|коз|лис\w*|енот\w*|волк\w*)/i;
```

### Шаг 5: Сборка RawArticle

```typescript
function parseFsvpsReport(text: string, reportDate: string, sourceUrl: string): RawArticle[] {
  const articles: RawArticle[] = [];
  // Split by numbered items
  const blocks = text.split(/\n\s*\d+\.\s+/).slice(1);
  for (const block of blocks) {
    const disease = block.match(/АЧС|КЧС|ящур|бешенство|.../i)?.[0];
    const region = block.match(/в\s+([А-Я][а-яё]+(?:\s+(?:область|край|Республика))?)/)?.[1];
    const cases = block.match(/заражено\s+(\d+)/i)?.[1];
    const deaths = block.match(/пало\s+(\d+)/i)?.[1];
    const species = block.match(/(свиней|кабанов|птицы|крс|мрс|лошадей)/i)?.[1];

    if (disease && region) {
      articles.push({
        source: "fsvps",
        url: sourceUrl,
        title: `${disease} в ${region}`,
        published_at: reportDate,
        body_text: block,
        detected_disease: disease,
        detected_region: region,
        detected_cases: cases ? parseInt(cases) : undefined,
        detected_deaths: deaths ? parseInt(deaths) : undefined,
        detected_species: species,
      });
    }
  }
  return articles;
}
```

### Шаг 6: Интеграция в `scrapeFsvps()`

В `fsvps.ts` заменить секцию "v2 placeholder" на:

```typescript
const raw: RawArticle[] = [];
for (const report of recent.slice(0, 30)) { // last 30 days
  try {
    const pdfBuffer = await downloadPdf(report.url);
    const text = await extractText(pdfBuffer);
    raw.push(...parseFsvpsReport(text, report.date, report.url));
  } catch (e) {
    console.warn(`[fsvps] Failed to parse ${report.url}:`, e);
  }
}
```

### Шаг 7: Конвертация RawArticle → Outbreak

Использовать существующие normalizers (`normalizeDisease`, `normalizeRegion`).

## Риски и сложности

1. **Структура PDF может меняться** — fsvps может изменить формат. Решение: иметь несколько шаблонов и fallback-логику.
2. **OCR может потребоваться** — если PDF это скан, а не текст. Решение: tesseract.js (тяжело, ~50МБ).
3. **Rate limiting** — fsvps может начать блокировать. Решение: 1 запрос в секунду, User-Agent.
4. **Омонимия болезней** — «чума» может быть АЧС, КЧС, чумой КРС, чумой мелких жвачных. Решение: учитывать контекст (вид животного).
5. **Регионы с дефисами/апострофами** — Чукотский АО, Ханты-Мансийский АО — Югра. Решение: уже покрыто в `normalizeRegion`.

## Оценка

- ~4-6 часов на полную реализацию
- ~1 час на тестирование против 5-10 реальных PDF
- ~1 час на edge-case обработку

## Минимально жизнеспособная версия

Если хочется быстро — парсить только вспышки, где есть и болезнь, и регион, и число павших. ~80% coverage. ~2 часа работы.
