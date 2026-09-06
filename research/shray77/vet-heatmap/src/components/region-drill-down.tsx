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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MapPin, Activity, AlertCircle } from "lucide-react";
import type { Outbreak, DiseaseKey } from "@/types/domain";
import { diseaseColor } from "@/lib/colors";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { speciesRu, sourceRu } from "@/lib/i18n-species";
import { getRegionProperties } from "@/data/regions";
import { RegionMiniMap, type EnterpriseLite } from "./region-mini-map";

interface RegionDrillDownProps {
  region: string | null;
  outbreaks: Outbreak[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelectOutbreak?: (o: Outbreak) => void;
  /** Full GeoJSON (all regions) — used to extract the selected region's polygon. */
  geo?: GeoJSON.FeatureCollection | null;
  /** Enterprises (filtered to this region internally). */
  enterprises?: EnterpriseLite[];
}

export function RegionDrillDown({
  region,
  outbreaks,
  open,
  onOpenChange,
  onSelectOutbreak,
  geo,
  enterprises = [],
}: RegionDrillDownProps) {
  // Hooks MUST run before any early return — useMemo first.
  const regionGeo = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!geo || !region) return { type: "FeatureCollection", features: [] };
    const features = geo.features.filter(
      (f) => (f.properties as { shapeName?: string }).shapeName === region,
    );
    return { type: "FeatureCollection", features };
  }, [geo, region]);

  if (!region) return null;

  const props = getRegionProperties(region);
  const regionOutbreaks = outbreaks.filter((o) => o.region_geo === region);
  const ongoing = regionOutbreaks.filter((o) => o.status === "Ongoing");
  const diseases = new Set(regionOutbreaks.map((o) => o.disease_key));
  const totalCases = regionOutbreaks.reduce((s, o) => s + o.cases, 0);
  const totalDeaths = regionOutbreaks.reduce((s, o) => s + o.deaths, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg overflow-y-auto thin-scroll pb-safe"
      >
        <SheetHeader className="space-y-2 pb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <SheetTitle className="text-lg">
              {props?.name_ru ?? region}
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            {props?.federal_district && `Округ: ${props.federal_district} · `}
            {props?.iso_code}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* Mini-map with outbreaks + enterprises + risk zones */}
          {regionGeo.features.length > 0 && (
            <RegionMiniMap
              geo={regionGeo}
              outbreaks={regionOutbreaks}
              enterprises={enterprises}
              onSelectOutbreak={(o) => {
                onSelectOutbreak?.(o);
                onOpenChange(false);
              }}
            />
          )}

          {/* Stats summary */}
          <div className="grid grid-cols-2 gap-2">
            <Card className="p-2.5 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary shrink-0" />
              <div>
                <div className="text-lg font-bold tabular-nums leading-none">
                  {regionOutbreaks.length}
                </div>
                <div className="text-[10px] text-muted-foreground">всего вспышек</div>
              </div>
            </Card>
            <Card className="p-2.5 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <div className="text-lg font-bold tabular-nums leading-none text-destructive">
                  {ongoing.length}
                </div>
                <div className="text-[10px] text-muted-foreground">активных</div>
              </div>
            </Card>
            <Card className="p-2.5 flex items-center gap-2">
              <div className="text-lg font-bold tabular-nums leading-none">
                {diseases.size}
              </div>
              <div className="text-[10px] text-muted-foreground">типов болезней</div>
            </Card>
            <Card className="p-2.5 flex items-center gap-2">
              <div className="text-lg font-bold tabular-nums leading-none text-destructive">
                {totalDeaths > 0 ? totalDeaths.toLocaleString("ru-RU") : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground">пало</div>
            </Card>
          </div>

          {/* Region metadata */}
          {props && (
            <>
              <Separator />
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <div className="text-muted-foreground">Население</div>
                  <div className="font-medium tabular-nums">
                    {props.population_mln > 0
                      ? `${props.population_mln} млн`
                      : "нет данных"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Свиней/км²</div>
                  <div className="font-medium tabular-nums">
                    {props.pigs_per_km2 > 0 ? props.pigs_per_km2 : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">КРС/км²</div>
                  <div className="font-medium tabular-nums">
                    {props.cattle_per_km2 > 0 ? props.cattle_per_km2 : "—"}
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Outbreaks list */}
          <div>
            <h4 className="text-xs font-semibold mb-2">
              Вспышки в регионе ({regionOutbreaks.length})
            </h4>
            <div className="max-h-[40vh] overflow-y-auto thin-scroll">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="py-2 text-xs">Дата</TableHead>
                    <TableHead className="py-2 text-xs">Болезнь</TableHead>
                    <TableHead className="py-2 text-xs">Вид</TableHead>
                    <TableHead className="py-2 text-xs text-right">Случаи</TableHead>
                    <TableHead className="py-2 text-xs">Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regionOutbreaks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                        Нет вспышек в этом регионе
                      </TableCell>
                    </TableRow>
                  ) : (
                    regionOutbreaks
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((o) => {
                        const labels = DISEASE_LABELS[o.disease_key as DiseaseKey];
                        const color = diseaseColor(o.disease_key, o.disease_group);
                        return (
                          <TableRow
                            key={o.id}
                            onClick={() => {
                              onSelectOutbreak?.(o);
                              onOpenChange(false);
                            }}
                            className="cursor-pointer hover:bg-accent/30 relative"
                            style={{ boxShadow: `inset 3px 0 0 0 ${color}` }}
                          >
                            <TableCell className="py-2 text-xs whitespace-nowrap tabular-nums">
                              {new Date(o.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                            </TableCell>
                            <TableCell className="py-2 text-xs">
                              <span className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                {labels?.short_ru ?? o.disease}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 text-xs text-muted-foreground">
                              {speciesRu(o.species)}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right font-mono tabular-nums">
                              {o.cases > 0 ? o.cases.toLocaleString("ru-RU") : "—"}
                            </TableCell>
                            <TableCell className="py-2">
                              {o.status === "Ongoing" ? (
                                <Badge variant="destructive" className="text-[9px] py-0 h-4">Активна</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[9px] py-0 h-4">Заверш.</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
