#!/usr/bin/env node
/**
 * tools/vectors_climatology.mjs — климатология «Сезона векторов» (Task 244):
 * 30 сезонов 1997–2026 на 3 опорных станциях + вся сеть 49 станций за 2026 +
 * чувствительность к полному ECDC-якорю (22–27°C И RH≥75%).
 *
 * Модель — те же якоря, что в season.ts / vectors.mjs (дубликат констант):
 * активация при среднемесячной 10.5°C; пик квестинга при суточной 22–27°C
 * (полный якорь: с RH 75–100%); затишье при суточной >30°C.
 * Каждая станция-год считается независимо тем же season_window, что и панель.
 *
 * Выход: data/vectors_climatology.json (компакт: perYear + тренды + сеть).
 * Ручной запуск: node tools/vectors_climatology.mjs (данные ERA5 у Open-Meteo).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const STATIONS = JSON.parse(readFileSync(join(ROOT, 'data', 'stations.json'), 'utf8')).stations;
const BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s]));

/* === якоря (дубликат season.ts — HYALOMMA_ANCHORS) === */
const ACTIVATION = 10.5;  // ECDC: среднемесячная активации
const QMIN = 22, QMAX = 27; // ECDC: суточное окно пика
const HEAT = 30;           // ECDC: выше — прячутся в почву
const RH_FULL = 75;        // ECDC: полный якорь пика — RH 75–100%

const REF_IDS = ['taganrog', 'rostov', 'millerovo']; // юг → центр → север
const START = '1997-01-01'; // 30 сезонов до 2026 включительно

async function fetchJsonRetry(url, tries = 5) {
  let err;
  for (let i = 1; i <= tries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 60000);
      try {
        const r = await fetch(url, { signal: ctl.signal });
        if (!r.ok) throw new Error(`${r.status}`);
        return await r.json();
      } finally { clearTimeout(t); }
    } catch (e) {
      err = e;
      // 429 (rate limit) — пауза длинная, окно ~минута; прочее — короткая
      const is429 = String(e.message).includes('429');
      const waitMs = is429 ? 45000 * i : 2000 * i;
      if (i < tries) await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw err;
}

const pad = (n) => String(n).padStart(2, '0');
const isoTodayMsk = () => {
  const d = new Date(Date.now() + 3 * 3600e3);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/** ERA5-архив: суточные T (и RH) за [start, end] — паттерн vectors.mjs. */
async function archive(lat, lon, start, end, withRh) {
  const p = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    start_date: start, end_date: end, timezone: 'UTC',
    daily: withRh
      ? 'temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean'
      : 'temperature_2m_max,temperature_2m_min',
  });
  return fetchJsonRetry(`https://archive-api.open-meteo.com/v1/archive?${p}`);
}

/** Месячные средние Tmean (1..12; месяц без данных — null; toFixed(1) как vectors.mjs). */
function monthlyMeans(dates, tMaxs, tMins) {
  const sums = new Array(12).fill(0), counts = new Array(12).fill(0);
  dates.forEach((d, i) => {
    const m = Number(d.slice(5, 7));
    if (m >= 1 && m <= 12 && tMaxs[i] != null && tMins[i] != null) {
      sums[m - 1] += (tMaxs[i] + tMins[i]) / 2; counts[m - 1]++;
    }
  });
  return sums.map((s, i) => (counts[i] ? +(s / counts[i]).toFixed(1) : null));
}

function seasonWindow(mm) {
  const active = [];
  for (let m = 1; m <= 12; m++) if (mm[m - 1] != null && mm[m - 1] >= ACTIVATION) active.push(m);
  return active.length ? [Math.min(...active), Math.max(...active)] : [null, null];
}

function questingClass(tMean, rh, rhFull) {
  if (tMean > HEAT) return 'heat';
  if (tMean >= QMIN && tMean <= QMAX) {
    if (rhFull) return (rh != null && rh >= RH_FULL) ? 'peak' : 'active'; // полный якорь
    return 'peak';
  }
  if (tMean >= ACTIVATION) return 'active';
  return 'off';
}

