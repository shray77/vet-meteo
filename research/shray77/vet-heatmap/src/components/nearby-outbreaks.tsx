"use client";

import { useState, useMemo, useCallback } from "react";
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
import { MapPin, LocateFixed, AlertTriangle, X, Navigation } from "lucide-react";
import type { Outbreak } from "@/types/domain";
import { diseaseColor } from "@/lib/colors";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { speciesRu } from "@/lib/i18n-species";

interface NearbyOutbreaksProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  outbreaks: Outbreak[];
  /** Optional: region centroids lookup (shapeName → [lng, lat]). Used when
   * an outbreak has no explicit lat/lon. */
  regionCentroids?: Map<string, [number, number]>;
  /** When user clicks an outbreak, parent can focus the map on it. */
  onFocusOutbreak?: (o: Outbreak) => void;
}

interface NearbyResult {
  outbreak: Outbreak;
  distanceKm: number;
  bearing: number; // 0-359, 0=N
}

/**
 * Dialog: "Find outbreaks near me".
 *
 * Uses navigator.geolocation to get the user's location, then computes
 * haversine distance to each outbreak (using lat/lon if available, or the
 * region centroid otherwise). Shows sorted list of nearest active outbreaks.
 */
export function NearbyOutbreaks({
  open,
  onOpenChange,
  outbreaks,
  regionCentroids,
  onFocusOutbreak,
}: NearbyOutbreaksProps) {
  const [status, setStatus] = useState<"idle" | "locating" | "error" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lon: number } | null>(null);
  const [maxDistance, setMaxDistance] = useState<number>(500); // km

  /** Get the user's current location. */
  const locate = () => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Геолокация не поддерживается вашим браузером");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStatus("ready");
      },
      (err) => {
        setStatus("error");
        const messages: Record<number, string> = {
          1: "Доступ к геолокации запрещён. Разрешите его в настройках браузера.",
          2: "Не удалось определить местоположение.",
          3: "Таймаут определения местоположения. Попробуйте ещё раз.",
        };
        setError(messages[err.code] ?? err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  /** Compute haversine distance in km between two [lat, lon] points. */
  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // km
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  /** Initial bearing from user to outbreak (degrees, 0=N). */
  const bearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  };

  /** Convert bearing to compass direction. */
  const compass = (deg: number): string => {
    const dirs = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];
    return dirs[Math.round(deg / 45) % 8];
  };

  /** Get [lat, lon] for an outbreak — explicit or via region centroid. */
  const getOutbreakPos = useCallback((o: Outbreak): [number, number] | null => {
    if (typeof o.lat === "number" && typeof o.lon === "number"
        && Number.isFinite(o.lat) && Number.isFinite(o.lon)
        && !(o.lat === 0 && o.lon === 0)) {
      return [o.lat, o.lon];
    }
    if (o.region_geo && regionCentroids?.has(o.region_geo)) {
      const [lng, lat] = regionCentroids.get(o.region_geo)!;
      // Guard against anti-meridian wraparound → lng=0 (Atlantic Ocean)
      if (Number.isFinite(lng) && Number.isFinite(lat) && lng !== 0) {
        return [lat, lng];
      }
    }
    return null;
  }, [regionCentroids]);

  /** Compute sorted list of nearby outbreaks (active only). */
  const nearby: NearbyResult[] = useMemo(() => {
    if (!userPos) return [];
    const results: NearbyResult[] = [];
    for (const o of outbreaks) {
      if (o.status !== "Ongoing") continue;
      const pos = getOutbreakPos(o);
      if (!pos) continue;
      const [lat, lon] = pos;
      const dist = haversine(userPos.lat, userPos.lon, lat, lon);
      if (dist > maxDistance) continue;
      results.push({
        outbreak: o,
        distanceKm: dist,
        bearing: bearing(userPos.lat, userPos.lon, lat, lon),
      });
    }
    return results.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 25);
  }, [userPos, outbreaks, maxDistance, getOutbreakPos]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto thin-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Вспышки рядом со мной
          </DialogTitle>
          <DialogDescription>
            Определяет ваше местоположение и показывает ближайшие активные вспышки
          </DialogDescription>
        </DialogHeader>

        {/* Status / locate button */}
        {status !== "ready" && (
          <Card className="p-4 flex flex-col items-center gap-3 text-center">
            {status === "locating" ? (
              <>
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <div className="text-sm text-muted-foreground">
                  Определяем ваше местоположение…
                </div>
              </>
            ) : status === "error" ? (
              <>
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <div className="text-sm text-destructive">{error}</div>
                <Button size="sm" onClick={locate}>
                  Попробовать снова
                </Button>
              </>
            ) : (
              <>
                <MapPin className="h-8 w-8 text-primary" />
                <div className="text-sm text-muted-foreground max-w-md">
                  Нажмите кнопку, чтобы определить ваше местоположение и найти
                  ближайшие активные вспышки болезней животных.
                </div>
                <Button onClick={locate}>
                  <LocateFixed className="h-4 w-4 mr-2" />
                  Определить местоположение
                </Button>
              </>
            )}
          </Card>
        )}

        {/* Results */}
        {status === "ready" && userPos && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <Badge variant="outline" className="text-[10px]">
                <MapPin className="h-3 w-3 mr-1" />
                {userPos.lat.toFixed(4)}°, {userPos.lon.toFixed(4)}°
              </Badge>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Радиус:</span>
                {[100, 500, 1000].map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={maxDistance === d ? "default" : "outline"}
                    className="h-6 text-[11px] px-2"
                    onClick={() => setMaxDistance(d)}
                  >
                    {d < 1000 ? `${d} км` : `${d / 1000} тыс. км`}
                  </Button>
                ))}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] ml-auto"
                onClick={locate}
              >
                <LocateFixed className="h-3 w-3 mr-1" />
                Обновить
              </Button>
            </div>

            {nearby.length === 0 ? (
              <Card className="p-6 text-center">
                <div className="text-sm text-muted-foreground">
                  В радиусе {maxDistance < 1000 ? `${maxDistance} км` : `${maxDistance / 1000} тыс. км`} активных вспышек не найдено.
                </div>
              </Card>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  Найдено активных вспышек: <strong className="text-foreground">{nearby.length}</strong>
                </div>
                <div className="space-y-1.5">
                  {nearby.map((r, idx) => {
                    const o = r.outbreak;
                    const labels = DISEASE_LABELS[o.disease_key];
                    const color = diseaseColor(o.disease_key, o.disease_group);
                    return (
                      <Card
                        key={o.id}
                        className="p-2.5 flex items-center gap-3 hover:bg-accent/30 cursor-pointer transition-colors"
                        onClick={() => {
                          onFocusOutbreak?.(o);
                          onOpenChange(false);
                        }}
                      >
                        <div className="text-xs font-mono font-bold text-muted-foreground w-6 text-center shrink-0">
                          {idx + 1}
                        </div>
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">
                            {labels?.short_ru ?? o.disease} — {o.region === "Russia" || o.region === "Russian Federation" ? "Россия" : o.region}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {speciesRu(o.species)} · {new Date(o.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold tabular-nums">
                            {r.distanceKm < 1
                              ? `${Math.round(r.distanceKm * 1000)} м`
                              : r.distanceKm < 10
                                ? `${r.distanceKm.toFixed(1)} км`
                                : `${Math.round(r.distanceKm)} км`}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {compass(r.bearing)} · {Math.round(r.bearing)}°
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
