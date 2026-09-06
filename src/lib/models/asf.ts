/**
 * Модель распространения АЧС от очага через популяцию кабана.
 * 1) Строим suitability-сетку 0.1° по bbox области: леса + вода + удалённость
 *    от городов → привлекательность среды для кабана.
 * 2) Дейкстра от клетки очага: цена шага = базовая дистанция / suitability,
 *    «дистанция» = накопленные км ночных переходов (волна ~12 км/ночь).
 * 3) Прогоняем 20 ночей → коридор: клетка + день достижения.
 * 4) Официальные зоны 5/20/100 км считаются отдельно (ВетИС-регламент).
 * Данные демо; прод-замена: лесополосы Landsat/ESA, популяция кабана РСХН.
 */
import { ASF_DEMO_OUTBREAKS, FORESTS, RIVERS, RO_BBOX } from '../geo/rostov';

export interface AsfCell {
  lat: number;
  lon: number;
  days: number;
}

const RES = 0.1;

function pointInPoly(lat: number, lon: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function suitability(lat: number, lon: number): number {
  let s = 0.25;
  for (const f of FORESTS) if (pointInPoly(lat, lon, f.coords)) { s += 0.5; break; }
  for (const r of RIVERS) {
    for (let i = 1; i < r.coords.length; i++) {
      const [p1, p2] = [r.coords[i - 1], r.coords[i]];
      const d = pointSegDistKm(lat, lon, p1, p2);
      if (d < 8) { s += 0.35; break; }
      if (d < 15) { s += 0.15; break; }
    }
  }
  const rostovDist = distanceKm(lat, lon, 47.23, 39.72);
  if (rostovDist < 25) s -= 0.3;
  return Math.max(0.05, Math.min(1, s));
}

function pointSegDistKm(
  lat: number, lon: number,
  [aLat, aLon]: [number, number],
  [bLat, bLon]: [number, number],
): number {
  const A = [aLat, aLon];
  const B = [bLat, bLon];
  const P = [lat, lon];
  const abx = B[0] - A[0];
  const aby = B[1] - A[1];
  const len2 = abx * abx + aby * aby;
  const t = Math.max(0, Math.min(1, ((P[0] - A[0]) * abx + (P[1] - A[1]) * aby) / len2));
  return distanceKm(lat, lon, A[0] + abx * t, A[1] + aby * t);
}

const corridorCache = new Map<string, AsfCell[]>();

/**
 * Коридор распространения от демо-очага idx: nights ночей × 12 км/ночь.
 * Клетка сетки 0.1° (~8 км по широте) — шаг волны. Соседей берём 8-связность.
 */
export function getAsfSpread(outbreakIdx: number, nights = 20): AsfCell[] {
  const ob = ASF_DEMO_OUTBREAKS[outbreakIdx];
  if (!ob) return [];
  const key = `${outbreakIdx}:${nights}`;
  const cached = corridorCache.get(key);
  if (cached) return cached;

  const lat0 = Math.round(ob.lat / RES) * RES;
  const lon0 = Math.round(ob.lon / RES) * RES;

  // dist: накопленные «км ночного перехода»
  const dist = new Map<string, number>();
  const startKey = `${lat0},${lon0}`;
  dist.set(startKey, 0);
  // приоритетная очередь на массиве (сеток немного, O(n²) ок для прототипа)
  const visited = new Set<string>();
  const maxKm = nights * 12;

  // 8-связность, шаг по 0.1°: N-S 8 км, E-W ~6.6 км, диагональ ~10.4 км
  const neighbors: [number, number, number][] = [
    [RES, 0, 8], [-RES, 0, 8], [0, RES, 6.6], [0, -RES, 6.6],
    [RES, RES, 10.4], [RES, -RES, 10.4], [-RES, RES, 10.4], [-RES, -RES, 10.4],
  ];

  const queue: string[] = [startKey];
  while (queue.length) {
    // достаём минимальный
    let bi = 0;
    for (let i = 1; i < queue.length; i++) {
      if (dist.get(queue[i])! < dist.get(queue[bi])!) bi = i;
    }
    const cur = queue.splice(bi, 1)[0];
    if (visited.has(cur)) continue;
    visited.add(cur);
    const [cLat, cLon] = cur.split(',').map(Number) as [number, number];

    for (const [dLat, dLon, km] of neighbors) {
      const nLat = +(cLat + dLat).toFixed(2);
      const nLon = +(cLon + dLon).toFixed(2);
      if (nLat < RO_BBOX.minLat || nLat > RO_BBOX.maxLat) continue;
      if (nLon < RO_BBOX.minLon || nLon > RO_BBOX.maxLon) continue;
      const nKey = `${nLat},${nLon}`;
      const suit = suitability(nLat, nLon);
      // в привлекательной среде кабан идёт охотнее → множитель <1
      const cost = km * (1.6 - suit * 1.2);
      const nd = dist.get(cur)! + cost;
      if (nd > maxKm) continue;
      if (!dist.has(nKey) || nd < dist.get(nKey)!) {
        dist.set(nKey, nd);
        queue.push(nKey);
      }
    }
  }

  const cells: AsfCell[] = [];
  for (const [k, d] of dist) {
    const [lat, lon] = k.split(',').map(Number) as [number, number];
    cells.push({ lat, lon, days: Math.ceil(d / 12) });
  }
  cells.sort((a, b) => a.days - b.days);
  corridorCache.set(key, cells);
  return cells;
}

/** Официальные радиусы (м): I карантин 5 км, II наблюдение 20 км, III контроль 100 км. */
export const ASF_ZONES: { radius: number; label: string; color: string }[] = [
  { radius: 5_000, label: 'I зона: карантин', color: '#c0392b' },
  { radius: 20_000, label: 'II зона: наблюдение', color: '#d95f2b' },
  { radius: 100_000, label: 'III зона: контроль', color: '#e0a636' },
];
