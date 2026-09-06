"use client";

import { AlertTriangle, Activity, MapPin, Biohazard, Download } from "lucide-react";
import type { Outbreak } from "@/types/domain";
import { exportOutbreaksCSV } from "@/lib/csv-export";

interface StatsBarProps {
  outbreaks: Outbreak[];
  totalRegions: number;
}

/**
 * Compact inline KPI bar — inspired by CDC top banner.
 * Single row on desktop, 2x2 grid on mobile.
 * Shows: total / active / regions / disease types + CSV export button.
 */
export function StatsBar({ outbreaks, totalRegions }: StatsBarProps) {
  const total = outbreaks.length;
  const ongoing = outbreaks.filter((o) => o.status === "Ongoing").length;
  const affectedRegions = new Set(outbreaks.map((o) => o.region_geo).filter(Boolean)).size;
  const diseaseTypes = new Set(outbreaks.map((o) => o.disease_key)).size;

  const items = [
    { label: "Всего", value: total, icon: Activity, color: "var(--foreground)", pulse: false },
    { label: "Активных", value: ongoing, icon: AlertTriangle, color: "var(--destructive)", pulse: ongoing > 0 },
    { label: "Регионов", value: `${affectedRegions}/${totalRegions}`, icon: MapPin, color: "var(--chart-4)", pulse: false },
    { label: "Болезней", value: diseaseTypes, icon: Biohazard, color: "var(--chart-3)", pulse: false },
  ];

  return (
    <>
      {/* Desktop: inline KPI bar + CSV export */}
      <div className="hidden md:flex items-center gap-4 px-1">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-2">
            {i > 0 && <div className="h-4 w-px bg-border" />}
            <item.icon className="h-4 w-4 shrink-0" style={{ color: item.color }} aria-hidden />
            {item.pulse && (
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
              </span>
            )}
            <span className="text-lg font-bold tabular-nums tracking-tight" style={{ color: item.color }}>
              {item.value}
            </span>
            <span className="text-xs text-muted-foreground tracking-tight">{item.label}</span>
          </div>
        ))}
        {/* CSV export button — exports currently filtered outbreaks */}
        <button
          onClick={() => exportOutbreaksCSV(outbreaks)}
          disabled={outbreaks.length === 0}
          className="flex items-center gap-1 px-2 py-1 rounded-md border border-border hover:bg-accent text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title={`Экспорт ${outbreaks.length} вспышек в CSV (Excel-совместимый)`}
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </button>
      </div>

      {/* Mobile: 2x2 compact grid */}
      <div className="md:hidden grid grid-cols-2 gap-1.5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-card border"
          >
            {item.pulse && (
              <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
              </span>
            )}
            <item.icon className="h-3.5 w-3.5 shrink-0" style={{ color: item.color }} aria-hidden />
            <span className="text-sm font-bold tabular-nums" style={{ color: item.color }}>
              {item.value}
            </span>
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}
