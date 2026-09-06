#!/usr/bin/env bun
/**
 * preprocess-geo.ts — clean + enrich the Natural Earth Russia ADM1 GeoJSON.
 *
 * Inputs:
 *   legacy/python/data/geo/russia_adm1.geojson  (2.3 MB, has 1 feature with shapeName=null)
 *
 * Outputs:
 *   public/data/russia_regions.geojson  (smaller, enriched, ready for MapLibre)
 *
 * Operations:
 *   1. Drop features with shapeName=null (the empty Yamal-Nenets wedge).
 *   2. Further simplify geometry (tolerance=0.01) to ~1km precision for smaller bundle.
 *   3. Merge region metadata (population, livestock density, iso_code, federal_district).
 *   4. Validate that every outbreak region maps to a feature in the output.
 *   5. Write final GeoJSON.
 *
 * Usage:
 *   bun run scripts/preprocess-geo.ts
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { REGION_PROPERTIES } from "../src/data/regions";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = resolve(__dirname, "..", "legacy", "python", "data", "geo", "russia_adm1.geojson");
const OUT_PATH = resolve(__dirname, "..", "public", "data", "russia_regions.geojson");

interface GeoFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}

interface GeoCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

/** Douglas-Peucker-like simplification on a polygon ring. */
function simplifyRing(coords: number[][], tolerance: number): number[][] {
  if (coords.length < 3) return coords;
  const out: number[][] = [coords[0]];

  for (let i = 1; i < coords.length - 1; i++) {
    const prev = out[out.length - 1];
    const cur = coords[i];
    const next = coords[i + 1];

    // Perpendicular distance from cur to line (prev, next)
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) continue;
    const dist = Math.abs(dy * cur[0] - dx * cur[1] + next[0] * prev[1] - next[1] * prev[0]) / len;
    if (dist >= tolerance) out.push(cur);
  }
  out.push(coords[coords.length - 1]);
  return out;
}

/** Recursively simplify geometry coordinates. */
function simplifyGeometry(geometry: GeoFeature["geometry"], tolerance: number): GeoFeature["geometry"] {
  if (geometry.type === "Polygon") {
    return {
      ...geometry,
      coordinates: (geometry.coordinates as number[][][]).map((ring) => simplifyRing(ring, tolerance)),
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: (geometry.coordinates as number[][][][]).map((poly) =>
        poly.map((ring) => simplifyRing(ring, tolerance)),
      ),
    };
  }
  return geometry;
}

async function main() {
  console.log("=".repeat(70));
  console.log("  preprocess-geo — clean + enrich Russia ADM1 GeoJSON");
  console.log("=".repeat(70));

  // 1. Load source
  console.log(`\n[1/5] Loading ${SRC_PATH}`);
  const raw = await readFile(SRC_PATH, "utf-8");
  const src: GeoCollection = JSON.parse(raw);
  console.log(`      Loaded ${src.features.length} features`);

  // 2. Filter + enrich
  console.log("\n[2/5] Filtering null shapeName + enriching with region metadata");
  const out: GeoFeature[] = [];
  let dropped = 0;
  let enriched = 0;
  let unmatched = 0;

  for (const f of src.features) {
    const shapeName = f.properties.shapeName as string | null;
    if (!shapeName) {
      dropped++;
      continue;
    }
    const props = REGION_PROPERTIES[shapeName];
    if (!props) {
      unmatched++;
      console.warn(`      ⚠  No metadata for shapeName "${shapeName}"`);
    }
    out.push({
      type: "Feature",
      properties: {
        ...f.properties,
        ...(props ?? {
          shapeName,
          name_ru: shapeName,
          iso_code: "",
          population_mln: 0,
          pigs_per_km2: 0,
          cattle_per_km2: 0,
          poultry_per_km2: 0,
          federal_district: "",
        }),
      },
      geometry: f.geometry,
    });
    if (props) enriched++;
  }

  console.log(`      Kept: ${out.length}`);
  console.log(`      Dropped (null shapeName): ${dropped}`);
  console.log(`      Enriched with metadata: ${enriched}`);
  console.log(`      Without metadata (warning): ${unmatched}`);

  // 3. Simplify geometry
  console.log("\n[3/5] Simplifying geometry (tolerance=0.01°, ~1.1km)");
  const TOLERANCE = 0.01;
  for (const f of out) {
    f.geometry = simplifyGeometry(f.geometry, TOLERANCE);
  }

  const srcSize = raw.length;
  const result: GeoCollection = { type: "FeatureCollection", features: out };
  const resultStr = JSON.stringify(result);
  const outSize = resultStr.length;
  console.log(`      Original: ${(srcSize / 1024).toFixed(0)} KB`);
  console.log(`      Simplified: ${(outSize / 1024).toFixed(0)} KB (${((1 - outSize / srcSize) * 100).toFixed(1)}% smaller)`);

  // 4. Validate against outbreaks
  console.log("\n[4/5] Validating against outbreaks.json");
  const outbreaksRaw = await readFile(resolve(__dirname, "..", "public", "data", "outbreaks.json"), "utf-8");
  const outbreaks = JSON.parse(outbreaksRaw).outbreaks as Array<{ region_geo: string }>;
  const geoNames = new Set(out.map((f) => f.properties.shapeName as string));
  const unresolved = outbreaks.filter((o) => o.region_geo && !geoNames.has(o.region_geo));
  console.log(`      Outbreaks: ${outbreaks.length}`);
  console.log(`      With valid region_geo: ${outbreaks.length - unresolved.length}`);
  console.log(`      Unresolved: ${unresolved.length}`);
  if (unresolved.length > 0) {
    console.log("      Unresolved regions:");
    for (const o of unresolved.slice(0, 10)) {
      console.log(`        - ${o.region_geo}`);
    }
  }

  // 5. Write
  console.log("\n[5/5] Writing output");
  await writeFile(OUT_PATH, resultStr, "utf-8");
  console.log(`      ✓ ${OUT_PATH}`);
  console.log(`      Features: ${out.length}`);
  console.log(`      Size: ${(outSize / 1024).toFixed(0)} KB`);

  console.log("\n" + "=".repeat(70));
  console.log("  Done");
  console.log("=".repeat(70));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
