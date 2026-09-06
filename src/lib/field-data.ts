/**
 * Загрузчик погоды по точкам: Open-Meteo (прямой) → /api/meteo (прокси) → синтетика.
 * Возвращает 7+1 дней hourly + daily с бейджем источника.
 */
import type { DailyPoint, HourlyPoint, WeatherSource } from './types';
import { syntheticDaily, syntheticHourly } from './synthetic';

export interface WeatherBundle {
  source: WeatherSource;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
}

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';

function omUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    hourly:
      'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,shortwave_radiation,precipitation',
    daily: 'temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_mean,precipitation_sum',
    timezone: 'Europe/Moscow',
    forecast_days: '8',
  });
  return `${OPEN_METEO}?${params}`;
}

function thiVal(t: number, rh: number): number {
  const f = 1.8 * t + 32;
  return f - (0.55 - 0.0055 * rh) * (1.8 * t - 26);
}

function mapOm(json: any): WeatherBundle {
  const hourly: HourlyPoint[] = [];
  const ht: string[] = json.hourly?.time ?? [];
  for (let i = 0; i < ht.length; i++) {
    const temp = json.hourly.temperature_2m[i];
    const rh = json.hourly.relative_humidity_2m[i];
    if (temp == null || rh == null) continue;
    hourly.push({
      time: ht[i].slice(11, 16),
      temp: +temp.toFixed(1),
      rh: Math.round(rh),
      wind: +(json.hourly.wind_speed_10m?.[i] ?? 0).toFixed(1),
      wdir: json.hourly.wind_direction_10m?.[i] ?? null,
      swr: json.hourly.shortwave_radiation?.[i] ?? null,
      precip: +(json.hourly.precipitation?.[i] ?? 0).toFixed(1),
      thi: +thiVal(temp, rh).toFixed(1),
    });
  }
  const daily: DailyPoint[] = [];
  const dt: string[] = json.daily?.time ?? [];
  for (let i = 0; i < dt.length; i++) {
    const tMax = json.daily.temperature_2m_max?.[i];
    const tMin = json.daily.temperature_2m_min?.[i];
    const rhM = json.daily.relative_humidity_2m_mean?.[i] ?? 60;
    if (tMax == null || tMin == null) continue;
    daily.push({
      date: dt[i],
      tMax: +tMax.toFixed(1),
      tMin: +tMin.toFixed(1),
      rhMean: Math.round(rhM),
      windMean: +(json.daily.wind_speed_10m_mean?.[i] ?? 3).toFixed(1),
      precipSum: +(json.daily.precipitation_sum?.[i] ?? 0).toFixed(1),
      thiMax: +thiVal(tMax, Math.max(30, rhM - 12)).toFixed(1),
      thiMin: +thiVal(tMin, Math.min(98, rhM + 10)).toFixed(1),
    });
  }
  return { source: 'openmeteo', hourly, daily };
}

/** fetch с таймаутом. */
async function fetchTo(url: string, ms = 8000): Promise<any | null> {
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

export async function loadPointWeather(id: string, lat: number, lon: number): Promise<WeatherBundle> {
  // 1) прямой Open-Meteo (в браузере юзера — свой IP)
  const direct = await fetchTo(omUrl(lat, lon));
  if (direct?.hourly?.time?.length && direct?.daily?.time?.length) return mapOm(direct);

  // 2) через наш прокси
  const proxy = await fetchTo(
    `/api/meteo?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`,
    9000,
  );
  if (proxy?.hourly?.time?.length && proxy?.daily?.time?.length) {
    const b = mapOm(proxy);
    return { ...b, source: 'proxy' };
  }

  // 3) синтетика
  const daily: DailyPoint[] = [];
  const hourly: HourlyPoint[] = [];
  for (let d = 0; d < 8; d++) {
    daily.push(syntheticDaily(id, d));
    hourly.push(...syntheticHourly(id, d));
  }
  return { source: 'synthetic', hourly, daily };
}
