/**
 * Web Worker for outbreak filtering.
 *
 * Moves the O(n) applyFilters loop off the main thread to prevent
 * UI freezes when filtering 2451 outbreaks.
 *
 * Usage in page.tsx:
 *   const worker = useMemo(() => new Worker(new URL('./filter-worker.ts', import.meta.url)), []);
 *   const filtered = useWorkerFilter(worker, data?.outbreaks ?? [], debouncedFilters);
 */

import type { Outbreak } from "@/types/domain";
import type { FilterState } from "@/lib/filters";

export interface FilterWorkerRequest {
  outbreaks: Outbreak[];
  filters: FilterState;
}

export interface FilterWorkerResponse {
  result: Outbreak[];
}

self.onmessage = (e: MessageEvent<FilterWorkerRequest>) => {
  const { outbreaks, filters } = e.data;
  const qLower = filters.query.trim().toLowerCase();

  const result = outbreaks.filter((o) => {
    if (filters.diseases.length && !filters.diseases.includes(o.disease_key)) return false;
    if (filters.species.length && !filters.species.includes(o.species)) return false;
    if (filters.statuses.length && !filters.statuses.includes(o.status)) return false;
    if (filters.federalDistricts.length && !filters.federalDistricts.includes(o.federal_district || "")) return false;
    if (filters.dateFrom && o.date < filters.dateFrom) return false;
    if (filters.dateTo && o.date > filters.dateTo) return false;
    if (qLower) {
      const hay = `${o.disease} ${o.region} ${o.species}`.toLowerCase();
      if (!hay.includes(qLower)) return false;
    }
    return true;
  });

  (self as unknown as Worker).postMessage({ result } satisfies FilterWorkerResponse);
};
