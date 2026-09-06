"use client";

import { useMemo } from "react";
import { AlertTriangle, MapPin, Activity, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Outbreak, DiseaseKey } from "@/types/domain";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { diseaseColor } from "@/lib/colors";

interface TodaySummaryProps {
  outbreaks: Outbreak[];
  /** Total regions with outbreaks (from filter scope). */
  totalRegionsWithOutbreaks: number;
  /** Called when user clicks a top disease chip. */
  onSelectDisease?: (key: DiseaseKey) => void;
  /** Called when user clicks "показать все". */
  onShowAll?: () => void;
}

/**
 * Compact daily snapshot shown above the map.
 *
 * Layout:
 *   🔴 886 активных · 19 регионов · 8 болезней
 *   ⚠️ Топ-3: АЧС (412)  Грипп птиц (234)  Ящур (98)
 *
 * Updates instantly with filter changes — gives a 1-second snapshot
 * without requiring clicks.
 */
export function TodaySummary({
  outbreaks,
  totalRegionsWithOutbreaks,
  onSelectDisease,
}: TodaySummaryProps) {
  const stats = useMemo(() => {
    const ongoing = outbreaks.filter((o) => o.status === "Ongoing");
    const regions = new Set<string>();
    const diseases = new Map<DiseaseKey, number>();
    const totalCases = outbreaks.reduce((s, o) => s + (o.cases || 0), 0);

    for (const o of ongoing) {
      if (o.region_geo) regions.add(o.region_geo);
      diseases.set(o.disease_key, (diseases.get(o.disease_key) ?? 0) + 1);
    }

    const top3 = Array.from(diseases.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return {
      total: outbreaks.length,
      ongoing: ongoing.length,
      regions: regions.size,
      diseases: diseases.size,
      totalCases,
      top3,
    };
  }, [outbreaks]);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 border-b bg-background/60 text-xs">
      {/* Left: headline numbers */}
      <div className="flex items-center gap-1.5">
        <span
          className="inline-flex h-2 w-2 rounded-full bg-destructive"
          style={{ animation: "pulse 2s ease-in-out infinite" }}
        />
        <span className="font-semibold text-foreground tabular-nums">{stats.ongoing}</span>
        <span className="text-muted-foreground">активн.</span>
      </div>
      <span className="text-muted-foreground/40">·</span>
      <div className="flex items-center gap-1.5">
        <MapPin className="h-3 w-3 text-muted-foreground" />
        <span className="font-semibold text-foreground tabular-nums">{stats.regions}</span>
        <span className="text-muted-foreground">регионов</span>
      </div>
      <span className="text-muted-foreground/40">·</span>
      <div className="flex items-center gap-1.5">
        <Activity className="h-3 w-3 text-muted-foreground" />
        <span className="font-semibold text-foreground tabular-nums">{stats.diseases}</span>
        <span className="text-muted-foreground">болезней</span>
      </div>
      <span className="text-muted-foreground/40">·</span>
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3 text-muted-foreground" />
        <span className="font-semibold text-foreground tabular-nums">
          {stats.totalCases >= 1000 ? `${(stats.totalCases / 1000).toFixed(1)}k` : stats.totalCases}
        </span>
        <span className="text-muted-foreground">случаев</span>
      </div>

      {/* Right: top-3 diseases */}
      {stats.top3.length > 0 && (
        <>
          <span className="text-muted-foreground/40 hidden md:inline">·</span>
          <div className="hidden md:flex items-center gap-1.5 ml-auto">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            <span className="text-muted-foreground">Топ:</span>
            {stats.top3.map(([key, count]) => {
              const labels = DISEASE_LABELS[key];
              if (!labels) return null;
              const color = diseaseColor(key, labels.group);
              return (
                <button
                  key={key}
                  onClick={() => onSelectDisease?.(key)}
                  className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] transition-colors hover:bg-accent"
                  style={{ borderColor: color + "55" }}
                  title={`${labels.ru} — ${count} активных (клик — открыть профиль)`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="font-medium text-foreground">{labels.short_ru}</span>
                  <span className="text-muted-foreground tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
