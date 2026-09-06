"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Outbreak, DiseaseKey } from "@/types/domain";
import { REGION_PROPERTIES } from "@/data/regions";
import { DISEASE_PROFILES_BY_KEY } from "@/data/disease-profiles";
import { diseaseColor } from "@/lib/colors";

interface RiskScoreProps {
  outbreaks: Outbreak[];
}

interface RegionRisk {
  region: string;
  name_ru: string;
  federal_district: string;
  score: number;
  diseases: { key: DiseaseKey; name: string; group: string; outbreaks: number; r0: number; density: number; contribution: number }[];
}

export function RiskScoreMap({ outbreaks }: RiskScoreProps) {
  const regionRisks = useMemo(() => {
    const byRegion = new Map<string, { outbreaks: number; diseases: Map<DiseaseKey, number> }>();

    for (const o of outbreaks) {
      const region = o.region_geo || o.region;
      if (!byRegion.has(region)) {
        byRegion.set(region, { outbreaks: 0, diseases: new Map() });
      }
      const r = byRegion.get(region)!;
      r.outbreaks++;
      r.diseases.set(o.disease_key, (r.diseases.get(o.disease_key) ?? 0) + 1);
    }

    const risks: RegionRisk[] = [];
    for (const [region, data] of byRegion) {
      const props = REGION_PROPERTIES[region];
      if (!props) continue;

      let totalScore = 0;
      const diseases: RegionRisk["diseases"] = [];

      for (const [dkey, count] of data.diseases) {
        const profile = DISEASE_PROFILES_BY_KEY[dkey];
        // Use r0_max as the upper bound of transmission potential —
        // more epidemiologically meaningful than the (non-existent) r0 field.
        const r0 = profile?.r0_max ?? 1.5;
        // Get density based on disease group — matches DiseaseGroup type
        // ("Avian" | "Swine" | "Ruminant" | "Equine/Wildlife" | "Wildlife" | "Multi-species")
        let density = 1;
        const group = profile?.group ?? "Multi-species";
        if (group === "Swine") density = props.pigs_per_km2;
        else if (group === "Ruminant") density = props.cattle_per_km2;
        else if (group === "Avian") density = props.poultry_per_km2;
        else density = (props.pigs_per_km2 + props.cattle_per_km2 + props.poultry_per_km2) / 3;

        const contribution = count * r0 * density * 0.1;
        totalScore += contribution;
        diseases.push({
          key: dkey,
          name: profile?.name_ru ?? dkey,
          group: profile?.group ?? "Multi-species",
          outbreaks: count,
          r0,
          density,
          contribution: Math.round(contribution),
        });
      }

      diseases.sort((a, b) => b.contribution - a.contribution);

      risks.push({
        region,
        name_ru: props.name_ru,
        federal_district: props.federal_district,
        score: Math.round(totalScore),
        diseases: diseases.slice(0, 5),
      });
    }

    return risks.sort((a, b) => b.score - a.score).slice(0, 15);
  }, [outbreaks]);

  const maxScore = Math.max(1, ...regionRisks.map((r) => r.score));

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Риск-скор регионов</h3>
        <Badge variant="secondary" className="text-[10px]">
          Σ (вспышки × R₀ × плотность)
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Композитный риск: учитывает количество вспышек, контагиозность (R₀) и плотность восприимчивых животных.
        Топ-15 регионов.
      </p>
      <div className="space-y-2 max-h-[400px] overflow-y-auto thin-scroll">
        {regionRisks.map((r, i) => (
          <div key={r.region} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold w-6 text-muted-foreground">#{i + 1}</span>
              <span className="text-sm font-medium flex-1 truncate">{r.name_ru}</span>
              <span className="text-xs text-muted-foreground">{r.federal_district}</span>
              <span className="text-sm font-bold px-2 py-0.5 rounded-full text-white"
                style={{
                  backgroundColor: r.score > maxScore * 0.7 ? "#dc2626" : r.score > maxScore * 0.4 ? "#eab308" : "#16a34a",
                }}>
                {r.score}
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden ml-8">
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${(r.score / maxScore) * 100}%`,
                  backgroundColor: r.score > maxScore * 0.7 ? "#dc2626" : r.score > maxScore * 0.4 ? "#eab308" : "#16a34a",
                }}
              />
            </div>
            {r.diseases.length > 0 && (
              <div className="flex flex-wrap gap-1 ml-8">
                {r.diseases.slice(0, 4).map((d) => (
                  <span key={d.key} className="text-[9px] px-1.5 py-0.5 rounded-full border"
                    style={{ borderColor: diseaseColor(d.key, d.group as any), color: diseaseColor(d.key, d.group as any), opacity: 0.8 }}>
                    {d.name} ×{d.outbreaks}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
