/**
 * WAHIS (WOAH) scraper via Playwright.
 *
 * Strategy:
 *   1. Launch headless Chromium
 *   2. Navigate to https://wahis.woah.org/
 *   3. Wait for Angular SPA to boot
 *   4. Navigate to the events page with country=Russia filter
 *   5. Extract outbreak data from the rendered DOM
 *
 * Alternative (simpler): use the public WAHIS REST API with session token
 * captured from the SPA's initial XHR.
 */

import { chromium } from "playwright";
import type { RawArticle } from "../../../src/types/domain";

const WAHIS_URL = "https://wahis.woah.org/";
const EVENTS_API = "https://wahis.woah.org/api/v1.0/events";

export async function scrapeWahisPlaywright(): Promise<{
  raw: RawArticle[];
  warning?: string;
}> {
  console.log("[wahis-pw] Launching headless browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
    locale: "en-US",
  });

  try {
    const page = await context.newPage();

    // Capture API calls to extract session token
    let authToken = "";
    let cookies = "";
    page.on("request", (req) => {
      const auth = req.headers()["authorization"];
      if (auth && auth.startsWith("Bearer") && !authToken) {
        authToken = auth;
        console.log("[wahis-pw] Captured auth token");
      }
    });

    // Navigate to WAHIS
    console.log("[wahis-pw] Navigating to WAHIS...");
    await page.goto(WAHIS_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(5000); // Let Angular boot

    // Get cookies
    const pageCookies = await context.cookies();
    cookies = pageCookies.map((c) => `${c.name}=${c.value}`).join("; ");

    if (!authToken) {
      console.log("[wahis-pw] No auth token captured, trying to navigate to events page...");
      // Try clicking through to the events page
      await page.goto(`${WAHIS_URL}#/events`, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(3000);

      // Check if we captured the token now
      if (!authToken) {
        console.log("[wahis-pw] Still no auth token. WAHIS may require login.");
        return { raw: [], warning: "WAHIS requires auth token — could not capture from SPA" };
      }
    }

    // Now use the REST API with captured token
    console.log("[wahis-pw] Fetching Russia events via REST API...");
    const allRaw: RawArticle[] = [];
    let pageNum = 1;
    const pageSize = 500;

    while (true) {
      const apiUrl = `${EVENTS_API}?pageSize=${pageSize}&pageNumber=${pageNum}&country=RU`;
      const res = await fetch(apiUrl, {
        headers: {
          Authorization: authToken,
          Cookie: cookies,
          Accept: "application/json",
          "Accept-Language": "en",
          Referer: WAHIS_URL,
        },
      });

      if (!res.ok) {
        console.warn(`[wahis-pw] API returned ${res.status}`);
        break;
      }

      const data = await res.json();
      if (!data.data || data.data.length === 0) break;

      for (const event of data.data) {
        allRaw.push({
          source: "wahis",
          url: `${WAHIS_URL}#/event/${event.id}`,
          title: `${event.disease?.nameEn ?? "Unknown"} in ${event.department ?? event.country}`,
          published_at: event.startDate,
          body_text: event.summary || "",
          detected_disease: event.disease?.nameEn,
          detected_region: event.department || event.country,
          detected_species: event.species?.nameCommon,
          detected_cases: event.cases,
          detected_deaths: event.deaths,
        });
      }

      console.log(`[wahis-pw] Page ${pageNum}: ${data.data.length} events`);
      if (data.data.length < pageSize) break;
      pageNum++;
      if (pageNum > 10) break; // safety limit
    }

    console.log(`[wahis-pw] Total events: ${allRaw.length}`);
    return { raw: allRaw };
  } catch (e) {
    console.error("[wahis-pw] Error:", e instanceof Error ? e.message : e);
    return { raw: [], warning: `WAHIS scrape failed: ${e instanceof Error ? e.message : e}` };
  } finally {
    await browser.close();
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeWahisPlaywright()
    .then((r) => {
      console.log(`\n=== WAHIS Playwright scrape ===`);
      console.log(`Articles: ${r.raw.length}`);
      if (r.warning) console.log(`Warning: ${r.warning}`);
      if (r.raw.length > 0) {
        console.log(`\nSample:`);
        console.log(JSON.stringify(r.raw[0], null, 2));
      }
    })
    .catch((e) => {
      console.error("FATAL:", e);
      process.exit(1);
    });
}
