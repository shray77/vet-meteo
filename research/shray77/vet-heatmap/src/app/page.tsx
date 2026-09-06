"use client";

import { useMemo, useCallback } from "react";
import { useMapStore } from "@/lib/map-store";
import { useWorkerFilter } from "@/hooks/use-worker-filter";
import { Activity, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OutbreakMap } from "@/components/outbreak-map";
import { TodaySummary } from "@/components/today-summary";
import { PwaBanners } from "@/components/pwa-banners";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { DialogManager } from "@/components/layout/dialog-manager";
import { useOutbreaks, useRegionsGeoJSON } from "@/lib/use-data";
import { useQuery } from "@tanstack/react-query";
import { useUIStore } from "@/lib/ui-store";
import { useKeyboardShortcuts } from "@/lib/use-keyboard";
import { useTheme } from "next-themes";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { useUrlFilters } from "@/lib/use-url-filters";
import { useDebounced } from "@/hooks/use-filter-options";
import type { DiseaseKey, Outbreak } from "@/types/domain";

export default function Home() {
  return <HomeContent />;
}

function HomeContent() {
  const { data, loading, error } = useOutbreaks();
  const { geo, loading: geoLoading } = useRegionsGeoJSON();
  const [filters, setFilters] = useUrlFilters();
  // 🆕 Debounce filters — prevents expensive applyFilters on every keystroke
  const debouncedFilters = useDebounced(filters, 300);

  // 🆕 Web Worker for filtering — moves O(n) filter loop off main thread
  const filterWorker = useMemo(() => {
    if (typeof Worker === "undefined") return null;
    try {
      return new Worker(new URL("../lib/filter-worker.ts", import.meta.url), { type: "module" });
    } catch {
      return null;
    }
  }, []);

  // 🆕 Map state from Zustand store (was 7 useState calls)
  const { showRiskZones, showChoropleth, densityLayer, showHeatmap, nightMode,
          timelineRange, mobileSheetExpanded,
          toggleRiskZones, toggleChoropleth, toggleHeatmap, toggleNightMode,
          setTimelineRange, setMobileSheetExpanded } = useMapStore();

  const {
    setDrawerDisease, setDrawerOpen, setCalcOpen, setCalcPreselect,
    setMobileFiltersOpen, setAboutOpen, setNearbyOpen, setSirOpen,
    openRegion, openOutbreak, selectedOutbreak
  } = useUIStore();

  const basePath = process.env.NODE_ENV === "production" ? "/vet-heatmap" : "";
  const enterprisesQuery = useQuery({
    queryKey: ["enterprises"],
    queryFn: async () => {
      const [osmRes, yandexRes] = await Promise.all([
        fetch(`${basePath}/data/enterprises.json`).then((r) => r.json()).catch(() => ({ enterprises: [] })),
        fetch(`${basePath}/data/enterprises-yandex.json`).then((r) => r.json()).catch(() => ({ enterprises: [] })),
      ]);
      const osmEnts = (osmRes.enterprises || []).filter((e: any) => typeof e.lat === "number" && typeof e.lon === "number");
      const yandexEnts = (yandexRes.enterprises || []).filter((e: any) => typeof e.lat === "number" && typeof e.lon === "number");
      return [...osmEnts, ...yandexEnts] as { id: string; name: string; type: string; lat: number; lon: number; region?: string }[];
    },
    staleTime: 30 * 60 * 1000,
  });
  const enterprises = enterprisesQuery.data ?? [];

  const regionCentroids = useMemo(() => {
    const m = new Map<string, [number, number]>();
    if (!geo) return m;
    for (const f of geo.features) {
      const name = (f.properties as { shapeName?: string }).shapeName;
      if (!name) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const visit = (coords: unknown) => {
        if (typeof (coords as number[])[0] === "number") {
          const [x, y] = coords as number[];
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        } else if (Array.isArray(coords)) {
          for (const c of coords) visit(c);
        }
      };
      visit((f.geometry as { coordinates: unknown }).coordinates);
      if (minX !== Infinity) m.set(name, [(minX + maxX) / 2, (minY + maxY) / 2]);
    }
    return m;
  }, [geo]);

  // 🆕 Use Web Worker for filtering (falls back to sync if Worker unavailable)
  const combinedFilters = useMemo(() => ({
    ...debouncedFilters,
    dateFrom: timelineRange.from ?? debouncedFilters.dateFrom,
    dateTo: timelineRange.to ?? debouncedFilters.dateTo,
  }), [debouncedFilters, timelineRange]);

  const filtered = useWorkerFilter(filterWorker, data?.outbreaks ?? [], combinedFilters);

  const totalRegions = geo?.features.length ?? 85;

  const focusRegion = useCallback((shapeName: string) => {
    openRegion(shapeName);
    window.dispatchEvent(new CustomEvent("vet:focusRegion", { detail: shapeName }));
  }, [openRegion]);

  const toggleDiseaseFilter = useCallback((key: DiseaseKey) => {
    setFilters((f) => {
      const isActive = f.diseases.includes(key);
      return { ...f, diseases: isActive ? f.diseases.filter((x) => x !== key) : [...f.diseases, key] };
    });
  }, [setFilters]);

  const resetFilters = () => setFilters(DEFAULT_FILTERS);
  const { setTheme, theme } = useTheme();

  useKeyboardShortcuts({
    onOpenFilters: () => setMobileFiltersOpen(true),
    onOpenCalculator: () => setCalcOpen(true),
    onOpenAbout: () => setAboutOpen(true),
    onOpenNearby: () => setNearbyOpen(true),
    onOpenSIR: () => setSirOpen(true),
    onResetFilters: resetFilters,
    onToggleTheme: () => setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light"),
  });

  if (loading || geoLoading) {
    return (
      <main className="h-dvh flex flex-col">
        {/* 🆕 Skeleton header */}
        <div className="h-14 border-b bg-muted/30 flex items-center px-4 gap-3">
          <div className="h-6 w-32 rounded bg-muted animate-pulse" />
          <div className="flex-1" />
          <div className="h-8 w-8 rounded bg-muted animate-pulse" />
          <div className="h-8 w-8 rounded bg-muted animate-pulse" />
        </div>
        {/* 🆕 Skeleton map area */}
        <div className="flex-1 relative bg-muted/20">
          <svg viewBox="0 0 1000 600" className="w-full h-full">
            <path
              d="M 150,200 Q 300,150 500,180 T 800,250 Q 850,300 700,350 T 400,400 Q 200,380 150,300 Z"
              fill="none"
              stroke="hsl(var(--muted-foreground) / 0.2)"
              strokeWidth="2"
              className="animate-pulse"
            />
            <path
              d="M 200,250 Q 350,220 550,260 T 750,320"
              fill="none"
              stroke="hsl(var(--muted-foreground) / 0.15)"
              strokeWidth="1.5"
              className="animate-pulse"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <div className="text-sm font-medium">Загрузка данных…</div>
              <div className="text-xs text-muted-foreground">
                {data?.total_outbreaks ?? 1300}+ вспышек и {geo?.features.length ?? 85} регионов
              </div>
            </div>
          </div>
        </div>
        {/* 🆕 Skeleton sidebar */}
        <div className="hidden md:block w-80 border-l bg-muted/30 p-4 space-y-3">
          <div className="h-6 w-24 rounded bg-muted animate-pulse" />
          <div className="h-10 w-full rounded bg-muted animate-pulse" />
          <div className="h-10 w-full rounded bg-muted animate-pulse" />
          <div className="h-6 w-20 rounded bg-muted animate-pulse mt-4" />
          <div className="h-8 w-full rounded bg-muted animate-pulse" />
          <div className="h-8 w-full rounded bg-muted animate-pulse" />
          <div className="h-8 w-full rounded bg-muted animate-pulse" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="h-dvh flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-md">
          <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
          <h2 className="text-lg font-semibold">Не удалось загрузить данные</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => window.location.reload()}>Попробовать снова</Button>
        </div>
      </main>
    );
  }

  return (
    <main className={`flex h-dvh flex-col overflow-hidden bg-background ${nightMode ? "night-mode" : ""}`}>
      <PwaBanners />

      <Header
        outbreaks={data?.outbreaks ?? []} filtered={filtered} filters={filters} setFilters={setFilters as any}
        totalRegions={totalRegions} focusRegion={focusRegion} toggleDiseaseFilter={toggleDiseaseFilter}
        resetFilters={resetFilters} nightMode={nightMode} setNightMode={toggleNightMode}
        showRiskZones={showRiskZones} setShowRiskZones={(v) => useMapStore.setState({ showRiskZones: v })}
        showChoropleth={showChoropleth} setShowChoropleth={(v) => useMapStore.setState({ showChoropleth: v })}
        showHeatmap={showHeatmap} setShowHeatmap={(v) => useMapStore.setState({ showHeatmap: v })} densityLayer={densityLayer}
      />

      <div className="hidden md:block">
        <TodaySummary
          outbreaks={filtered}
          totalRegionsWithOutbreaks={totalRegions}
          onSelectDisease={(k) => { setDrawerDisease(k); setDrawerOpen(true); }}
        />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="relative min-h-0 flex-1 overflow-hidden">
          <OutbreakMap
            outbreaks={filtered}
            geo={geo}
            regionCentroids={regionCentroids}
            selectedOutbreak={selectedOutbreak}
            showRiskZones={showRiskZones}
            showChoropleth={showChoropleth}
            densityLayer={densityLayer}
            showHeatmap={showHeatmap}
            onSelectOutbreak={openOutbreak}
            onSelectRegion={openRegion}
            initialCenter={filters.mapLng != null && filters.mapLat != null ? [filters.mapLng, filters.mapLat] : undefined}
            initialZoom={filters.mapZoom}
            onMapMove={(center, zoom) => setFilters((f) => ({ ...f, mapLng: center[0], mapLat: center[1], mapZoom: zoom }))}
          />
          <MobileFloatingStats filtered={filtered} />
          <MapLegend densityLayer={densityLayer} updated={data?.updated} sources={data?.sources} />
        </section>

        <Sidebar
          outbreaks={data?.outbreaks ?? []} filtered={filtered} filters={filters} setFilters={setFilters as any}
          resetFilters={resetFilters} showRiskZones={showRiskZones} setShowRiskZones={(v) => useMapStore.setState({ showRiskZones: v })}
          showChoropleth={showChoropleth} setShowChoropleth={(v) => useMapStore.setState({ showChoropleth: v })} showHeatmap={showHeatmap}
          setShowHeatmap={(v) => useMapStore.setState({ showHeatmap: v })} densityLayer={densityLayer}
          timelineRange={timelineRange} setTimelineRange={setTimelineRange} onSelectOutbreak={openOutbreak}
          mobileSheetExpanded={mobileSheetExpanded} setMobileSheetExpanded={setMobileSheetExpanded}
        />
      </div>

      <DialogManager
        outbreaks={data?.outbreaks ?? []} filtered={filtered} geo={geo}
        enterprises={enterprises} regionCentroids={regionCentroids}
      />
    </main>
  );
}