function questingStats(dates, tMaxs, tMins, rhs, mOpen, mClose, rhFull) {
  const s = { peak: 0, active: 0, heat: 0, off: 0 };
  dates.forEach((d, i) => {
    const m = Number(d.slice(5, 7));
    if (mOpen != null && m >= mOpen && m <= mClose && tMaxs[i] != null && tMins[i] != null) {
      s[questingClass((tMaxs[i] + tMins[i]) / 2, rhs ? rhs[i] : null, rhFull)]++;
    }
  });
  return s;
}

/** Линейный тренд: наклон за единицу x + R². */
function linreg(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let sxx = 0, sxy = 0, syy = 0;
  xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i] - my); syy += (ys[i] - my) ** 2; });
  const b = sxx ? sxy / sxx : 0;
  return { b, r2: sxx && syy ? (sxy * sxy) / (sxx * syy) : 0 };
}

const today = isoTodayMsk();
const out = {
  generatedAt: new Date().toISOString(),
  model: 'hyalomma-season climatology (Task 244; модель season.ts/vectors.mjs без изменений)',
  anchors: { activationMonthlyMean: ACTIVATION, questingMin: QMIN, questingMax: QMAX,
             heatHide: HEAT, rhFullAnchor: RH_FULL,
             source: 'ECDC factsheet for experts «Hyalomma marginatum» (Tier 1)' },
  period: `${START.slice(0, 4)}–${today.slice(0, 4)}`,
  dataEnd: null,
  stations: {},
  network2026: null,
};

async function refStation(id) {
  const st = BY_ID[id];
  const j = await archive(st.lat, st.lon, START, today, true);
  const d = j.daily;
  const dates = d.time, tMaxs = d.temperature_2m_max, tMins = d.temperature_2m_min,
        rhs = d.relative_humidity_2m_mean;
  const perYear = [];
  for (let y = Number(START.slice(0, 4)); y <= Number(today.slice(0, 4)); y++) {
    const idx = dates.map((dt, i) => (dt.startsWith(String(y)) ? i : -1)).filter((i) => i >= 0);
    const mm = monthlyMeans(idx.map((i) => dates[i]), idx.map((i) => tMaxs[i]), idx.map((i) => tMins[i]));
    const [o, c] = seasonWindow(mm);
    const q = o != null
      ? questingStats(idx.map((i) => dates[i]), idx.map((i) => tMaxs[i]), idx.map((i) => tMins[i]),
                      idx.map((i) => rhs[i]), o, c, false)
      : { peak: 0, active: 0, heat: 0, off: 0 };
    const qFull = o != null
      ? questingStats(idx.map((i) => dates[i]), idx.map((i) => tMaxs[i]), idx.map((i) => tMins[i]),
                      idx.map((i) => rhs[i]), o, c, true)
      : { peak: 0, active: 0, heat: 0, off: 0 };
    const seasonIdx = idx.filter((i) => { const m = Number(dates[i].slice(5, 7)); return o != null && m >= o && m <= c; });
    const rh75 = seasonIdx.length
      ? +(100 * seasonIdx.filter((i) => rhs[i] != null && rhs[i] >= RH_FULL).length / seasonIdx.length).toFixed(1)
      : null;
    perYear.push({ year: y, open: o, close: c, april: mm[3],
                   peak: q.peak, heat: q.heat, peakFullAnchor: qFull.peak, rh75SeasonPct: rh75 });
  }
  const years = perYear.map((p) => p.year);
  const apr = perYear.map((p) => p.april).filter((v) => v != null);
  const pe = perYear.map((p) => p.peak);
  const prh = perYear.map((p) => p.peakFullAnchor);
  const tApr = linreg(years.slice(0, apr.length), apr);
  const tPe = linreg(years, pe);
  const tPrh = linreg(years, prh);
  return {
    id, name: st.name, lat: st.lat, lon: st.lon,
    perYear,
    aprilGateYears: apr.filter((v) => v >= ACTIVATION).length,
    openMonths: perYear.reduce((acc, p) => { acc[p.open] = (acc[p.open] || 0) + 1; return acc; }, {}),
    closeMonths: perYear.reduce((acc, p) => { acc[p.close] = (acc[p.close] || 0) + 1; return acc; }, {}),
    peakDays: { min: Math.min(...pe), max: Math.max(...pe), mean: +(pe.reduce((a, b) => a + b) / pe.length).toFixed(1) },
    peakDaysFullAnchor: { min: Math.min(...prh), max: Math.max(...prh), mean: +(prh.reduce((a, b) => a + b) / prh.length).toFixed(1) },
    trends: { aprilCPerDecade: +(tApr.b * 10).toFixed(2), peakDaysPerDecade: +(tPe.b * 10).toFixed(2),
              peakFullPerDecade: +(tPrh.b * 10).toFixed(2),
              r2: { april: +tApr.r2.toFixed(2), peak: +tPe.r2.toFixed(2), peakFull: +tPrh.r2.toFixed(2) } },
  };
}

