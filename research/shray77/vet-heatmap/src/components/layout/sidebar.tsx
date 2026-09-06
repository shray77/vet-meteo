import { useState, useRef, useEffect, useCallback } from "react";
import { FilterPanel } from "@/components/filter-panel";
import { TimelineSlider } from "@/components/timeline-slider";
import { HotspotList } from "@/components/hotspot-list";
import { EpiCurve } from "@/components/epi-curve";
import { DiseaseComparison } from "@/components/disease-comparison";
import { RiskScoreMap } from "@/components/risk-score-map";
import { OutbreaksTable } from "@/components/outbreaks-table";
import { SeasonalHeatmap } from "@/components/seasonal-heatmap";
import { useUIStore } from "@/lib/ui-store";
import type { Outbreak } from "@/types/domain";
import type { FilterState } from "@/lib/filters";

interface SidebarProps {
  outbreaks: Outbreak[];
  filtered: Outbreak[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  resetFilters: () => void;
  showRiskZones: boolean;
  setShowRiskZones: (v: boolean) => void;
  showChoropleth: boolean;
  setShowChoropleth: (v: boolean) => void;
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
  densityLayer: "none" | "pigs" | "cattle" | "poultry";
  timelineRange: { from: string | null; to: string | null };
  setTimelineRange: (r: { from: string | null; to: string | null }) => void;
  onSelectOutbreak: (o: Outbreak) => void;
  mobileSheetExpanded: boolean;
  setMobileSheetExpanded: (v: boolean) => void;
}

export function Sidebar({
  outbreaks, filtered, filters, setFilters, resetFilters,
  showRiskZones, setShowRiskZones, showChoropleth, setShowChoropleth,
  showHeatmap, setShowHeatmap, densityLayer,
  timelineRange, setTimelineRange, onSelectOutbreak,
  mobileSheetExpanded, setMobileSheetExpanded
}: SidebarProps) {
  const { setRegionDrillDown, setRegionDrillDownOpen } = useUIStore();

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return 380;
    const saved = window.localStorage.getItem("vet:sidebarWidth");
    return saved ? Math.min(Math.max(parseInt(saved, 10), 280), 720) : 380;
  });

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside
        className="hidden shrink-0 flex-col overflow-hidden border-l bg-background/60 lg:flex"
        style={{ width: `${sidebarWidth}px` }}
      >
        <SidebarResizer width={sidebarWidth} onResize={setSidebarWidth} />
        <div className="thin-scroll flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          <FilterPanel
            outbreaks={outbreaks} filters={filters} onChange={setFilters} onReset={resetFilters}
            showRiskZones={showRiskZones} onShowRiskZonesChange={setShowRiskZones}
            showChoropleth={showChoropleth} onShowChoroplethChange={setShowChoropleth}
            densityLayer={densityLayer} showHeatmap={showHeatmap} onShowHeatmapChange={setShowHeatmap}
          />
          <TimelineSlider outbreaks={outbreaks} onDateRangeChange={(from, to) => setTimelineRange({ from, to })} />
          <HotspotList outbreaks={filtered} onSelectRegion={(r) => { setRegionDrillDown(r); setRegionDrillDownOpen(true); }} />
          <EpiCurve outbreaks={filtered} />
          <DiseaseComparison outbreaks={filtered} />
          <RiskScoreMap outbreaks={filtered} />
          <OutbreaksTable outbreaks={filtered} onSelectOutbreak={onSelectOutbreak} />
        </div>
      </aside>

      {/* MOBILE BOTTOM SHEET */}
      <div
        className={`transition-all duration-300 ease-in-out border-t bg-card/95 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.15)] rounded-t-3xl flex flex-col shrink-0 lg:hidden ${
          mobileSheetExpanded ? "h-[65vh]" : "h-14"
        }`}
      >
        <button
          onClick={() => setMobileSheetExpanded(!mobileSheetExpanded)}
          className="w-full px-4 py-2.5 flex items-center justify-between shrink-0 select-none cursor-pointer text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="mx-0.5 h-1.5 w-8 rounded-full bg-muted-foreground/40 shrink-0" />
            <span className="text-xs font-semibold tracking-tight text-foreground truncate">
              📊 Аналитика и данные ({filtered.length})
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-primary font-medium shrink-0">
            <span>{mobileSheetExpanded ? "Свернуть ▼" : "Развернуть ▲"}</span>
          </div>
        </button>

        {mobileSheetExpanded && (
          <div className="thin-scroll flex-1 overflow-y-auto overscroll-contain px-4 pb-safe space-y-4 pt-1">
            <TimelineSlider outbreaks={outbreaks} onDateRangeChange={(from, to) => setTimelineRange({ from, to })} />
            <HotspotList outbreaks={filtered} onSelectRegion={(r) => { setRegionDrillDown(r); setRegionDrillDownOpen(true); }} />
            <EpiCurve outbreaks={filtered} />
            <DiseaseComparison outbreaks={filtered} />
            <SeasonalHeatmap outbreaks={filtered} />
            <RiskScoreMap outbreaks={filtered} />
            <OutbreaksTable outbreaks={filtered} onSelectOutbreak={onSelectOutbreak} />
          </div>
        )}
      </div>
    </>
  );
}

function SidebarResizer({ width, onResize }: { width: number; onResize: (w: number) => void; }) {
  const draggingRef = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 280), 720);
      onResize(newWidth);
    };
    const onUp = () => {
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.localStorage.setItem("vet:sidebarWidth", String(width));
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [onResize, width]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onResize(Math.min(width + 16, 720));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onResize(Math.max(width - 16, 280));
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
      onMouseDown={startDrag}
      onKeyDown={onKeyDown}
      className="group relative h-1 w-full cursor-col-resize shrink-0 bg-border hover:bg-primary/40 transition-colors"
    >
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />
        <div className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />
        <div className="h-0.5 w-0.5 rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}
