/**
 * FSVP (Rosselkhoznadzor) scraper.
 *
 * Strategy:
 *   1. Fetch /jepizooticheskaja-situacija/rossija/operativnye-informacionnye-soobshhenija/
 *      — this page links daily PDF situation reports (one per working day).
 *   2. Extract PDF URLs + their publication dates.
 *   3. For each report within the lookback window:
 *      a. Download the PDF
 *      b. Extract text with pdfjs-dist
 *      c. Parse disease sections + items via fsvps-pdf-parser.ts
 *      d. Build RawArticle per outbreak entry
 *   4. Return list of outbreaks.
 *
 * The PDF parsing is real (not stub) — it extracts:
 *   - disease (from section header: "Бешенство животных", "Лейкоз КРС", etc.)
 *   - region (from item: "Иркутская область", "Алтайский край", etc.)
 *   - status (Ongoing if "установлены", Resolved if "снятие"/"отменены")
 *   - species (inferred from disease label + parenthetical "(вид)")
 *   - cases/deaths (when present in text, often absent in legal-style reports)
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

import type { Outbreak, RawArticle, SourceKey, DiseaseKey, DiseaseGroup, OutbreakStatus } from "../../../src/types/domain";
import { normalizeDisease, getDiseaseLabels } from "../../../src/data/diseases-normalize";
import { normalizeRegion } from "../../../src/data/regions";
import { parseFsvpsReport } from "./fsvps-pdf-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CACHE_DIR = resolve(__dirname, "..", ".cache");
const FSVPS_URL =
  "https://fsvps.gov.ru/jepizooticheskaja-situacija/rossija/operativnye-informacionnye-soobshhenija/";

/** PDF report link with extracted date. */
export interface FsvpPdfReport {
  url: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Russian display date as it appeared on the page. */
  display: string;
  /** When we scraped this entry. */
  fetched_at: string;
}

const MONTHS_RU: Record<string, string> = {
  января: "01", февраля: "02", марта: "03", апреля: "04", мая: "05", июня: "06",
  июля: "07", августа: "08", сентября: "09", октября: "10", ноября: "11", декабря: "12",
};

/** Parse "19 июня 2026" -> "2026-06-19". */
function parseRuDate(s: string): string | null {
  const m = s.match(/(\d{1,2})\s+([а-яА-Я]+)\s+(\d{4})/);
  if (!m) return null;
  const [, day, monRu, year] = m;
  const mon = MONTHS_RU[monRu.toLowerCase()];
  if (!mon) return null;
  return `${year}-${mon}-${day.padStart(2, "0")}`;
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3",
      "Accept-Encoding": "gzip, deflate, br",
    },
  });
  if (!res.ok) {
    throw new Error(`[fsvps] HTTP ${res.status} on ${url}`);
  }
  return res.text();
}

/** Extract all PDF report links with publication dates from the operational-news page. */
function extractPdfReports(html: string): FsvpPdfReport[] {
  const reports: FsvpPdfReport[] = [];
  const seen = new Set<string>();

  // Match: href="...*.pdf" + nearby date "DD month YYYY"
  const re = /href="(https?:\/\/[^"]+\.pdf)"[^>]*>([^<]{0,200}?)<[^>]*>\s*(\d{1,2}\s+[а-яА-Я]+\s+\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const [, url, , dateRu] = m;
    if (seen.has(url)) continue;
    seen.add(url);

    const iso = parseRuDate(dateRu.trim());
    if (!iso) continue;
    reports.push({
      url,
      date: iso,
      display: dateRu.trim(),
      fetched_at: new Date().toISOString(),
    });
  }

  // Fallback: any *.pdf link in the page, with date inferred from URL filename
  const pdfRe = /href="(https?:\/\/fsvps\.gov\.ru\/wp-content\/uploads\/\d{4}\/\d{2}\/[^"]+\.pdf)"/g;
  while ((m = pdfRe.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);
    // Try to parse date from filename: "19.06.2026г.pdf" or "01.06.2026.pdf"
    const fname = url.split("/").pop() || "";
    const d = fname.match(/(\d{1,2})\.(\d{1,2})\.(20\d{2})/);
    if (d) {
      const [, day, mon, year] = d;
      const iso = `${year}-${mon.padStart(2, "0")}-${day.padStart(2, "0")}`;
      reports.push({
        url,
        date: iso,
        display: fname,
        fetched_at: new Date().toISOString(),
      });
    }
  }

  return reports.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Main scrape entrypoint.
 *
 * For each recent report PDF:
 *   1. Download
 *   2. Extract text with pdfjs-dist
 *   3. Parse with parseFsvpsReport() to get RawArticle[]
 *
 * Returns the union of all articles + outbreaks.
 */
