"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import maplibregl, { Map as MLMap, Popup, Marker, LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "next-themes";

import type { Outbreak, OutbreakDataset, DiseaseProfile, DiseaseKey, DiseaseGroup } from "@/types/domain";
import { diseaseColor } from "@/lib/colors";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { DISEASE_PROFILES_BY_KEY } from "@/data/disease-profiles";
import { REGION_PROPERTIES } from "@/data/regions";
import { speciesRu, sourceRu } from "@/lib/i18n-species";

/** Safe color lookup that accepts string keys (cluster properties). */
function diseaseColorSafe(key: string): string {
  const labels = (DISEASE_LABELS as Record<string, { group: DiseaseGroup }>)[key];
  if (labels) return diseaseColor(key as DiseaseKey, labels.group);
  return "#757575";
}

const basePath = process.env.NODE_ENV === "production" ? "/vet-heatmap" : "";

// Russia bounds: [[west, south], [east, north]]
const RUSSIA_BOUNDS: LngLatBoundsLike = [[19, 41], [180, 82]];

interface OutbreakMapProps {
  outbreaks: Outbreak[];
  selectedOutbreak?: Outbreak | null;
  geo: GeoJSON.FeatureCollection | null;
  /** 🆕 Pre-computed region centroids (from page.tsx useMemo) — avoids
   *  recomputing bbox for 85 regions on every outbreaks change. */
  regionCentroids?: Map<string, [number, number]>;
  /** Show risk-zone circles around ongoing outbreaks (3/10/30 km). */
  showRiskZones: boolean;
  /** Show choropleth (density) layer. */
  showChoropleth: boolean;
  /** Show livestock density heatmap (pigs/cattle/poultry per km²). */
  densityLayer: "none" | "pigs" | "cattle" | "poultry";
  /** Show outbreak heatmap (replaces markers with density heatmap). */
  showHeatmap?: boolean;
  /** Called when user clicks an outbreak marker. */
  onSelectOutbreak?: (o: Outbreak) => void;
  /** Called when user clicks a region. */
  onSelectRegion?: (region: string) => void;
  /** Initial map center [lng, lat] (from URL params). */
  initialCenter?: [number, number];
  /** Initial zoom level (from URL params). */
  initialZoom?: number;
  /** Called when map moves (for URL sync). */
  onMapMove?: (center: [number, number], zoom: number) => void;
}

