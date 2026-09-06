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
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Radio, MapPin, Clock, TrendingDown, AlertTriangle } from "lucide-react";
import type { Outbreak } from "@/types/domain";
import { DISEASE_PROFILES } from "@/data/disease-profiles";
import { REGION_PROPERTIES, REGION_CENTROIDS } from "@/data/regions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  outbreaks: Outbreak[];
}

/**
 * Feature 1: Backward simulation — Outbreak Source Tracking.
 *
 * Given multiple outbreaks of the same disease in different regions,
 * estimates where and when the outbreak likely started (Patient Zero).
 *
 * Algorithm:
 * 1. Group outbreaks by disease
 * 2. Sort by date (earliest first)
 * 3. Use incubation period from disease profile
 * 4. For each early outbreak, compute a "probable infection window"
 *    (detection_date - incubation_max → detection_date - incubation_min)
 * 5. Intersect windows across all early outbreaks → probable origin timeframe
 * 6. Use region proximity to estimate probable origin location
 */
export function OutbreakSourceTracker({ open, onOpenChange, outbreaks }: Props) {
  const [selectedDisease, setSelectedDisease] = useState<string>("");

  const diseases = useMemo(() => {
    const set = new Map<string, { key: string; name: string; count: number }>();
    for (const o of outbreaks) {
      const k = o.disease_key;
      if (!set.has(k)) set.set(k, { key: k, name: o.disease, count: 0 });
      set.get(k)!.count++;
    }
    return Array.from(set.values()).sort((a, b) => b.count - a.count);
  }, [outbreaks]);

  const analysis = useMemo(() => {
    if (!selectedDisease) return null;
    const diseaseOutbreaks = outbreaks
      .filter((o) => o.disease_key === selectedDisease)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (diseaseOutbreaks.length < 2) return null;

    const profile = DISEASE_PROFILES.find((p) => p.disease_key === selectedDisease);
    if (!profile) return null;

    const incubMin = profile.incubation_min;
    const incubMax = profile.incubation_max;

    // Compute probable infection windows for each outbreak
    const windows = diseaseOutbreaks.map((o) => {
      const detection = new Date(o.date);
      const infectionStart = new Date(detection);
      infectionStart.setDate(detection.getDate() - incubMax);
      const infectionEnd = new Date(detection);
      infectionEnd.setDate(detection.getDate() - incubMin);
      return { outbreak: o, infectionStart, infectionEnd, detection };
    });

    // Find intersection of infection windows (earliest outbreaks)
    const earlyWindows = windows.slice(0, Math.min(5, windows.length));
    let intersectStart = earlyWindows[0].infectionStart;
    let intersectEnd = earlyWindows[0].infectionEnd;
    for (const w of earlyWindows.slice(1)) {
      if (w.infectionStart > intersectStart) intersectStart = w.infectionStart;
      if (w.infectionEnd < intersectEnd) intersectEnd = w.infectionEnd;
    }

    // Probable origin: the region of the earliest outbreak
    const earliest = diseaseOutbreaks[0];

    // Spread velocity (km/day) between first and second outbreak
    let spreadVelocity = 0;
    if (diseaseOutbreaks.length >= 2) {
      // Use REGION_CENTROIDS (RegionProperties has no lat/lon fields).
      const c1 = REGION_CENTROIDS[earliest.region_geo];
      const c2 = REGION_CENTROIDS[diseaseOutbreaks[1].region_geo];
      if (c1 && c2) {
        const dx = c1[0] - c2[0];  // lon
        const dy = c1[1] - c2[1];  // lat
        const distKm = Math.sqrt(dx * dx + dy * dy) * 111;
        const daysDiff =
          (new Date(diseaseOutbreaks[1].date).getTime() -
            new Date(earliest.date).getTime()) /
          (1000 * 60 * 60 * 24);
        if (daysDiff > 0) spreadVelocity = distKm / daysDiff;
      }
    }

    // Risk regions — regions that had outbreaks within incubation period of earliest
    const riskRegions = diseaseOutbreaks
      .filter((o) => {
        const daysFromStart =
          (new Date(o.date).getTime() - new Date(earliest.date).getTime()) /
          (1000 * 60 * 60 * 24);
        return daysFromStart <= incubMax && daysFromStart >= 0;
      })
      .map((o) => o.region);

    // Probability scoring: how likely each early outbreak is the source
    const sourceProbabilities = windows.slice(0, Math.min(5, windows.length)).map((w, i) => {
      // Earlier = more likely (weight: 1 - i/total)
      const earlinessWeight = 1 - (i / Math.min(5, windows.length));
      // More cases = more likely it was burning longer (weight: log(cases+1)/5)
      const casesWeight = Math.log((w.outbreak.cases || 1) + 1) / 5;
      // Overlap with intersection window = higher probability
      const overlapMs = Math.max(0,
        Math.min(w.infectionEnd.getTime(), intersectEnd.getTime()) -
        Math.max(w.infectionStart.getTime(), intersectStart.getTime())
      );
      const overlapDays = overlapMs / (1000 * 60 * 60 * 24);
      const overlapWeight = Math.min(1, overlapDays / incubMax);
      // Combined score (0-100)
      const score = Math.round((earlinessWeight * 0.5 + casesWeight * 0.2 + overlapWeight * 0.3) * 100);
      return { outbreak: w.outbreak, probability: Math.min(100, score) };
    });

    return {
      profile,
      diseaseOutbreaks,
      windows,
      intersectStart,
      intersectEnd,
      earliest,
      spreadVelocity,
      riskRegions: [...new Set(riskRegions)],
      r0: profile.r0_min,
      sourceProbabilities,
    };
  }, [selectedDisease, outbreaks]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            Поиск источника вспышки
          </DialogTitle>
          <DialogDescription>
            Обратная симуляция: оценка вероятного источника и времени заражения
            на основе инкубационного периода и хронологии вспышек
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={selectedDisease} onValueChange={setSelectedDisease}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите болезнь для анализа" />
            </SelectTrigger>
            <SelectContent>
              {diseases.map((d) => (
                <SelectItem key={d.key} value={d.key}>
                  {d.name} ({d.count} очагов)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!analysis && selectedDisease && (
            <Card className="p-4 text-center text-muted-foreground">
              Недостаточно данных для анализа (нужно 2+ вспышки)
            </Card>
          )}

          {!selectedDisease && (
            <Card className="p-4 text-center text-muted-foreground">
              Выберите болезнь — алгоритм проанализирует хронологию вспышек
            </Card>
          )}

          {analysis && (
            <>
              {/* Probable origin */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-red-500" />
                  <h3 className="font-semibold">Вероятный источник</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Регион:</span>
                    <span className="font-medium">{analysis.earliest.region}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Первая вспышка:</span>
                    <span className="font-medium">{analysis.earliest.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Вероятное заражение:</span>
                    <span className="font-medium">
                      {analysis.intersectStart.toLocaleDateString("ru-RU")} —{" "}
                      {analysis.intersectEnd.toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Инкубационный период:</span>
                    <span className="font-medium">
                      {analysis.profile.incubation_min}–{analysis.profile.incubation_max} дн.
                    </span>
                  </div>
                </div>
              </Card>

              {/* Spread velocity */}
              {analysis.spreadVelocity > 0 && (
                <Card className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-orange-500" />
                    <h3 className="font-semibold">Скорость распространения</h3>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Между первыми очагами:</span>
                      <span className="font-medium">
                        {analysis.spreadVelocity.toFixed(1)} км/день
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">R₀ (базовый):</span>
                      <span className="font-medium">{analysis.r0}–{analysis.profile.r0_max}</span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Risk regions */}
              {analysis.riskRegions.length > 1 && (
                <Card className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <h3 className="font-semibold">Зоны риска (в радиусе инкубации)</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.riskRegions.map((r) => (
                      <Badge key={r} variant="secondary">
                        {r}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* Source probability ranking */}
              {analysis.sourceProbabilities.length > 1 && (
                <Card className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-purple-500" />
                    <h3 className="font-semibold">Ранжирование источников</h3>
                  </div>
                  <div className="space-y-1.5">
                    {analysis.sourceProbabilities.map((sp, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="font-medium w-24 truncate">{sp.outbreak.region}</span>
                        <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${sp.probability}%`,
                              backgroundColor: sp.probability > 70 ? "#ef4444" : sp.probability > 40 ? "#f59e0b" : "#6b7280",
                            }}
                          />
                        </div>
                        <span className="font-bold tabular-nums w-8 text-right">{sp.probability}%</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Timeline */}
              <Card className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <h3 className="font-semibold">Хронология ({analysis.diseaseOutbreaks.length} вспышек)</h3>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {analysis.windows.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <span className="font-medium">{w.outbreak.region}</span>
                      <span className="text-muted-foreground">
                        обнаружено: {w.detection.toLocaleDateString("ru-RU")}
                      </span>
                      <span className="text-muted-foreground">
                        заражение: {w.infectionStart.toLocaleDateString("ru-RU")} —{" "}
                        {w.infectionEnd.toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Separator />

              <p className="text-xs text-muted-foreground">
                ⚠️ Результаты основаны на инкубационном периоде и географической
                близости. Не является официальным эпизоотологическим заключением.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