console.log(`климатология ${out.period} · сегодня ${today} · 3 опорные станции + сеть 49`);
for (const id of REF_IDS) {
  const st = await refStation(id);
  out.dataEnd = today;
  out.stations[id] = st;
  console.log(`${st.name}: апрель-гейт ${st.aprilGateYears}/30; открытие ${JSON.stringify(st.openMonths)}; пик ${st.peakDays.min}..${st.peakDays.max} (ср. ${st.peakDays.mean}); полный якорь ср. ${st.peakDaysFullAnchor.mean}; тренд пика ${st.trends.peakDaysPerDecade} дн/декаду`);
}

/* — сеть 2026: все 49 станций, только T — */
const net = [];
for (const st of STATIONS) {
  const j = await archive(st.lat, st.lon, '2026-01-01', today, false);
  const d = j.daily;
  const mm = monthlyMeans(d.time, d.temperature_2m_max, d.temperature_2m_min);
  const [o, c] = seasonWindow(mm);
  const q = o != null
    ? questingStats(d.time, d.temperature_2m_max, d.temperature_2m_min, null, o, c, false)
    : { peak: 0, active: 0, heat: 0, off: 0 };
  net.push({ id: st.id, name: st.name, lat: st.lat, lon: st.lon,
             open: o, close: c, peak: q.peak, heat: q.heat, total: q.peak + q.active + q.heat + q.off });
  await new Promise((r) => setTimeout(r, 1500)); // вежливая пауза: ERA5-архив троттлит 429
}
const tLat = linreg(net.map((s) => s.lat), net.map((s) => s.peak));
out.network2026 = {
  stations: net,
  trendPeakDaysPerDegreeLat: +tLat.b.toFixed(2),
  r2: +tLat.r2.toFixed(2),
  peakDays: {
    min: Math.min(...net.map((s) => s.peak)), max: Math.max(...net.map((s) => s.peak)),
    median: [...net.map((s) => s.peak)].sort((a, b) => a - b)[Math.floor(net.length / 2)],
    mean: +(net.reduce((a, s) => a + s.peak, 0) / net.length).toFixed(1),
  },
};
console.log(`сеть 2026: ${net.length} станций; пик ${out.network2026.peakDays.min}..${out.network2026.peakDays.max} (медиана ${out.network2026.peakDays.median}); тренд ${out.network2026.trendPeakDaysPerDegreeLat} дн/градус (R²=${out.network2026.r2})`);

const OUT_PATH = join(ROOT, 'data', 'vectors_climatology.json');
writeFileSync(OUT_PATH, JSON.stringify(out) + '\n');
console.log(`vectors_climatology.json: ${(readFileSync(OUT_PATH).length / 1024).toFixed(1)} КБ`);