export function OutbreakMap({
  outbreaks,
  selectedOutbreak,
  geo,
  regionCentroids,
  showRiskZones,
  showChoropleth,
  densityLayer,
  showHeatmap = false,
  onSelectOutbreak,
  onSelectRegion,
  initialCenter,
  initialZoom,
  onMapMove,
}: OutbreakMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const popupsRef = useRef<Record<string, Popup>>({});
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const { resolvedTheme } = useTheme();
  const [ready, setReady] = useState(false);
  const [mapStyle, setMapStyle] = useState<"light" | "dark" | "satellite">(() => (resolvedTheme === "dark" ? "dark" : "light"));

  // 🆕 Memoized region → outbreak count (used by choropleth).
  // Previously computed inline inside the choropleth useEffect on every
  // dependency change; memoizing avoids the O(n) pass when other deps
  // (showChoropleth, resolvedTheme, …) change but `outbreaks` does not.
  const regionDensity = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of outbreaks) {
      const key = o.region_geo;
      if (!key) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [outbreaks]);

  // ─── Init map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const isDark = resolvedTheme === "dark";

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "osm-light": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          },
          "osm-dark": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution: '&copy; OSM &copy; CARTO',
          },
          "satellite": {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            attribution: "&copy; Esri",
          },
        },
        layers: [
          {
            id: "background-tiles",
            type: "raster",
            source: isDark ? "osm-dark" : "osm-light",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: initialCenter ?? [55, 60], // geographic center of Russia-ish (or URL-restored)
      zoom: initialZoom ?? 2.5,
      minZoom: 2,
      maxZoom: 12,
      maxBounds: RUSSIA_BOUNDS,
      attributionControl: { compact: true },
    });

    map.on("load", () => {
      setReady(true);
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

    mapRef.current = map;

    // Notify parent of map position changes (for URL sharing)
    let moveTimer: ReturnType<typeof setTimeout> | null = null;
    const onMoveEnd = () => {
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        const c = map.getCenter();
        const z = map.getZoom();
        onMapMove?.([c.lng, c.lat], z);
      }, 500); // debounce 500ms — avoid URL update on every frame
    };
    map.on("moveend", onMoveEnd);

    // Listen for external "focus region" events (from SearchBox).
    // Fly to the region's bounding-box center + appropriate zoom.
    const onFocusRegion = (e: Event) => {
      const shapeName = (e as CustomEvent<string>).detail;
      if (!shapeName || !geo) return;
      const f = geo.features.find(
        (feat) => (feat.properties as { shapeName?: string }).shapeName === shapeName,
      );
      if (!f) return;
      // Compute bbox of the region
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
      visit((f.geometry as { coordinates: unknown }).coordinates);
      if (minX === Infinity) return;
      const bounds: [[number, number], [number, number]] = [[minX, minY], [maxX, maxY]];
      map.fitBounds(bounds, { padding: 40, maxZoom: 8, duration: 1200 });
    };
    window.addEventListener("vet:focusRegion", onFocusRegion as EventListener);

    // Resize observer — handles mobile URL bar show/hide + viewport changes
    if (mapContainer.current && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        mapRef.current?.resize();
      });
      ro.observe(mapContainer.current);
      // Store for cleanup
      resizeObserverRef.current = ro;
    }

    // Also resize on window resize (mobile URL bar toggle, orientation change)
    const onWindowResize = () => mapRef.current?.resize();
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("orientationchange", onWindowResize);

    return () => {
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("orientationchange", onWindowResize);
      window.removeEventListener("vet:focusRegion", onFocusRegion as EventListener);
      resizeObserverRef.current?.disconnect();
      // cleanup markers
      Object.values(markersRef.current).forEach((m) => m.remove());
      Object.values(popupsRef.current).forEach((p) => p.remove());
      markersRef.current = {};
      popupsRef.current = {};
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []); // init once

  // ─── Switch base layer on style/theme change ────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const styleSource = mapStyle === "satellite" ? "satellite" : mapStyle === "dark" ? "osm-dark" : "osm-light";
    if (map.getLayer("background-tiles")) {
      map.removeLayer("background-tiles");
    }
    map.addLayer(
      {
        id: "background-tiles",
        type: "raster",
        source: styleSource,
        minzoom: 0,
        maxzoom: 19,
      },
      // insert before any other layers if they exist
      map.getStyle().layers.find((l) => l.id.startsWith("choropleth") || l.id.startsWith("risk") || l.id.startsWith("outbreak"))?.id,
    );
  }, [mapStyle, resolvedTheme, ready]);

  // ─── Choropleth layer ───────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !geo) return;

    // Add source if missing
    if (!map.getSource("regions")) {
      map.addSource("regions", { type: "geojson", data: geo, promoteId: "shapeName" });
    } else {
      (map.getSource("regions") as maplibregl.GeoJSONSource).setData(geo);
    }

    // 🆕 Use memoized density (was inline O(n) on every render)
    const density = regionDensity;
    const maxCount = Math.max(1, ...density.values());

    // Color stops (YlOrRd-ish)
    const stops: [number, string][] = [
      [0, "#ffffff00"],
      [1 / maxCount, "#fff5eb"],
      [Math.max(0.25, 1 / maxCount), "#fd8d3c"],
      [Math.max(0.5, 1 / maxCount), "#e6550d"],
      [1, "#a63603"],
    ];

    if (map.getLayer("choropleth-fill")) {
      map.removeLayer("choropleth-fill");
    }
    if (map.getLayer("choropleth-line")) {
      map.removeLayer("choropleth-line");
    }
    if (map.getLayer("choropleth-hover")) {
      map.removeLayer("choropleth-hover");
    }

    if (showChoropleth) {
      map.addLayer({
        id: "choropleth-fill",
        type: "fill",
        source: "regions",
        layout: {},
        paint: {
          "fill-color": {
            property: "shapeName",
            type: "interval",
            stops: stops.map(([t, c]) => [t * maxCount, c]),
            default: "#ffffff00",
          },
          "fill-opacity": 0.55,
        },
      });
      map.addLayer({
        id: "choropleth-line",
        type: "line",
        source: "regions",
        layout: {},
        paint: {
          "line-color": resolvedTheme === "dark" ? "#555" : "#888",
          "line-width": 0.5,
          "line-opacity": 0.4,
        },
      });
      // Hover highlight
      map.addLayer({
        id: "choropleth-hover",
        type: "line",
        source: "regions",
        layout: {},
        paint: {
          "line-color": "#1B5E20",
          "line-width": 2,
          "line-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 1, 0],
        },
      });
    }

    // Region click → callback
    const onClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      const f = e.features?.[0];
      if (!f) return;
      const name = (f.properties as { shapeName: string }).shapeName;
      onSelectRegion?.(name);
    };
    map.on("click", "choropleth-fill", onClick);
    map.on("click", "choropleth-line", onClick);

    return () => {
      map.off("click", "choropleth-fill", onClick);
      map.off("click", "choropleth-line", onClick);
    };
  }, [geo, outbreaks, showChoropleth, ready, resolvedTheme, onSelectRegion, regionDensity]);

  // ─── Outbreak markers ──────────────────────────────────────────────
  // PERFORMANCE: Always use MapLibre circle layers + clustering.
  // HTML markers were used previously on desktop for nicer popup UX,
  // but with >500 outbreaks this created 1000+ DOM nodes + Popups +
  // event listeners and crippled the page. Circle layers are GPU-rendered
  // and handle 10k+ points smoothly. Popups still work via click handler.
  // HTML markers are only used for tiny datasets (< 80 points) where the
  // overhead is negligible and the UX gain is real.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!geo) return;

    // Always use MapLibre clustered layers (no HTML markers)
    // This solves marker overlapping in region centers and improves performance.
    const useHtmlMarkers = false;
    Object.values(markersRef.current).forEach((m) => m.remove());
    Object.values(popupsRef.current).forEach((p) => p.remove());
    markersRef.current = {};
    popupsRef.current = {};

    // Remove old circle layers if switching from mobile to desktop or vice versa
    const layers = map.getStyle()?.layers ?? [];
    for (const l of layers) {
      if (l.id === "outbreaks-circle" || l.id === "outbreaks-circle-active" || l.id === "outbreaks-clusters" || l.id === "outbreaks-clusters-count") {
        map.removeLayer(l.id);
      }
    }
    if (map.getSource("outbreaks-points")) {
      map.removeSource("outbreaks-points");
    }

    if (outbreaks.length === 0) return;

    // 🆕 Use pre-computed centroids from page.tsx (was O(85) bbox calc on every render)
    const centroids = regionCentroids ?? new Map<string, [number, number]>();

    // Build GeoJSON points for all outbreaks
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    for (const o of outbreaks) {
      let lngLat: [number, number] | null = null;
      if (typeof o.lon === "number" && typeof o.lat === "number"
          && Number.isFinite(o.lon) && Number.isFinite(o.lat)
          && !(o.lon === 0 && o.lat === 0)) {
        lngLat = [o.lon, o.lat];
      } else if (o.region_geo) {
        const c = centroids.get(o.region_geo);
        if (c && Number.isFinite(c[0]) && Number.isFinite(c[1]) && c[0] !== 0) {
          lngLat = c;
        }
      }
      if (!lngLat) continue;

      const color = diseaseColor(o.disease_key, o.disease_group);
      const isOngoing = o.status === "Ongoing";
      const size = 8 + Math.min(Math.sqrt(o.cases || 1) / 2, 18);

      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: lngLat },
        properties: {
          id: o.id,
          disease: o.disease,
          disease_key: o.disease_key,
          disease_group: o.disease_group,
          region: o.region,
          region_geo: o.region_geo ?? "",
          source: o.source,
          notes: o.notes ?? "",
          date: o.date,
          status: o.status,
          cases: o.cases,
          deaths: o.deaths,
          species: o.species,
          color,
          isOngoing,
          size,
        },
      });
    }

    if (features.length === 0) return;

    const geojson: GeoJSON.FeatureCollection = { type: "FeatureCollection", features };

    if (useHtmlMarkers) {
      // ─── Desktop with small dataset: use HTML markers (best popup UX) ─
      for (const o of outbreaks) {
        const color = diseaseColor(o.disease_key, o.disease_group);
        const isOngoing = o.status === "Ongoing";

        // Use precise coords if available, else region centroid
        let lngLat: [number, number] | null = null;
        if (typeof o.lon === "number" && typeof o.lat === "number"
            && Number.isFinite(o.lon) && Number.isFinite(o.lat)
            && !(o.lon === 0 && o.lat === 0)) {
          lngLat = [o.lon, o.lat];
        } else if (o.region_geo) {
          const c = centroids.get(o.region_geo);
          if (c && Number.isFinite(c[0]) && Number.isFinite(c[1]) && c[0] !== 0) {
            lngLat = c;
          }
        }
        if (!lngLat) continue;

        // Build HTML element
        const el = document.createElement("div");
        el.className = `outbreak-marker${isOngoing ? " outbreak-marker--active" : ""}`;
        el.style.cssText = `
          width: ${8 + Math.min(Math.sqrt(o.cases) / 2, 18)}px;
          height: ${8 + Math.min(Math.sqrt(o.cases) / 2, 18)}px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid ${isOngoing ? "#fff" : color};
          box-shadow: 0 0 0 ${isOngoing ? "2px" : "1px"} ${color}88;
          cursor: pointer;
          --ripple-color: ${color}99;
          ${isOngoing ? "" : ""}
        `;

        const popup = new Popup({ offset: 14, closeButton: true, maxWidth: "320px" }).setHTML(
          buildPopupHTML(o),
        );
        popupsRef.current[o.id] = popup;

        const marker = new Marker({ element: el }).setLngLat(lngLat).setPopup(popup).addTo(map);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectOutbreak?.(o);
        });
        markersRef.current[o.id] = marker;
      }

      return () => {
        Object.values(markersRef.current).forEach((m) => m.remove());
        Object.values(popupsRef.current).forEach((p) => p.remove());
        markersRef.current = {};
        popupsRef.current = {};
      };
    }

    // ─── Default: clustered circle layers (mobile OR large dataset) ────
    map.addSource("outbreaks-points", {
      type: "geojson",
      data: geojson,
      cluster: true,
      clusterMaxZoom: 14,        // was 12 — keep clustering longer to avoid
                                 // 886 individual points appearing too early
      clusterRadius: 50,         // was 40 — denser clusters
      clusterProperties: {       // aggregate counts for hover tooltip
        ongoing: ["+", ["case", ["==", ["get", "isOngoing"], true], 1, 0]],
      },
    });

      // Cluster count circles
      map.addLayer({
        id: "outbreaks-clusters",
        type: "circle",
        source: "outbreaks-points",
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 1, 12, 10, 18, 50, 28, 200, 40],
          "circle-color": ["interpolate", ["linear"], ["get", "point_count"], 1, "#f59e0b", 10, "#ef4444", 50, "#dc2626", 200, "#991b1b"],
          "circle-opacity": 0.6,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.5,
        },
      });

      // Cluster count text
      map.addLayer({
        id: "outbreaks-clusters-count",
        type: "symbol",
        source: "outbreaks-points",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
          "text-font": ["Noto Sans Regular"],
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Click cluster → zoom in (MapLibre 5.x: async/Promise, no callback)
      map.on("click", "outbreaks-clusters", async (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["outbreaks-clusters"] });
        if (features.length > 0) {
          const clusterId = (features[0].properties as { cluster_id?: number }).cluster_id;
          const source = map.getSource("outbreaks-points") as maplibregl.GeoJSONSource | undefined;
          if (!source || clusterId === undefined) return;
          try {
            const zoom = await source.getClusterExpansionZoom(clusterId);
            const geom = features[0].geometry;
            if (geom && geom.type === "Point") {
              map.easeTo({
                center: geom.coordinates as [number, number],
                zoom: zoom + 1,
                duration: 500,
              });
            }
          } catch {
            // cluster may have been removed during async wait — ignore
          }
        }
      });

      // Cluster hover → popup with disease breakdown
      const clusterPopup = new Popup({ closeButton: false, maxWidth: "240px", offset: 12 });
      const onClusterEnter = async (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f) return;
        map.getCanvas().style.cursor = "pointer";

        const clusterId = (f.properties as { cluster_id?: number }).cluster_id;
        const source = map.getSource("outbreaks-points") as maplibregl.GeoJSONSource | undefined;
        if (!source || clusterId === undefined) return;

        try {
          // MapLibre 5.x: getClusterLeaves returns a Promise
          const leaves = await source.getClusterLeaves(clusterId, 200, 0);
          if (!leaves || leaves.length === 0) return;
          const byDisease = new Map<string, number>();
          let ongoing = 0;
          for (const lf of leaves) {
            const p = lf.properties as { disease_key?: string; isOngoing?: boolean };
            const key = p.disease_key ?? "other";
            byDisease.set(key, (byDisease.get(key) ?? 0) + 1);
            if (p.isOngoing) ongoing++;
          }
          // Sort by count desc, take top 5
          const sorted = Array.from(byDisease.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
          const total = leaves.length;
          const otherCount = total - sorted.reduce((s, [, c]) => s + c, 0);

          const rows = sorted.map(([key, count]) => {
            const labels = (DISEASE_LABELS as Record<string, { short_ru: string }>)[key];
            const color = diseaseColorSafe(key);
            const pct = Math.round((count / total) * 100);
            return `
              <div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0;">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};"></span>
                <span style="flex:1;color:#1f2937;">${labels?.short_ru ?? key}</span>
                <span style="color:#6b7280;font-variant-numeric:tabular-nums;">${count} (${pct}%)</span>
              </div>
            `;
          }).join("");
          const otherRow = otherCount > 0
            ? `<div style="display:flex;align-items:center;gap:6px;font-size:11px;padding:2px 0;color:#9ca3af;">
                <span style="display:inline-block;width:8px;height:8px;"></span>
                <span style="flex:1;">прочее</span>
                <span style="font-variant-numeric:tabular-nums;">${otherCount}</span>
              </div>`
            : "";

          const html = `
            <div style="font-family:inherit;padding:2px;">
              <div style="font-size:11px;font-weight:600;color:#1f2937;margin-bottom:4px;">
                ${total} вспышек ${ongoing > 0 ? `· <span style="color:#dc2626;">${ongoing} активн.</span>` : ""}
              </div>
              ${rows}
              ${otherRow}
              <div style="font-size:10px;color:#9ca3af;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:4px;">
                клик — раскрыть кластер
              </div>
            </div>
          `;
          const geom = f.geometry;
          if (geom && geom.type === "Point") {
            clusterPopup.setHTML(html).setLngLat(geom.coordinates as [number, number]).addTo(map);
          }
        } catch {
          // cluster may have been removed during async wait — ignore
        }
      };
      const onClusterLeave = () => {
        map.getCanvas().style.cursor = "";
        clusterPopup.remove();
      };
      map.on("mouseenter", "outbreaks-clusters", onClusterEnter);
      map.on("mouseleave", "outbreaks-clusters", onClusterLeave);

      // Resolved outbreaks (smaller, dimmer) — unclustered only
      map.addLayer({
        id: "outbreaks-circle",
        type: "circle",
        source: "outbreaks-points",
        filter: ["all", ["!", ["has", "point_count"]], ["!", ["get", "isOngoing"]]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "size"], 0, 4, 30, 12],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.6,
          "circle-stroke-width": 1,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-opacity": 0.9,
        },
      });

      // Ongoing outbreaks (bigger, brighter) — unclustered only
      map.addLayer({
        id: "outbreaks-circle-active",
        type: "circle",
        source: "outbreaks-points",
        filter: ["all", ["!", ["has", "point_count"]], ["get", "isOngoing"]],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "size"], 0, 6, 30, 16],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 1,
        },
      });

      // Popup on click (works for both mobile tap and desktop click)
      const popup = new Popup({ closeButton: true, maxWidth: "300px" });
      const onPointClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as Record<string, unknown>;
        const html = buildPopupHTML({
          id: p.id as number,
          disease: p.disease as string,
          region: p.region as string,
          date: p.date as string,
          status: p.status as Outbreak["status"],
          cases: p.cases as number,
          deaths: p.deaths as number,
          species: p.species as string,
          disease_key: p.disease_key as Outbreak["disease_key"],
          disease_group: (p.disease_group as Outbreak["disease_group"]) ?? "Multi-species",
          region_geo: (p.region_geo as string) ?? "",
          source: (p.source as Outbreak["source"]) ?? "fsvps",
          notes: (p.notes as string) ?? "",
        } as Outbreak);
        popup.setHTML(html).setLngLat(e.lngLat).addTo(map);

        // Find the original outbreak object and call onSelectOutbreak
        const id = p.id as number;
        const o = outbreaks.find((x) => x.id === id);
        if (o) onSelectOutbreak?.(o);
      };
      map.on("click", "outbreaks-circle", onPointClick);
      map.on("click", "outbreaks-circle-active", onPointClick);

      // Cursor pointer on hover (desktop)
      const onMouseEnter = () => { map.getCanvas().style.cursor = "pointer"; };
      const onMouseLeave = () => { map.getCanvas().style.cursor = ""; };
      map.on("mouseenter", "outbreaks-circle", onMouseEnter);
      map.on("mouseleave", "outbreaks-circle", onMouseLeave);
      map.on("mouseenter", "outbreaks-circle-active", onMouseEnter);
      map.on("mouseleave", "outbreaks-circle-active", onMouseLeave);

      return () => {
        map.off("click", "outbreaks-circle", onPointClick);
        map.off("click", "outbreaks-circle-active", onPointClick);
        map.off("mouseenter", "outbreaks-circle", onMouseEnter);
        map.off("mouseleave", "outbreaks-circle", onMouseLeave);
        map.off("mouseenter", "outbreaks-circle-active", onMouseEnter);
        map.off("mouseleave", "outbreaks-circle-active", onMouseLeave);
        map.off("mouseenter", "outbreaks-clusters", onClusterEnter);
        map.off("mouseleave", "outbreaks-clusters", onClusterLeave);
        popup.remove();
        clusterPopup.remove();
      };
  }, [outbreaks, geo, ready, onSelectOutbreak]);

  // ─── Risk zones (only visible when zoomed in) ──────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // Remove existing risk zone layers
    const layers = map.getStyle()?.layers ?? [];
    for (const l of layers) {
      if (l.id.startsWith("risk-zone-")) {
        map.removeLayer(l.id);
      }
    }
    if (map.getSource("risk-zones")) {
      map.removeSource("risk-zones");
    }

    if (!showRiskZones) return;

    // PERFORMANCE: only show risk zones when zoomed in (zoom > 7 ≈ district level).
    // Was 6 — too low, drew 2658+ polygons for 886 ongoing outbreaks at
    // country-level zoom where they overlap into meaningless noise.
    const currentZoom = map.getZoom();
    if (currentZoom < 7) return;

    // Scale zone visibility based on zoom level
    // zoom 7-9:  only protection (3-5km) — barely visible, small dots
    // zoom 9-11: protection + surveillance
    // zoom 11+:  all three zones
    const showProtection = currentZoom >= 7;
    const showSurveillance = currentZoom >= 9;
    const showRestriction = currentZoom >= 11;

    // Build circles for ongoing outbreaks only
    const ongoing = outbreaks.filter((o) => o.status === "Ongoing");
    if (ongoing.length === 0) return;

    // Limit to visible area for performance
    const bounds = map.getBounds();
    let visible = ongoing.filter((o) => {
      const center = getOutbreakCenter(o, geo);
      if (!center) return false;
      return center[0] >= bounds.getWest() - 2 && center[0] <= bounds.getEast() + 2 &&
             center[1] >= bounds.getSouth() - 2 && center[1] <= bounds.getNorth() + 2;
    });

    // PERFORMANCE: cap at 60 nearest outbreaks to avoid drawing 180+ polygons
    // when zoomed out at region level. 60 × 3 zones = 180 polygons max.
    const MAX_RISK_ZONE_OUTBREAKS = 60;
    if (visible.length > MAX_RISK_ZONE_OUTBREAKS) {
      // Sort by distance to map center (closer first)
      const center = map.getCenter();
      visible.sort((a, b) => {
        const ca = getOutbreakCenter(a, geo);
        const cb = getOutbreakCenter(b, geo);
        if (!ca) return 1;
        if (!cb) return -1;
        const da = (ca[0] - center.lng) ** 2 + (ca[1] - center.lat) ** 2;
        const db = (cb[0] - center.lng) ** 2 + (cb[1] - center.lat) ** 2;
        return da - db;
      });
      visible = visible.slice(0, MAX_RISK_ZONE_OUTBREAKS);
    }

    const features: GeoJSON.Feature[] = [];
    for (const o of visible) {
      const center = getOutbreakCenter(o, geo);
      if (!center) continue;
      const profile = DISEASE_PROFILES_BY_KEY[o.disease_key];

      // Zone radii — use real values from disease profiles
      const protectionR = profile?.protection_zone_km ?? 3;
      const surveillanceR = profile?.surveillance_zone_km ?? 10;
      const restrictionR = profile?.restriction_zone_km ?? 30;

      // Only add zones that should be visible at current zoom
      if (showProtection) {
        features.push({
          type: "Feature",
          properties: { outbreak_id: o.id, label: "protection", color: "#dc2626", opacity: 0.25, radius_km: protectionR },
          geometry: { type: "Point", coordinates: center },
        });
      }
      if (showSurveillance) {
        features.push({
          type: "Feature",
          properties: { outbreak_id: o.id, label: "surveillance", color: "#f59e0b", opacity: 0.15, radius_km: surveillanceR },
          geometry: { type: "Point", coordinates: center },
        });
      }
      if (showRestriction) {
        features.push({
          type: "Feature",
          properties: { outbreak_id: o.id, label: "restriction", color: "#3b82f6", opacity: 0.08, radius_km: restrictionR },
          geometry: { type: "Point", coordinates: center },
        });
      }
    }

    if (features.length === 0) return;

    map.addSource("risk-zones", { type: "geojson", data: { type: "FeatureCollection", features } });

    // Draw as outline-only circles (no fill) to avoid covering markers
    const layerOrder = ["restriction", "surveillance", "protection"];
    const zoneStyles: Record<string, { opacity: number }> = {
      restriction: { opacity: 0.08 },
      surveillance: { opacity: 0.15 },
      protection: { opacity: 0.25 },
    };
    for (const label of layerOrder) {
      const hasFeatures = features.some((f) => f.properties?.label === label);
      if (!hasFeatures) continue;
      const zs = zoneStyles[label];
      map.addLayer({
        id: `risk-zone-${label}`,
        type: "circle",
        source: "risk-zones",
        filter: ["==", ["get", "label"], label],
        paint: {
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            7, ["*", ["get", "radius_km"], 3],
            10, ["*", ["get", "radius_km"], 15],
            13, ["*", ["get", "radius_km"], 80],
          ],
          "circle-color": ["get", "color"],
          "circle-opacity": zs.opacity,
          "circle-stroke-width": 1,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-opacity": 0.6,
        },
      });
    }
  }, [outbreaks, geo, showRiskZones, ready]);

  // Re-render risk zones on zoom change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !showRiskZones) return;

    let zoomTimer: ReturnType<typeof setTimeout> | null = null;
    const onZoom = () => {
      if (zoomTimer) clearTimeout(zoomTimer);
      zoomTimer = setTimeout(() => {
        // Trigger re-render of risk zones by toggling showRiskZones
        const layers = map.getStyle()?.layers ?? [];
        for (const l of layers) {
          if (l.id.startsWith("risk-zone-")) map.removeLayer(l.id);
        }
        if (map.getSource("risk-zones")) map.removeSource("risk-zones");

        const currentZoom = map.getZoom();
        if (currentZoom < 7) return;

        const showProtection = currentZoom >= 7;
        const showSurveillance = currentZoom >= 9;
        const showRestriction = currentZoom >= 11;

        const ongoing = outbreaks.filter((o) => o.status === "Ongoing");
        const bounds = map.getBounds();
        let visible = ongoing.filter((o) => {
          const center = getOutbreakCenter(o, geo);
          if (!center) return false;
          return center[0] >= bounds.getWest() - 2 && center[0] <= bounds.getEast() + 2 &&
                 center[1] >= bounds.getSouth() - 2 && center[1] <= bounds.getNorth() + 2;
        });

        // PERFORMANCE: cap at 60 nearest outbreaks (same as initial render)
        const MAX_RISK_ZONE_OUTBREAKS = 60;
        if (visible.length > MAX_RISK_ZONE_OUTBREAKS) {
          const mapCenter = map.getCenter();
          visible.sort((a, b) => {
            const ca = getOutbreakCenter(a, geo);
            const cb = getOutbreakCenter(b, geo);
            if (!ca) return 1;
            if (!cb) return -1;
            const da = (ca[0] - mapCenter.lng) ** 2 + (ca[1] - mapCenter.lat) ** 2;
            const db = (cb[0] - mapCenter.lng) ** 2 + (cb[1] - mapCenter.lat) ** 2;
            return da - db;
          });
          visible = visible.slice(0, MAX_RISK_ZONE_OUTBREAKS);
        }

        const features: GeoJSON.Feature[] = [];
        for (const o of visible) {
          const center = getOutbreakCenter(o, geo);
          if (!center) continue;
          const profile = DISEASE_PROFILES_BY_KEY[o.disease_key];
          const protectionR = profile?.protection_zone_km ?? 3;
          const surveillanceR = profile?.surveillance_zone_km ?? 10;
          const restrictionR = profile?.restriction_zone_km ?? 30;

          if (showProtection) features.push({ type: "Feature", properties: { outbreak_id: o.id, label: "protection", color: "#dc2626", opacity: 0.25, radius_km: protectionR }, geometry: { type: "Point", coordinates: center } });
          if (showSurveillance) features.push({ type: "Feature", properties: { outbreak_id: o.id, label: "surveillance", color: "#f59e0b", opacity: 0.15, radius_km: surveillanceR }, geometry: { type: "Point", coordinates: center } });
          if (showRestriction) features.push({ type: "Feature", properties: { outbreak_id: o.id, label: "restriction", color: "#3b82f6", opacity: 0.08, radius_km: restrictionR }, geometry: { type: "Point", coordinates: center } });
        }

        if (features.length === 0) return;
        map.addSource("risk-zones", { type: "geojson", data: { type: "FeatureCollection", features } });
        const zStyles: Record<string, { opacity: number }> = {
          restriction: { opacity: 0.08 },
          surveillance: { opacity: 0.15 },
          protection: { opacity: 0.25 },
        };
        for (const label of ["restriction", "surveillance", "protection"]) {
          if (!features.some((f) => f.properties?.label === label)) continue;
          const zs = zStyles[label];
          map.addLayer({ id: `risk-zone-${label}`, type: "circle", source: "risk-zones", filter: ["==", ["get", "label"], label], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, ["*", ["get", "radius_km"], 3], 10, ["*", ["get", "radius_km"], 15], 13, ["*", ["get", "radius_km"], 80]], "circle-color": ["get", "color"], "circle-opacity": zs.opacity, "circle-stroke-width": 1, "circle-stroke-color": ["get", "color"], "circle-stroke-opacity": 0.6 } });
        }
      }, 300); // debounce 300ms
    };

    map.on("zoomend", onZoom);
    return () => { map.off("zoomend", onZoom); if (zoomTimer) clearTimeout(zoomTimer); };
  }, [outbreaks, geo, showRiskZones, ready]);

  // ─── Selected Outbreak Highlight, Buffer Zones & Contact Links ───────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const selectedLayerIds = [
      "selected-buffer-restriction",
      "selected-buffer-surveillance",
      "selected-buffer-protection",
      "selected-connections",
      "selected-pulse",
    ];

    for (const id of selectedLayerIds) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource("selected-buffers")) map.removeSource("selected-buffers");
    if (map.getSource("selected-connections-src")) map.removeSource("selected-connections-src");
    if (map.getSource("selected-pulse-src")) map.removeSource("selected-pulse-src");

    if (!selectedOutbreak) return;

    const center = getOutbreakCenter(selectedOutbreak, geo);
    if (!center) return;

    const profile = DISEASE_PROFILES_BY_KEY[selectedOutbreak.disease_key];
    const protR = profile?.protection_zone_km ?? 3;
    const survR = profile?.surveillance_zone_km ?? 10;
    const restR = profile?.restriction_zone_km ?? 30;

    const bufferFeatures: GeoJSON.Feature[] = [
      {
        type: "Feature",
        properties: { zone: "restriction" },
        geometry: { type: "Point", coordinates: center },
      },
      {
        type: "Feature",
        properties: { zone: "surveillance" },
        geometry: { type: "Point", coordinates: center },
      },
      {
        type: "Feature",
        properties: { zone: "protection" },
        geometry: { type: "Point", coordinates: center },
      },
    ];

    map.addSource("selected-buffers", {
      type: "geojson",
      data: { type: "FeatureCollection", features: bufferFeatures },
    });

    map.addLayer({
      id: "selected-buffer-restriction",
      type: "fill",
      source: "selected-buffers",
      filter: ["==", ["get", "zone"], "restriction"],
      paint: { "fill-color": "#3b82f6", "fill-opacity": 0.15, "fill-outline-color": "#2563eb" },
    });
    map.addLayer({
      id: "selected-buffer-surveillance",
      type: "fill",
      source: "selected-buffers",
      filter: ["==", ["get", "zone"], "surveillance"],
      paint: { "fill-color": "#f59e0b", "fill-opacity": 0.22, "fill-outline-color": "#d97706" },
    });
    map.addLayer({
      id: "selected-buffer-protection",
      type: "fill",
      source: "selected-buffers",
      filter: ["==", ["get", "zone"], "protection"],
      paint: { "fill-color": "#dc2626", "fill-opacity": 0.3, "fill-outline-color": "#b91c1c" },
    });

    // Epidemiological contact links (same disease within 100km)
    const nearbySameDisease = outbreaks.filter((o) => {
      if (o.id === selectedOutbreak.id || o.disease_key !== selectedOutbreak.disease_key) return false;
      const c = getOutbreakCenter(o, geo);
      if (!c) return false;
      const dist = Math.hypot((c[0] - center[0]) * 111 * Math.cos((center[1] * Math.PI) / 180), (c[1] - center[1]) * 111);
      return dist <= 100;
    });

    if (nearbySameDisease.length > 0) {
      const lineFeatures: GeoJSON.Feature[] = nearbySameDisease.map((o) => {
        const c = getOutbreakCenter(o, geo)!;
        return {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [center, c] },
        };
      });

      map.addSource("selected-connections-src", {
        type: "geojson",
        data: { type: "FeatureCollection", features: lineFeatures },
      });

      map.addLayer({
        id: "selected-connections",
        type: "line",
        source: "selected-connections-src",
        paint: {
          "line-color": diseaseColor(selectedOutbreak.disease_key, selectedOutbreak.disease_group),
          "line-width": 2.5,
          "line-dasharray": [3, 2],
          "line-opacity": 0.9,
        },
      });
    }

    // Pulsing highlight marker
    map.addSource("selected-pulse-src", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: center } }],
      },
    });

    map.addLayer({
      id: "selected-pulse",
      type: "circle",
      source: "selected-pulse-src",
      paint: {
        "circle-radius": 16,
        "circle-color": "transparent",
        "circle-stroke-width": 3,
        "circle-stroke-color": "#ef4444",
        "circle-stroke-opacity": 0.9,
      },
    });

    // Fly map to selected outbreak center
    const bounds = map.getBounds();
    if (!bounds.contains(center)) {
      map.flyTo({ center, zoom: Math.max(map.getZoom(), 8), duration: 1000 });
    }

    return () => {
      for (const id of selectedLayerIds) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource("selected-buffers")) map.removeSource("selected-buffers");
      if (map.getSource("selected-connections-src")) map.removeSource("selected-connections-src");
      if (map.getSource("selected-pulse-src")) map.removeSource("selected-pulse-src");
    };
  }, [selectedOutbreak, outbreaks, geo, ready]);

  // ─── Livestock density layer ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !geo) return;

    // Remove old density layer
    if (map.getLayer("density-fill")) map.removeLayer("density-fill");
    if (map.getSource("density-data")) map.removeSource("density-data");

    if (densityLayer === "none" || !showChoropleth) return;

    // Build GeoJSON with density values
    const densityField = densityLayer === "pigs" ? "pigs_per_km2" : densityLayer === "cattle" ? "cattle_per_km2" : "poultry_per_km2";
    const maxDensity = Math.max(...Object.values(REGION_PROPERTIES).map(p => p[densityField] as number), 1);

    const features = geo.features.map((f) => {
      const name = (f.properties as { shapeName?: string }).shapeName;
      const props = name ? REGION_PROPERTIES[name] : undefined;
      const density = props ? (props[densityField] as number) : 0;
      return {
        ...f,
        properties: {
          ...f.properties,
          density,
          densityPercent: (density / maxDensity) * 100,
        },
      };
    });

    map.addSource("density-data", {
      type: "geojson",
      data: { type: "FeatureCollection", features },
    });

    const colors = densityLayer === "pigs"
      ? ["#fff5f0", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#a50f15"]
      : densityLayer === "cattle"
        ? ["#f7fcf5", "#c7e9c0", "#a1d99b", "#74c476", "#41ab5d", "#238b45"]
        : ["#fffbeb", "#fee391", "#fec44f", "#fe9929", "#ec7014", "#cc4c02"];

    map.addLayer({
      id: "density-fill",
      type: "fill",
      source: "density-data",
      layout: {},
      paint: {
        "fill-color": {
          property: "densityPercent",
          type: "interval",
          stops: [
            [0, colors[0]],
            [5, colors[1]],
            [15, colors[2]],
            [30, colors[3]],
            [50, colors[4]],
            [75, colors[5]],
          ],
          default: colors[0],
        },
        "fill-opacity": 0.6,
      },
    }, (() => {
      // Insert density layer BELOW choropleth-line if it exists.
      // Previous code had a bug: `"choropleth-line" in stringArray`
      // checks for an array INDEX named "choropleth-line", always false.
      const layers = map.getStyle()?.layers ?? [];
      const choroplethLine = layers.find((l) => l.id === "choropleth-line");
      return choroplethLine ? "choropleth-line" : undefined;
    })());
  }, [densityLayer, showChoropleth, geo, ready]);

  // ─── Outbreak heatmap layer ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !geo) return;

    // Remove existing heatmap
    if (map.getLayer("outbreak-heat")) map.removeLayer("outbreak-heat");
    if (map.getSource("outbreak-heat-data")) map.removeSource("outbreak-heat-data");

    if (!showHeatmap) return;

    // Build point GeoJSON from outbreaks
    const centroids = new Map<string, [number, number]>();
    for (const f of geo.features) {
      const name = (f.properties as { shapeName?: string }).shapeName;
      if (!name) continue;
      const bbox = computeBBox(f.geometry);
      if (bbox) centroids.set(name, [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]);
    }

    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    for (const o of outbreaks) {
      let lngLat: [number, number] | null = null;
      if (typeof o.lon === "number" && typeof o.lat === "number"
          && Number.isFinite(o.lon) && Number.isFinite(o.lat)
          && !(o.lon === 0 && o.lat === 0)) {
        lngLat = [o.lon, o.lat];
      } else if (o.region_geo) {
        const c = centroids.get(o.region_geo);
        if (c && c[0] !== 0) lngLat = c;
      }
      if (!lngLat) continue;

      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: lngLat },
        properties: {
          weight: Math.max(0.1, Math.min(1, (o.cases || 1) / 100)),
          active: o.status === "Ongoing" ? 1 : 0.3,
        },
      });
    }

    if (features.length === 0) return;

    map.addSource("outbreak-heat-data", {
      type: "geojson",
      data: { type: "FeatureCollection", features },
    });

    map.addLayer({
      id: "outbreak-heat",
      type: "heatmap",
      source: "outbreak-heat-data",
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 1, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 6, 3],
        "heatmap-color": [
          "interpolate", ["linear"], ["heatmap-density"],
          0, "rgba(0,0,0,0)",
          0.2, "rgba(33,102,172,0.4)",
          0.4, "rgba(103,169,207,0.6)",
          0.6, "rgba(209,229,240,0.7)",
          0.8, "rgba(253,219,199,0.8)",
          1, "rgba(239,138,98,0.9)",
        ],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 20, 6, 60],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0.8, 9, 0],
      },
    });
  }, [showHeatmap, outbreaks, geo, ready]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Floating base map style switcher pill */}
      <div className="absolute top-3 left-3 z-20 hidden sm:flex gap-1 rounded-full border border-white/15 bg-card/75 p-1 shadow-lg backdrop-blur-xl pointer-events-auto">
        {[
          { id: "dark", label: "🌙 Тёмная" },
          { id: "light", label: "☀️ Светлая" },
          { id: "satellite", label: "🛰️ Спутник" },
        ].map((st) => (
          <button
            key={st.id}
            onClick={() => setMapStyle(st.id as any)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
              mapStyle === st.id
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <div className="text-sm text-muted-foreground">Загрузка карты…</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function buildPopupHTML(o: Outbreak): string {
  const color = diseaseColor(o.disease_key, o.disease_group);
  const statusBadge =
    o.status === "Ongoing"
      ? '<span style="background:#D32F2F;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">АКТИВНО</span>'
      : o.status === "Resolved"
        ? '<span style="background:#2E7D32;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">ЗАВЕРШЕНО</span>'
        : '<span style="background:#757575;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">НЕИЗВЕСТНО</span>';

  return `
    <div style="font-family: inherit; padding: 4px 0;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${color};"></div>
        <strong style="font-size:14px;">${escapeHTML(o.disease)}</strong>
      </div>
      <div style="margin-bottom:8px;">${statusBadge}</div>
      <table style="font-size:12px;width:100%;border-spacing:0;">
        <tr><td style="color:#888;padding:2px 8px 2px 0;">Регион:</td><td style="font-weight:500;">${escapeHTML(o.region === 'Russia' || o.region === 'Russian Federation' ? 'Россия (без региона)' : o.region)}</td></tr>
        <tr><td style="color:#888;padding:2px 8px 2px 0;">Дата:</td><td>${formatDate(o.date)}</td></tr>
        <tr><td style="color:#888;padding:2px 8px 2px 0;">Вид:</td><td>${escapeHTML(speciesRu(o.species))}</td></tr>
        <tr><td style="color:#888;padding:2px 8px 2px 0;">Случаи:</td><td><strong>${o.cases.toLocaleString("ru-RU")}</strong></td></tr>
        <tr><td style="color:#888;padding:2px 8px 2px 0;">Пало:</td><td><strong style="color:#D32F2F;">${o.deaths.toLocaleString("ru-RU")}</strong></td></tr>
        <tr><td style="color:#888;padding:2px 8px 2px 0;">Источник:</td><td style="font-size:11px;">${sourceRu(o.source)}</td></tr>
      </table>
    </div>
  `;
}

function escapeHTML(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

/** Compute bounding box of a geometry — used as rough centroid source. */
function computeBBox(geom: GeoJSON.Geometry): [number, number, number, number] | null {
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
  visit((geom as { coordinates: unknown }).coordinates);
  if (minX === Infinity) return null;
  return [minX, minY, maxX, maxY];
}

function getOutbreakCenter(o: Outbreak, geo: GeoJSON.FeatureCollection | null): [number, number] | null {
  if (typeof o.lon === "number" && typeof o.lat === "number"
      && Number.isFinite(o.lon) && Number.isFinite(o.lat)
      && !(o.lon === 0 && o.lat === 0)) {
    return [o.lon, o.lat];
  }
  if (geo && o.region_geo) {
    for (const f of geo.features) {
      if ((f.properties as { shapeName?: string }).shapeName === o.region_geo) {
        const bbox = computeBBox(f.geometry);
        if (bbox) {
          const cx = (bbox[0] + bbox[2]) / 2;
          const cy = (bbox[1] + bbox[3]) / 2;
          // For Russia, cx=0 always means anti-meridian wraparound bug
          // (Chukotka spans -180..+180, midpoint = 0 = Atlantic Ocean).
          // Filter these out — outbreak won't render, but won't appear in
          // the wrong place either.
          if (Number.isFinite(cx) && Number.isFinite(cy) && cx !== 0) {
            return [cx, cy];
          }
        }
      }
    }
  }
  return null;
}

/** Build a circle polygon (lat/lng, rough — uses spherical-to-planar approximation). */
function makeCircle(center: [number, number], radiusKm: number, segments = 64): [number, number][] {
  const [lng, lat] = center;
  const latRad = (lat * Math.PI) / 180;
  const radiusDeg = radiusKm / 111; // 1 deg ≈ 111km (rough, ignores lat)
  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const dLng = (radiusDeg * Math.cos(angle)) / Math.cos(latRad || 0.0001);
    const dLat = radiusDeg * Math.sin(angle);
    points.push([lng + dLng, lat + dLat]);
  }
  return points;
}

// React.memo wrapper
import { memo } from "react";
export const OutbreakMapMemo = memo(OutbreakMap);
