#!/usr/bin/env bun
/**
 * run-all.ts — orchestrator for the scraper pipeline.
 *
 * Flow:
 *   1. Load curated outbreak dataset (always — fallback safety net)
 *   2. Try each scraper source in parallel:
 *        - fsvps (real, v1 indexes PDFs only)
 *        - wahis (stub)
 *        - efsa (stub)
 *   3. Merge + dedupe all outbreaks
 *   4. Write final OutbreakDataset to public/data/outbreaks.json
 *   5. Print a summary
 *
 * Usage:
 *   bun run scripts/scrape/run-all.ts
 *
 * Exit codes:
 *   0 — at least curated data is available, dataset written successfully
 *   1 — fatal error, no data produced
 */

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { Outbreak, SourceKey } from "../../src/types/domain";
import { loadCuratedOutbreaks } from "./sources/curated";
import { scrapeFsvps } from "./sources/fsvps";
import { scrapeHistoricalArchive } from "./sources/fsvps-historical";
import { parseFsvpsReport } from "./sources/fsvps-pdf-parser";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFile } from "node:fs/promises";
import { scrapeWahis } from "./sources/wahis";
import { normalizeDisease, getDiseaseLabels } from "../../src/data/diseases-normalize";
import { normalizeRegion } from "../../src/data/regions";
import { scrapeEfsa } from "./sources/efsa";
import { mergeOutbreaks, buildDataset } from "./merge";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "..", "..", "public", "data", "outbreaks.json");

