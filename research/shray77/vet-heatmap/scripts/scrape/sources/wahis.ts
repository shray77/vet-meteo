/**
 * WAHIS (WOAH) scraper — REAL, no Playwright needed!
 *
 * Discovered: WAHIS has a public POST API at
 *   https://wahis.woah.org/api/v1/pi/event/filtered-list?language=en
 * No auth token needed, just need proper headers (Referer, Content-Type).
 *
 * Paginate through all events, filter for Russia, convert to RawArticle.
 */

import type { RawArticle, SourceKey } from "../../../src/types/domain";

const API_URL = "https://wahis.woah.org/api/v1/pi/event/filtered-list?language=en";
const PAGE_SIZE = 500;

interface WahisEvent {
  reportId: number;
  eventId: number;
  country: string;
  disease: string;
  subType: string;
  eventStartDate: string;
  eventStatus: string;
  reason: string;
  reportType: string;
  reportStatus: string;
  submissionDate: string;
  reportNumber: number;
  isAquatic: boolean;
}

interface WahisResponse {
  list: WahisEvent[];
  totalSize: number;
  pageSize: number;
  pageNumber: number;
}

export async function scrapeWahis(): Promise<{
  source: SourceKey;
  raw: RawArticle[];
  outbreaks: never[];
  warning?: string;
}> {
  console.log("[wahis] Fetching events via public POST API...");
  const allRaw: RawArticle[] = [];
  let pageNum = 0;
  let totalProcessed = 0;
  let totalSize = 0;

  while (true) {
    const body = JSON.stringify({
      pageNumber: pageNum,
      pageSize: PAGE_SIZE,
      sortOrder: "desc",
      sortBy: "startDate",
    });

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
        Referer: "https://wahis.woah.org/",
        Origin: "https://wahis.woah.org",
      },
      body,
    });

    if (!res.ok) {
      console.warn(`[wahis] API returned ${res.status}`);
      break;
    }

    const data: WahisResponse = await res.json();
    if (pageNum === 0) {
      totalSize = data.totalSize;
      console.log(`[wahis] Total events available: ${totalSize}`);
    }

    // Filter for Russia
    const ruEvents = data.list.filter(
      (e) => e.country.toLowerCase().includes("russia") || e.country.toLowerCase().includes("russian"),
    );

    for (const e of ruEvents) {
      const status = e.eventStatus === "On-going" ? "Ongoing" : "Resolved";
      allRaw.push({
        source: "wahis",
        url: `https://wahis.woah.org/#/event/${e.eventId}`,
        title: `${e.disease} in ${e.country}`,
        published_at: e.eventStartDate.split("T")[0],
        body_text: `Reason: ${e.reason}. Report type: ${e.reportType}. Status: ${e.eventStatus}.`,
        detected_disease: e.disease,
        detected_region: e.country,
        detected_species: undefined,
        detected_cases: undefined,
        detected_deaths: undefined,
      });
    }

    totalProcessed += data.list.length;
    console.log(`[wahis] Page ${pageNum}: ${data.list.length} events, ${ruEvents.length} Russia`);

    if (data.list.length < PAGE_SIZE) break;
    pageNum++;

    // Safety limit — 20 pages = 10000 events
    if (pageNum > 20) break;

    // Brief delay
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`[wahis] Processed ${totalProcessed}/${totalSize} events, found ${allRaw.length} Russia events`);

  return {
    source: "wahis",
    raw: allRaw,
    outbreaks: [],
    warning: allRaw.length === 0 ? "No Russia events found in WAHIS" : undefined,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeWahis().then((r) => {
    console.log(`\n=== WAHIS scrape ===`);
    console.log(`Articles: ${r.raw.length}`);
    if (r.raw.length > 0) {
      console.log(`\nSample (first 5):`);
      for (const a of r.raw.slice(0, 5)) {
        console.log(`  ${a.published_at} | ${a.detected_disease} | ${a.detected_region}`);
      }
    }
    if (r.warning) console.log(`\n⚠️  ${r.warning}`);
  }).catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
}
