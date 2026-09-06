"use client";

import { useMemo, useEffect, useRef } from "react";
import maplibregl, { Map as MLMap, Popup } from "maplibre-gl";
import { AlertCircle, Factory } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Outbreak, DiseaseKey } from "@/types/domain";
import { diseaseColor } from "@/lib/colors";
import { DISEASE_PROFILES_BY_KEY } from "@/data/disease-profiles";
import { speciesRu } from "@/lib/i18n-species";

export interface EnterpriseLite {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  region?: string;
}

interface RegionMiniMapProps {
  /** GeoJSON FeatureCollection (filtered to just this region's polygon). */
  geo: GeoJSON.FeatureCollection;
  outbreaks: Outbreak[];
  enterprises: EnterpriseLite[];
  /** Called when user clicks an outbreak marker. */
  onSelectOutbreak?: (o: Outbreak) => void;
}

/**
 * Mini-map for the RegionDrillDown panel.
 *
 * Shows:
 *  - The region's polygon (outlined)
 *  - All outbreaks in the region (clustered circles)
 *  - Risk zones (3/10/30 km) around ongoing outbreaks
 *  - Enterprises (pig farms, poultry farms, etc.) within region bounds
 *
 * Smaller and simpler than the main OutbreakMap — no controls beyond
 * scroll-zoom, no full-screen, no choropleth.
 */
