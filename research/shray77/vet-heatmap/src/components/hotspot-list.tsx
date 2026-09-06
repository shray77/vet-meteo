"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, TrendingDown } from "lucide-react";
import type { Outbreak } from "@/types/domain";
import { diseaseColor } from "@/lib/colors";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { REGION_PROPERTIES } from "@/data/regions";

interface HotspotListProps {
  outbreaks: Outbreak[];
  onSelectRegion?: (region: string) => void;
}

/**
 * Top regions by outbreak count — inspired by EMPRES-i "Latest events" list.
 * Shows the 5 most affected regions with a mini bar chart.
 */
export function HotspotList({ outbreaks, onSelectRegion }: HotspotListProps) {
  // Aggregate by region
  const byRegion = new Map<string, { total: number; ongoing: number; topDisease: string; topDiseaseKey: string; topDiseaseGroup: string }>();

  for (const o of outbreaks) {
    if (!o.region_geo) continue;
    const r = byRegion.get(o.region_geo) ?? { total: 0, ongoing: 0, topDisease: "", topDiseaseKey: "", topDiseaseGroup: "" };
    r.total++;
    if (o.status === "Ongoing") r.ongoing++;
    if (!r.topDisease) {
      r.topDisease = o.disease;
      r.topDiseaseKey = o.disease_key;
      r.topDiseaseGroup = o.disease_group;
    }
    byRegion.set(o.region_geo, r);
  }

  const sorted = Array.from(byRegion.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 5);

  if (sorted.length === 0) return null;

  const maxCount = sorted[0][1].total;

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Flame className="h-3.5 w-3.5 text-destructive" />
        <h3 className="text-xs font-semibold">Топ регионов</h3>
      </div>
      <div className="space-y-1.5">
        {sorted.map(([region, stats], i) => {
          const labels = DISEASE_LABELS[stats.topDiseaseKey as keyof typeof DISEASE_LABELS];
          const color = diseaseColor(stats.topDiseaseKey as any, stats.topDiseaseGroup as any);
          const barWidth = (stats.total / maxCount) * 100;
          return (
            <button
              key={region}
              onClick={() => onSelectRegion?.(region)}
              className="w-full text-left group"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono text-muted-foreground w-3">{i + 1}</span>
                <span className="text-xs font-medium truncate flex-1 group-hover:text-primary transition-colors">
                  {REGION_PROPERTIES[region]?.name_ru ?? region}
                </span>
                <span className="text-xs font-bold tabular-nums">{stats.total}</span>
                {stats.ongoing > 0 && (
                  <Badge variant="destructive" className="text-[9px] h-3.5 px-1 leading-none">
                    {stats.ongoing} акт.
                  </Badge>
                )}
              </div>
              {/* Mini bar */}
              <div className="flex items-center gap-1 ml-5">
                <div className="h-1.5 rounded-full overflow-hidden bg-muted flex-1">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground truncate max-w-[60px]">
                  {labels?.short_ru}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
