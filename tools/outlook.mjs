#!/usr/bin/env node
/**
 * tools/outlook.mjs — суточный дайджест (03:00 UTC): читает fresh-прогноз
 * Open-Meteo по всем станциям (чанками ≤ 25, с ретраями) + вчерашние
 * снапшоты → data/outlook.json.
 * Итог: 7-дневные THImax, дни превышения 72/80, топ-риски, осадки.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const STATIONS = JSON.parse(readFileSync(join(ROOT, 'data', 'stations.json'), 'utf8'));

const thi = (t, rh) => {
  const f = 1.8 * t + 32;
  return f - (0.55 - 0.0055 * rh) * (1.8 * t - 26);
};

async function fetchJson(url, ms = 30000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchJsonRetry(url, ms = 45000, tries = 3) {
  let err;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fetchJson(url, ms);
    } catch (e) {
      err = e;
      if (i < tries) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw err;
}

/* чанки по 25 станций — лимиты Open-Meteo на мульти-точечные запросы */
const om = [];
const CH = 25;
for (let i = 0; i < STATIONS.stations.length; i += CH) {
  const chunk = STATIONS.stations.slice(i, i + CH);
  const params = new URLSearchParams({
    daily: 'temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_mean,precipitation_sum',
    timezone: 'Europe/Moscow',
    forecast_days: '7',
    windspeed_unit: 'ms',
    latitude: chunk.map((s) => s.lat).join(','),
    longitude: chunk.map((s) => s.lon).join(','),
  });
  const part = await fetchJsonRetry(
    `https://api.open-meteo.com/v1/forecast?${params}`,
  ).catch(() => null);
  if (part == null) continue;
  om.push(...(Array.isArray(part) ? part : [part]));
}

const stations = [];
if (Array.isArray(om) && om.length === STATIONS.stations.length) {
  STATIONS.stations.forEach((st, i) => {
    const d = om[i].daily ?? {};
    const days = d.time ?? [];
    let ex72 = 0;
    let ex80 = 0;
    let thiMax7 = -999;
    const perDay = [];
    let precip7 = 0;
    for (let k = 0; k < days.length; k++) {
      const tMax = d.temperature_2m_max?.[k] ?? 0;
      const rhM = d.relative_humidity_2m_mean?.[k] ?? 60;
      const tMaxv = thi(tMax, Math.max(30, rhM - 12));
      thiMax7 = Math.max(thiMax7, tMaxv);
      if (tMaxv > 72) ex72++;
      if (tMaxv > 80) ex80++;
      precip7 += d.precipitation_sum?.[k] ?? 0;
      perDay.push(+tMaxv.toFixed(1));
    }
    stations.push({
      id: st.id,
      name: st.name,
      thiMax7: +thiMax7.toFixed(1),
      days72: ex72,
      days80: ex80,
      precip7: +precip7.toFixed(1),
      perDay,
    });
  });
}

/* вчерашний снапшот: доля часов THI>72 */
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const yFile = join(ROOT, 'data', 'snapshots', `${yesterday}.json`);
let yesterdaySummary = null;
if (existsSync(yFile)) {
  const snap = JSON.parse(readFileSync(yFile, 'utf8'));
  const hot = {};
  for (const h of snap.hours ?? []) {
    for (const [id, arr] of Object.entries(h.s ?? {})) {
      hot[id] ??= { hours: 0, hot72: 0, maxThi: -999 };
      hot[id].hours++;
      if (arr[3] > 72) hot[id].hot72++;
      hot[id].maxThi = Math.max(hot[id].maxThi, arr[3]);
    }
  }
  yesterdaySummary = { date: yesterday, perStation: hot };
}

const alerts = stations
  .filter((s) => s.days80 > 0)
  .map((s) => `${s.name}: THI>80 — ${s.days80} дн из 7 (max ${s.thiMax7})`);
const alerts72 = stations
  .filter((s) => s.days72 > 2 && s.days80 === 0)
  .map((s) => `${s.name}: THI>72 — ${s.days72} дн из 7`);
const wet = stations
  .filter((s) => s.precip7 > 20)
  .map((s) => `${s.name}: осадки ${s.precip7} мм/7дн — фасциолёз-риск`);

const outlook = {
  generatedAt: new Date().toISOString(),
  horizon: '7 дней',
  stations,
  yesterday: yesterdaySummary,
  digest: [...alerts, ...alerts72, ...wet],
};
writeFileSync(join(ROOT, 'data', 'outlook.json'), JSON.stringify(outlook, null, 1) + '\n');
console.log(`OK: outlook по ${stations.length} станциям, алертов: ${outlook.digest.length}`);
