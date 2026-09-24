#!/usr/bin/env node
/**
 * tools/cf-slice.mjs — опциональный срез через CF Worker vet-api (динамический оффлоад).
 *
 * GET $VET_API_URL/v1/meteo/slice → строгая валидация схемы → запись
 * data/latest.json + data/forecast.json + снапшот дня (логика 1-в-1 из fetch_stations.mjs).
 *
 * Любая ошибка (сеть, схема, таймаут) → exit 1 → воркфлоу stations.yml запускает
 * локальный фолбэк tools/fetch_stations.mjs. Без зависимостей: Node 20 (глобальный fetch).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const API = (process.env.VET_API_URL ?? '').replace(/\/+$/, '');
if (!API) {
  console.error('VET_API_URL не задан — cf-slice пропущен');
  process.exit(1);
}

const ctl = new AbortController();
const timer = setTimeout(() => ctl.abort(), 45000);
let r;
try {
  r = await fetch(`${API}/v1/meteo/slice`, { signal: ctl.signal, headers: { accept: 'application/json' } });
} finally {
  clearTimeout(timer);
}
if (!r.ok) {
  console.error('vet-api slice HTTP', r.status);
  process.exit(1);
}
const d = await r.json();

/* ---------- строгая валидация схемы (не ломаем потребителей alerts/verify/docs) ---------- */
const fail = (m) => {
  console.error('валидация не прошла:', m);
  process.exit(1);
};
if (!d || typeof d !== 'object') fail('нет объекта');
if (!d.generatedAt || Number.isNaN(Date.parse(d.generatedAt))) fail('generatedAt');
if (typeof d.region !== 'string' || !d.region) fail('region');
if (!Array.isArray(d.stations)) fail('stations');
if (!Array.isArray(d.metar)) fail('metar');
const NEED = ['id', 'name', 'lat', 'lon', 't', 'rh', 'wind', 'wdir', 'precip24', 'thi', 'thiAdj', 'thiMaxToday', 'thiMax7', 'brd', 'source'];
for (const s of d.stations) {
  for (const k of NEED) if (!(k in s)) fail(`станция ${s.id ?? '?'}: нет поля ${k}`);
}
// forecast может отсутствовать (деградация Open-Meteo) — тогда не трогаем forecast.json
if (d.forecast != null) {
  if (!d.forecast.generatedAt || !d.forecast.h0 || !Array.isArray(d.forecast.stations)) fail('forecast-схема');
  if (!d.forecast.stations.length) d.forecast = null;
}

/* ---------- 1. data/latest.json (формат 1-в-1 с fetch_stations.mjs: без forecast) ---------- */
const latest = { generatedAt: d.generatedAt, region: d.region, stations: d.stations, metar: d.metar };
writeFileSync(join(ROOT, 'data', 'latest.json'), JSON.stringify(latest, null, 1) + '\n');

/* ---------- 2. data/forecast.json ---------- */
if (d.forecast) {
  const fc = { generatedAt: d.forecast.generatedAt, h0: d.forecast.h0, hours: d.forecast.hours, stations: d.forecast.stations };
  writeFileSync(join(ROOT, 'data', 'forecast.json'), JSON.stringify(fc) + '\n');
}

/* ---------- 3. снапшот дня (логика 1-в-1 из fetch_stations.mjs) ---------- */
const now = new Date(d.generatedAt);
const dayKey = now.toISOString().slice(0, 10);
const snapRow = {};
for (const s of d.stations) snapRow[s.id] = [s.t, s.rh, s.wind, s.thi, s.thiAdj];
const snapDir = join(ROOT, 'data', 'snapshots');
mkdirSync(snapDir, { recursive: true });
const snapFile = join(snapDir, `${dayKey}.json`);
let snap = { date: dayKey, hours: [] };
if (existsSync(snapFile)) {
  try {
    snap = JSON.parse(readFileSync(snapFile, 'utf8'));
  } catch {
    /* битый файл — перезапишем */
  }
}
// не дублируем один и тот же час
if (!snap.hours.some((h) => h.ts === d.generatedAt)) {
  snap.hours.push({ ts: d.generatedAt, s: snapRow });
}
writeFileSync(snapFile, JSON.stringify(snap) + '\n');

/* ---------- 4. подрезка истории (30 дней) ---------- */
const cut = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
for (const f of readdirSync(snapDir)) {
  const dd = f.replace('.json', '');
  if (dd < cut) {
    rmSync(join(snapDir, f));
    console.log('pruned', f);
  }
}

console.log(
  `OK (CF vet-api): ${d.stations.length} станций, METAR ${d.metar.filter((m) => m.t != null).length}/${d.metar.length}, снапшот ${dayKey} → ${snap.hours.length} записей, прогноз: ${d.forecast ? d.forecast.stations.length + ' станций от ' + d.forecast.h0 : '—'}`,
);
