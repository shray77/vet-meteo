'use client';

/**
 * ГИС-КАРТА (Leaflet): топо-подложка OpenTopoMap / тёмная Carto.
 * Слои: THI-круги, METAR-станции, реки, коридор АЧС, зоны 5/20/100,
 * районы КГЛ, MQTT-точки OSINT.
 *
 * ФЛАГ-ФИКС: Leaflet 1.8+ вшивает флаг Украины в дефолтный префикс
 * атрибуции (svg.leaflet-attribution-flag). Заменяем префикс на чистую
 * ссылку (BSD-лицензия — заслуги сохранены), CSS-страховка в globals.css.
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MetarObs, MqttPoint } from '@/lib/types';
import type { PointAssessment } from '@/lib/assessment';
import { RIVERS, RO_BBOX, CCHF_DISTRICTS, ASF_DEMO_OUTBREAKS } from '@/lib/geo/rostov';
import { getAsfSpread } from '@/lib/models/asf';
import { getPlume, plumeColor, PLUME_PRESETS } from '@/lib/models/plume';
import { thiColor } from './StationColor';

export interface LayerToggles {
  rivers: boolean;
  asf: boolean;
  metar: boolean;
  osint: boolean;
  cchl: boolean;
  plume: boolean;
}

interface GisMapProps {
  assessments: Record<string, PointAssessment>;
  selectedId: string | null;
  onSelectPoint: (id: string) => void;
  metarStations: MetarObs[];
  osintPoints: MqttPoint[];
  outbreakIdx: number;
  onSelectOutbreak: (idx: number) => void;
  tile: 'topo' | 'dark';
  layers: LayerToggles;
  /** индекс часа в почасовом прогнозе (0 = 00:00 сегодня) */
  hourIdx: number;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function daysColor(days: number): string {
  if (days <= 2) return '#c0392b';
  if (days <= 5) return '#d95f2b';
  if (days <= 10) return '#e0a636';
  return '#b6c94b';
}

