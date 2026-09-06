/**
 * ПЛЮМ-МОДЕЛЬ АЭРОЗОЛЬНОГО ПЕРЕНОСА (по мотивам Gloster/Donaldson —
 * дальний перенос ящура/ГПАП ветром): каждый час выпускаем «плюм-пуф»,
 * он адвективируется почасовым ветром и экспоненциально распадается
 * (период полураспада — параметр болезни). Доза накапливается в сетке 0.05°.
 *
 * ДЕМО-МОДЕЛЬ: без турбулентной диффузии и стабильности Паскуилла.
 */
import type { HourlyPoint } from '../types';

export interface PlumeCell {
  lat: number;
  lon: number;
  dose: number; // 0..1 от максимума
}

export interface PlumeParams {
  hours: number; // горизонт адвекции
  halfLifeH: number; // полураспад инфекционности, ч
  driftFactor: number; // доля скорости ветра, переносимая облаком
}

export const PLUME_PRESETS: Record<string, PlumeParams & { label: string }> = {
  fmd: { label: 'Ящур (FMDV, 60 км/3 сут)', hours: 72, halfLifeH: 8, driftFactor: 0.55 },
  hpai: { label: 'ГПАП H5N1 (локальный)', hours: 48, halfLifeH: 3, driftFactor: 0.45 },
  generic: { label: 'Генерический аэрозоль', hours: 48, halfLifeH: 6, driftFactor: 0.5 },
};

const CELL = 0.05; // градусы

export function getPlume(
  origin: { lat: number; lon: number },
  hourly: HourlyPoint[],
  preset: PlumeParams,
): PlumeCell[] {
  const maxSteps = Math.min(preset.hours, hourly.length);
  if (maxSteps <= 0) return [];
  const doses = new Map<string, number>();
  const decay = Math.log(2) / preset.halfLifeH;

  for (let release = 0; release < maxSteps; release++) {
    // каждый час — новый пуф с единичной массой
    let lat = origin.lat;
    let lon = origin.lon;
    let mass = 1;
    for (let step = release; step < maxSteps; step++) {
      const h = hourly[step];
      const spd = Math.min(18, Math.max(0, h.wind)) * preset.driftFactor; // м/с
      const dir = ((h.wdir ?? 135) + 180) % 360; // wdir — откуда дует; вынос — куда дует
      const dt = 3600; // с
      const dLat = (spd * dt * Math.cos((dir * Math.PI) / 180)) / 111_320;
      const dLon = (spd * dt * Math.sin((dir * Math.PI) / 180)) / (111_320 * Math.cos((lat * Math.PI) / 180));
      lat += dLat;
      lon += dLon;
      mass *= Math.exp(-decay);
      if (mass < 0.02) break;

      // вклад в клетку (шаг 1 ч; «толщина» сечения — одна клетка)
      const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
      doses.set(key, (doses.get(key) ?? 0) + mass);
    }
  }

  let max = 0;
  for (const v of doses.values()) max = Math.max(max, v);
  if (max <= 0) return [];

  const out: PlumeCell[] = [];
  for (const [key, v] of doses) {
    const rel = v / max;
    if (rel < 0.04) continue; // шумовой порог
    const [la, lo] = key.split(',').map(Number);
    out.push({ lat: la, lon: lo, dose: +rel.toFixed(3) });
  }
  return out;
}

export function plumeColor(d: number): string {
  if (d > 0.6) return '#c0392b';
  if (d > 0.35) return '#d95f2b';
  if (d > 0.15) return '#e0a636';
  return '#b6c94b';
}