export function RegionMiniMap({
  geo,
  outbreaks,
  enterprises,
  onSelectOutbreak,
}: RegionMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);

  // Compute region bbox for initial view
  const bbox = useMemo<[number, number, number, number] | null>(() => {
    if (!geo.features.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const visit = (coords: unknown) => {
      if (typeof (coords as number[])[0] === "number") {
        const [x, y] = coords as number[];
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      } else if (Array.isArray(coords)) {
        for (const c of coords) visit(c);
      }
    };
    for (const f of geo.features) {
      visit((f.geometry as { coordinates: unknown }).coordinates);
    }
    if (minX === Infinity) return null;
    return [minX, minY, maxX, maxY];
  }, [geo]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !bbox) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          "osm-light": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution: "&copy; OSM &copy; CARTO",
          },
        },
        layers: [{
          id: "bg",
          type: "raster",
          source: "osm-light",
        }],
      },
      center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
      zoom: 6,
      interactive: true,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [bbox]);

  // Update layers when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bbox) return;

    const update = () => {
      // Remove old layers/sources
      ["region-outline", "outbreaks-circle", "outbreaks-circle-active", "risk-zones-line", "enterprises-circle"].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      ["region-polygon", "outbreaks-points", "risk-zones", "enterprises-points"].forEach((s) => {
        if (map.getSource(s)) map.removeSource(s);
      });

      // 1. Region polygon outline
      map.addSource("region-polygon", { type: "geojson", data: geo });
      map.addLayer({
        id: "region-outline",
        type: "line",
        source: "region-polygon",
        paint: {
          "line-color": "#0ea5e9",
          "line-width": 2,
          "line-opacity": 0.6,
        },
      });

      // 2. Risk zones (around ongoing outbreaks only)
      const ongoing = outbreaks.filter((o) => o.status === "Ongoing" && typeof o.lat === "number" && typeof o.lon === "number");
      const riskFeatures: GeoJSON.Feature[] = [];
      for (const o of ongoing) {
        const profile = DISEASE_PROFILES_BY_KEY[o.disease_key];
        const zones = [
          { label: "protection", r: profile?.protection_zone_km ?? 3, color: "#dc2626", width: 2 },
          { label: "surveillance", r: profile?.surveillance_zone_km ?? 10, color: "#f59e0b", width: 1.5 },
          { label: "restriction", r: profile?.restriction_zone_km ?? 30, color: "#3b82f6", width: 1.5 },
        ];
        for (const z of zones) {
          const coords = makeCircle([o.lon!, o.lat!], z.r);
          riskFeatures.push({
            type: "Feature",
            properties: { label: z.label, color: z.color, width: z.width },
            geometry: { type: "Polygon", coordinates: [coords] },
          });
        }
      }
      if (riskFeatures.length) {
        map.addSource("risk-zones", { type: "geojson", data: { type: "FeatureCollection", features: riskFeatures } });
        map.addLayer({
          id: "risk-zones-line",
          type: "line",
          source: "risk-zones",
          paint: {
            "line-color": ["get", "color"],
            "line-width": ["get", "width"],
            "line-opacity": 0.5,
            "line-dasharray": [3, 2],
          },
        });
      }

      // 3. Outbreaks — clustered circle layer
      // Apply local jitter to break up outbreaks with the same lat/lon
      // (multiple outbreaks at the same region centroid still stack).
      // Jitter is deterministic per outbreak.id so re-renders are stable.
      const seen = new Map<string, number>(); // key="lon,lat rounded" → count
      const outbreakFeatures: GeoJSON.Feature<GeoJSON.Point>[] = outbreaks
        .filter((o) => typeof o.lat === "number" && typeof o.lon === "number")
        .map((o) => {
          // Quantize to 0.001° (~100 m) and find how many we've seen at this spot
          const qlon = Math.round(o.lon! * 1000) / 1000;
          const qlat = Math.round(o.lat! * 1000) / 1000;
          const key = `${qlon},${qlat}`;
          const n = (seen.get(key) ?? 0);
          seen.set(key, n + 1);

          // If multiple at same spot, spread them on a small spiral
          // around the centroid. Spiral radius grows with n.
          let lon = o.lon!;
          let lat = o.lat!;
          if (n > 0) {
            const angle = n * 2.39996; // golden angle in radians (~137.5°)
            const r = 0.008 * Math.sqrt(n); // ~800m * sqrt(n) in degrees
            lon = qlon + r * Math.cos(angle);
            lat = qlat + r * Math.sin(angle);
          }

          return {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [lon, lat] },
            properties: {
              id: o.id,
              disease: o.disease,
              disease_key: o.disease_key,
              date: o.date,
              status: o.status,
              cases: o.cases,
              species: o.species,
              color: diseaseColor(o.disease_key, o.disease_group),
              isOngoing: o.status === "Ongoing",
            },
          };
        });

      if (outbreakFeatures.length) {
        map.addSource("outbreaks-points", {
          type: "geojson",
          data: { type: "FeatureCollection", features: outbreakFeatures },
          cluster: true,
          clusterMaxZoom: 16,   // keep clustering longer (was 14)
          clusterRadius: 40,    // bigger cluster radius (was 30)
        });

        // Resolved (smaller, dimmer)
        map.addLayer({
          id: "outbreaks-circle",
          type: "circle",
          source: "outbreaks-points",
          filter: ["all", ["!", ["has", "point_count"]], ["!", ["get", "isOngoing"]]],
          paint: {
            "circle-radius": 5,
            "circle-color": ["get", "color"],
            "circle-opacity": 0.5,
            "circle-stroke-width": 1,
            "circle-stroke-color": ["get", "color"],
          },
        });

        // Ongoing (bigger, white stroke)
        map.addLayer({
          id: "outbreaks-circle-active",
          type: "circle",
          source: "outbreaks-points",
          filter: ["all", ["!", ["has", "point_count"]], ["get", "isOngoing"]],
          paint: {
            "circle-radius": 7,
            "circle-color": ["get", "color"],
            "circle-opacity": 0.85,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        // Click → popup + onSelectOutbreak
        const popup = new Popup({ closeButton: true, maxWidth: "260px" });
        const onClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as Record<string, unknown>;
          const html = `
            <div style="font-family: inherit; font-size: 11px; line-height: 1.4;">
              <div style="font-weight: 600; color: ${(p.color as string) ?? "#000"}; margin-bottom: 4px;">
                ${p.disease as string}
              </div>
              <div style="color: #6b7280;">
                ${new Date(p.date as string).toLocaleDateString("ru-RU")}
                ${p.status === "Ongoing" ? ' · <span style="color:#dc2626;">активна</span>' : ""}
              </div>
              <div>Случаев: <b>${(p.cases as number) ?? 0}</b></div>
              <div>Вид: ${speciesRu(p.species as string)}</div>
            </div>
          `;
          popup.setHTML(html).setLngLat(e.lngLat).addTo(map);

          const id = p.id as number;
          const o = outbreaks.find((x) => x.id === id);
          if (o) onSelectOutbreak?.(o);
        };
        map.on("click", "outbreaks-circle", onClick);
        map.on("click", "outbreaks-circle-active", onClick);

        const onEnter = () => { map.getCanvas().style.cursor = "pointer"; };
        const onLeave = () => { map.getCanvas().style.cursor = ""; };
        map.on("mouseenter", "outbreaks-circle", onEnter);
        map.on("mouseleave", "outbreaks-circle", onLeave);
        map.on("mouseenter", "outbreaks-circle-active", onEnter);
        map.on("mouseleave", "outbreaks-circle-active", onLeave);
      }

      // 4. Enterprises within bbox
      const entFeatures: GeoJSON.Feature<GeoJSON.Point>[] = enterprises
        .filter((e) => typeof e.lat === "number" && typeof e.lon === "number"
          && e.lon >= bbox[0] - 0.5 && e.lon <= bbox[2] + 0.5
          && e.lat >= bbox[1] - 0.5 && e.lat <= bbox[3] + 0.5)
        .map((e) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [e.lon, e.lat] },
          properties: {
            name: e.name,
            type: e.type,
          },
        }));

      if (entFeatures.length) {
        map.addSource("enterprises-points", {
          type: "geojson",
          data: { type: "FeatureCollection", features: entFeatures },
        });
        map.addLayer({
          id: "enterprises-circle",
          type: "circle",
          source: "enterprises-points",
          paint: {
            "circle-radius": 4,
            "circle-color": "#16a34a",
            "circle-opacity": 0.8,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
          },
        });

        const popup = new Popup({ closeButton: true, maxWidth: "240px" });
        const onClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as Record<string, unknown>;
          popup.setHTML(`
            <div style="font-size: 11px;">
              <div style="font-weight: 600;">${p.name as string}</div>
              <div style="color: #6b7280;">${enterpriseTypeRu(p.type as string)}</div>
            </div>
          `).setLngLat(e.lngLat).addTo(map);
        };
        map.on("click", "enterprises-circle", onClick);
        map.on("mouseenter", "enterprises-circle", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "enterprises-circle", () => { map.getCanvas().style.cursor = ""; });
      }

      // Fit to bbox with padding
      map.fitBounds(bbox, { padding: 30, maxZoom: 9 });
    };

    if (map.loaded()) update();
    else map.on("load", update);

    // Cleanup: removing layers/sources at the start of next update() handles
    // re-runs. We don't need to manually off() handlers because removeLayer()
    // also drops any listeners attached to that layer id. Popup instances
    // are GC'd when their anchor layer is removed.
  }, [geo, outbreaks, enterprises, bbox, onSelectOutbreak]);

  const enterpriseCount = enterprises.filter((e) =>
    bbox && typeof e.lat === "number" && typeof e.lon === "number"
    && e.lon >= bbox[0] - 0.5 && e.lon <= bbox[2] + 0.5
    && e.lat >= bbox[1] - 0.5 && e.lat <= bbox[3] + 0.5
  ).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/40 px-2.5 py-1.5 text-[10px]">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <span className="h-2 w-2 rounded-full bg-red-500" /> очаги
          <span className="mx-1 text-muted-foreground">·</span>
          <span className="h-2 w-2 rounded-full bg-green-600" />
          <Factory className="h-3 w-3" /> предприятия
        </div>
        <div className="text-muted-foreground tabular-nums">
          {outbreaks.length} оч. · {enterpriseCount} пр.
        </div>
      </div>
      <div ref={containerRef} className="h-[260px] w-full" />
      <div className="flex items-center gap-2 border-t bg-muted/20 px-2.5 py-1 text-[9px] text-muted-foreground">
        <AlertCircle className="h-3 w-3" />
        <span>зоны риска: 3 км / 10 км / 30 км</span>
      </div>
    </Card>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────

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

/** Generate a circular polygon (lon, lat) with given radius in km. */
function makeCircle(center: [number, number], radiusKm: number): [number, number][] {
  const points: [number, number][] = [];
  const steps = 48;
  const lat = center[1];
  const lon = center[0];
  // Approximate degrees per km
  const latPerKm = 1 / 111;
  const lonPerKm = 1 / (111 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    points.push([
      lon + radiusKm * lonPerKm * Math.cos(angle),
      lat + radiusKm * latPerKm * Math.sin(angle),
    ]);
  }
  return points;
}
