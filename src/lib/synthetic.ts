/**
 * Синтетический погодный генератор (фолбэк-режим «sandbox»):
 * детерминированный сид от id точки + смещения дня, климатология Ростовской
 * области (средние по месяцам), суточный ход, случайные фронтальные качели.
 */
import type { DailyPoint, HourlyPoint } from './types';

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Климатология: [Tmax, Tmin, RH, осадки/мес] по месяцам (Ростов-на-Дону). */
const CLIM: [number, number, number, number][] = [
  [-2, -7, 85, 55], [ -1, -7, 83, 45], [5, -2, 78, 40],
  [15, 5, 68, 40], [22, 11, 63, 50], [27, 16, 62, 60],
  [30, 19, 60, 55], [29, 18, 58, 40], [23, 13, 65, 45],
  [15, 7, 74, 50], [6, 1, 82, 60], [0, -5, 86, 60],
];

export function syntheticDaily(id: string, dayOffset: number): DailyPoint {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const month = d.getMonth();
  const rnd = mulberry32(hash(`${id}:${dayOffset}`));
  const [tMax, tMin, rh, pmon] = CLIM[month];
  // фронтальные качели ±4°
  const swing = (rnd() - 0.5) * 8;
  const tM = tMax + swing;
  const tN = tMin + swing * 0.7;
  const rhM = Math.max(30, Math.min(98, rh + (rnd() - 0.5) * 20));
  const wind = 2 + rnd() * 6;
  const precipProb = pmon / 700;
  const precip = rnd() < precipProb ? +(rnd() * 9).toFixed(1) : 0;
  const thiMax = thiVal(tM, rhM - 10);
  const thiMin = thiVal(tN, rhM + 8);
  return {
    date: d.toISOString().slice(0, 10),
    tMax: +tM.toFixed(1),
    tMin: +tN.toFixed(1),
    rhMean: Math.round(rhM),
    windMean: +wind.toFixed(1),
    precipSum: precip,
    thiMax: +thiMax.toFixed(1),
    thiMin: +thiMin.toFixed(1),
  };
}

function thiVal(t: number, rh: number): number {
  const f = 1.8 * t + 32;
  return f - (0.55 - 0.0055 * rh) * (1.8 * t - 26);
}

export function syntheticHourly(id: string, dayOffset: number): HourlyPoint[] {
  const day = syntheticDaily(id, dayOffset);
  const rnd = mulberry32(hash(`h:${id}:${dayOffset}`));
  const out: HourlyPoint[] = [];
  for (let h = 0; h < 24; h++) {
    const phase = Math.sin(((h - 4) / 24) * 2 * Math.PI - Math.PI / 2);
    const temp = day.tMin + (day.tMax - day.tMin) * (phase + 1) / 2;
    const rh = day.rhMean + (0.5 - (phase + 1) / 2) * 18 + (rnd() - 0.5) * 6;
    const wind = Math.max(0.3, day.windMean * (0.7 + Math.abs(Math.sin(h / 3.1)) * 0.6));
    const precip = h >= 12 && h <= 20 && day.precipSum > 0 ? +(day.precipSum / 8).toFixed(2) : 0;
    out.push({
      time: `${String(h).padStart(2, '0')}:00`,
      temp: +temp.toFixed(1),
      rh: Math.round(Math.max(20, Math.min(100, rh))),
      wind: +wind.toFixed(1),
      precip,
      thi: +thiVal(temp, rh).toFixed(1),
    });
  }
  return out;
}
