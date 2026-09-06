import { describe, it, expect } from "vitest";
import { applySpatialJitter, hashString } from "./jitter";

describe("Spatial Jittering", () => {
  it("should generate deterministic hash for string", () => {
    const hash1 = hashString("outbreak-123");
    const hash2 = hashString("outbreak-123");
    const hash3 = hashString("outbreak-456");

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(typeof hash1).toBe("number");
  });

  it("should return base coordinates when index is 0 and no ID provided", () => {
    const base = { lat: 55.7558, lon: 37.6173 }; // Moscow
    const result = applySpatialJitter(base, 0);

    expect(result.lat).toBe(base.lat);
    expect(result.lon).toBe(base.lon);
  });

  it("should apply non-zero offset for index > 0", () => {
    const base = { lat: 55.7558, lon: 37.6173 };
    const jittered1 = applySpatialJitter(base, 1, "outbreak-1");
    const jittered2 = applySpatialJitter(base, 2, "outbreak-2");

    expect(jittered1.lat).not.toBe(base.lat);
    expect(jittered1.lon).not.toBe(base.lon);
    expect(jittered1.lat).not.toBe(jittered2.lat);

    // Distance should be within ~25km radius (roughly <= 0.3 degrees)
    const latDiff = Math.abs(jittered1.lat - base.lat);
    const lonDiff = Math.abs(jittered1.lon - base.lon);
    expect(latDiff).toBeLessThan(0.35);
    expect(lonDiff).toBeLessThan(0.35);
  });
});
