import { useState, useEffect } from "react";
import {
  DEFAULT_FILTERS,
  FilterState,
  filtersToParams,
  paramsToFilters,
} from "./filters";

export function useUrlFilters() {
  const [filters, setFilters] = useState<FilterState>(() => {
    if (typeof window === "undefined") return DEFAULT_FILTERS;
    const params = new URLSearchParams(window.location.search);
    return paramsToFilters(params);
  });

  useEffect(() => {
    const params = filtersToParams(filters);
    const basePath = process.env.NODE_ENV === "production" ? "/vet-heatmap" : "";
    const url = params.toString()
      ? `${basePath}/?${params.toString()}`
      : `${basePath}/`;
    
    // Use history.replaceState to avoid Next.js router issues in static export
    window.history.replaceState(null, "", url);
  }, [filters]);

  return [filters, setFilters] as const;
}