function MobileFloatingStats({ filtered }: { filtered: Outbreak[] }) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 flex gap-2 md:hidden">
      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-full border border-white/15 bg-card/60 shadow-lg backdrop-blur-xl">
        <span className="text-sm font-bold tabular-nums leading-none text-foreground">{filtered.length}</span>
        <span className="mt-0.5 text-[7px] uppercase text-muted-foreground">всего</span>
      </div>
      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-full border border-white/15 bg-card/60 shadow-lg backdrop-blur-xl">
        <span className="text-sm font-bold tabular-nums leading-none text-destructive">
          {filtered.filter((o) => o.status === "Ongoing").length}
        </span>
        <span className="mt-0.5 text-[7px] uppercase text-muted-foreground">активн.</span>
      </div>
    </div>
  );
}

function MapLegend({ densityLayer, updated, sources }: { densityLayer: string, updated?: string, sources?: string[] }) {
  return (
    <div className="absolute bottom-3 right-3 z-20 max-w-[220px] rounded-2xl border border-white/15 bg-card/60 p-3 text-[10px] shadow-2xl backdrop-blur-xl pointer-events-auto">
      <div className="font-semibold text-foreground mb-1.5">Зоны риска</div>
      <LegendRow color="#D32F2F" label="Защита (3 км)" />
      <LegendRow color="#F57C00" label="Наблюдение (10 км)" />
      <LegendRow color="#1565C0" label="Ограничение (30 км)" />
      <div className="pt-1.5 mt-1.5 border-t border-white/10">
        <div className="font-semibold text-foreground mb-1">Плотность</div>
        <div className="flex gap-1">
          {[
            { v: "none", label: "Нет", color: "var(--muted)" },
            { v: "pigs", label: "Св.", color: "#fb6a4a" },
            { v: "cattle", label: "КРС", color: "#74c476" },
            { v: "poultry", label: "Птц.", color: "#fe9929" },
          ].map((opt) => (
            <div key={opt.v} className={`px-1.5 py-0.5 rounded text-[9px] border transition-all ${densityLayer === opt.v ? "bg-foreground text-background" : "bg-transparent"}`} style={densityLayer === opt.v ? {} : { borderColor: opt.color, color: opt.color }}>{opt.label}</div>
          ))}
        </div>
      </div>
      <div className="pt-1.5 mt-1.5 border-t border-white/10 text-muted-foreground">
        <div>Данные актуальны на: <span className="text-foreground font-medium">{updated ?? "—"}</span></div>
        <div className="text-[9px] mt-0.5">Источники: {sources?.join(", ")}</div>
      </div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color, opacity: 0.5 }} />
      <span className="text-foreground">{label}</span>
    </div>
  );
}
