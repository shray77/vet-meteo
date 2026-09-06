"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Outbreak, DiseaseKey } from "@/types/domain";
import { DISEASE_PROFILES_BY_KEY } from "@/data/disease-profiles";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { diseaseColor } from "@/lib/colors";

interface DiseaseComparisonProps {
  outbreaks: Outbreak[];
}

export function DiseaseComparison({ outbreaks }: DiseaseComparisonProps) {
  const comparison = useMemo(() => {
    const byDisease = new Map<DiseaseKey, {
      total: number;
      ongoing: number;
      resolved: number;
      regions: Set<string>;
      cases: number;
      deaths: number;
      firstDate: string;
      lastDate: string;
    }>();

    for (const o of outbreaks) {
      if (!byDisease.has(o.disease_key)) {
        byDisease.set(o.disease_key, {
          total: 0, ongoing: 0, resolved: 0, regions: new Set(),
          cases: 0, deaths: 0, firstDate: o.date, lastDate: o.date,
        });
      }
      const d = byDisease.get(o.disease_key)!;
      d.total++;
      if (o.status === "Ongoing") d.ongoing++;
      if (o.status === "Resolved") d.resolved++;
      d.regions.add(o.region);
      d.cases += o.cases || 0;
      d.deaths += o.deaths || 0;
      if (o.date < d.firstDate) d.firstDate = o.date;
      if (o.date > d.lastDate) d.lastDate = o.date;
    }

    return Array.from(byDisease.entries())
      .map(([key, d]) => {
        const profile = DISEASE_PROFILES_BY_KEY[key];
        const labels = DISEASE_LABELS[key];
        // Compute R0 as midpoint of range, incubation as max (most
        // conservative for surveillance planning).
        const r0 = profile ? (profile.r0_min + profile.r0_max) / 2 : 0;
        const incubation = profile?.incubation_max ?? 0;
        // Lethality: estimate from observed cases+deaths in the dataset.
        // Falls back to a heuristic based on disease group when no
        // observed deaths (e.g. for zoonoses where animal CFR isn't
        // always recorded). Range 0-100 (%).
        let lethality = 0;
        if (d.cases > 0 && d.deaths > 0) {
          lethality = Math.round((d.deaths / d.cases) * 100);
        } else if (profile) {
          // Heuristic CFR by group — based on WOAH typical mortality
          const cfrByGroup: Record<string, number> = {
            Swine: 90,        // ASF up to 100%, CSF 80-100%
            Avian: 80,        // HPAI 90-100%, Newcastle 50-90%
            Ruminant: 30,     // FMD 5%, Anthrax 80-100%, LSD 5-10%
            "Equine/Wildlife": 40,
            Wildlife: 50,
            "Multi-species": 10,
          };
          lethality = cfrByGroup[profile.group] ?? 10;
        }
        return {
          key,
          name: labels?.short_ru ?? key,
          color: diseaseColor(key, labels?.group ?? ""),
          ...d,
          regions: d.regions.size,
          r0,
          incubation,
          lethality,
          group: labels?.group ?? "Multi-species",
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [outbreaks]);

  if (comparison.length < 2) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Сравнение болезней</h3>
        <Badge variant="secondary" className="text-[10px]">{comparison.length} болезней</Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground border-b">
              <th className="text-left py-1.5 pr-2">Болезнь</th>
              <th className="text-center py-1.5 px-1">Вспыш.</th>
              <th className="text-center py-1.5 px-1">Активн.</th>
              <th className="text-center py-1.5 px-1">Регионы</th>
              <th className="text-center py-1.5 px-1">R₀</th>
              <th className="text-center py-1.5 px-1">Инкуб.</th>
              <th className="text-center py-1.5 px-1">Летал.</th>
              <th className="text-center py-1.5 px-1">Случаи</th>
              <th className="text-center py-1.5 px-1">Пало</th>
              <th className="text-center py-1.5 pl-1">Период</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((d) => (
              <tr key={d.key} className="border-b border-border/40 hover:bg-accent/20">
                <td className="py-1.5 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="font-medium">{d.name}</span>
                  </div>
                </td>
                <td className="text-center py-1.5 px-1 font-mono">{d.total}</td>
                <td className="text-center py-1.5 px-1">
                  {d.ongoing > 0 ? (
                    <span className="text-red-500 font-mono">{d.ongoing}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="text-center py-1.5 px-1 font-mono">{d.regions}</td>
                <td className="text-center py-1.5 px-1 font-mono">
                  {d.r0 > 0 ? d.r0.toFixed(1) : "—"}
                </td>
                <td className="text-center py-1.5 px-1 font-mono">
                  {d.incubation > 0 ? `${d.incubation}д` : "—"}
                </td>
                <td className="text-center py-1.5 px-1 font-mono">
                  {d.lethality > 0 ? `${d.lethality}%` : "—"}
                </td>
                <td className="text-center py-1.5 px-1 font-mono">{d.cases || "—"}</td>
                <td className="text-center py-1.5 px-1 font-mono">{d.deaths || "—"}</td>
                <td className="text-center py-1.5 pl-1 text-[10px] text-muted-foreground whitespace-nowrap">
                  {d.firstDate.slice(0, 7)}—{d.lastDate.slice(0, 7)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
