"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Zap, MapPin, TrendingUp, Clock, AlertTriangle, Activity } from "lucide-react";
import type { DiseaseKey, Outbreak } from "@/types/domain";
import { DISEASE_PROFILES } from "@/data/disease-profiles";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { REGION_PROPERTIES } from "@/data/regions";
import { diseaseColor } from "@/lib/colors";

interface SpatialSimulatorProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  outbreaks: Outbreak[];
  regionCentroids?: Map<string, [number, number]>;
}

interface SpreadResult {
  region: string;
  regionRu: string;
  distance: number;
  day: number;
  cases: number;
  risk: number;
}

/**
 * Spatial Spread Simulator — "безумная идея"
 *
 * Instead of a simple SEIR model for one population, this simulates how a
 * disease would spread ACROSS REGIONS using a gravity model:
 *
 *   risk(i → j) = (R0 * livestock_density_j) / (distance_ij^2 + 1)
 *
 * The simulator picks an epicenter (selected region or outbreak), then
 * computes which neighboring regions would be hit, on what day, and with
 * how many estimated cases.
 *
 * This is NOT a real epidemiological forecast — it's a visualization tool
 * to help vets understand how spatial spread works and which regions are
 * at risk.
 */
export function SpatialSimulator({
  open,
  onOpenChange,
  outbreaks,
  regionCentroids,
}: SpatialSimulatorProps) {
  const [disease, setDisease] = useState<DiseaseKey>("asf");
  const [epicenter, setEpicenter] = useState<string>("");
  const [r0, setR0] = useState<number>(4);
  const [spreadRate, setSpreadRate] = useState<number>(0.3); // km/day effective
  const [maxDays, setMaxDays] = useState<number>(60);
  const [chartReady, setChartReady] = useState(false);

  // Build region list from outbreaks
  const regionList = useMemo(() => {
    const set = new Set<string>();
    for (const o of outbreaks) {
      if (o.region_geo) set.add(o.region_geo);
    }
    return Array.from(set).sort();
  }, [outbreaks]);

  // Auto-select first region with outbreaks if none selected.
  // Use derived value instead of setState-in-effect.
  const effectiveEpicenter = epicenter || (regionList.length > 0 ? regionList[0] : "");

  // Load disease preset
  const [loadedDisease, setLoadedDisease] = useState<string | null>(null);
  const applyDiseasePreset = (key: DiseaseKey) => {
    setDisease(key);
    if (key !== loadedDisease) {
      const profile = DISEASE_PROFILES.find((p) => p.disease_key === key);
      if (profile) {
        setR0(Math.round((profile.r0_min + profile.r0_max) / 2 * 10) / 10);
      }
      setLoadedDisease(key);
    }
  };

  // Haversine distance
  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  // Run spatial simulation
  const results: SpreadResult[] = useMemo(() => {
    if (!effectiveEpicenter || !regionCentroids) return [];

    const epicenterCoord = regionCentroids.get(effectiveEpicenter);
    if (!epicenterCoord) return [];

    const [epiLng, epiLat] = epicenterCoord;
    const profile = DISEASE_PROFILES.find((p) => p.disease_key === disease);
    const infectiousDays = profile?.incubation_max ?? 14;
    const beta = r0 / infectiousDays;

    const results: SpreadResult[] = [];

    // Epicenter always on day 0
    const epiProps = REGION_PROPERTIES[effectiveEpicenter];
    const epiDensity = epiProps
      ? Math.max(epiProps.pigs_per_km2, epiProps.cattle_per_km2, epiProps.poultry_per_km2)
      : 1;
    results.push({
      region: effectiveEpicenter,
      regionRu: epiProps?.name_ru ?? effectiveEpicenter,
      distance: 0,
      day: 0,
      cases: Math.round(epiDensity * 10),
      risk: 100,
    });

    // For each other region, compute spread risk
    for (const [regionName, [lng, lat]] of regionCentroids) {
      if (regionName === effectiveEpicenter) continue;
      if (lng === 0) continue; // anti-meridian guard

      const dist = haversine(epiLat, epiLng, lat, lng);
      if (dist > 3000) continue; // skip regions > 3000 km

      const props = REGION_PROPERTIES[regionName];
      // Use max livestock density (pigs for ASF/CSF, cattle for FMD/Anthrax, etc.)
      const density = props
        ? Math.max(props.pigs_per_km2, props.cattle_per_km2, props.poultry_per_km2)
        : 1;

      // Gravity model: risk proportional to density, inverse to distance²
      const distanceFactor = 1 / (1 + (dist / 100) ** 2);
      const risk = Math.min(100, r0 * density * distanceFactor * 10);

      // Estimated day of first case: distance / spread rate
      const day = Math.min(maxDays, Math.ceil(dist * spreadRate / 10));

      // Estimated cases based on risk and density
      const cases = Math.round(risk * density * 0.5);

      if (risk > 1 && cases > 0) {
        results.push({
          region: regionName,
          regionRu: props?.name_ru ?? regionName,
          distance: Math.round(dist),
          day,
          cases: Math.max(1, cases),
          risk: Math.round(risk),
        });
      }
    }

    return results.sort((a, b) => a.day - b.day);
  }, [effectiveEpicenter, regionCentroids, disease, r0, spreadRate, maxDays]);

  // Summary stats
  const stats = useMemo(() => {
    if (results.length === 0) return null;
    const totalCases = results.reduce((s, r) => s + r.cases, 0);
    const affectedRegions = results.length;
    const maxDay = Math.max(...results.map((r) => r.day));
    const highRisk = results.filter((r) => r.risk > 50).length;
    return { totalCases, affectedRegions, maxDay, highRisk };
  }, [results]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setChartReady(true));
    return () => {
      cancelAnimationFrame(id);
      setChartReady(false);
    };
  }, [open]);

  const labels = DISEASE_LABELS[disease];
  const color = diseaseColor(disease, labels.group);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto thin-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Симулятор пространственного распространения
          </DialogTitle>
          <DialogDescription>
            Gravity-модель: риск spread = R₀ × плотность животных / расстояние².
            Выберите эпицентр → увидите какие регионы под угрозой и когда.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-4">
          {/* Controls */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Болезнь</Label>
              <Select value={disease} onValueChange={(v) => applyDiseasePreset(v as DiseaseKey)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISEASE_PROFILES.map((p) => (
                    <SelectItem key={p.disease_key} value={p.disease_key}>
                      {p.short_ru} — {p.name_ru}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Эпицентр (регион)</Label>
              <Select value={effectiveEpicenter} onValueChange={setEpicenter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Выберите регион" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {regionList.map((r) => (
                    <SelectItem key={r} value={r}>
                      {REGION_PROPERTIES[r]?.name_ru ?? r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  R₀
                </Label>
                <Badge variant="outline" className="text-xs tabular-nums">{r0.toFixed(1)}</Badge>
              </div>
              <Slider value={[r0]} onValueChange={(v) => setR0(v[0])} min={0.5} max={20} step={0.1} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Скорость spread (км/день)</Label>
                <Badge variant="outline" className="text-xs tabular-nums">{(spreadRate * 10).toFixed(1)}</Badge>
              </div>
              <Slider value={[spreadRate * 10]} onValueChange={(v) => setSpreadRate(v[0] / 10)} min={0.5} max={5} step={0.1} />
              <p className="text-[10px] text-muted-foreground">
                Насколько быстро болезнь преодолевает расстояние между регионами
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Горизонт (дни)</Label>
                <Badge variant="outline" className="text-xs tabular-nums">{maxDays} дн</Badge>
              </div>
              <Slider value={[maxDays]} onValueChange={(v) => setMaxDays(v[0])} min={14} max={180} step={1} />
            </div>

            {stats && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-2">
                  <Card className="p-2 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <div className="text-sm font-bold tabular-nums">{stats.affectedRegions}</div>
                      <div className="text-[10px] text-muted-foreground">регионов</div>
                    </div>
                  </Card>
                  <Card className="p-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                    <div>
                      <div className="text-sm font-bold tabular-nums text-destructive">{stats.highRisk}</div>
                      <div className="text-[10px] text-muted-foreground">высокий риск</div>
                    </div>
                  </Card>
                  <Card className="p-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-chart-2 shrink-0" />
                    <div>
                      <div className="text-sm font-bold tabular-nums">{stats.totalCases.toLocaleString("ru-RU")}</div>
                      <div className="text-[10px] text-muted-foreground">оценка случаев</div>
                    </div>
                  </Card>
                  <Card className="p-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-chart-4 shrink-0" />
                    <div>
                      <div className="text-sm font-bold tabular-nums">{stats.maxDay}</div>
                      <div className="text-[10px] text-muted-foreground">дней до max</div>
                    </div>
                  </Card>
                </div>
              </>
            )}
          </div>

          {/* Results */}
          <div className="space-y-3">
            {/* Timeline chart */}
            <Card className="p-3">
              <div className="text-xs font-medium mb-2">
                День первого заражения по регионам
              </div>
              <div style={{ width: "100%", height: 200, minHeight: 200 }}>
                {chartReady && results.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                    <BarChart
                      data={results.slice(0, 15).map(r => ({
                        name: r.regionRu.length > 12 ? r.regionRu.substring(0, 10) + "…" : r.regionRu,
                        day: r.day,
                        risk: r.risk,
                        cases: r.cases,
                      }))}
                      layout="vertical"
                      margin={{ top: 4, right: 8, bottom: 4, left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
                      <XAxis
                        type="number"
                        dataKey="day"
                        tick={{ fontSize: 10, fill: "currentColor" }}
                        stroke="currentColor"
                        strokeOpacity={0.3}
                        label={{ value: "День", position: "insideBottom", offset: -2, style: { fontSize: 10, fill: "currentColor" } }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 9, fill: "currentColor" }}
                        stroke="currentColor"
                        strokeOpacity={0.3}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--popover)",
                          color: "var(--popover-foreground)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          fontSize: 11,
                        }}
                        formatter={((v: number, name: string) => {
                          if (name === "day") return [`День ${v}`, "Первое заражение"];
                          return [v, name];
                        }) as any}
                      />
                      <Bar dataKey="day" fill={color} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Risk table */}
            <Card className="p-3">
              <div className="text-xs font-medium mb-2">
                Регионы под угрозой (топ 10)
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto thin-scroll">
                {results.slice(0, 10).map((r, i) => (
                  <div
                    key={r.region}
                    className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-accent/30 transition-colors"
                  >
                    <span className="text-[10px] font-mono text-muted-foreground w-4">{i + 1}</span>
                    <span className="text-xs font-medium flex-1 truncate">{r.regionRu}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {r.distance} км
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      День {r.day}
                    </span>
                    {/* Risk bar */}
                    <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${r.risk}%`,
                          backgroundColor: r.risk > 50 ? "var(--destructive)" : r.risk > 25 ? "var(--chart-3)" : "var(--chart-4)",
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold tabular-nums w-8 text-right">
                      {r.cases.toLocaleString("ru-RU")}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <p className="text-[10px] text-muted-foreground leading-relaxed">
              ⚠️ Gravity-модель упрощена: не учитывает карантинные меры,
              вакцинацию, естественные барьеры (горы, реки), миграцию животных.
              Риск = R₀ × плотность / расстояние². Для реального планирования
              обратитесь к эпизоотологу.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
