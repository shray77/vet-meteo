/**
 * METAR: парсинг сырых строк NOAA aviationweather.
 * Станции вокруг Ростовской области (координаты аэродромов).
 */
import type { MetarObs } from './types';

export const METAR_STATIONS: { icao: string; name: string; lat: number; lon: number }[] = [
  { icao: 'URRP', name: 'Ростов-на-Дону (Платов)', lat: 47.49, lon: 39.93 },
  { icao: 'URWW', name: 'Волгоград (Гумрак)', lat: 48.78, lon: 44.34 },
  { icao: 'URKK', name: 'Краснодар (Пашковский)', lat: 45.03, lon: 39.17 },
  { icao: 'URWI', name: 'Элиста', lat: 46.38, lon: 44.33 },
  { icao: 'UUOO', name: 'Воронеж', lat: 51.7, lon: 39.23 },
  { icao: 'URMT', name: 'Минеральные Воды', lat: 44.22, lon: 43.08 },
];

/** RH из T и Td (Магнус). */
export function rhFromTd(t: number, td: number): number {
  const es = 6.112 * Math.exp((17.67 * t) / (t + 243.5));
  const e = 6.112 * Math.exp((17.67 * td) / (td + 243.5));
  return Math.max(1, Math.min(100, (e / es) * 100));
}

/** Разбор METAR-строки до ключевых величин. */
export function parseMetar(raw: string, meta: { icao: string; name: string; lat: number; lon: number }): MetarObs {
  const obs: MetarObs = {
    icao: meta.icao, name: meta.name, lat: meta.lat, lon: meta.lon,
    raw, time: '', temp: null, dewp: null, rh: null, wdir: null, wspd: null, altim: null,
  };
  const m = raw.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
  if (m) obs.time = `${m[1]}:${m[2]}Z`;

  // ветер: dddff или dddffKT (или VRB)
  const w = raw.match(/\b(\d{3}|VRB)(\d{2})(G(\d{2}))?KT\b/);
  if (w) {
    obs.wdir = w[1] === 'VRB' ? null : Number(w[1]);
    obs.wspd = Math.round(Number(w[2]) * 0.514);
  }

  // видимость, облачность — пропускаем; ищем температуру Ttt/Tdd
  const t = raw.match(/\b(M?\d{2})\/(M?\d{2})\b/);
  if (t) {
    const parse = (s: string) => (s.startsWith('M') ? -Number(s.slice(1)) : Number(s));
    obs.temp = parse(t[1]);
    obs.dewp = parse(t[2]);
    obs.rh = Math.round(rhFromTd(obs.temp, obs.dewp));
  }

  const q = raw.match(/\bQ(\d{4})\b/);
  if (q) obs.altim = Number(q[1]);
  const q2 = raw.match(/\bA(\d{4})\b/);
  if (!q && q2) obs.altim = Math.round((Number(q2[1]) / 100) * 33.86);

  return obs;
}
