/**
 * Curated outbreak dataset — the fallback source.
 *
 * Reads the hand-curated `public/data/outbreaks.json` (originally compiled
 * in legacy/python/scripts/fetch_wahis.py) and converts it to the
 * canonical Outbreak shape with proper disease_key + region_geo fields.
 *
 * v1: this is the primary source of truth while fsvps/wahis/efsa scrapers
 *     are stubs.
 *
 * v2+: when scrapers produce real data, this becomes a fallback seed.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { Outbreak, OutbreakStatus, SourceKey } from "../../../src/types/domain";
import { normalizeDisease, getDiseaseLabels } from "../../../src/data/diseases-normalize";
import { normalizeRegion } from "../../../src/data/regions";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Read from legacy/ — this file is the original hand-curated seed and is never
// overwritten. Reading from public/data/outbreaks.json would create a feedback
// loop (merge output becomes input on next run).
const CURATED_PATH = resolve(__dirname, "..", "..", "..", "legacy", "python", "data", "outbreaks", "outbreaks.json");

/** Legacy JSON shape (from Python pipeline). */
interface LegacyOutbreak {
  id?: number;
  disease: string;
  disease_group?: string;
  region: string;
  date: string;
  species: string;
  cases: number;
  deaths: number;
  status: string;
  source: string;
  lat?: number;
  lon?: number;
}

interface LegacyDataset {
  updated: string;
  source: "curated";
  total_outbreaks: number;
  outbreaks: LegacyOutbreak[];
}

/** Map legacy "source" string to SourceKey. */
function mapSource(s: string): SourceKey {
  const lower = s.toLowerCase();
  if (lower.includes("wahis")) return "wahis";
  if (lower.includes("efsa") || lower.includes("adis")) return "efsa";
  if (lower.includes("fsvps") || lower.includes("rossel")) return "fsvps";
  return "curated";
}

export async function loadCuratedOutbreaks(): Promise<Outbreak[]> {
  const raw = await readFile(CURATED_PATH, "utf-8");
  const data: LegacyDataset = JSON.parse(raw);

  return data.outbreaks.map((o, idx) => {
    const disease_key = normalizeDisease(o.disease);
    const labels = getDiseaseLabels(disease_key);
    const region_geo = normalizeRegion(o.region) ?? "";
    const status: OutbreakStatus =
      o.status === "Ongoing" ? "Ongoing" :
      o.status === "Resolved" ? "Resolved" : "Unknown";

    return {
      id: o.id ?? idx + 1,
      disease_key,
      disease: labels.ru,
      disease_group: labels.group,
      region: o.region,
      region_geo,
      date: o.date,
      species: o.species,
      cases: o.cases,
      deaths: o.deaths,
      status,
      source: mapSource(o.source),
      lat: o.lat,
      lon: o.lon,
      notes: o.disease, // preserve original disease string for provenance
    } satisfies Outbreak;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loadCuratedOutbreaks()
    .then((outbreaks) => {
      console.log(`Curated outbreaks loaded: ${outbreaks.length}`);
      console.log("\nSample (first 3):");
      console.log(JSON.stringify(outbreaks.slice(0, 3), null, 2));
      const unresolved = outbreaks.filter((o) => !o.region_geo);
      console.log(`\nUnresolved regions: ${unresolved.length}`);
      for (const o of unresolved.slice(0, 5)) {
        console.log(`  - ${o.region}`);
      }
    })
    .catch((e) => {
      console.error("FATAL:", e);
      process.exit(1);
    });
}
