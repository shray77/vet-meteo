"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, MapPin, Activity, AlertTriangle, TrendingUp } from "lucide-react";
import type { Outbreak } from "@/types/domain";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { diseaseColor } from "@/lib/colors";
import { REGION_PROPERTIES } from "@/data/regions";
import { speciesRu } from "@/lib/i18n-species";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  outbreaks: Outbreak[];
}

/**
 * Comparison mode — two regions side by side.
 *
 * Shows a side-by-side comparison of outbreak stats for two selected
 * regions. Vets can compare "Belgorod vs Voronezh ASF 2024" to see
 * which region has more cases, different disease profiles, etc.
 *
 * Each side shows:
 *   - Region name + federal district
 *   - Total/active/resolved counts
 *   - Cases/deaths
 *   - Top 5 diseases
 *   - Livestock density (for context)
 *   - Timeline (first/last outbreak)
 */
export function RegionComparison({ open, onOpenChange, outbreaks }: Props) {
  const [regionA, setRegionA] = useState<string>("");
  const [regionB, setRegionB] = useState<string>("");

  // Get all regions that have outbreaks
  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    for (const o of outbreaks) {
      if (o.region_geo) set.add(o.region_geo);
    }
    return Array.from(set).sort();
  }, [outbreaks]);

  const dataA = useMemo(() => computeRegionStats(regionA, outbreaks), [regionA, outbreaks]);
  const dataB = useMemo(() => computeRegionStats(regionB, outbreaks), [regionB, outbreaks]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto thin-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Сравнение регионов
          </DialogTitle>
          <DialogDescription>
            Сравните эпизоотическую обстановку в двух регионах бок о бок.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          {/* ─── Region A selector ─────────────────────────────── */}
          <RegionSelector
            label="Регион A"
            value={regionA}
            onChange={setRegionA}
            regions={availableRegions}
          />
          {/* ─── Region B selector ─────────────────────────────── */}
          <RegionSelector
            label="Регион B"
            value={regionB}
            onChange={setRegionB}
            regions={availableRegions}
          />
        </div>

        {/* ─── Comparison cards ───────────────────────────────── */}
        {dataA && dataB && (
          <div className="grid grid-cols-2 gap-3 mt-2">
            <RegionStatsCard data={dataA} label="A" />
            <RegionStatsCard data={dataB} label="B" />

            {/* ─── Delta row ─────────────────────────────────── */}
            <div className="col-span-2">
              <DeltaRow dataA={dataA} dataB={dataB} />
            </div>

            {/* ─── Disease comparison ────────────────────────── */}
            <div className="col-span-2">
              <DiseaseComparisonTable dataA={dataA} dataB={dataB} />
            </div>
          </div>
        )}

        {(!dataA || !dataB) && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Выберите два региона для сравнения
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Helper: compute region stats ──────────────────────────────────
function computeRegionStats(region: string, outbreaks: Outbreak[]) {
  if (!region) return null;
  const regionOutbreaks = outbreaks.filter((o) => o.region_geo === region);
  if (regionOutbreaks.length === 0) return null;

  const props = REGION_PROPERTIES[region];
  const ongoing = regionOutbreaks.filter((o) => o.status === "Ongoing").length;
  const resolved = regionOutbreaks.filter((o) => o.status === "Resolved").length;
  const totalCases = regionOutbreaks.reduce((s, o) => s + (o.cases || 0), 0);
  const totalDeaths = regionOutbreaks.reduce((s, o) => s + (o.deaths || 0), 0);

  // By disease
  const byDisease = new Map<string, { count: number; cases: number; ongoing: number }>();
  for (const o of regionOutbreaks) {
    const e = byDisease.get(o.disease_key) ?? { count: 0, cases: 0, ongoing: 0 };
    e.count++;
    e.cases += o.cases || 0;
    if (o.status === "Ongoing") e.ongoing++;
    byDisease.set(o.disease_key, e);
  }
  const topDiseases = Array.from(byDisease.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  // Timeline
  const dates = regionOutbreaks.map((o) => o.date).sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  // By species
  const bySpecies = new Map<string, number>();
  for (const o of regionOutbreaks) {
    bySpecies.set(o.species, (bySpecies.get(o.species) ?? 0) + 1);
  }

  return {
    region,
    name: props?.name_ru ?? region,
    federalDistrict: props?.federal_district ?? "—",
    total: regionOutbreaks.length,
    ongoing,
    resolved,
    totalCases,
    totalDeaths,
    topDiseases,
    firstDate,
    lastDate,
    bySpecies,
    pigsPerKm2: props?.pigs_per_km2 ?? 0,
    cattlePerKm2: props?.cattle_per_km2 ?? 0,
    poultryPerKm2: props?.poultry_per_km2 ?? 0,
    population: props?.population_mln ?? 0,
  };
}

// ─── Region selector ───────────────────────────────────────────────
function RegionSelector({
  label, value, onChange, regions,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  regions: string[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm border rounded-md bg-background"
      >
        <option value="">— выберите —</option>
        {regions.map((r) => {
          const props = REGION_PROPERTIES[r];
          return (
            <option key={r} value={r}>
              {props?.name_ru ?? r}
            </option>
          );
        })}
      </select>
    </div>
  );
}

// ─── Region stats card ─────────────────────────────────────────────
function RegionStatsCard({ data, label }: { data: NonNullable<ReturnType<typeof computeRegionStats>>; label: string }) {
  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">{data.name}</div>
          <div className="text-[10px] text-muted-foreground">{data.federalDistrict}</div>
        </div>
        <Badge variant="outline" className="text-[9px]">{label}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <div className="text-lg font-bold tabular-nums">{data.total}</div>
          <div className="text-[8px] text-muted-foreground">вспышек</div>
        </div>
        <div>
          <div className="text-lg font-bold tabular-nums text-destructive">{data.ongoing}</div>
          <div className="text-[8px] text-muted-foreground">активн.</div>
        </div>
        <div>
          <div className="text-lg font-bold tabular-nums">{data.totalCases}</div>
          <div className="text-[8px] text-muted-foreground">случаев</div>
        </div>
      </div>

      <div className="text-[10px] space-y-0.5 border-t pt-1.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Пало:</span>
          <span className="font-medium tabular-nums">{data.totalDeaths}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Период:</span>
          <span className="font-medium text-[9px]">{data.firstDate} → {data.lastDate}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Свиней/км²:</span>
          <span className="font-medium tabular-nums">{data.pigsPerKm2}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">КРС/км²:</span>
          <span className="font-medium tabular-nums">{data.cattlePerKm2}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Птиц/км²:</span>
          <span className="font-medium tabular-nums">{data.poultryPerKm2}</span>
        </div>
      </div>

      {/* Top diseases */}
      <div className="space-y-0.5 border-t pt-1.5">
        <div className="text-[9px] text-muted-foreground mb-1">Топ болезни:</div>
        {data.topDiseases.map(([dk, v]) => {
          const labels = DISEASE_LABELS[dk as keyof typeof DISEASE_LABELS];
          const color = diseaseColor(dk as any, labels?.group ?? "Multi-species");
          return (
            <div key={dk} className="flex items-center gap-1.5 text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="flex-1 truncate">{labels?.short_ru ?? dk}</span>
              <span className="tabular-nums text-muted-foreground">
                {v.count}{v.ongoing > 0 && <span className="text-destructive"> ({v.ongoing} акт.)</span>}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Delta row — shows difference between A and B ──────────────────
function DeltaRow({
  dataA, dataB,
}: {
  dataA: NonNullable<ReturnType<typeof computeRegionStats>>;
  dataB: NonNullable<ReturnType<typeof computeRegionStats>>;
}) {
  const deltas = [
    { label: "Вспышек", a: dataA.total, b: dataB.total, higher: "worse" },
    { label: "Активных", a: dataA.ongoing, b: dataB.ongoing, higher: "worse" },
    { label: "Случаев", a: dataA.totalCases, b: dataB.totalCases, higher: "worse" },
    { label: "Пало", a: dataA.totalDeaths, b: dataB.totalDeaths, higher: "worse" },
    { label: "Свиней/км²", a: dataA.pigsPerKm2, b: dataB.pigsPerKm2, higher: "neutral" },
    { label: "КРС/км²", a: dataA.cattlePerKm2, b: dataB.cattlePerKm2, higher: "neutral" },
  ];

  return (
    <Card className="p-3">
      <div className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
        <TrendingUp className="h-3 w-3" /> Разница (A − B)
      </div>
      <div className="grid grid-cols-6 gap-2 text-center">
        {deltas.map((d) => {
          const diff = d.a - d.b;
          const isHigher = diff > 0;
          const isLower = diff < 0;
          const color = d.higher === "worse"
            ? (isHigher ? "text-destructive" : isLower ? "text-green-600" : "text-muted-foreground")
            : "text-foreground";
          return (
            <div key={d.label}>
              <div className={`text-sm font-bold tabular-nums ${color}`}>
                {diff > 0 ? "+" : ""}{diff}
              </div>
              <div className="text-[8px] text-muted-foreground">{d.label}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Disease comparison table ──────────────────────────────────────
function DiseaseComparisonTable({
  dataA, dataB,
}: {
  dataA: NonNullable<ReturnType<typeof computeRegionStats>>;
  dataB: NonNullable<ReturnType<typeof computeRegionStats>>;
}) {
  // Merge disease keys from both regions
  const allDiseases = new Set<string>();
  for (const [dk] of dataA.topDiseases) allDiseases.add(dk);
  for (const [dk] of dataB.topDiseases) allDiseases.add(dk);

  const rows = Array.from(allDiseases).map((dk) => {
    const a = dataA.topDiseases.find(([k]) => k === dk)?.[1];
    const b = dataB.topDiseases.find(([k]) => k === dk)?.[1];
    return { dk, aCount: a?.count ?? 0, aOngoing: a?.ongoing ?? 0, bCount: b?.count ?? 0, bOngoing: b?.ongoing ?? 0 };
  }).sort((x, y) => (y.aCount + y.bCount) - (x.aCount + x.bCount));

  return (
    <Card className="p-3">
      <div className="text-[10px] text-muted-foreground mb-2">Сравнение по болезням</div>
      <table className="w-full text-[10px]">
        <thead>
          <tr className="border-b">
            <th className="text-left py-1">Болезнь</th>
            <th className="text-center py-1">{dataA.name.split(" ")[0]}</th>
            <th className="text-center py-1">{dataB.name.split(" ")[0]}</th>
            <th className="text-center py-1">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const labels = DISEASE_LABELS[r.dk as keyof typeof DISEASE_LABELS];
            const color = diseaseColor(r.dk as any, labels?.group ?? "Multi-species");
            const diff = r.aCount - r.bCount;
            return (
              <tr key={r.dk} className="border-b border-border/30">
                <td className="py-1">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    {labels?.short_ru ?? r.dk}
                  </span>
                </td>
                <td className="text-center tabular-nums">
                  {r.aCount}{r.aOngoing > 0 && <span className="text-destructive text-[8px]"> ●{r.aOngoing}</span>}
                </td>
                <td className="text-center tabular-nums">
                  {r.bCount}{r.bOngoing > 0 && <span className="text-destructive text-[8px]"> ●{r.bOngoing}</span>}
                </td>
                <td className={`text-center tabular-nums font-medium ${diff > 0 ? "text-destructive" : diff < 0 ? "text-green-600" : "text-muted-foreground"}`}>
                  {diff > 0 ? "+" : ""}{diff}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
