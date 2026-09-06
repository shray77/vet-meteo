/** Прокси NOAA METAR (кэш 10 мин). */
import { NextResponse } from 'next/server';
import { METAR_STATIONS, parseMetar } from '@/lib/metar';
import type { MetarObs } from '@/lib/types';

export const dynamic = 'force-dynamic';

let cache: { at: number; data: MetarObs[] } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 10 * 60_000) {
    return NextResponse.json({ stations: cache.data, cached: true });
  }
  const ids = METAR_STATIONS.map((s) => s.icao).join(',');
  try {
    const r = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${ids}&format=raw&hours=1`,
      { signal: AbortSignal.timeout(9000) },
    );
    const text = await r.text();
    const stations: MetarObs[] = [];
    for (const line of text.split('\n')) {
      const raw = line.trim();
      if (!raw) continue;
      const icao = raw.slice(0, 4);
      const meta = METAR_STATIONS.find((s) => s.icao === icao);
      if (!meta) continue;
      const obs = parseMetar(raw, meta);
      if (obs.temp != null) stations.push(obs);
    }
    if (stations.length) {
      cache = { at: Date.now(), data: stations };
      return NextResponse.json({ stations, cached: false });
    }
    return NextResponse.json({ stations: [], error: 'no metar parsed' }, { status: 502 });
  } catch {
    return NextResponse.json({ stations: [], error: 'aviationweather unreachable' }, { status: 502 });
  }
}
