import { describe, it, expect } from "vitest";
import { diseaseColor, DISEASE_COLORS, GROUP_COLORS } from "./colors";
import type { DiseaseKey, DiseaseGroup } from "@/types/domain";

describe("diseaseColor", () => {
  it("returns specific disease color when defined", () => {
    expect(diseaseColor("asf", "Swine")).toBe(DISEASE_COLORS.asf);
    expect(diseaseColor("hpai", "Avian")).toBe(DISEASE_COLORS.hpai);
  });

  it("falls back to group color when disease color not defined", () => {
    // Use a disease key that's not in DISEASE_COLORS. All 51 real diseases
    // have colors now, so use a fake key.
    const key = "__nonexistent_disease__" as DiseaseKey;
    expect(DISEASE_COLORS[key]).toBeUndefined(); // sanity check
    expect(diseaseColor(key, "Swine")).toBe(GROUP_COLORS.Swine);
  });

  it("falls back to multi-species group color when group is unknown", () => {
    // @ts-expect-error testing invalid group
    const result = diseaseColor("unknown" as DiseaseKey, "NonexistentGroup");
    expect(result).toBe(GROUP_COLORS["Multi-species"]);
  });

  it("all 6 groups have colors", () => {
    const groups: DiseaseGroup[] = ["Avian", "Swine", "Ruminant", "Equine/Wildlife", "Wildlife", "Multi-species"];
    for (const g of groups) {
      expect(GROUP_COLORS[g]).toBeDefined();
      expect(GROUP_COLORS[g]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
