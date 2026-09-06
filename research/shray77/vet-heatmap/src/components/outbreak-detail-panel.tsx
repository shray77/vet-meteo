"use client";

import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import {
  MapPin,
  Calendar,
  Activity,
  Crosshair,
  Factory,
  FileText,
  Beaker,
  ShieldAlert,
  Microscope,
} from "lucide-react";
import type { Outbreak, DiseaseKey } from "@/types/domain";
import { diseaseColor } from "@/lib/colors";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { DISEASE_PROFILES_BY_KEY } from "@/data/disease-profiles";
import { speciesRu, sourceRu } from "@/lib/i18n-species";
import type { EnterpriseLite } from "./region-mini-map";
import { RtChart } from "./rt-chart";
import { ResponseChecklist } from "./response-checklist";

interface OutbreakDetailPanelProps {
  outbreak: Outbreak | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** All outbreaks (for finding nearby same-disease cases). */
  outbreaks: Outbreak[];
  /** Enterprises (for finding nearby at-risk facilities). */
  enterprises?: EnterpriseLite[];
  /** Open the disease profile drawer. */
  onSelectDisease?: (key: DiseaseKey) => void;
  /** Open the SIR simulator preloaded with this outbreak's params. */
  onSimulate?: (o: Outbreak) => void;
}

/**
 * Side panel replacing the small popup when user clicks an outbreak marker.
 *
 * Layout:
 *  ┌─────────────────────────────────┐
 *  │ Disease name                    │
 *  │ Status badge · date · source    │
 *  ├─────────────────────────────────┤
 *  │ Cases · Deaths · Species        │
 *  │ Region · Municipality · Notes   │
 *  ├─────────────────────────────────┤
 *  │ Nearby outbreaks (same disease) │
 *  │ ─ 4 cases · 23 km · 2024-11-12  │
 *  │ ─ 12 cases · 67 km · 2024-10-30 │
 *  ├─────────────────────────────────┤
 *  │ At-risk enterprises (<50 km)    │
 *  │ ─ ООО «Мясной Двор» · 8 km      │
 *  │ ─ Птицефабрика №1 · 23 km       │
 *  ├─────────────────────────────────┤
 *  │ [Профиль болезни] [SIR] [Закрыть]│
 *  └─────────────────────────────────┘
 */
