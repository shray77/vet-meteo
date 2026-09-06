"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Outbreak, DiseaseKey } from "@/types/domain";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { diseaseColor } from "@/lib/colors";

interface SeasonalHeatmapProps {
  outbreaks: Outbreak[];
}

const MONTHS_RU = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

const MONTHS_FULL_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

/**
 * Seasonal pattern heatmap — disease × month matrix.
 *
 * Shows which months historically have the most outbreaks for each disease.
 * Helps vets time vaccination campaigns and surveillance.
 *
 * Color intensity = number of outbreaks in that month across all years
 * in the dataset.
 */
export function SeasonalHeatmap({ outbreaks }: SeasonalHeatmapProps) {
  const matrix = useMemo(() => {
    // Get top 8 diseases by total count
    const diseaseCounts = new Map<DiseaseKey, number>();
    for (const o of outbreaks) {
      diseaseCounts.set(o.disease_key, (diseaseCounts.get(o.disease_key) ?? 0) + 1);
    }
    const topDiseases = Array.from(diseaseCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([k]) => k);

    // Build matrix: disease × month = count
    const grid: Record<string, number[]> = {};
    for (const dk of topDiseases) {
      grid[dk] = new Array(12).fill(0);
    }
    for (const o of outbreaks) {
      if (!grid[o.disease_key]) continue;
      const month = new Date(o.date).getMonth();
      grid[o.disease_key][month]++;
    }

    // Find max value for normalization
    let maxVal = 1;
    for (const dk of topDiseases) {
      for (const v of grid[dk]) {
        if (v > maxVal) maxVal = v;
      }
    }

    return { topDiseases, grid, maxVal };
  }, [outbreaks]);

  if (matrix.topDiseases.length === 0) {
    return null;
  }

  // Find peak month for each disease
  const peakMonths: Record<string, number> = {};
  for (const dk of matrix.topDiseases) {
    let peakMonth = 0;
    let peakVal = 0;
    matrix.grid[dk].forEach((v, m) => {
      if (v > peakVal) {
        peakVal = v;
        peakMonth = m;
      }
    });
    peakMonths[dk] = peakMonth;
  }

  /** Get color intensity for a cell value. */
  function getCellColor(value: number, maxVal: number, diseaseKey: string): string {
    if (value === 0) return "transparent";
    const intensity = Math.min(value / maxVal, 1);
    const baseColor = diseaseColor(diseaseKey as DiseaseKey, DISEASE_LABELS[diseaseKey as DiseaseKey]?.group ?? "Multi-species");
    // Convert hex to rgba with intensity-based opacity
    const hex = baseColor.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${0.15 + intensity * 0.85})`;
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Сезонность вспышек</h3>
        <Badge variant="secondary" className="text-[10px]">
          {matrix.topDiseases.length} болезней × 12 мес.
        </Badge>
      </div>

      <div className="overflow-x-auto thin-scroll">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr>
              <th className="text-left p-1 sticky left-0 bg-background z-10">Болезнь</th>
              {MONTHS_RU.map((m, i) => (
                <th
                  key={m}
                  className={`text-center p-1 font-medium ${i === new Date().getMonth() ? "text-primary" : "text-muted-foreground"}`}
                >
                  {m}
                </th>
              ))}
              <th className="text-center p-1 text-muted-foreground">Пик</th>
            </tr>
          </thead>
          <tbody>
            {matrix.topDiseases.map((dk) => {
              const labels = DISEASE_LABELS[dk as DiseaseKey];
              const color = diseaseColor(dk as DiseaseKey, labels?.group ?? "Multi-species");
              return (
                <tr key={dk} className="border-t border-border/50">
                  <td className="p-1 sticky left-0 bg-background z-10 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-medium text-foreground">{labels?.short_ru ?? dk}</span>
                    </span>
                  </td>
                  {matrix.grid[dk].map((val, month) => (
                    <td key={month} className="p-0.5 text-center">
                      <div
                        className="h-7 min-w-[28px] rounded flex items-center justify-center font-mono tabular-nums"
                        style={{
                          backgroundColor: getCellColor(val, matrix.maxVal, dk),
                          color: val > 0 ? (val / matrix.maxVal > 0.5 ? "#fff" : "var(--foreground)") : "var(--muted-foreground)",
                        }}
                        title={`${labels?.ru ?? dk}: ${val} вспышек в ${MONTHS_FULL_RU[month]}`}
                      >
                        {val > 0 ? val : ""}
                      </div>
                    </td>
                  ))}
                  <td className="p-1 text-center text-muted-foreground">
                    {MONTHS_RU[peakMonths[dk]]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
        <span>Меньше</span>
        <div className="flex h-3 rounded overflow-hidden">
          {[0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1].map((op) => (
            <div
              key={op}
              className="w-4 h-full"
              style={{ backgroundColor: `rgba(34, 197, 94, ${op})` }}
            />
          ))}
        </div>
        <span>Больше</span>
        <span className="ml-auto">
          Текущий месяц: <span className="text-primary font-medium">{MONTHS_RU[new Date().getMonth()]}</span>
        </span>
      </div>
    </Card>
  );
}
