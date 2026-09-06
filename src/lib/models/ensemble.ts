/**
 * АНСАМБЛЬ ECMWF (Open-Meteo ensemble API, без ключа):
 * p10/p50/p90 THImax по дням + P(THImax > 72 / > 80).
 * Фолбэк: локальная пертурбация детерминированного прогноза (51 член,
 * σ растёт с горизонтом) — помечается source: 'perturbed'.
 */
import type { EnsembleDay, EnsembleResult } from '../types';
import { thi } from './thi';

const ENS_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble';

const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function label(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return `${DAY_LABELS[d.getDay()]} ${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Собирает массивы членов из ответа ансамбль-API (ключи *_memberN / *_N). */
function collectMembers(json: any, varName: string): { dates: string[]; members: number[][] } {
  const daily = json.daily ?? {};
  const dates: string[] = daily.time ?? [];
  const members: number[][] = [];
  const re = new RegExp(`^${varName}(?:_member)?_?(\\d+)$`);
  for (const key of Object.keys(daily)) {
    if (key === varName) continue; // детерминированный/агрегированный массив — не член
    const m = key.match(re);
    if (m) members.push(daily[key]);
  }
  return { dates, members };
}

async function fetchJson(url: string, ms = 9000): Promise<any | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function fetchEnsemble(lat: number, lon: number): Promise<EnsembleResult | null> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    daily: 'temperature_2m_max,relative_humidity_2m_mean',
    models: 'ecmwf_ifs025',
    timezone: 'Europe/Moscow',
    forecast_days: '7',
  });
  const json = await fetchJson(`${ENS_URL}?${params}`);
  if (json?.daily?.time?.length) {
    const t = collectMembers(json, 'temperature_2m_max');
    const rh = collectMembers(json, 'relative_humidity_2m_mean');
    if (t.members.length >= 10 && t.dates.length) {
      const days: EnsembleDay[] = t.dates.map((date, i) => {
        const thiMaxes: number[] = [];
        for (let m = 0; m < t.members.length; m++) {
          const tMax = t.members[m][i];
          const rhM = rh.members[m]?.[i] ?? 55;
          if (tMax == null) continue;
          thiMaxes.push(thi(tMax, Math.max(30, Math.min(98, rhM - 10))));
        }
        thiMaxes.sort((a, b) => a - b);
        const n = thiMaxes.length || 1;
        return {
          date,
          label: label(date),
          p10: +pct(thiMaxes, 0.1).toFixed(1),
          p50: +pct(thiMaxes, 0.5).toFixed(1),
          p90: +pct(thiMaxes, 0.9).toFixed(1),
          p72: +(thiMaxes.filter((v) => v > 72).length / n).toFixed(2),
          p80: +(thiMaxes.filter((v) => v > 80).length / n).toFixed(2),
        };
      });
      return { source: 'ecmwf', days };
    }
  }
  return null; // вызывающий код сделает пертурбацию по детерминированному прогнозу
}

/** Пертурбационный «ансамбль» вокруг детерминированных THImax (51 член). */
export function perturbedEnsemble(daily: { date: string; thiMax: number }[]): EnsembleResult {
  const r = (seed: number) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const rnd = r(1337);
  const gauss = () => {
    const u = Math.max(1e-9, rnd());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  };
  const days: EnsembleDay[] = daily.slice(0, 7).map((d, i) => {
    const sigma = 0.9 + 0.55 * i; // σ растёт с горизонтом
    const members: number[] = [];
    for (let m = 0; m < 51; m++) members.push(d.thiMax + gauss() * sigma);
    members.sort((a, b) => a - b);
    const n = members.length;
    return {
      date: d.date,
      label: label(d.date),
      p10: +pct(members, 0.1).toFixed(1),
      p50: +pct(members, 0.5).toFixed(1),
      p90: +pct(members, 0.9).toFixed(1),
      p72: +(members.filter((v) => v > 72).length / n).toFixed(2),
      p80: +(members.filter((v) => v > 80).length / n).toFixed(2),
    };
  });
  return { source: 'perturbed', days };
}