export async function scrapeFsvps(opts: { lookbackDays?: number; maxReports?: number } = {}): Promise<{
  source: SourceKey;
  reports: FsvpPdfReport[];
  raw: RawArticle[];
  outbreaks: Outbreak[];
  warning?: string;
}> {
  const lookback = opts.lookbackDays ?? 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookback);
  const maxReports = opts.maxReports ?? 14;

  const allReports: FsvpPdfReport[] = [];
  let page = 1;

  while (page <= 20) {
    const url = page === 1 ? FSVPS_URL : `${FSVPS_URL}page/${page}/`;
    console.log(`[fsvps] Fetching page ${page}…`);
    try {
      const html = await fetchHtml(url);
      const pageReports = extractPdfReports(html);
      if (pageReports.length === 0) break;
      allReports.push(...pageReports);
      
      const recentSoFar = allReports.filter((r) => new Date(r.date) >= cutoff);
      if (recentSoFar.length >= maxReports) break; // we have enough recent ones
      
      // If the oldest report on this page is older than cutoff, we don't need next pages
      const oldestDate = pageReports[pageReports.length - 1]?.date;
      if (oldestDate && new Date(oldestDate) < cutoff) break;
    } catch (e) {
      console.warn(`[fsvps] Failed to fetch page ${page}:`, e);
      break;
    }
    page++;
  }

  // Deduplicate by URL
  const uniqueReportsMap = new Map(allReports.map(r => [r.url, r]));
  const reports = Array.from(uniqueReportsMap.values()).sort((a, b) => b.date.localeCompare(a.date));

  console.log(`[fsvps] Found ${reports.length} unique PDF reports across pages`);

  // Save manifest for the frontend "last fetched" indicator
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    resolve(CACHE_DIR, "fsvps-pdfs.json"),
    JSON.stringify({ fetched_at: new Date().toISOString(), url: FSVPS_URL, reports }, null, 2),
    "utf-8",
  );

  const recent = reports.filter((r) => new Date(r.date) >= cutoff);
  console.log(`[fsvps] ${recent.length} reports within last ${lookback} days`);

  const toParse = recent.slice(0, maxReports);
  console.log(`[fsvps] Will parse ${toParse.length} PDFs (cap: ${maxReports})`);

  const allRaw: RawArticle[] = [];
  let parsed = 0;
  let failed = 0;

  for (const report of toParse) {
    try {
      console.log(`[fsvps] Parsing ${report.date} — ${report.url.split("/").pop()}`);
      const pdfBuffer = await downloadPdf(report.url);
      const text = await extractPdfText(pdfBuffer);
      const articles = parseFsvpsReport(text, report.date, report.url);
      allRaw.push(...articles);
      parsed++;
      // Brief delay to be polite to fsvps server
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      console.warn(`[fsvps] Failed to parse ${report.url}:`, e instanceof Error ? e.message : e);
      failed++;
    }
  }

  console.log(`[fsvps] Parsed ${parsed} PDFs successfully, ${failed} failed`);
  console.log(`[fsvps] Total raw articles extracted: ${allRaw.length}`);

  // Convert RawArticle → Outbreak (basic conversion, real merge/dedupe happens in merge.ts)
  const outbreaks: Outbreak[] = allRaw.map((raw, i) => {
    // Re-use rawToOutbreak from the parser module
    // (imported lazily to avoid circular deps in CLI)
    return convertRawToOutbreak(raw, i + 1);
  });

  return {
    source: "fsvps",
    reports,
    raw: allRaw,
    outbreaks,
    warning: failed > 0 ? `${failed} PDF(s) failed to parse` : undefined,
  };
}

/** Download a PDF and return it as a Buffer. */
async function downloadPdf(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
      "Accept": "application/pdf,*/*;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

/** Extract plain text from a PDF buffer. */
async function extractPdfText(pdfBuffer: Buffer): Promise<string> {
  const data = new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength);
  const doc = await pdfjs.getDocument({ data }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items
      .map((it: unknown) => (it as { str?: string }).str || "")
      .join(" ") + "\n";
  }
  return text;
}

/** Convert a RawArticle to an Outbreak (basic; merge.ts will dedupe + assign final IDs). */
function convertRawToOutbreak(raw: RawArticle, id: number): Outbreak {
  const disease_key: DiseaseKey = normalizeDisease(raw.detected_disease ?? "");
  const labels = getDiseaseLabels(disease_key);
  const region_geo = normalizeRegion(raw.detected_region ?? "") ?? "";
  const status: OutbreakStatus =
    raw.body_text && /(снятие|отмен)/i.test(raw.body_text) ? "Resolved" : "Ongoing";

  return {
    id,
    disease_key,
    disease: labels.ru,
    disease_group: labels.group as DiseaseGroup,
    region: raw.detected_region ?? "",
    region_geo,
    date: raw.published_at,
    species: raw.detected_species ?? "Other",
    cases: raw.detected_cases ?? 0,
    deaths: raw.detected_deaths ?? 0,
    status,
    source: "fsvps" as SourceKey,
    source_url: raw.url,
    notes: raw.title,
  };
}

// ─── CLI entrypoint ────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeFsvps()
    .then((r) => {
      console.log("\n=== fsvps scrape result ===");
      console.log(`Source: ${r.source}`);
      console.log(`PDF reports found: ${r.reports.length}`);
      console.log(`Most recent 5 reports:`);
      for (const rep of r.reports.slice(0, 5)) {
        console.log(`  ${rep.date}  ${rep.url}`);
      }
      if (r.warning) console.log(`\n⚠️  ${r.warning}`);
    })
    .catch((e) => {
      console.error("[fsvps] FATAL:", e);
      process.exit(1);
    });
}
