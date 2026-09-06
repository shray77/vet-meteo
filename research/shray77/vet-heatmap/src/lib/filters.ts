/**
 * App-wide type for filter state used by map, epi curve, and stats.
 */
import type { DiseaseKey, OutbreakStatus } from "@/types/domain";

export interface FilterState {
  /** Diseases to show. Empty = all. */
  diseases: DiseaseKey[];
  /** Species to show. Empty = all. */
  species: string[];
  /** Statuses to show. Empty = all. */
  statuses: OutbreakStatus[];
  /** Federal districts to show. Empty = all. */
  federalDistricts: string[];
  /** ISO date string. If null = no lower bound. */
  dateFrom: string | null;
  /** ISO date string. If null = no upper bound. */
  dateTo: string | null;
  /** Search query (matches disease, region, species). */
  query: string;
  /** Map center latitude (for URL sharing). Not used for filtering. */
  mapLat?: number;
  /** Map center longitude. */
  mapLng?: number;
  /** Map zoom level. */
  mapZoom?: number;
  /** Selected outbreak ID (for deep linking). */
  outbreakId?: number;
}

export const DEFAULT_FILTERS: FilterState = {
  diseases: [],
  species: [],
  statuses: [],
  federalDistricts: [],
  // Default: last 3 years — keeps data fresh
  dateFrom: (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 3);
    return d.toISOString().slice(0, 10);
  })(),
  dateTo: null,
  query: "",
};

/** Compute a single URL search params string from a FilterState. */
export function filtersToParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.diseases.length) p.set("d", f.diseases.join(","));
  if (f.species.length) p.set("sp", f.species.join(","));
  if (f.statuses.length) p.set("st", f.statuses.join(","));
  if (f.federalDistricts.length) p.set("fd", f.federalDistricts.join(","));
  if (f.dateFrom) p.set("from", f.dateFrom);
  if (f.dateTo) p.set("to", f.dateTo);
  if (f.query) p.set("q", f.query);
  if (f.mapLat != null) p.set("lat", f.mapLat.toFixed(4));
  if (f.mapLng != null) p.set("lng", f.mapLng.toFixed(4));
  if (f.mapZoom != null) p.set("z", String(Math.round(f.mapZoom)));
  if (f.outbreakId != null) p.set("oid", String(f.outbreakId));
  return p;
}

/** Parse a FilterState from URL search params (or any Record<string,string>). */
export function paramsToFilters(params: URLSearchParams | Record<string, string>): FilterState {
  const get = (k: string) =>
    params instanceof URLSearchParams ? params.get(k) : params[k] ?? null;

  const d = get("d");
  const sp = get("sp");
  const st = get("st");
  const fd = get("fd");

  return {
    diseases: d ? (d.split(",").filter(Boolean) as DiseaseKey[]) : [],
    species: sp ? sp.split(",").filter(Boolean) : [],
    statuses: st ? st.split(",").filter(Boolean) as OutbreakStatus[] : [],
    federalDistricts: fd ? fd.split(",").filter(Boolean) : [],
    dateFrom: get("from"),
    dateTo: get("to"),
    query: get("q") ?? "",
    mapLat: get("lat") ? parseFloat(get("lat")!) : undefined,
    mapLng: get("lng") ? parseFloat(get("lng")!) : undefined,
    mapZoom: get("z") ? parseFloat(get("z")!) : undefined,
    outbreakId: get("oid") ? parseInt(get("oid")!, 10) : undefined,
  };
}

/** Apply a FilterState to an outbreak list. Pure function. */
export function applyFilters<T extends {
  disease_key: DiseaseKey;
  species: string;
  status: OutbreakStatus;
  date: string;
  disease: string;
  region: string;
  federal_district?: string;
}>(outbreaks: T[], f: FilterState): T[] {
  const qLower = f.query.trim().toLowerCase();
  return outbreaks.filter((o) => {
    if (f.diseases.length && !f.diseases.includes(o.disease_key)) return false;
    if (f.species.length && !f.species.includes(o.species)) return false;
    if (f.statuses.length && !f.statuses.includes(o.status)) return false;
    if (f.federalDistricts.length && !f.federalDistricts.includes(o.federal_district || "")) return false;
    if (f.dateFrom && o.date < f.dateFrom) return false;
    if (f.dateTo && o.date > f.dateTo) return false;
    if (qLower) {
      const hay = `${o.disease} ${o.region} ${o.species}`.toLowerCase();
      if (!hay.includes(qLower)) return false;
    }
    return true;
  });
}
