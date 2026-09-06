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
import {
  MapPin, TrendingUp, AlertTriangle, Activity, Calendar, Percent, Download,
} from "lucide-react";
import type { Outbreak } from "@/types/domain";
import { DISEASE_PROFILES } from "@/data/disease-profiles";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  outbreaks: Outbreak[];
}

/**
 * Region Report Card — detailed epidemiological stats for a region.
 *
 * Click a region → get:
 *   - Total outbreaks, cases, deaths
 *   - Disease breakdown (top 5)
 *   - Year-over-year trend
 *   - Risk assessment (active outbreaks, nearest disease)
 *   - Export as CSV
 */
export function RegionReportCard({ open, onOpenChange, outbreaks }: Props) {
  const [selectedRegion, setSelectedRegion] = useState<string>("");

  const regions = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of outbreaks) {
      map.set(o.region, (map.get(o.region) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [outbreaks]);

  const report = useMemo(() => {
    if (!selectedRegion) return null;
    const regionOutbreaks = outbreaks.filter((o) => o.region === selectedRegion);
    if (regionOutbreaks.length === 0) return null;

    const totalCases = regionOutbreaks.reduce((s, o) => s + (o.cases || 0), 0);
    const totalDeaths = regionOutbreaks.reduce((s, o) => s + (o.deaths || 0), 0);
    const active = regionOutbreaks.filter((o) => o.status === "Ongoing").length;

    // Disease breakdown
    const byDisease = new Map<string, { count: number; cases: number; deaths: number; lastDate: string }>();
    for (const o of regionOutbreaks) {
      const key = o.disease;
      if (!byDisease.has(key)) byDisease.set(key, { count: 0, cases: 0, deaths: 0, lastDate: "" });
      const d = byDisease.get(key)!;
      d.count++;
      d.cases += o.cases || 0;
      d.deaths += o.deaths || 0;
      if (o.date > d.lastDate) d.lastDate = o.date;
    }
    const topDiseases = Array.from(byDisease.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    // Year-over-year
    const byYear = new Map<string, number>();
    for (const o of regionOutbreaks) {
      const y = o.date.substring(0, 4);
      byYear.set(y, (byYear.get(y) || 0) + 1);
    }
    const years = Array.from(byYear.entries()).sort();
    const lastYear = years[years.length - 1]?.[0] || "";
    const prevYear = years[years.length - 2]?.[0] || "";
    const lastYearCount = byYear.get(lastYear) || 0;
    const prevYearCount = byYear.get(prevYear) || 0;
    const yoyChange = prevYearCount > 0
      ? Math.round(((lastYearCount - prevYearCount) / prevYearCount) * 100)
      : 0;

    // Species breakdown
    const bySpecies = new Map<string, number>();
    for (const o of regionOutbreaks) {
      bySpecies.set(o.species, (bySpecies.get(o.species) || 0) + 1);
    }

    // Mortality rate
    const mortalityRate = totalCases > 0 ? Math.round((totalDeaths / totalCases) * 100) : 0;

    return {
      total: regionOutbreaks.length,
      totalCases,
      totalDeaths,
      active,
      mortalityRate,
      topDiseases,
      years,
      yoyChange,
      lastYear,
      bySpecies: Array.from(bySpecies.entries()).sort((a, b) => b[1] - a[1]),
      firstOutbreak: regionOutbreaks.reduce((min, o) => o.date < min ? o.date : min, "9999"),
      lastOutbreak: regionOutbreaks.reduce((max, o) => o.date > max ? o.date : max, ""),
    };
  }, [selectedRegion, outbreaks]);

  const handleExportCSV = () => {
    if (!selectedRegion) return;
    const regionOutbreaks = outbreaks.filter((o) => o.region === selectedRegion);
    const headers = ["id", "disease", "disease_key", "date", "species", "cases", "deaths", "status", "source"];
    const rows = regionOutbreaks.map((o) =>
      [o.id, o.disease, o.disease_key, o.date, o.species, o.cases || 0, o.deaths || 0, o.status, o.source].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedRegion}_outbreaks.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Карточка региона
          </DialogTitle>
          <DialogDescription>
            Полная эпизоотологическая сводка по региону
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите регион" />
            </SelectTrigger>
            <SelectContent>
              {regions.map(([name, count]) => (
                <SelectItem key={name} value={name}>
                  {name} ({count} вспышек)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {report && (
            <>
              {/* Key metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold">{report.total}</div>
                  <div className="text-xs text-muted-foreground">вспышек</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold text-orange-500">{report.totalCases}</div>
                  <div className="text-xs text-muted-foreground">случаев</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className="text-2xl font-bold text-red-500">{report.totalDeaths}</div>
                  <div className="text-xs text-muted-foreground">пало</div>
                </Card>
                <Card className="p-3 text-center">
                  <div className={`text-2xl font-bold ${report.active > 0 ? "text-red-500" : "text-green-500"}`}>
                    {report.active}
                  </div>
                  <div className="text-xs text-muted-foreground">активных</div>
                </Card>
              </div>

              {/* Mortality + YoY */}
              <div className="grid grid-cols-2 gap-2">
                <Card className="p-3 flex items-center gap-3">
                  <Percent className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <div className="text-lg font-bold">{report.mortalityRate}%</div>
                    <div className="text-xs text-muted-foreground">летальность</div>
                  </div>
                </Card>
                <Card className="p-3 flex items-center gap-3">
                  <TrendingUp className={`h-8 w-8 ${report.yoyChange > 0 ? "text-red-500" : "text-green-500"}`} />
                  <div>
                    <div className="text-lg font-bold">
                      {report.yoyChange > 0 ? "+" : ""}{report.yoyChange}%
                    </div>
                    <div className="text-xs text-muted-foreground">год к году ({report.lastYear})</div>
                  </div>
                </Card>
              </div>

              {/* Top diseases */}
              <Card className="p-4">
                <div className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Activity className="h-4 w-4 text-primary" />
                  Топ болезней
                </div>
                <div className="space-y-1.5">
                  {report.topDiseases.map(([disease, stats]) => {
                    const profile = DISEASE_PROFILES.find((p) => p.name_ru === disease);
                    return (
                      <div key={disease} className="flex items-center justify-between text-sm">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium truncate">{disease}</span>
                          {profile?.zoonotic && <Badge variant="destructive" className="ml-1 text-xs py-0">зооноз</Badge>}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{stats.count} всп.</span>
                          <span>{stats.cases} сл.</span>
                          <span>{stats.deaths} пало</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Year chart */}
              <Card className="p-4">
                <div className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-primary" />
                  Динамика по годам
                </div>
                <div className="flex items-end gap-1 h-20">
                  {report.years.map(([year, count]) => {
                    const max = Math.max(...report.years.map(([, c]) => c));
                    return (
                      <div key={year} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className="w-full bg-primary rounded-t"
                          style={{ height: `${(count / max) * 100}%`, minHeight: "2px" }}
                          title={`${year}: ${count} вспышек`}
                        />
                        <span className="text-[10px] text-muted-foreground">{year.slice(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Species */}
              {report.bySpecies.length > 0 && (
                <Card className="p-3">
                  <div className="text-sm font-medium mb-2">Виды животных</div>
                  <div className="flex flex-wrap gap-1.5">
                    {report.bySpecies.map(([sp, count]) => (
                      <Badge key={sp} variant="secondary">
                        {sp}: {count}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              <Separator />

              {/* Period */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Период наблюдения:</span>
                <span className="font-medium">{report.firstOutbreak} — {report.lastOutbreak}</span>
              </div>

              {/* Export */}
              <button
                onClick={handleExportCSV}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition"
              >
                <Download className="h-4 w-4" />
                Экспортировать в CSV
              </button>
            </>
          )}

          {!report && selectedRegion && (
            <Card className="p-8 text-center text-muted-foreground">
              Нет данных по этому региону
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
