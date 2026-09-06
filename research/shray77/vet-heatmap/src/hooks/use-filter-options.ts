"use client";

import { useMemo, useState, useEffect } from "react";
import type { Outbreak, DiseaseKey } from "@/types/domain";

/**
 * Extracts filter options (diseases, species, federal districts) from
 * outbreak data with proper memoization.
 *
 * Previously this was inline useMemo in FilterPanel, recalculated on
 * every outbreaks change. Now it's a reusable hook.
 */
export function useFilterOptions(outbreaks: Outbreak[]) {
  return useMemo(() => {
    const diseaseCounts = new Map<DiseaseKey, number>();
    const speciesSet = new Set<string>();
    const districtCounts = new Map<string, number>();

    for (const o of outbreaks) {
      // Disease counts
      diseaseCounts.set(
        o.disease_key,
        (diseaseCounts.get(o.disease_key) ?? 0) + 1
      );

      // Species
      if (o.species) speciesSet.add(o.species);

      // Federal districts
      if (o.federal_district) {
        districtCounts.set(
          o.federal_district,
          (districtCounts.get(o.federal_district) ?? 0) + 1
        );
      }
    }

    return {
      diseases: Array.from(diseaseCounts.entries()).sort((a, b) => b[1] - a[1]),
      species: Array.from(speciesSet).sort(),
      districts: Array.from(districtCounts.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [outbreaks]);
}

/**
 * Debounces a value — useful for filter changes that trigger expensive
 * recomputations (map re-render, etc).
 *
 * Usage:
 *   const debouncedFilters = useDebounced(filters, 300);
 *   <OutbreakMap filters={debouncedFilters} />
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
