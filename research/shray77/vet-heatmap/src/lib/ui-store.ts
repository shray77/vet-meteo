"use client";

import { create } from "zustand";
import type { DiseaseKey, Outbreak } from "@/types/domain";

/**
 * UI state store — consolidates 25+ useState calls from page.tsx into a
 * single Zustand store. Dialog open/close state + selected items.
 *
 * Benefits:
 *   - No prop drilling — any component can call useUIStore() to read/set
 *     dialog state.
 *   - Reduces page.tsx from ~825 lines by ~80 lines (all useState + setters).
 *   - Makes dialog orchestration testable (pure store, no React tree needed).
 *   - Persists across re-renders without useEffect dependencies.
 *
 * Usage:
 *   const open = useUIStore(s => s.calcOpen);
 *   const setCalcOpen = useUIStore(s => s.setCalcOpen);
 *   // or destructure multiple:
 *   const { calcOpen, sirOpen } = useUIStore();
 */

interface UIState {
  // ─── Dialog open/close ───────────────────────────────────────────────
  drawerOpen: boolean;
  calcOpen: boolean;
  mobileFiltersOpen: boolean;
  aboutOpen: boolean;
  nearbyOpen: boolean;
  sirOpen: boolean;
  sourceTrackerOpen: boolean;
  transportOpen: boolean;
  pdfReportOpen: boolean;
  customImportOpen: boolean;
  enterpriseRiskOpen: boolean;
  spreadAnimOpen: boolean;
  regionCardOpen: boolean;
  alertOpen: boolean;
  spatialOpen: boolean;
  regionDrillDownOpen: boolean;
  outbreakDetailOpen: boolean;
  comparisonOpen: boolean;

  // ─── Selected items ──────────────────────────────────────────────────
  drawerDisease: DiseaseKey | null;
  calcPreselect: DiseaseKey | null;
  regionDrillDown: string | null;
  selectedOutbreak: Outbreak | null;

  // ─── Setters (one per field, idiomatic Zustand) ─────────────────────
  setDrawerOpen: (v: boolean) => void;
  setCalcOpen: (v: boolean) => void;
  setMobileFiltersOpen: (v: boolean) => void;
  setAboutOpen: (v: boolean) => void;
  setNearbyOpen: (v: boolean) => void;
  setSirOpen: (v: boolean) => void;
  setSourceTrackerOpen: (v: boolean) => void;
  setTransportOpen: (v: boolean) => void;
  setPdfReportOpen: (v: boolean) => void;
  setCustomImportOpen: (v: boolean) => void;
  setEnterpriseRiskOpen: (v: boolean) => void;
  setSpreadAnimOpen: (v: boolean) => void;
  setRegionCardOpen: (v: boolean) => void;
  setAlertOpen: (v: boolean) => void;
  setSpatialOpen: (v: boolean) => void;
  setRegionDrillDownOpen: (v: boolean) => void;
  setOutbreakDetailOpen: (v: boolean) => void;
  setComparisonOpen: (v: boolean) => void;

  setDrawerDisease: (v: DiseaseKey | null) => void;
  setCalcPreselect: (v: DiseaseKey | null) => void;
  setRegionDrillDown: (v: string | null) => void;
  setSelectedOutbreak: (v: Outbreak | null) => void;

  // ─── Convenience: open disease drawer ────────────────────────────────
  openDisease: (d: DiseaseKey) => void;
  // ─── Convenience: open outbreak detail panel ─────────────────────────
  openOutbreak: (o: Outbreak) => void;
  // ─── Convenience: open region drill-down ─────────────────────────────
  openRegion: (region: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // ─── Initial state ───────────────────────────────────────────────────
  drawerOpen: false,
  calcOpen: false,
  mobileFiltersOpen: false,
  aboutOpen: false,
  nearbyOpen: false,
  sirOpen: false,
  sourceTrackerOpen: false,
  transportOpen: false,
  pdfReportOpen: false,
  customImportOpen: false,
  enterpriseRiskOpen: false,
  spreadAnimOpen: false,
  regionCardOpen: false,
  alertOpen: false,
  spatialOpen: false,
  regionDrillDownOpen: false,
  outbreakDetailOpen: false,
  comparisonOpen: false,
  drawerDisease: null,
  calcPreselect: null,
  regionDrillDown: null,
  selectedOutbreak: null,

  // ─── Setters ─────────────────────────────────────────────────────────
  setDrawerOpen: (v) => set({ drawerOpen: v }),
  setCalcOpen: (v) => set({ calcOpen: v }),
  setMobileFiltersOpen: (v) => set({ mobileFiltersOpen: v }),
  setAboutOpen: (v) => set({ aboutOpen: v }),
  setNearbyOpen: (v) => set({ nearbyOpen: v }),
  setSirOpen: (v) => set({ sirOpen: v }),
  setSourceTrackerOpen: (v) => set({ sourceTrackerOpen: v }),
  setTransportOpen: (v) => set({ transportOpen: v }),
  setPdfReportOpen: (v) => set({ pdfReportOpen: v }),
  setCustomImportOpen: (v) => set({ customImportOpen: v }),
  setEnterpriseRiskOpen: (v) => set({ enterpriseRiskOpen: v }),
  setSpreadAnimOpen: (v) => set({ spreadAnimOpen: v }),
  setRegionCardOpen: (v) => set({ regionCardOpen: v }),
  setAlertOpen: (v) => set({ alertOpen: v }),
  setSpatialOpen: (v) => set({ spatialOpen: v }),
  setRegionDrillDownOpen: (v) => set({ regionDrillDownOpen: v }),
  setOutbreakDetailOpen: (v) => set({ outbreakDetailOpen: v }),
  setComparisonOpen: (v) => set({ comparisonOpen: v }),
  setDrawerDisease: (v) => set({ drawerDisease: v }),
  setCalcPreselect: (v) => set({ calcPreselect: v }),
  setRegionDrillDown: (v) => set({ regionDrillDown: v }),
  setSelectedOutbreak: (v) => set({ selectedOutbreak: v }),

  // ─── Convenience actions ─────────────────────────────────────────────
  openDisease: (d) => set({ drawerDisease: d, drawerOpen: true }),
  openOutbreak: (o) => set({ selectedOutbreak: o, outbreakDetailOpen: true }),
  openRegion: (region) => set({ regionDrillDown: region, regionDrillDownOpen: true }),
}));
