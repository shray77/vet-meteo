/**
 * Species label translation (EN canonical key → RU display label).
 *
 * Canonical keys are used in data (outbreaks.json, disease-profiles.ts)
 * because they're stable across sources. Display layer translates to RU
 * so users never see English species names mixed with Russian UI.
 */

import type { SusceptibleSpecies, DiseaseGroup, SourceKey } from "@/types/domain";

const SPECIES_RU: Record<SusceptibleSpecies, string> = {
  Cattle: "КРС",
  Sheep: "Овцы",
  Goats: "Козы",
  "Sheep/Goats": "МРС",
  "Swine (domestic)": "Свиньи",
  "Wild boar": "Дикие кабаны",
  Poultry: "Птица",
  "Wild birds": "Дикие птицы",
  Horse: "Лошади",
  Fox: "Лисы",
  Wolf: "Волки",
  "Raccoon dog": "Енотовидные собаки",
  "Fox/Wolf": "Лисы/волки",
  "Fox/Raccoon dog": "Лисы/енотовидные собаки",
  Other: "Прочее",
};

const GROUP_RU: Record<DiseaseGroup, string> = {
  Avian: "Птицы",
  Swine: "Свиньи",
  Ruminant: "Жвачные",
  "Equine/Wildlife": "Лошади/Дикие",
  Wildlife: "Дикие животные",
  "Multi-species": "Множество видов",
};

const SOURCE_RU: Record<SourceKey, string> = {
  fsvps: "Россельхознадзор",
  wahis: "WOAH WAHIS",
  efsa: "EFSA ADIS",
  curated: "Кураторская база",
};

/**
 * Translate a species key (or arbitrary string) to RU.
 * If the input is already RU or unknown, returns as-is.
 */
export function speciesRu(s: string): string {
  if (s in SPECIES_RU) return SPECIES_RU[s as SusceptibleSpecies];
  const lower = s.toLowerCase();
  if (/cattle|cow|bovine|крс|крупн/.test(lower)) return "КРС";
  if (/sheep|овц/.test(lower)) return "Овцы";
  if (/goat|коз/.test(lower)) return "Козы";
  if (/swine|pig|свин|свинь/.test(lower)) return "Свиньи";
  if (/wild boar|кабан/.test(lower)) return "Дикие кабаны";
  if (/poultry|bird|птиц/.test(lower)) return "Птица";
  if (/horse|лошад|кон/.test(lower)) return "Лошади";
  if (/fox|лис/.test(lower)) return "Лисы";
  if (/wolf|волк/.test(lower)) return "Волки";
  if (/raccoon|енот/.test(lower)) return "Енотовидные собаки";
  if (/wildlife|дикие/.test(lower)) return "Дикие животные";
  return s;
}

export function groupRu(g: DiseaseGroup): string {
  return GROUP_RU[g] ?? g;
}

export function sourceRu(s: SourceKey): string {
  return SOURCE_RU[s] ?? s;
}
