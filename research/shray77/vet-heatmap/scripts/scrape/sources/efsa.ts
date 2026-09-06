/**
 * EFSA ADIS (Animal Disease Information System) scraper — v1 STUB.
 *
 * Status:
 *   - Public page: https://www.efsa.europa.eu/en/data/animal-disease-information-system-adis
 *   - HTTP 403 to plain curl — Cloudflare/anti-bot blocks our User-Agent.
 *   - The actual ADIS data export endpoint is at ec.europa.eu/food/animals/adis
 *     and requires interactive session negotiation.
 *
 * v1 approach: do nothing (return empty). EFSA mainly covers EU outbreaks
 * anyway, which would be relevant only for cross-border risk assessment
 * (e.g., LSD spreading from Balkans to RF southern borders).
 *
 * v2 TODO (see /scripts/scrape/TODO-efsa.md):
 *   1. Use Playwright with realistic browser fingerprint
 *   2. Navigate to the ADIS public dashboard
 *   3. Apply filter: country = Russia (and neighboring EU states for risk)
 *   4. Export results as CSV via the in-page "Export" button
 *   5. Parse CSV → RawArticle[]
 */

import type { Outbreak, RawArticle, SourceKey } from "../../../src/types/domain";

export async function scrapeEfsa(): Promise<{
  source: SourceKey;
  raw: RawArticle[];
  outbreaks: Outbreak[];
  warning: string;
}> {
  console.log("[efsa] v1 stub — no work done. See TODO-efsa.md.");
  return {
    source: "efsa",
    raw: [],
    outbreaks: [],
    warning:
      "v1 stub: EFSA ADIS is behind Cloudflare (403). Needs Playwright. See TODO-efsa.md.",
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeEfsa().then((r) => console.log(JSON.stringify(r, null, 2)));
}
