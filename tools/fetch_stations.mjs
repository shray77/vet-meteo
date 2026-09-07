#!/usr/bin/env node
/**
 * tools/fetch_stations.mjs — опрос станций для GitHub Actions.
 * Без зависимостей: Node 20 (глобальный fetch).
 *
 * 1. METAR (NOAA aviationweather, JSON) по аэропортам-ориентирам.
 * 2. Open-Meteo: мульти-точечные запросы чанками ≤ 25 станций с ретраями
 *    (49 точек: все 43 района Ростовской обл. + 2 ретрая на чанк).
 * 3. Считаем THI/THImax7/осадки-24ч/BRD-лайт.
 * 4. Пишем data/latest.json + дописываем снапшот дня data/snapshots/YYYY-MM-DD.json,
 *    подрезаем историю старше 30 дней.
 *
 * Коммит делает воркфлоу (git-шаги вынесены в YAML), скрипт только пишет файлы.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const STATIONS = JSON.parse(readFileSync(join(ROOT, 'data', 'stations.json'), 'utf8'));

const thi = (t, rh) => {
  const f = 1.8 * t + 32;
  return f - (0.55 - 0.0055 * rh) * (1.8 * t - 26);
};

/** THIadj (Mader et al. 2006): ветер обезветривает, радиация догружает. */
const thiMader = (t, rh, wind, swr) =>
  4.51 + thi(t, rh) - 1.992 * Math.max(0, wind) + 0.0068 * Math.max(0, swr || 0);

function rhFromTd(t, td) {
  const es = 6.112 * Math.exp((17.67 * t) / (t + 243.5));
  const e = 6.112 * Math.exp((17.67 * td) / (td + 243.5));
  return Math.max(1, Math.min(100, (e / es) * 100));
}

