/** Прокси Open-Meteo (фолбэк для песочниц с ограниченным IP). */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const memCache = new Map<string, { at: number; json: any }>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat, lon required' }, { status: 400 });
  }
  const key = `${lat},${lon}`;
  const c = memCache.get(key);
  if (c && Date.now() - c.at < 10 * 60_000) return NextResponse.json(c.json);

  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation',
    daily: 'temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_mean,precipitation_sum',
    timezone: 'Europe/Moscow',
    forecast_days: '8',
  });
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return NextResponse.json({ error: `open-meteo ${r.status}` }, { status: 502 });
    const json = await r.json();
    memCache.set(key, { at: Date.now(), json });
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ error: 'open-meteo unreachable' }, { status: 502 });
  }
}
