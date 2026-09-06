/**
 * Топографический движок на РЕАЛЬНОМ SRTM-DEM (0.05°, src/lib/geo/dem.json).
 * Уклон/экспозиция, индекс застоя холодного воздуха (корытообразные
 * понижения), ветровая экспозиция и микроклиматические поправки к T/RH/ветру.
 * Рельеф настоящий, физика поправок — приближения прототипа.
 */
import { demElevation } from '../geo/rostov';
import type { TopoInfo } from '../types';

const step = 0.05; // ~5.5 км по широте — совпадает с шагом DEM-сетки

/** Расстояние на юг-север между узлами (м) и длина градуса долготы (м). */
const dLat = step * 111_320;
const dLonAt = (lat: number) => step * 1.0 * 111_320 * Math.cos((lat * Math.PI) / 180);

export function slopeAt(lat: number, lon: number): number {
  const ns = demElevation(lat + step, lon) - demElevation(lat - step, lon);
  const dLon = dLonAt(lat);
  const ew = demElevation(lat, lon + step) - demElevation(lat, lon - step);
  const runNS = 2 * dLat;
  const runEW = 2 * dLon;
  const slopeRad = Math.atan(Math.hypot(ns / runNS, ew / runEW));
  return (slopeRad * 180) / Math.PI;
}

export function aspectAt(lat: number, lon: number): { deg: number; label: string } {
  const ns = demElevation(lat + step, lon) - demElevation(lat - step, lon);
  const ew = demElevation(lat, lon + step) - demElevation(lat, lon - step);
  let deg = (Math.atan2(ew, ns) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  const labels = [
    [0, 'С'], [45, 'СВ'], [90, 'В'], [135, 'ЮВ'], [180, 'Ю'],
    [225, 'ЮЗ'], [270, 'З'], [315, 'СЗ'], [360, 'С'],
  ] as const;
  const label = labels.reduce((best, cur) =>
    Math.abs(cur[0] - deg) < Math.abs(best[0] - deg) ? cur : best, labels[0])[1];
  return { deg: Math.round(deg), label };
}

/**
 * Застой холодного воздуха: понижение рельефа → холодный воздух стекает
 * и стоит. Считаем: локальная вогнутость (высота ниже окружения) + малый уклон.
 * 0 (нет застоя) … 1 (корыто, ночью +2° риск заморозка/сырости).
 */
export function coldPoolIndex(lat: number, lon: number): number {
  const hC = demElevation(lat, lon);
  const ring = [
    [lat + step, lon], [lat - step, lon],
    [lat, lon + step], [lat, lon - step],
    [lat + step, lon + step], [lat - step, lon - step],
    [lat + step, lon - step], [lat - step, lon + step],
  ];
  const around = ring.reduce((s, [a, b]) => s + demElevation(a, b), 0) / ring.length;
  const concavity = Math.max(0, (around - hC) / 40);
  const slope = slopeAt(lat, lon) / 4;
  return Math.max(0, Math.min(1, concavity * (1 - Math.min(1, slope))));
}

/**
 * Ветровая экспозиция: гребень/наветренный склон обдуваются,
 * ложбины и подветренные склоны закрыты.
 */
export function windExposure(lat: number, lon: number, prevailingDeg = 240): number {
  const hC = demElevation(lat, lon);
  const upwind = demElevation(
    lat - step * Math.cos((prevailingDeg * Math.PI) / 180),
    lon - step * Math.cos((lat * Math.PI) / 180) * Math.sin((prevailingDeg * Math.PI) / 180),
  );
  const openness = Math.max(0, (hC - upwind + 60) / 120);
  const slope = slopeAt(lat, lon) / 5;
  return Math.max(0, Math.min(1, 0.35 + openness * 0.4 + slope * 0.25));
}

export function topoInfoAt(lat: number, lon: number): TopoInfo {
  const slope = slopeAt(lat, lon);
  const { deg, label } = aspectAt(lat, lon);
  const coldPool = coldPoolIndex(lat, lon);
  const windExp = windExposure(lat, lon);
  const notes: string[] = [];
  if (coldPool > 0.55) notes.push('застой холодного воздуха ночью (сырость, заморозки, BRD+)');
  if (windExp < 0.35) notes.push('закрытое место: слабое проветривание, в жару хуже');
  if (windExp > 0.7) notes.push('наветренный склон: сквозняки в холодный сезон');
  if (slope > 3) notes.push('склон, сток осадков');
  return {
    slope: +slope.toFixed(2),
    aspectDeg: deg,
    aspectLabel: label,
    coldPool: +coldPool.toFixed(2),
    windExposure: +windExp.toFixed(2),
    note: notes.join('; ') || 'ровное проветриваемое место',
  };
}

/**
 * Микроклиматические поправки к метео точки:
 * T понижается с высотой (~0.65°/100м от базовой 80м),
 * застой ночью +охлаждение и +RH, экспозиция ускоряет ветер.
 */
export function topoAdjust(
  temp: number,
  rh: number,
  wind: number,
  lat: number,
  lon: number,
  alt: number,
  isNight: boolean,
): { temp: number; rh: number; wind: number } {
  const info = topoInfoAt(lat, lon);
  let t = temp - Math.max(0, (alt - 80) / 100) * 0.65;
  let r = rh;
  if (isNight) {
    t -= info.coldPool * 2.2;
    r += info.coldPool * 9;
  } else {
    t += info.slope > 3 && info.aspectDeg > 135 && info.aspectDeg < 225 ? 0.6 : 0;
  }
  const w = wind * (0.6 + info.windExposure);
  r = Math.max(15, Math.min(100, r));
  return { temp: +t.toFixed(1), rh: Math.round(r), wind: +w.toFixed(1) };
}