async function fetchJson(url, ms = 25000) {
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

async function fetchJsonRetry(url, ms = 30000, tries = 3) {
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

/* ---------- 1. METAR ---------- */
async function fetchMetar() {
  const ids = STATIONS.metar.map((m) => m.icao).join(',');
  try {
    const j = await fetchJson(
      `https://aviationweather.gov/api/data/metar?ids=${ids}&format=json&hours=1`,
    );
    const byIcao = new Map();
    for (const m of Array.isArray(j) ? j : []) {
      const temp = m.temp ?? null;
      const dewp = m.dewp ?? null;
      byIcao.set(m.icaoId, {
        icao: m.icaoId,
        t: temp,
        rh: temp != null && dewp != null ? Math.round(rhFromTd(temp, dewp)) : null,
        wdir: m.wdir ?? null,
        wspd: m.wspd != null ? Math.round(m.wspd * 0.514) : null, // kt → м/с
        raw: m.raw ?? '',
      });
    }
    return STATIONS.metar.map((m) => byIcao.get(m.icao) ?? { ...m, t: null, rh: null, wdir: null, wspd: null, raw: 'нет данных' });
  } catch (e) {
    console.error('METAR недоступен:', e.message);
    return STATIONS.metar.map((m) => ({ ...m, t: null, rh: null, wdir: null, wspd: null, raw: 'ошибка сети' }));
  }
}

/* ---------- 2. Open-Meteo (чанками по 25, с ретраями) ---------- */
const OM_FIELDS = {
  current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation',
  hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,shortwave_radiation',
  daily: 'temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_mean,precipitation_sum',
  timezone: 'Europe/Moscow',
  forecast_days: '7',
};

async function fetchOpenMeteo() {
  const all = [];
  const CH = 25;
  for (let i = 0; i < STATIONS.stations.length; i += CH) {
    const chunk = STATIONS.stations.slice(i, i + CH);
    const params = new URLSearchParams({
      ...OM_FIELDS,
      latitude: chunk.map((s) => s.lat).join(','),
      longitude: chunk.map((s) => s.lon).join(','),
    });
    const part = await fetchJsonRetry(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      45000,
      3,
    );
    all.push(...(Array.isArray(part) ? part : [part]));
  }
  return all;
}

/* ---------- BRD-лайт (скрининг) ---------- */
function brdLite(d) {
  const amp = d.tMax - d.tMin;
  let s = 0;
  if (amp > 14) s += 25; else if (amp > 10) s += 14;
  if (d.rhMean > 78) s += 22; else if (d.rhMean > 70) s += 12;
  if (d.precipSum > 3) s += 18; else if (d.precipSum > 1) s += 9;
  if (d.windMean < 2.5) s += 15;
  if (d.tempDrop < -5) s += 20; else if (d.tempDrop < -3) s += 10;
  return Math.min(100, s);
}

/* ---------- main ---------- */
const now = new Date();
const generatedAt = now.toISOString();
const dayKey = now.toISOString().slice(0, 10);

const [metar, om] = await Promise.all([fetchMetar(), fetchOpenMeteo().catch((e) => null)]);

const stations = [];
const snapRow = {};

if (Array.isArray(om) && om.length === STATIONS.stations.length) {
  STATIONS.stations.forEach((st, i) => {
    const w = om[i];
    const cur = w.current ?? {};
    const t = cur.temperature_2m ?? 0;
    const rh = cur.relative_humidity_2m ?? 60;
    const wind = cur.wind_speed_10m ?? 0;
    const wdir = cur.wind_direction_10m ?? null;
    // солнечная радиация текущего часа (ночь → 0/отсутствует)
    const hTimes = w.hourly?.time ?? [];
    const hIdx = cur.time ? hTimes.indexOf(String(cur.time).slice(0, 13) + ':00') : -1;
    const swr = hIdx >= 0 ? (w.hourly?.shortwave_radiation?.[hIdx] ?? 0) : 0;
    const thiAdj = thiMader(t, rh, wind, swr);
    const precip24 = (w.hourly?.precipitation ?? []).slice(0, 24).reduce((a, b) => a + (b ?? 0), 0);
    const daily = w.daily ?? {};
    let thiMax7 = -999;
    let tMaxPrev = null;
    let brd = 0;
    const days = daily.time ?? [];
    for (let d = 0; d < days.length; d++) {
      const tMax = daily.temperature_2m_max?.[d] ?? 0;
      const tMin = daily.temperature_2m_min?.[d] ?? 0;
      const rhM = daily.relative_humidity_2m_mean?.[d] ?? 60;
      thiMax7 = Math.max(thiMax7, thi(tMax, Math.max(30, rhM - 12)));
      if (d === 0) {
        const drop = tMaxPrev == null ? 0 : tMax - tMaxPrev;
        brd = brdLite({ tMax, tMin, rhMean: rhM, precipSum: daily.precipitation_sum?.[d] ?? 0, windMean: daily.wind_speed_10m_mean?.[d] ?? 3, tempDrop: drop });
      }
      tMaxPrev = tMax;
    }
    const row = {
      id: st.id,
      name: st.name,
      lat: st.lat,
      lon: st.lon,
      t: +t.toFixed(1),
      rh: Math.round(rh),
      wind: +wind.toFixed(1),
      wdir,
      precip24: +precip24.toFixed(1),
      thi: +thi(t, rh).toFixed(1),
      thiAdj: +thiAdj.toFixed(1),
      thiMaxToday: +(thi(daily.temperature_2m_max?.[0] ?? t, Math.max(30, (daily.relative_humidity_2m_mean?.[0] ?? 60) - 12))).toFixed(1),
      thiMax7: +thiMax7.toFixed(1),
      brd,
      source: 'open-meteo',
    };
    stations.push(row);
    snapRow[st.id] = [row.t, row.rh, row.wind, row.thi, row.thiAdj];
  });
} else {
  console.error('Open-Meteo недоступен, срез будет пустым по метео (METAR остаётся)');
}

const latest = { generatedAt, region: STATIONS.region, stations, metar };
writeFileSync(join(ROOT, 'data', 'latest.json'), JSON.stringify(latest, null, 1) + '\n');

/* ---------- снапшот дня ---------- */
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
if (!snap.hours.some((h) => h.ts === generatedAt)) {
  snap.hours.push({ ts: generatedAt, s: snapRow });
}
writeFileSync(snapFile, JSON.stringify(snap) + '\n');

/* ---------- подрезка истории (30 дней) ---------- */
const cut = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
for (const f of readdirSync(snapDir)) {
  const d = f.replace('.json', '');
  if (d < cut) {
    rmSync(join(snapDir, f));
    console.log('pruned', f);
  }
}

console.log(
  `OK: ${stations.length}/${STATIONS.stations.length} станций, METAR ${metar.filter((m) => m.t != null).length}/${STATIONS.metar.length}, снапшот ${dayKey} → ${snap.hours.length} записей`,
);