export function OutbreakDetailPanel({
  outbreak,
  open,
  onOpenChange,
  outbreaks,
  enterprises = [],
  onSelectDisease,
  onSimulate,
}: OutbreakDetailPanelProps) {
  // Memoize expensive O(N×M) haversine computations.
  // Hooks MUST run before any early return — so we guard inside the memo.
  // Without this, every parent re-render (which happens on every map move)
  // re-runs ~900k distance calculations.
  const nearby = useMemo(
    () => outbreak ? computeNearby(outbreak, outbreaks, 100, 5) : [],
    [outbreak, outbreaks],
  );
  const atRisk = useMemo(
    () => outbreak ? computeAtRiskEnterprises(outbreak, enterprises, 50, 5) : [],
    [outbreak, enterprises],
  );

  if (!outbreak) return null;

  const labels = DISEASE_LABELS[outbreak.disease_key];
  const profile = DISEASE_PROFILES_BY_KEY[outbreak.disease_key];
  const color = diseaseColor(outbreak.disease_key, outbreak.disease_group);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg overflow-y-auto thin-scroll pb-safe"
      >
        <SheetHeader className="space-y-2 pb-3">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <SheetTitle className="text-base">
              {labels?.ru ?? outbreak.disease}
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs flex flex-wrap items-center gap-2">
            {outbreak.status === "Ongoing" ? (
              <Badge variant="destructive" className="text-[10px] py-0 h-4">Активна</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] py-0 h-4">Завершена</Badge>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(outbreak.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span>{sourceRu(outbreak.source)}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* Cases / deaths / species cards */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                <Activity className="h-3 w-3" /> случаи
              </div>
              <div className="text-base font-bold tabular-nums">
                {outbreak.cases > 0 ? outbreak.cases.toLocaleString("ru-RU") : "—"}
              </div>
            </Card>
            <Card className="p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                <ShieldAlert className="h-3 w-3" /> пало
              </div>
              <div className="text-base font-bold tabular-nums text-destructive">
                {outbreak.deaths > 0 ? outbreak.deaths.toLocaleString("ru-RU") : "—"}
              </div>
            </Card>
            <Card className="p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                <Microscope className="h-3 w-3" /> вид
              </div>
              <div className="text-xs font-medium truncate">
                {speciesRu(outbreak.species)}
              </div>
            </Card>
          </div>

          {/* Location */}
          <div className="space-y-1 text-xs">
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <div className="font-medium">{outbreak.region}</div>
                {outbreak.municipality && (
                  <div className="text-muted-foreground text-[11px]">
                    {outbreak.municipality}
                  </div>
                )}
                {typeof outbreak.lat === "number" && typeof outbreak.lon === "number" && (
                  <div className="text-[10px] text-muted-foreground font-mono">
                    {outbreak.lat.toFixed(4)}, {outbreak.lon.toFixed(4)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {outbreak.notes && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Описание
                </div>
                <div className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded p-2 max-h-32 overflow-y-auto thin-scroll">
                  {outbreak.notes}
                </div>
              </div>
            </>
          )}

          {/* Nearby outbreaks (same disease) */}
          {nearby.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Crosshair className="h-3.5 w-3.5 text-muted-foreground" />
                  Соседние вспышки ({labels?.short_ru})
                </div>
                <div className="space-y-1">
                  {nearby.map((n) => (
                    <div
                      key={n.outbreak.id}
                      className="flex items-center justify-between text-[11px] rounded p-1.5 hover:bg-accent/30 cursor-default"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">{formatDate(n.outbreak.date)}</span>
                        {n.outbreak.status === "Ongoing" && (
                          <Badge variant="destructive" className="text-[9px] py-0 h-3.5 px-1">акт.</Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground tabular-nums shrink-0">
                        {n.distanceKm} км
                        {n.outbreak.cases > 0 && (
                          <span className="ml-2 text-foreground">{n.outbreak.cases} сл.</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* At-risk enterprises */}
          {atRisk.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Factory className="h-3.5 w-3.5 text-amber-600" />
                  Предприятия в зоне риска (&lt;50 км)
                </div>
                <div className="space-y-1">
                  {atRisk.map((e) => (
                    <div
                      key={e.enterprise.id}
                      className="flex items-center justify-between text-[11px] rounded p-1.5 hover:bg-accent/30 cursor-default"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate text-foreground">
                          {e.enterprise.name}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {enterpriseTypeRu(e.enterprise.type)}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${e.distanceKm <= 10 ? "border-destructive text-destructive" : e.distanceKm <= 30 ? "border-amber-500 text-amber-600" : ""}`}
                      >
                        {e.distanceKm} км
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Rt chart — effective reproduction number */}
          {/* Shows if epidemic is growing or fading for this disease */}
          <Separator />
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Activity className="h-3.5 w-3.5 text-primary" />
              Эпидемическая динамика (Rt)
            </div>
            <div className="text-[10px] text-muted-foreground">
              Коэффициент эффективного воспроизводства — растёт ли эпидемия этой болезни
            </div>
            <RtChart outbreaks={outbreaks} diseaseKey={outbreak.disease_key} compact />
          </div>

          {/* Recommended measures */}
          {profile?.measures_summary && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                  Рекомендованные меры
                </div>
                <div className="text-[11px] text-muted-foreground leading-relaxed bg-muted/30 rounded p-2">
                  {profile.measures_summary}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Зоны: защита {profile.protection_zone_km} км · наблюдение {profile.surveillance_zone_km} км · ограничение {profile.restriction_zone_km} км
                </div>
              </div>
            </>
          )}

          {/* Response checklist — disease-specific actionable steps */}
          {profile?.response_checklist && profile.response_checklist.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                  Чек-лист реагирования ({profile.short_ru})
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Пошаговые действия по дням от обнаружения. Отмечайте выполненные — прогресс сохраняется.
                </div>
                <ResponseChecklist items={profile.response_checklist} outbreak={outbreak} />
              </div>
            </>
          )}

          {/* Action buttons */}
          <Separator />
          <div className="flex flex-wrap gap-2 pb-2">
            <button
              onClick={() => { onSelectDisease?.(outbreak.disease_key); onOpenChange(false); }}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <FileText className="h-3.5 w-3.5" />
              Профиль болезни
            </button>
            <button
              onClick={() => { onSimulate?.(outbreak); onOpenChange(false); }}
              className="inline-flex items-center gap-1 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <Beaker className="h-3.5 w-3.5" />
              Моделировать
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function computeNearby(
  center: Outbreak,
  all: Outbreak[],
  maxKm: number,
  limit: number,
): { outbreak: Outbreak; distanceKm: number }[] {
  if (typeof center.lat !== "number" || typeof center.lon !== "number") return [];
  const results: { outbreak: Outbreak; distanceKm: number }[] = [];
  for (const o of all) {
    if (o.id === center.id) continue;
    if (o.disease_key !== center.disease_key) continue;
    if (typeof o.lat !== "number" || typeof o.lon !== "number") continue;
    const d = haversineKm([center.lon, center.lat], [o.lon, o.lat]);
    if (d <= maxKm) results.push({ outbreak: o, distanceKm: Math.round(d) });
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results.slice(0, limit);
}

function computeAtRiskEnterprises(
  center: Outbreak,
  enterprises: EnterpriseLite[],
  maxKm: number,
  limit: number,
): { enterprise: EnterpriseLite; distanceKm: number }[] {
  if (typeof center.lat !== "number" || typeof center.lon !== "number") return [];
  const results: { enterprise: EnterpriseLite; distanceKm: number }[] = [];
  for (const e of enterprises) {
    if (typeof e.lat !== "number" || typeof e.lon !== "number") continue;
    const d = haversineKm([center.lon, center.lat], [e.lon, e.lat]);
    if (d <= maxKm) results.push({ enterprise: e, distanceKm: Math.round(d) });
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results.slice(0, limit);
}

function enterpriseTypeRu(t: string): string {
  const map: Record<string, string> = {
    pig_farm: "Свиноводческий комплекс",
    poultry_farm: "Птицефабрика",
    cattle_farm: "Скотоводческое хозяйство",
    meat_plant: "Мясокомбинат",
    dairy: "Молочный комбинат",
    market: "Животноводческий рынок",
    feed_mill: "Комбикормовый завод",
    vet_clinic: "Ветеринарная клиника",
    slaughterhouse: "Убойный цех",
    farm: "Ферма",
  };
  return map[t] ?? t;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}
