/**
 * fsvps historical archive scraper.
 *
 * The fsvps.gov.ru website archives daily outbreak reports going back to 2023.
 * These are HTML pages at /files/informacija-ot-DD-mesjacja-YYYY-goda-.../
 * each containing a link to a PDF report.
 *
 * This module:
 *   1. Fetches the archive page at /jepizooticheskaja-situacija/rossija/operativnye-informacionnye-soobshhenija/
 *   2. Extracts all report page links (informacija-ot-...)
 *   3. For each report page, extracts the PDF URL
 *   4. Returns list of {url, date, display} for PDFs going back to 2023
 *
 * Combined with the existing fsvps.ts scraper (which downloads + parses PDFs),
 * this gives us ~2 years of data instead of 6 months.
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, "..", ".cache");
const ARCHIVE_URL = "https://fsvps.gov.ru/jepizooticheskaja-situacija/rossija/operativnye-informacionnye-soobshhenija/";

const MONTHS_RU: Record<string, string> = {
  "января": "01", "февраля": "02", "марта": "03", "апреля": "04",
  "мая": "05", "июня": "06", "июля": "07", "августа": "08",
  "сентября": "09", "октября": "10", "ноября": "11", "декабря": "12",
  "janvarja": "01", "fevralja": "02", "marta": "03", "aprjelja": "04",
  "majja": "05", "ijunja": "06", "ijulja": "07", "avgusta": "08",
  "sentjabrja": "09", "oktjabrja": "10", "nojabrja": "11", "dekabrja": "12",
};

interface HistoricalReport {
  pageUrl: string;
  pdfUrl: string | null;
  date: string;
  display: string;
  fetched_at: string;
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
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  return res.text();
}

/** Parse "17 января 2024" or "17-janvarja-2024" → "2024-01-17" */
function parseDate(s: string): string | null {
  // Try RU month names
  const m = s.match(/(\d{1,2})\s+([а-яА-Яё]+)\s+(\d{4})/);
  if (m) {
    const [, day, monRu, year] = m;
    const mon = MONTHS_RU[monRu.toLowerCase()];
    if (mon) return `${year}-${mon}-${day.padStart(2, "0")}`;
  }
  // Try transliterated: "17-janvarja-2024"
  const m2 = s.match(/(\d{1,2})-([a-z]+)-(\d{4})/i);
  if (m2) {
    const [, day, monRu, year] = m2;
    const mon = MONTHS_RU[monRu.toLowerCase()];
    if (mon) return `${year}-${mon}-${day.padStart(2, "0")}`;
  }
  // Try DD.MM.YYYY format
  const m3 = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m3) {
    const [, day, mon, year] = m3;
    return `${year}-${mon.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return null;
}

/** Extract all report page links from the archive page. */
function extractReportPages(html: string): { url: string; dateStr: string }[] {
  const reports: { url: string; dateStr: string }[] = [];
  const seen = new Set<string>();

  // Match links to /files/informacija-ot-...-po-jepizooticheskoj-situacii-...
  const re = /href="(https?:\/\/fsvps\.gov\.ru\/files\/informacija-ot-[^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    seen.add(url);

    // Extract date from URL: "informacija-ot-17-janvarja-2024-goda-..."
    const dateMatch = url.match(/informacija-ot-(\d{1,2}-[a-z]+-\d{4})/i);
    if (dateMatch) {
      reports.push({ url, dateStr: dateMatch[1] });
      continue;
    }
    // Also try "svodnaja-informacija-za-period-s-DD-MM-YYYY-po-DD-MM-YYYY"
    const periodMatch = url.match(/za-period-s-(\d{2}-\d{2}-\d{4})/i);
    if (periodMatch) {
      reports.push({ url, dateStr: periodMatch[1] });
    }
  }

  return reports;
}

/** Fetch a report page and extract the PDF URL. */
async function extractPdfUrl(pageUrl: string): Promise<string | null> {
  try {
    const html = await fetchHtml(pageUrl);
    // Look for PDF links
    const pdfMatch = html.match(/href="([^"]+\.pdf)"/i);
    if (pdfMatch) {
      let pdfUrl = pdfMatch[1];
      // Make absolute if relative
      if (pdfUrl.startsWith("/")) {
        pdfUrl = `https://fsvps.gov.ru${pdfUrl}`;
      }
      return pdfUrl;
    }
  } catch (e) {
    console.warn(`[fsvps-hist] Failed to fetch report page ${pageUrl}:`, e instanceof Error ? e.message : e);
  }
  return null;
}

/**
 * Scrape the historical archive.
 *
 * @param opts.maxReports Maximum number of report pages to process (default: 50)
 * @param opts.yearFilter Only process reports from this year (e.g., 2024)
 */
export async function scrapeHistoricalArchive(opts: { maxReports?: number; yearFilter?: number } = {}): Promise<{
  reports: HistoricalReport[];
  totalFound: number;
}> {
  console.log("[fsvps-hist] Fetching archive page...");
  const html = await fetchHtml(ARCHIVE_URL);
  console.log(`[fsvps-hist] Archive page size: ${html.length.toLocaleString()} bytes`);

  const reportPages = extractReportPages(html);
  console.log(`[fsvps-hist] Found ${reportPages.length} report page links`);

  // Filter by year if requested
  let filtered = reportPages;
  if (opts.yearFilter) {
    filtered = reportPages.filter((r) => {
      const iso = parseDate(r.dateStr);
      return iso && iso.startsWith(String(opts.yearFilter));
    });
    console.log(`[fsvps-hist] After year filter (${opts.yearFilter}): ${filtered.length}`);
  }

  // Limit
  const maxReports = opts.maxReports ?? 50;
  const toProcess = filtered.slice(0, maxReports);
  console.log(`[fsvps-hist] Will process ${toProcess.length} report pages (cap: ${maxReports})`);

  const results: HistoricalReport[] = [];
  let processed = 0;
  let withPdf = 0;

  for (const rp of toProcess) {
    const iso = parseDate(rp.dateStr);
    if (!iso) {
      console.warn(`[fsvps-hist] Could not parse date: ${rp.dateStr}`);
      continue;
    }

    console.log(`[fsvps-hist] Processing ${iso} — ${rp.url.split("/").pop()}`);
    const pdfUrl = await extractPdfUrl(rp.url);
    results.push({
      pageUrl: rp.url,
      pdfUrl,
      date: iso,
      display: rp.dateStr,
      fetched_at: new Date().toISOString(),
    });
    processed++;
    if (pdfUrl) withPdf++;

    // Brief delay
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`[fsvps-hist] Processed ${processed} pages, ${withPdf} have PDF links`);

  // Save to cache
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    resolve(CACHE_DIR, "fsvps-historical.json"),
    JSON.stringify({ fetched_at: new Date().toISOString(), reports: results }, null, 2),
    "utf-8",
  );

  return { reports: results, totalFound: reportPages.length };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeHistoricalArchive({ maxReports: 30, yearFilter: 2024 })
    .then((r) => {
      console.log(`\n=== Historical archive scrape ===`);
      console.log(`Total found: ${r.totalFound}`);
      console.log(`Processed: ${r.reports.length}`);
      console.log(`With PDF: ${r.reports.filter((r) => r.pdfUrl).length}`);
      console.log(`\nSample (first 5):`);
      for (const rep of r.reports.slice(0, 5)) {
        console.log(`  ${rep.date}  ${rep.pdfUrl ?? "NO PDF"}`);
      }
    })
    .catch((e) => {
      console.error("FATAL:", e);
      process.exit(1);
    });
}
