import { describe, it, expect } from "vitest";
import { mergeOutbreaks } from "./merge";
import type { Outbreak, SourceKey } from "../../src/types/domain";

function makeOutbreak(overrides: Partial<Outbreak> = {}): Outbreak {
  return {
    id: 0,  // mergeOutbreaks reassigns IDs
    disease_key: "asf",
    disease: "АЧС",
    disease_group: "Swine",
    region: "Москва",
    region_geo: "Moskva",
    date: "2024-06-15",
    species: "Swine (domestic)",
    cases: 100,
    deaths: 50,
    status: "Ongoing",
    source: "fsvps",
    source_url: "",
    notes: "",
    ...overrides,
  };
}

describe("mergeOutbreaks", () => {
  it("returns empty array for empty input", () => {
    expect(mergeOutbreaks([])).toEqual([]);
  });

  it("passes through single source without changes (except ID reassignment)", () => {
    const o = makeOutbreak({ cases: 100, region: "Москва" });
    const result = mergeOutbreaks([{ source: "fsvps", outbreaks: [o] }]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);  // IDs reassigned starting from 1
    expect(result[0].cases).toBe(100);
    expect(result[0].region).toBe("Москва");
  });

  it("deduplicates outbreaks with same disease + region + date bucket", () => {
    const o1 = makeOutbreak({ source: "fsvps" as SourceKey, cases: 100 });
    const o2 = makeOutbreak({ source: "wahis" as SourceKey, cases: 150 });  // same dedup key
    const result = mergeOutbreaks([
      { source: "fsvps", outbreaks: [o1] },
      { source: "wahis", outbreaks: [o2] },
    ]);
    expect(result).toHaveLength(1);
    // FSVPS wins source priority, but cases = max(100, 150) = 150
    expect(result[0].cases).toBe(150);
    expect(result[0].source).toBe("fsvps");
  });

  it("keeps separate outbreaks with different regions", () => {
    const o1 = makeOutbreak({ region: "Москва", region_geo: "Moskva" });
    const o2 = makeOutbreak({ region: "Воронеж", region_geo: "Voronezh" });
    const result = mergeOutbreaks([{ source: "fsvps", outbreaks: [o1, o2] }]);
    expect(result).toHaveLength(2);
  });

  it("keeps separate outbreaks with different diseases", () => {
    const o1 = makeOutbreak({ disease_key: "asf", disease: "АЧС" });
    const o2 = makeOutbreak({ disease_key: "csf", disease: "КЧС" });
    const result = mergeOutbreaks([{ source: "fsvps", outbreaks: [o1, o2] }]);
    expect(result).toHaveLength(2);
  });

  it("deduplicates by 7-day date bucket (same week = same key)", () => {
    const o1 = makeOutbreak({ date: "2024-06-15" });  // Saturday
    const o2 = makeOutbreak({ date: "2024-06-17" });  // Monday next week, but same bucket?
    // Date bucket floors to 7-day windows. Let's check: 2024-06-15 is day 19882 (epoch days).
    // 19882 / 7 = 2840.28 → bucket 2840 * 7 = 19880 → 2024-06-13.
    // 2024-06-17 = day 19884 / 7 = 2840.57 → bucket 2840 * 7 = 19880 → same bucket.
    const result = mergeOutbreaks([{ source: "fsvps", outbreaks: [o1, o2] }]);
    expect(result).toHaveLength(1);
  });

  it("keeps separate outbreaks in different week buckets", () => {
    const o1 = makeOutbreak({ date: "2024-06-15" });
    const o2 = makeOutbreak({ date: "2024-06-25" });  // 10 days later, different bucket
    const result = mergeOutbreaks([{ source: "fsvps", outbreaks: [o1, o2] }]);
    expect(result).toHaveLength(2);
  });

  it("prefers specific region over country-level in dedup", () => {
    const countryLevel = makeOutbreak({
      source: "wahis" as SourceKey,
      region: "Russia",
      region_geo: "",
      cases: 200,
    });
    const specific = makeOutbreak({
      source: "fsvps" as SourceKey,
      region: "Москва",
      region_geo: "Moskva",
      cases: 100,
    });
    const result = mergeOutbreaks([
      { source: "wahis", outbreaks: [countryLevel] },
      { source: "fsvps", outbreaks: [specific] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].region).toBe("Москва");
    expect(result[0].cases).toBe(200);  // max of both
  });

  it("Ongoing status wins over Resolved in merge", () => {
    const resolved = makeOutbreak({ source: "fsvps" as SourceKey, status: "Resolved" });
    const ongoing = makeOutbreak({ source: "wahis" as SourceKey, status: "Ongoing" });
    const result = mergeOutbreaks([
      { source: "fsvps", outbreaks: [resolved] },
      { source: "wahis", outbreaks: [ongoing] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("Ongoing");
  });

  it("reassigns sequential IDs starting from 1", () => {
    const outbreaks = [
      makeOutbreak({ region: "Москва", region_geo: "Moskva" }),
      makeOutbreak({ region: "Воронеж", region_geo: "Voronezh" }),
      makeOutbreak({ region: "Казань", region_geo: "Tatarstan" }),
    ];
    const result = mergeOutbreaks([{ source: "fsvps", outbreaks }]);
    expect(result.map((o) => o.id)).toEqual([1, 2, 3]);
  });

  it("combines notes from multiple sources", () => {
    const o1 = makeOutbreak({ source: "fsvps" as SourceKey, notes: "FSVPS report" });
    const o2 = makeOutbreak({ source: "wahis" as SourceKey, notes: "WAHIS data" });
    const result = mergeOutbreaks([
      { source: "fsvps", outbreaks: [o1] },
      { source: "wahis", outbreaks: [o2] },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].notes).toContain("FSVPS report");
    expect(result[0].notes).toContain("WAHIS data");
  });
});
