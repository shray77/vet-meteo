"use client";

import { create } from "zustand";

/**
 * Map state store — consolidates map-related useState from page.tsx.
 *
 * Previously these were 7 separate useState calls in page.tsx:
 *   showRiskZones, showChoropleth, densityLayer, showHeatmap,
 *   nightMode, timelineRange, mobileSheetExpanded
 *
 * Now any component can subscribe to just the fields it needs:
 *   const showRiskZones = useMapStore(s => s.showRiskZones);
 *   const toggleRiskZones = useMapStore(s => s.toggleRiskZones);
 */

export type DensityLayer = "none" | "pigs" | "cattle" | "poultry";

interface MapState {
  // ─── Layer visibility ───────────────────────────────────────────────
  showRiskZones: boolean;
  showChoropleth: boolean;
  showHeatmap: boolean;
  nightMode: boolean;

  // ─── Density layer ──────────────────────────────────────────────────
  densityLayer: DensityLayer;

  // ─── Timeline ───────────────────────────────────────────────────────
  timelineRange: { from: string | null; to: string | null };

  // ─── Mobile UI ──────────────────────────────────────────────────────
  mobileSheetExpanded: boolean;

  // ─── Setters ────────────────────────────────────────────────────────
  toggleRiskZones: () => void;
  toggleChoropleth: () => void;
  toggleHeatmap: () => void;
  toggleNightMode: () => void;
  setDensityLayer: (layer: DensityLayer) => void;
  setTimelineRange: (range: { from: string | null; to: string | null }) => void;
  setMobileSheetExpanded: (v: boolean) => void;

  // ─── Reset all layers to defaults ───────────────────────────────────
  resetLayers: () => void;
}

const DEFAULTS = {
  showRiskZones: true,
  showChoropleth: true,
  showHeatmap: false,
  nightMode: false,
  densityLayer: "none" as DensityLayer,
  timelineRange: { from: null, to: null },
  mobileSheetExpanded: false,
};

export const useMapStore = create<MapState>((set) => ({
  ...DEFAULTS,

  toggleRiskZones: () => set((s) => ({ showRiskZones: !s.showRiskZones })),
  toggleChoropleth: () => set((s) => ({ showChoropleth: !s.showChoropleth })),
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
  toggleNightMode: () => set((s) => ({ nightMode: !s.nightMode })),
  setDensityLayer: (densityLayer) => set({ densityLayer }),
  setTimelineRange: (timelineRange) => set({ timelineRange }),
  setMobileSheetExpanded: (mobileSheetExpanded) => set({ mobileSheetExpanded }),

  resetLayers: () => set(DEFAULTS),
}));
