"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider as RQProvider } from "@tanstack/react-query";

/**
 * React Query provider wrapper.
 *
 * Creates a single QueryClient per app lifetime with sensible defaults:
 *   - staleTime: 5 min — data considered fresh for 5 min, no refetch on
 *     window focus during that window (outbreak data updates 4×/day via CI,
 *     so 5 min is plenty).
 *   - gcTime: 30 min — unused data stays in cache 30 min (helps when user
 *     navigates between dialogs).
 *   - retry: 2 — retry failed fetches twice (handles transient network
 *     blips for field vets on flaky mobile).
 *   - refetchOnWindowFocus: false — we don't want to refetch 1.1 MB
 *     outbreaks.json every time the user switches tabs.
 *
 * The SW's stale-while-revalidate strategy handles actual data freshness —
 * React Query just manages the in-memory cache + dedup.
 */
export function QueryClientProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,    // 5 min
            gcTime: 30 * 60 * 1000,      // 30 min
            retry: 2,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
          },
        },
      }),
  );

  return <RQProvider client={client}>{children}</RQProvider>;
}