async function main() {
  console.log("=".repeat(70));
  console.log("  VetHeatmap scraper — run-all");
  console.log("=".repeat(70));
  console.log(`Started: ${new Date().toISOString()}\n`);

  // 1. Always load curated as baseline
  console.log("─".repeat(70));
  console.log("[1/4] Loading curated baseline…");
  const curated = await loadCuratedOutbreaks();
  console.log(`      ✓ ${curated.length} curated outbreaks loaded`);

  // 2. Run all scrapers in parallel
  console.log("\n" + "─".repeat(70));
  console.log("[2/4] Running scrapers in parallel…");

  const sources: { source: SourceKey; outbreaks: Outbreak[]; warning?: string }[] = [];

  // Curated always goes in
  sources.push({ source: "curated", outbreaks: curated });

  // Run external scrapers; if any fail, log warning and continue
  const results = await Promise.allSettled([
    scrapeFsvps({ lookbackDays: 1000, maxReports: 1000 }),
    scrapeWahis(),
    scrapeEfsa(),
  ]);

  const fsvpsResult = results[0];
  if (fsvpsResult.status === "fulfilled") {
    console.log(`      ✓ fsvps: ${fsvpsResult.value.reports.length} PDF reports indexed, ${fsvpsResult.value.outbreaks.length} outbreaks extracted`);
    sources.push({ source: "fsvps", outbreaks: fsvpsResult.value.outbreaks, warning: fsvpsResult.value.warning });
    if (fsvpsResult.value.warning) console.log(`        ⚠  ${fsvpsResult.value.warning}`);
  } else {
    console.log(`      ✗ fsvps FAILED: ${fsvpsResult.reason?.message ?? fsvpsResult.reason}`);
  }

  // ─── Historical archive (2024 data) ──────────────────────────
  // Scrape older fsvps reports from the archive page, parse PDFs,
  // and add to the outbreak list.
  try {
    console.log("\n      ─── Historical archive (2024) ───");
    const histResult = await scrapeHistoricalArchive({ maxReports: 100, yearFilter: 2024 });
    console.log(`      Found ${histResult.totalFound} historical reports, processing ${histResult.reports.length}`);

    const histOutbreaks: any[] = [];
    let histParsed = 0;
    let histFailed = 0;

    for (const report of histResult.reports) {
      if (!report.pdfUrl) continue;
      try {
        // Download PDF
        const pdfRes = await fetch(report.pdfUrl, {
          headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/pdf,*/*;q=0.8" },
        });
        if (!pdfRes.ok) { histFailed++; continue; }
        const ab = await pdfRes.arrayBuffer();
        const buf = Buffer.from(ab);
        const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

        // Extract text
        const doc = await pdfjs.getDocument({ data }).promise;
        let text = "";
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map((it: any) => it.str || "").join(" ") + "\n";
        }

        // Parse
        const articles = parseFsvpsReport(text, report.date, report.pdfUrl);
        for (const raw of articles) {
          histOutbreaks.push({
            ...raw,
            detected_disease: raw.detected_disease,
            detected_region: raw.detected_region,
            detected_species: raw.detected_species,
            detected_cases: raw.detected_cases,
            detected_deaths: raw.detected_deaths,
          });
        }
        histParsed++;
        await new Promise((r) => setTimeout(r, 200)); // polite delay
      } catch (e) {
        histFailed++;
      }
    }

    console.log(`      Historical: parsed ${histParsed} PDFs, ${histFailed} failed, ${histOutbreaks.length} articles extracted`);

    // Convert RawArticles to Outbreaks (reuse fsvps.ts convertRawToOutbreak)
    if (histOutbreaks.length > 0) {
      const { normalizeDisease, getDiseaseLabels } = await import("../../src/data/diseases-normalize");
      const { normalizeRegion } = await import("../../src/data/regions");
      const histOutbreaksConverted = histOutbreaks.map((raw: any, i: number) => {
        const disease_key = normalizeDisease(raw.detected_disease ?? "");
        const labels = getDiseaseLabels(disease_key);
        const region_geo = normalizeRegion(raw.detected_region ?? "") ?? "";
        const status = raw.body_text && /(снятие|отмен)/i.test(raw.body_text) ? "Resolved" : "Ongoing";
        return {
          id: 10000 + i, // offset to avoid collision with curated IDs
          disease_key,
          disease: labels.ru,
          disease_group: labels.group,
          region: raw.detected_region ?? "",
          region_geo,
          date: raw.published_at,
          species: raw.detected_species ?? "Other",
          cases: raw.detected_cases ?? 0,
          deaths: raw.detected_deaths ?? 0,
          status,
          source: "fsvps" as const,
          source_url: raw.url,
          notes: raw.body_text || raw.title,
          municipality: (raw as any).detected_municipality ?? undefined,
          settlements: (raw as any).detected_settlements,
        };
      });
      sources.push({ source: "fsvps", outbreaks: histOutbreaksConverted });
      console.log(`      ✓ Historical: ${histOutbreaksConverted.length} outbreaks added from 2024`);
    }
  } catch (e) {
    console.log(`      ⚠ Historical archive failed:`, e instanceof Error ? e.message : e);
  }

  const wahisResult = results[1];
  if (wahisResult.status === "fulfilled") {
    // Convert WAHIS RawArticles to Outbreaks
    const wahisRaw = wahisResult.value.raw;
    const wahisOutbreaks = wahisRaw.map((raw: any, i: number) => {
                  const disease_key = normalizeDisease(raw.detected_disease ?? "");
      const labels = getDiseaseLabels(disease_key);
      return {
        id: 20000 + i,
        disease_key,
        disease: labels.ru,
        disease_group: labels.group,
        region: raw.detected_region ?? "",
        region_geo: normalizeRegion(raw.detected_region ?? "") ?? "",
        date: raw.published_at,
        species: raw.detected_species ?? "Other",
        cases: raw.detected_cases ?? 0,
        deaths: raw.detected_deaths ?? 0,
        status: raw.body_text?.includes("On-going") ? "Ongoing" : "Resolved",
        source: "wahis" as const,
        source_url: raw.url,
        notes: raw.title,
      };
    });
    console.log(`      ✓ wahis: ${wahisRaw.length} events, ${wahisOutbreaks.length} outbreaks`);
    sources.push({ source: "wahis", outbreaks: wahisOutbreaks, warning: wahisResult.value.warning });
    if (wahisResult.value.warning) console.log(`        ⚠  ${wahisResult.value.warning}`);
  } else {
    console.log(`      ✗ wahis FAILED: ${wahisResult.reason?.message ?? wahisResult.reason}`);
  }

  const efsaResult = results[2];
  if (efsaResult.status === "fulfilled") {
    console.log(`      ✓ efsa: ${efsaResult.value.outbreaks.length} outbreaks (stub)`);
    sources.push({ source: "efsa", outbreaks: efsaResult.value.outbreaks, warning: efsaResult.value.warning });
    if (efsaResult.value.warning) console.log(`        ⚠  ${efsaResult.value.warning}`);
  } else {
    console.log(`      ✗ efsa FAILED: ${efsaResult.reason?.message ?? efsaResult.reason}`);
  }

  // 3. Merge + dedupe
  console.log("\n" + "─".repeat(70));
  console.log("[3/4] Merging + deduping…");
  const totalBefore = sources.reduce((s, x) => s + x.outbreaks.length, 0);
  const merged = mergeOutbreaks(sources.map((s) => ({ source: s.source, outbreaks: s.outbreaks })));
  console.log(`      ${totalBefore} → ${merged.length} (after dedupe)`);

  const contributingSources: SourceKey[] = sources
    .filter((s) => s.outbreaks.length > 0)
    .map((s) => s.source);

  // 4. Build dataset + write
  console.log("\n" + "─".repeat(70));
  console.log("[4/4] Writing final dataset…");
  const dataset = buildDataset(merged, contributingSources);

  await writeFile(OUT_PATH, JSON.stringify(dataset, null, 2), "utf-8");
  console.log(`      ✓ Written ${dataset.total_outbreaks} outbreaks to ${OUT_PATH}`);

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("  Summary");
  console.log("=".repeat(70));
  console.log(`Updated: ${dataset.updated}`);
  console.log(`Sources contributing: ${dataset.sources.join(", ")}`);
  console.log(`Total outbreaks: ${dataset.total_outbreaks}`);

  const { REGION_PROPERTIES } = await import("../../src/data/regions");

  const byDisease: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byDistrict: Record<string, { total: number, diseases: Record<string, number> }> = {};

  for (const o of dataset.outbreaks) {
    byDisease[o.disease] = (byDisease[o.disease] ?? 0) + 1;
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
    bySource[o.source] = (bySource[o.source] ?? 0) + 1;

    const district = o.region_geo && REGION_PROPERTIES[o.region_geo]
      ? REGION_PROPERTIES[o.region_geo].federal_district
      : "Неизвестно";
    
    if (!byDistrict[district]) byDistrict[district] = { total: 0, diseases: {} };
    byDistrict[district].total++;
    byDistrict[district].diseases[o.disease] = (byDistrict[district].diseases[o.disease] ?? 0) + 1;
  }

  console.log("\n📊 ТОП-5 БОЛЕЗНЕЙ:");
  for (const [d, n] of Object.entries(byDisease).sort((a, b) => b[1] - a[1]).slice(0, 5)) {
    console.log(`  🔸 ${n.toString().padStart(4)} | ${d}`);
  }

  console.log("\n🗺️  ПО ФЕДЕРАЛЬНЫМ ОКРУГАМ:");
  for (const [dist, data] of Object.entries(byDistrict).sort((a, b) => b[1].total - a[1].total)) {
    const topDisease = Object.entries(data.diseases).sort((a, b) => b[1] - a[1])[0];
    const topStr = topDisease ? `(в осн. ${topDisease[0]} - ${topDisease[1]})` : "";
    console.log(`  📍 ${dist.padEnd(10)}: ${data.total.toString().padStart(4)} вспышек ${topStr}`);
  }

  console.log("\nСтатусы:");
  for (const [s, n] of Object.entries(byStatus)) {
    console.log(`  ${s === "Ongoing" ? "🔥" : "✅"} ${n.toString().padStart(4)} | ${s}`);
  }
  
  console.log("\nИсточники:");
  for (const [s, n] of Object.entries(bySource)) {
    console.log(`  📡 ${n.toString().padStart(4)} | ${s}`);
  }

  console.log(`\n🎉 Сбор данных завершен: ${new Date().toISOString()}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
