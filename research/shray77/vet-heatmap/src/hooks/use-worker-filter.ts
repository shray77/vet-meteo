"use client";

import { useState, useEffect, useMemo } from "react";
import type { Outbreak } from "@/types/domain";
import type { FilterState } from "@/lib/filters";

/**
 * Hook: useWorkerFilter
 *
 * Filters outbreaks in a Web Worker to prevent UI freezes.
 * Falls back to synchronous filtering if Worker is unavailable.
 *
 * Usage:
 *   const worker = useMemo(() =>
 *     typeof Worker !== 'undefined'
 *       ? new Worker(new URL('../lib/filter-worker.ts', import.meta.url), { type: 'module' })
 *       : null
 *   , []);
 *   const filtered = useWorkerFilter(worker, allOutbreaks, debouncedFilters);
 */

export function useWorkerFilter(
  worker: Worker | null,
  outbreaks: Outbreak[],
  filters: FilterState
): Outbreak[] {
  const [filtered, setFiltered] = useState<Outbreak[]>([]);
  const [version, setVersion] = useState(0);

  // Fallback: synchronous filter (used when Worker is unavailable, or while
  // waiting for the Worker's first response on the initial render).
  const syncFiltered = useMemo(() => {
    if (worker) return filtered; // Worker handles it
    const qLower = filters.query.trim().toLowerCase();
    return outbreaks.filter((o) => {
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
  }, [outbreaks, filters, worker, filtered]);

  // Only post to the Worker when there is actual work to do. The empty-
  // outbreaks case is handled directly in the render body (below), so we
  // never need to call setState synchronously inside this effect.
  useEffect(() => {
    if (!worker) return;
    if (outbreaks.length === 0) return;

    let cancelled = false;

    const handleResult = (e: MessageEvent) => {
      if (!cancelled) {
        setFiltered(e.data.result);
        setVersion((v) => v + 1);
      }
    };

    worker.addEventListener("message", handleResult);
    worker.postMessage({ outbreaks, filters });

    return () => {
      cancelled = true;
      worker.removeEventListener("message", handleResult);
    };
  }, [worker, outbreaks, filters]);

  // No Worker available — use the synchronous filter result.
  if (!worker) return syncFiltered;

  // Empty outbreaks — result is always empty. Return [] directly instead of
  // falling through to the (potentially stale) `filtered` state from a
  // previous non-empty run.
  if (outbreaks.length === 0) return [];

  // Worker is active but hasn't responded yet (first render) — fall back
  // to the synchronous result so the UI shows something immediately.
  if (version === 0) return syncFiltered;

  return filtered;
}
