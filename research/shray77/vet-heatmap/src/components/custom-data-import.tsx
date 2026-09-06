"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Upload, FileJson, FileText, AlertCircle, CheckCircle2, MapPin } from "lucide-react";
import type { Outbreak } from "@/types/domain";
import { REGION_PROPERTIES, REGION_CENTROIDS } from "@/data/regions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  outbreaks: Outbreak[];
}

interface CustomPoint {
  name: string;
  lat: number;
  lon: number;
  description?: string;
}

interface RiskAssessment {
  point: CustomPoint;
  nearestOutbreak: Outbreak | null;
  distanceKm: number;
  riskLevel: "high" | "medium" | "low" | "safe";
  riskDisease: string | null;
}

/**
 * Feature 5: Local CSV/JSON import — privacy-first custom data overlay.
 *
 * Users (commercial farms, agricultural companies) can import their own
 * farm/operation coordinates as CSV or JSON. The app locally (in-browser)
 * computes distance to nearest outbreak and risk level.
 *
 * Nothing is uploaded to any server — all processing is client-side.
 *
 * CSV format: name,lat,lon,description
 * JSON format: [{ "name": "...", "lat": 55.75, "lon": 37.61, "description": "..." }]
 */
export function CustomDataImport({ open, onOpenChange, outbreaks }: Props) {
  const [points, setPoints] = useState<CustomPoint[]>([]);
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback(
    (file: File) => {
      setError("");
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        try {
          let parsed: CustomPoint[] = [];

          if (file.name.endsWith(".json")) {
            const data = JSON.parse(text);
            if (!Array.isArray(data)) throw new Error("JSON должен быть массивом");
            parsed = data.map((item: Record<string, unknown>) => ({
              name: String(item.name || item.title || "Без названия"),
              lat: Number(item.lat || item.latitude || 0),
              lon: Number(item.lon || item.lng || item.longitude || 0),
              description: item.description ? String(item.description) : undefined,
            }));
          } else {
            // CSV: name,lat,lon,description
            const lines = text.trim().split("\n");
            const header = lines[0].toLowerCase().trim();
            const hasHeader = header.includes("lat") && header.includes("lon");
            const dataLines = hasHeader ? lines.slice(1) : lines;
            parsed = dataLines.map((line) => {
              const parts = line.split(",").map((s) => s.trim());
              return {
                name: parts[0] || "Без названия",
                lat: parseFloat(parts[1]) || 0,
                lon: parseFloat(parts[2]) || 0,
                description: parts[3],
              };
            });
          }

          // Filter valid
          parsed = parsed.filter((p) => p.lat !== 0 && p.lon !== 0);
          if (parsed.length === 0) throw new Error("Нет валидных точек с координатами");

          setPoints(parsed);
          computeRisk(parsed, outbreaks);
        } catch (err) {
          setError(`Ошибка парсинга: ${err}`);
          setPoints([]);
          setAssessments([]);
        }
      };
      reader.readAsText(file);
    },
    [outbreaks],
  );

  const computeRisk = (pts: CustomPoint[], obs: Outbreak[]) => {
    // Get region centroids (RegionProperties has no lat/lon — use the
    // separate REGION_CENTROIDS map).
    const regionCoords = new Map<string, [number, number]>();
    for (const name of Object.keys(REGION_PROPERTIES)) {
      const c = REGION_CENTROIDS[name];
      if (c) regionCoords.set(name, c);
    }

    const results: RiskAssessment[] = pts.map((point) => {
      let nearest: Outbreak | null = null;
      let minDist = Infinity;

      for (const o of obs) {
        const coords = regionCoords.get(o.region_geo);
        if (!coords) continue;
        const [rlat, rlon] = coords;
        const dx = (point.lon - rlon) * Math.cos((point.lat * Math.PI) / 180) * 111;
        const dy = (point.lat - rlat) * 111;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          nearest = o;
        }
      }

      let riskLevel: RiskAssessment["riskLevel"] = "safe";
      if (minDist < 30) riskLevel = "high";
      else if (minDist < 100) riskLevel = "medium";
      else if (minDist < 300) riskLevel = "low";

      return {
        point,
        nearestOutbreak: nearest,
        distanceKm: Math.round(minDist),
        riskLevel,
        riskDisease: nearest?.disease || null,
      };
    });

    setAssessments(results);
  };

  const riskColor = {
    high: "text-red-500",
    medium: "text-orange-500",
    low: "text-yellow-500",
    safe: "text-green-500",
  };

  const riskLabel = {
    high: "Высокий риск",
    medium: "Средний риск",
    low: "Низкий риск",
    safe: "В безопасности",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Импорт своих данных
          </DialogTitle>
          <DialogDescription>
            Загрузите координаты своих ферм/точек (CSV или JSON). Данные
            обрабатываются локально в браузере — ничего не отправляется на сервер.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload area */}
          <Card
            className="p-6 border-dashed cursor-pointer hover:bg-muted/50 transition-colors text-center"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) parseFile(f);
              }}
            />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Нажмите для загрузки</p>
            <p className="text-xs text-muted-foreground mt-1">
              CSV: name,lat,lon,description или JSON массив
            </p>
          </Card>

          {fileName && (
            <div className="flex items-center gap-2 text-sm">
              {fileName.endsWith(".json") ? (
                <FileJson className="h-4 w-4" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              <span className="font-medium">{fileName}</span>
              <Badge variant="secondary">{points.length} точек</Badge>
            </div>
          )}

          {error && (
            <Card className="p-3 border-red-300 dark:border-red-900">
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            </Card>
          )}

          {/* Results */}
          {assessments.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {(["high", "medium", "low", "safe"] as const).map((level) => {
                  const count = assessments.filter((a) => a.riskLevel === level).length;
                  if (count === 0) return null;
                  return (
                    <Badge key={level} variant="outline" className={riskColor[level]}>
                      {riskLabel[level]}: {count}
                    </Badge>
                  );
                })}
              </div>

              <Separator />

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {assessments.map((a, i) => (
                  <Card key={i} className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {a.point.name}
                        </div>
                        {a.nearestOutbreak ? (
                          <div className="text-xs text-muted-foreground mt-1">
                            Ближайшая вспышка: {a.nearestOutbreak.disease} —{" "}
                            {a.nearestOutbreak.region} ({a.nearestOutbreak.date})
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground mt-1">
                            Нет ближайших вспышек в базе
                          </div>
                        )}
                        {a.point.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {a.point.description}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className={`font-bold text-sm ${riskColor[a.riskLevel]}`}>
                          {a.distanceKm === Infinity ? "—" : `${a.distanceKm} км`}
                        </div>
                        <div className={`text-xs ${riskColor[a.riskLevel]}`}>
                          {riskLabel[a.riskLevel]}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <Card className="p-3 bg-muted/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  Данные обработаны локально. Ничего не отправлено на сервер.
                  Закройте окно — данные не сохранятся.
                </div>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
