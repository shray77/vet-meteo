import { describe, it, expect } from "vitest";
import { normalizeDisease, DISEASE_LABELS, getDiseaseLabels } from "./diseases-normalize";

describe("normalizeDisease", () => {
  it("handles Russian names", () => {
    expect(normalizeDisease("Африканская чума свиней")).toBe("asf");
    expect(normalizeDisease("Ящур")).toBe("fmd");
    expect(normalizeDisease("Грипп птиц")).toBe("hpai");
  });

  it("handles English names", () => {
    expect(normalizeDisease("African Swine Fever")).toBe("asf");
    expect(normalizeDisease("Foot and Mouth Disease")).toBe("fmd");
  });

  it("handles abbreviations", () => {
    expect(normalizeDisease("АЧС")).toBe("asf");
    expect(normalizeDisease("ASF")).toBe("asf");
    expect(normalizeDisease("FMD")).toBe("fmd");
  });

  it("handles case insensitively", () => {
    expect(normalizeDisease("африканская чума свиней")).toBe("asf");
    expect(normalizeDisease("ASF")).toBe("asf");
    expect(normalizeDisease("asf")).toBe("asf");
  });

  it("handles substring matches for long forms", () => {
    expect(normalizeDisease("Avian Influenza (HPAI H5N1) — details")).toBe("hpai");
    expect(normalizeDisease("Записка об АЧС в регионе")).toBe("asf");
  });

  it("returns 'other' for unknown diseases", () => {
    expect(normalizeDisease("Неизвестная болезнь")).toBe("other");
    expect(normalizeDisease("")).toBe("other");
  });

  it("handles ё/е variants", () => {
    expect(normalizeDisease("Бруцеллёз")).toBe("brucellosis");
    expect(normalizeDisease("Бруцеллез")).toBe("brucellosis");
  });

  it("all 51 disease keys have labels", () => {
    // The catalog was expanded from 21 → 51 diseases per Приказ МСХ №62.
    // Every key in DISEASE_LABELS should round-trip via getDiseaseLabels.
    const expectedKeys = [
      "asf", "csf", "prrs", "erysipelas", "tesch", "svd", "tge",
      "fmd", "anthrax", "bluetongue", "brucellosis", "btb", "ppr", "lsd",
      "leukosis", "bvd", "ibr", "paratub", "blackleg", "sgp", "cbpp", "mcf",
      "pasteurellosis", "bse", "scrapie",
      "hpai", "newcastle", "avian_salmonellosis", "gumboro", "marek", "ilt",
      "ib", "eds", "pullorum", "rhd", "myxomatosis",
      "rabies", "wnv", "eia", "trichinellosis", "svc", "glanders", "eva",
      "equine_flu", "strangles", "dourine",
      "varroosis", "nosemosis", "afb", "efb",
      "lepto", "qfever", "tularaemia", "listeriosis", "echinococcosis",
      "toxoplasmosis", "yersiniosis",
      "other",
    ];
    for (const key of expectedKeys) {
      expect(DISEASE_LABELS[key as keyof typeof DISEASE_LABELS]).toBeDefined();
      const labels = getDiseaseLabels(key as any);
      expect(labels.ru).toBeTruthy();
      expect(labels.en).toBeTruthy();
      expect(labels.short_ru).toBeTruthy();
      expect(labels.group).toBeTruthy();
    }
  });
});
