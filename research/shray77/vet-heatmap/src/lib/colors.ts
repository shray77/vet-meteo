/**
 * Disease group color palette — single source of truth.
 * Used by: map markers, epi curve bars, filter chips, legend.
 */

import type { DiseaseGroup, DiseaseKey } from "@/types/domain";

export const GROUP_COLORS: Record<DiseaseGroup, string> = {
  Avian: "#D32F2F",         // red
  Swine: "#7B1FA2",         // purple
  Ruminant: "#1565C0",      // blue
  "Equine/Wildlife": "#F57C00", // amber
  Wildlife: "#2E7D32",      // dark green
  "Multi-species": "#5D4037", // brown
};

/** Specific color per disease (overrides group color when we want distinction). */
export const DISEASE_COLORS: Partial<Record<DiseaseKey, string>> = {
  // ─── Swine ──────────────────────────────────────────────────────────
  asf: "#6A1B9A",        // ASF — deep purple (distinguish from CSF)
  csf: "#AD1457",        // CSF — magenta
  prrs: "#5E35B1",       // PRRS — indigo (purple family)
  erysipelas: "#EC407A", // Рожа — pink (skin lesions)
  tesch: "#8E24AA",      // Teschen — purple (neuro swine)
  svd: "#7E57C2",        // SVD — light purple (vesicular)
  tge: "#9575CD",        // TGE — lavender (enteric)
  // ─── Ruminant ───────────────────────────────────────────────────────
  fmd: "#0D47A1",        // FMD — navy
  anthrax: "#3E2723",    // Anthrax — dark brown (soil-borne)
  bluetongue: "#283593", // Bluetongue — indigo
  brucellosis: "#00838F", // Brucellosis — teal
  btb: "#4E342E",        // Bovine TB — brown
  ppr: "#4527A0",        // PPR — deep violet
  lsd: "#558B2F",        // LSD — olive green
  leukosis: "#37474F",   // Leukosis — blue-grey
  bvd: "#1E88E5",        // BVD — bright blue
  ibr: "#1565C0",        // IBR — strong blue (respiratory)
  paratub: "#5D4037",    // Paratub — brown (chronic GI)
  blackleg: "#6D4C41",   // Эмкар — brown (muscle/blackleg)
  sgp: "#7B1FA2",        // Sheep/Goat Pox — purple (pox-like)
  cbpp: "#00695C",       // CBPP — dark teal (pleuropneumonia)
  mcf: "#455A64",        // MCF — blue-grey (mucosal)
  pasteurellosis: "#00897B", // Pasteurellosis — teal
  bse: "#37474F",        // BSE — slate (TSE)
  scrapie: "#546E7A",    // Scrapie — slate (TSE)
  // ─── Avian ──────────────────────────────────────────────────────────
  hpai: "#C62828",       // HPAI — bright red
  newcastle: "#EF6C00",  // Newcastle — orange
  avian_salmonellosis: "#E65100", // Salmonellosis — dark orange
  gumboro: "#D84315",    // Gumboro — deep orange
  marek: "#BF360C",      // Marek — red-brown (lymphoid)
  ilt: "#E64A19",        // ILT — orange-red
  ib: "#F4511E",         // IB — orange
  eds: "#FF7043",        // EDS — light orange
  pullorum: "#FF5722",   // Pullorum — orange-red
  rhd: "#A1887F",        // RHD — rabbit brown
  myxomatosis: "#8D6E63", // Myxomatosis — brown (rabbit)
  // ─── Equine / Wildlife ──────────────────────────────────────────────
  rabies: "#1B5E20",     // Rabies — deep green
  wnv: "#FF8F00",        // WNV — golden amber
  eia: "#880E4F",        // EIA — dark magenta
  trichinellosis: "#5D4037", // Trichinellosis — brown
  svc: "#00897B",        // SVC — teal (fish)
  glanders: "#33691E",   // Glanders — dark olive (zoonotic, severe)
  eva: "#558B2F",        // EVA — olive green (equine)
  equine_flu: "#689F38", // Equine flu — green
  strangles: "#7CB342",  // Strangles — bright green
  dourine: "#33691E",    // Dourine — dark olive (equine STD)
  // ─── Bees ───────────────────────────────────────────────────────────
  varroosis: "#F9A825",  // Varroosis — amber (bees)
  nosemosis: "#FBC02D",  // Nosemosis — yellow (bees)
  afb: "#F57F17",        // American FB — dark amber (bees, severe)
  efb: "#F9A825",        // European FB — amber (bees, milder)
  // ─── Multi-species / Zoonotic ───────────────────────────────────────
  lepto: "#6D4C41",      // Lepto — brown
  qfever: "#3E2723",     // Q Fever — dark brown (zoonotic, soil)
  tularaemia: "#1B5E20", // Tularaemia — green (zoonotic, wildlife)
  listeriosis: "#5D4037", // Listeriosis — brown
  echinococcosis: "#3E2723", // Echinococcosis — dark brown (parasite)
  toxoplasmosis: "#37474F", // Toxoplasmosis — slate
  yersiniosis: "#546E7A", // Yersiniosis — slate
  other: "#757575",
};

export function diseaseColor(key: DiseaseKey, group: DiseaseGroup): string {
  return DISEASE_COLORS[key] ?? GROUP_COLORS[group] ?? GROUP_COLORS["Multi-species"];
}
