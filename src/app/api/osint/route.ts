/**
 * OSINT-эндпоинт: открытые MQTT-брокеры по bbox Ростовской области.
 * Провайдеры: Shodan / Censys. API-ключ приходит в теле запроса
 * (ключ юзера, на сервере не хранится).
 */
import { NextResponse } from 'next/server';
import { RO_BBOX } from '@/lib/geo/rostov';
import type { MqttPoint } from '@/lib/types';

export const dynamic = 'force-dynamic';

function inBBox(lat: number, lon: number): boolean {
  return (
    lat >= RO_BBOX.minLat - 0.4 && lat <= RO_BBOX.maxLat + 0.4 &&
    lon >= RO_BBOX.minLon - 0.4 && lon <= RO_BBOX.maxLon + 0.4
  );
}

function weatherLike(banner: string): boolean {
  return /weather|meteo|temp|humid|esp|esp8266|dht|bme|bmp|sensor|weather-station|ws-|atmos/i.test(banner);
}

interface ShodanMatch {
  ip_str?: string;
  port?: number;
  latitude?: number;
  longitude?: number;
  org?: string;
  product?: string;
  data?: string;
}

async function fetchShodan(key: string): Promise<MqttPoint[]> {
  const r = await fetch(
    'https://api.shodan.io/shodan/host/search?key=' +
      encodeURIComponent(key) +
      '&query=' +
      encodeURIComponent('mqtt country:"RU"'),
    { signal: AbortSignal.timeout(20000) },
  );
  if (!r.ok) throw new Error(`shodan ${r.status}`);
  const json = await r.json();
  const out: MqttPoint[] = [];
  for (const m of (json.matches ?? []) as ShodanMatch[]) {
    if (m.latitude == null || m.longitude == null) continue;
    if (!inBBox(m.latitude, m.longitude)) continue;
    out.push({
      ip: m.ip_str ?? '?',
      port: m.port ?? 0,
      lat: m.latitude,
      lon: m.longitude,
      org: m.org ?? '—',
      provider: 'shodan',
      label: m.product ?? 'MQTT broker',
      banner: (m.data ?? '').slice(0, 300),
      weatherLike: weatherLike(m.data ?? ''),
    });
  }
  return out;
}

interface CensysHit {
  ip?: string;
  services?: { port?: number; banner?: string; service_name?: string }[];
  location?: { latitude?: number; longitude?: number; asn_description?: string };
}

async function fetchCensys(id: string, secret: string): Promise<MqttPoint[]> {
  const auth = Buffer.from(`${id}:${secret}`).toString('base64');
  const body = {
    q: 'services.mqtt.messages:"" and location.country: "Russia"',
    per_page: 100,
  };
  const r = await fetch('https://search.censys.io/api/v2/hosts/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`censys ${r.status}`);
  const json = await r.json();
  const out: MqttPoint[] = [];
  for (const h of (json.result?.hits ?? []) as CensysHit[]) {
    const lat = h.location?.latitude;
    const lon = h.location?.longitude;
    if (lat == null || lon == null) continue;
    if (!inBBox(lat, lon)) continue;
    const svc = h.services?.[0];
    out.push({
      ip: h.ip ?? '?',
      port: svc?.port ?? 0,
      lat, lon,
      org: h.location?.asn_description ?? '—',
      provider: 'censys',
      label: svc?.service_name ?? 'MQTT',
      banner: (svc?.banner ?? '').slice(0, 300),
      weatherLike: weatherLike(svc?.banner ?? ''),
    });
  }
  return out;
}

export async function POST(req: Request) {
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const provider = payload?.provider as string;
  try {
    if (provider === 'shodan') {
      const key = String(payload?.key ?? '');
      if (!key) return NextResponse.json({ error: 'shodan key required' }, { status: 400 });
      const points = await fetchShodan(key);
      return NextResponse.json({ provider, count: points.length, points });
    }
    if (provider === 'censys') {
      const id = String(payload?.key ?? '');
      const secret = String(payload?.secret ?? '');
      if (!id || !secret) return NextResponse.json({ error: 'censys id + secret required' }, { status: 400 });
      const points = await fetchCensys(id, secret);
      return NextResponse.json({ provider, count: points.length, points });
    }
    return NextResponse.json({ error: 'provider must be shodan or censys' }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'osint fetch failed' },
      { status: 502 },
    );
  }
}