export default function GisMap(props: GisMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const labelRef = useRef<L.TileLayer | null>(null);
  const layersRef = useRef<Record<string, L.LayerGroup> | null>(null);

  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map('vetradar-map', {
      center: [47.9, 41.3],
      zoom: 7,
      minZoom: 6,
      maxZoom: 13,
      preferCanvas: true,
      zoomControl: true,
      attributionControl: true,
    });
    map.fitBounds([
      [RO_BBOX.minLat, RO_BBOX.minLon],
      [RO_BBOX.maxLat, RO_BBOX.maxLon],
    ]);
    // Убираем вшитый флаг: чистая ссылка вместо дефолтного префикса.
    map.attributionControl.setPrefix(
      '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps" target="_blank" rel="noreferrer">Leaflet</a>',
    );
    L.control.scale({ metric: true, imperial: false }).addTo(map);
    mapRef.current = map;

    layersRef.current = {
      thi: L.layerGroup().addTo(map),
      rivers: L.layerGroup().addTo(map),
      asf: L.layerGroup().addTo(map),
      metar: L.layerGroup().addTo(map),
      osint: L.layerGroup().addTo(map),
      cchl: L.layerGroup().addTo(map),
      plume: L.layerGroup().addTo(map),
    };

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
  }, []);

  // подложка: CARTO выпилен (требует их API-политику) → keyless Esri Dark Gray
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) map.removeLayer(tileRef.current);
    if (labelRef.current) map.removeLayer(labelRef.current);
    if (props.tile === 'topo') {
      tileRef.current = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        subdomains: 'abc',
        attribution: '© OpenTopoMap (CC-BY-SA) | SRTM',
        maxZoom: 17,
      });
      tileRef.current.addTo(map);
      tileRef.current.bringToBack();
    } else {
      tileRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Esri, HERE, Garmin, FAO, NOAA, USGS | © OpenStreetMap contributors', maxZoom: 16 },
      );
      labelRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 16 },
      );
      tileRef.current.addTo(map);
      labelRef.current.addTo(map);
      tileRef.current.bringToBack();
      labelRef.current.bringToBack();
    }
  }, [props.tile]);

  // THI-точки — на час скраббера (или THImax дня, если часа нет)
  useEffect(() => {
    const lg = layersRef.current?.thi;
    if (!lg) return;
    lg.clearLayers();
    const { selectedId, onSelectPoint, hourIdx } = props;
    for (const a of Object.values(props.assessments)) {
      const h = a.hourly[hourIdx];
      const today = a.outlook[0];
      const v = h ? h.thi : today?.thiMax;
      const color = thiColor(v);
      const sel = a.point.id === selectedId;
      L.circleMarker([a.point.lat, a.point.lon], {
        radius: sel ? 16 : 11,
        color: sel ? '#f5e6c4' : '#10130a',
        weight: sel ? 3 : 1,
        fillColor: Number.isFinite(v) ? color : '#6a6a4a',
        fillOpacity: 0.88,
      })
        .on('click', () => onSelectPoint(a.point.id))
        .addTo(lg);
      const wdir = h?.wdir;
      // ➤ смотрит на восток (90°): поворот = (направление выноса − 90°) = wdir + 90°
      const arrow =
        wdir != null
          ? `<span style="display:inline-block;transform:rotate(${(wdir + 90) % 360}deg);color:#b8bca8">➤</span> `
          : '';
      const label = L.divIcon({
        className: '',
        html: `<div style="transform:translate(-50%,-50%);pointer-events:none;white-space:nowrap;
          font:600 10px/1.25 ui-monospace,Consolas,monospace;text-align:center;color:#f2f0e4;
          text-shadow:0 1px 2px #000,0 0 3px #000">${esc(a.point.name)}<br/>
          ${arrow}<b style="color:${color};font-size:11px">${Number.isFinite(v) ? v.toFixed(0) : '—'}</b></div>`,
        iconSize: [0, 0],
      });
      L.marker([a.point.lat, a.point.lon], { icon: label, interactive: false })
        .on('click', () => onSelectPoint(a.point.id))
        .addTo(lg);
    }
  }, [props.assessments, props.selectedId, props.onSelectPoint, props.hourIdx]);

  // Плюм-слой: аэрозольный вынос из выбранного очага по прогнозному ветру
  useEffect(() => {
    const lg = layersRef.current?.plume;
    if (!lg) return;
    lg.clearLayers();
    if (!props.layers.plume) return;
    const ob = ASF_DEMO_OUTBREAKS[props.outbreakIdx];
    // ближайшая к очагу точка с почасовым ветром
    let best: PointAssessment | null = null;
    let bestD = Infinity;
    for (const a of Object.values(props.assessments)) {
      const d = Math.hypot(a.point.lat - ob.lat, a.point.lon - ob.lon);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    if (!best || best.hourly.length === 0) return;
    const cells = getPlume(
      { lat: ob.lat, lon: ob.lon },
      best.hourly.slice(0, 72),
      PLUME_PRESETS.generic,
    );
    const half = 0.025;
    for (const c of cells) {
      L.rectangle(
        [
          [c.lat - half, c.lon - half],
          [c.lat + half, c.lon + half],
        ],
        {
          color: plumeColor(c.dose),
          weight: 0,
          fillColor: plumeColor(c.dose),
          fillOpacity: 0.3 + 0.35 * c.dose,
        },
      )
        .bindTooltip(
          `аэрозоль-плюм из «${ob.name}»: доза ${(c.dose * 100).toFixed(0)}% от макс. (демо-модель, Gloster-подход)`,
        )
        .addTo(lg);
    }
  }, [props.layers.plume, props.outbreakIdx, props.assessments]);

  // реки
  useEffect(() => {
    const lg = layersRef.current?.rivers;
    if (!lg) return;
    lg.clearLayers();
    if (!props.layers.rivers) return;
    for (const r of RIVERS) {
      L.polyline(r.coords, {
        color: '#6fa3b5',
        weight: r.width,
        opacity: 0.85,
        dashArray: r.major ? undefined : '4 6',
      })
        .bindTooltip(`${r.name} (схематично)`)
        .addTo(lg);
    }
  }, [props.layers.rivers]);

  // КГЛ-районы
  useEffect(() => {
    const lg = layersRef.current?.cchl;
    if (!lg) return;
    lg.clearLayers();
    if (!props.layers.cchl) return;
    for (const d of CCHF_DISTRICTS) {
      L.circleMarker([d.lat, d.lon], {
        radius: 18,
        color: '#d9792b',
        weight: 1.5,
        dashArray: '3 4',
        fillOpacity: 0.06,
      })
        .bindTooltip(`${d.name} р-н — эндемичен по КГЛ (по прежним сезонам)`)
        .addTo(lg);
    }
  }, [props.layers.cchl]);

  // METAR
  useEffect(() => {
    const lg = layersRef.current?.metar;
    if (!lg) return;
    lg.clearLayers();
    if (!props.layers.metar) return;
    for (const s of props.metarStations) {
      if (s.lat == null || s.lon == null) continue;
      const rot = s.wdir ?? 0;
      const html = `<div style="transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;white-space:nowrap;
        font:600 11px/1.2 ui-monospace,monospace;color:#e8d9a0;text-shadow:0 1px 2px #000">
        <span style="display:inline-block;transform:rotate(${(rot + 90) % 360}deg);color:#e8d9a0">➤</span>
        ${s.temp != null ? s.temp.toFixed(0) + '°' : '—'}/${s.rh != null ? s.rh.toFixed(0) + '%' : '—'}</div>`;
      const icon = L.divIcon({ className: '', html, iconSize: [0, 0] });
      L.marker([s.lat, s.lon], { icon, zIndexOffset: 500 })
        .bindTooltip(
          `<b>${esc(s.icao)} ${esc(s.name)}</b><br/>T ${s.temp ?? '—'}°C · Td ${s.dewp ?? '—'}°C · RH ${s.rh != null ? s.rh.toFixed(0) : '—'}%<br/>ветер ${s.wdir ?? '—'}° ${s.wspd ?? '—'} м/с · QNH ${s.altim ?? '—'}<br/><span style="font-size:10px;opacity:.7">${esc(s.raw)}</span>`,
        )
        .addTo(lg);
    }
  }, [props.metarStations, props.layers.metar]);

  // OSINT MQTT
  useEffect(() => {
    const lg = layersRef.current?.osint;
    if (!lg) return;
    lg.clearLayers();
    if (!props.layers.osint) return;
    for (const p of props.osintPoints) {
      if (p.lat == null || p.lon == null) continue;
      const color = p.weatherLike ? '#69b45f' : '#9a8fc0';
      const html = `<div style="transform:translate(-50%,-50%);white-space:nowrap;pointer-events:auto;cursor:pointer;
        font:600 10px ui-monospace,monospace;color:${color};text-shadow:0 1px 2px #000">◆ ${esc(p.ip)}:${p.port}</div>`;
      L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html, iconSize: [0, 0] }), zIndexOffset: 400 })
        .bindTooltip(
          `<b>${esc(p.label)}</b> · ${esc(p.provider)}<br/>${esc(p.ip)}:${p.port}<br/>${esc(p.org)}<br/><span style="font-size:10px;opacity:.75">${esc(p.banner.slice(0, 120))}</span>`,
        )
        .addTo(lg);
    }
  }, [props.osintPoints, props.layers.osint]);

  // АЧС: коридор + зоны + очаги
  useEffect(() => {
    const lg = layersRef.current?.asf;
    if (!lg) return;
    lg.clearLayers();
    if (!props.layers.asf) return;
    const cells = getAsfSpread(props.outbreakIdx, 20);
    const half = 0.05;
    for (const c of cells) {
      L.rectangle(
        [
          [c.lat - half, c.lon - half],
          [c.lat + half, c.lon + half],
        ],
        { color: daysColor(c.days), weight: 0, fillColor: daysColor(c.days), fillOpacity: 0.42 },
      ).addTo(lg);
    }
    const ob = ASF_DEMO_OUTBREAKS[props.outbreakIdx];
    const { onSelectOutbreak } = props;
    ASF_DEMO_OUTBREAKS.forEach((o, i) => {
      const sel = i === props.outbreakIdx;
      const html = `<div style="transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;white-space:nowrap;
        font:700 11px ui-monospace,monospace;color:${sel ? '#ff6b5e' : '#d98a80'};
        text-shadow:0 1px 3px #000;${sel ? 'text-decoration:underline' : ''}">
        ☠ ${esc(o.name)}</div>`;
      L.marker([o.lat, o.lon], { icon: L.divIcon({ className: '', html, iconSize: [0, 0] }), zIndexOffset: 900 })
        .on('click', () => onSelectOutbreak(i))
        .bindTooltip(`${o.name} · ${o.date} · ДЕМО-ДАННЫЕ`)
        .addTo(lg);
    });
    const rings: [number, string, string][] = [
      [5_000, '#c0392b', 'I зона: карантин'],
      [20_000, '#d95f2b', 'II зона: наблюдение'],
      [100_000, '#e0a636', 'III зона: контроль'],
    ];
    for (const [r, color, label] of rings) {
      L.circle([ob.lat, ob.lon], {
        radius: r, color, weight: 1.5, dashArray: '6 6', fillOpacity: 0.03,
      })
        .bindTooltip(`${label} (5/20/100 км)`)
        .addTo(lg);
    }
  }, [props.outbreakIdx, props.layers.asf, props.onSelectOutbreak]);

  return (
    <div className="relative h-full w-full">
      <div id="vetradar-map" className="h-full w-full bg-[#0e100a]" />
      <div className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded border border-[#3a4030] bg-[#14170fd9] px-2.5 py-2 font-mono text-[10px] leading-4 text-[#d8dcc8] shadow-lg">
        <div className="mb-1 font-bold tracking-wider text-[#f0c674]">ЛЕГЕНДА</div>
        <div><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#5f9e5f]" />THI нет стресса</div>
        <div><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#e0a636]" />THI умеренный 72+</div>
        <div><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#d95f2b]" />THI тяжёлый 80+</div>
        <div><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#c0392b]" />THI критич. 90+</div>
        <div className="mt-1 border-t border-[#3a4030] pt-1">
          <span className="mr-1 text-[#c0392b]">▨</span>коридор АЧС (дни) ·
          <span className="mx-1 text-[#e8d9a0]">➤</span>METAR ·
          <span className="mr-1 text-[#69b45f]">◆</span>OSINT MQTT ·
          <span className="ml-1 text-[#e0a636]">▦</span>аэрозоль-плюм
        </div>
      </div>
    </div>
  );
}
