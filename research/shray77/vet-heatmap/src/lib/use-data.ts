"use client";

import { useQuery } from "@tanstack/react-query";
import type { OutbreakDataset, DiseaseProfile } from "@/types/domain";
import { DISEASE_PROFILES } from "@/data/disease-profiles";

/**
 * Data fetching hooks powered by React Query.
 *
 * Benefits over the previous hand-rolled useState+useEffect:
 *   - Automatic dedup: multiple components calling useOutbreaks() share
 *     one fetch (was: each component fetched independently).
 *   - Background refresh: data auto-refreshes when stale (5 min) without
 *     user action.
 *   - Retry on error: transient network failures retry twice.
 *   - Cache: navigations between dialogs don't re-fetch.
 *
 * The service worker's stale-while-revalidate handles HTTP-level caching;
 * React Query manages the in-memory cache on top.
 */

import { applySpatialJitter } from "@/lib/jitter";

const basePath = process.env.NODE_ENV === "production" ? "/vet-heatmap" : "";

interface LoadState {
  data: OutbreakDataset | null;
  loading: boolean;
  error: string | null;
}

export function useOutbreaks(): LoadState & {
  profiles: DiseaseProfile[];
  profilesByKey: Record<string, DiseaseProfile>;
} {
  const query = useQuery({
    queryKey: ["outbreaks"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/data/outbreaks.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rawData = (await res.json()) as OutbreakDataset;

      // Group outbreaks by region to apply spatial jittering when coordinates stack
      const regionCounters: Record<string, number> = {};
      const jitteredOutbreaks = rawData.outbreaks.map((ob) => {
        const key = ob.region_geo || ob.region;
        const count = regionCounters[key] || 0;
        regionCounters[key] = count + 1;

        if (count > 0 && typeof ob.lat === "number" && typeof ob.lon === "number") {
          const jittered = applySpatialJitter({ lat: ob.lat, lon: ob.lon }, count, String(ob.id));
          return {
            ...ob,
            lat: jittered.lat,
            lon: jittered.lon,
          };
        }
        return ob;
      });

      return {
        ...rawData,
        outbreaks: jitteredOutbreaks,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const profilesByKey = Object.fromEntries(
    DISEASE_PROFILES.map((p) => [p.disease_key, p]),
  );

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
    profiles: DISEASE_PROFILES,
    profilesByKey,
  };
}

/** Load the GeoJSON regions layer. */
export function useRegionsGeoJSON() {
  const query = useQuery({
    queryKey: ["regions-geojson"],
    queryFn: async () => {
      const res = await fetch(`${basePath}/data/russia_regions.geojson`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as GeoJSON.FeatureCollection;
    },
    staleTime: 60 * 60 * 1000, // 1 hour — geo data rarely changes
  });

  return {
    geo: query.data ?? null,
    loading: query.isLoading,
    error: query.error?.message ?? null,
  };
}

export { basePath };
