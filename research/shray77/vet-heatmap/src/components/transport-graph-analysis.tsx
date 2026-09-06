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
import { Truck, AlertTriangle, MapPin } from "lucide-react";
import type { Outbreak } from "@/types/domain";
import { DISEASE_PROFILES } from "@/data/disease-profiles";
import { findConnectedRegions } from "@/data/transport-graph";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  outbreaks: Outbreak[];
}

/**
 * Feature 2: Transport graph analysis.
 *
 * Shows which regions are at risk of disease spread via transport routes
 * (federal highways, livestock transport). When user selects an outbreak region,
 * the BFS algorithm finds all connected regions within 2 hops.
 */
export function TransportGraphAnalysis({ open, onOpenChange, outbreaks }: Props) {
  const [selectedOutbreakId, setSelectedOutbreakId] = useState<string>("");

  const ongoingOutbreaks = useMemo(
    () => outbreaks.filter((o) => o.status === "Ongoing" || o.status === "Unknown"),
    [outbreaks],
  );

  const allOutbreaks = ongoingOutbreaks.length > 0 ? ongoingOutbreaks : outbreaks;

  const analysis = useMemo(() => {
    if (!selectedOutbreakId) return null;
    const outbreak = allOutbreaks.find((o) => o.id === parseInt(selectedOutbreakId));
    if (!outbreak) return null;

    const profile = DISEASE_PROFILES.find((p) => p.disease_key === outbreak.disease_key);
    const connected = findConnectedRegions(outbreak.region_geo, 2);

    // Check if connected regions have existing outbreaks of the same disease
    const withExistingRisk = connected.map((node) => {
      const hasOutbreak = outbreaks.some(
        (o) =>
          o.region_geo === node.region &&
          o.disease_key === outbreak.disease_key,
      );
      return { ...node, hasOutbreak };
    });

    return { outbreak, profile, connected: withExistingRisk };
  }, [selectedOutbreakId, allOutbreaks, outbreaks]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Транспортный риск
          </DialogTitle>
          <DialogDescription>
            Анализ распространения по федеральным трассам. Выберите очаг —
            алгоритм найдёт регионы под угрозой по транспортным маршрутам.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={selectedOutbreakId} onValueChange={setSelectedOutbreakId}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите вспышку для анализа" />
            </SelectTrigger>
            <SelectContent>
              {allOutbreaks.slice(0, 50).map((o) => (
                <SelectItem key={o.id} value={o.id.toString()}>
                  {o.disease} — {o.region} ({o.date})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {analysis && (
            <>
              <Card className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-red-500" />
                  <span className="font-medium">{analysis.outbreak.disease}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Очаг: {analysis.outbreak.region} ({analysis.outbreak.date})
                </div>
                {analysis.profile && (
                  <div className="text-sm">
                    Зона ограничения:{" "}
                    <span className="font-medium">{analysis.profile.restriction_zone_km} км</span>
                  </div>
                )}
              </Card>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Регионы под риском ({analysis.connected.length})
                </h3>
                {analysis.connected.map((node) => (
                  <Card
                    key={node.region}
                    className={`p-3 ${node.hasOutbreak ? "border-red-300 dark:border-red-900" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm flex items-center gap-2">
                          {node.region}
                          {node.hasOutbreak && (
                            <Badge variant="destructive" className="text-xs">
                              уже есть вспышка
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {node.hops === 1 ? "1 пересадка" : `${node.hops} пересадки`} •{" "}
                          {node.distance} км • {node.highway}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          🚛 В пути: {node.travelHours} ч • прибытие ~{node.arrivalDate}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Маршрут: {node.path.join(" → ")}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Риск</div>
                        <div
                          className={`font-bold ${
                            node.riskWeight > 0.7
                              ? "text-red-500"
                              : node.riskWeight > 0.4
                                ? "text-orange-500"
                                : "text-yellow-500"
                          }`}
                        >
                          {(node.riskWeight * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {analysis.connected.length === 0 && (
                <Card className="p-4 text-center text-muted-foreground text-sm">
                  Нет транспортных связей от этого региона в графе.
                  Возможна изолированная вспышка.
                </Card>
              )}

              <Separator />
              <p className="text-xs text-muted-foreground">
                Граф основан на федеральных трассах РФ. Риск = произведение весов
                нагрузки трасс. Не учитывает фактическое движение скотовозов.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
