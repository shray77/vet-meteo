#!/usr/bin/env node
/**
 * tools/verify.mjs — ретроспективная проверка прогноза («что обещали vs что случилось»).
 * Без зависимостей: Node 20+ (глобальный fetch).
 *
 * СЛОЙ A — бэктест модели за 30 дней (доступен сразу):
 *   archived forecasts Open-Meteo (historical-forecast-api, тот же best_match,
 *   что и радар) против ERA5-реанализа (archive-api) как «факта».
 *   49 станций × ~720 ч = ~35 тыс станций-часов. Пересчёт раз в 12 ч (кэш в verify.json),
 *   остальное время шаг в воркфлоу проходит мгновенно.
 *
 * СЛОЙ B — наш собственный прогноз 48 ч, как показывал радар:
 *   git-история data/forecast.json (первый выпуск на каждый час h0) против фактических
 *   срезов станций (data/snapshots/*.json, 3×/час). Накапливается сам с каждым коммитом;
 *   ошибки считаются по горизонтам 1–3 / 4–12 / 13–24 / 25–48 ч.
 *
 * Юнит-баг ветра: до 07.09.2026 ~19:40 UTC Open-Meteo ветер писался в км/ч.
 * Записи раньше FIX_TS пересчитываются км/ч → м/с (÷3,6), чтобы ряды были однородны.
 *
 * Выход: data/verify.json (+ вердикт «малые/умеренные/заметные/большие» по MAE THI).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const STATIONS = JSON.parse(readFileSync(join(ROOT, 'data', 'stations.json'), 'utf8')).stations;
const OUT = join(ROOT, 'data', 'verify.json');

const thi = (t, rh) => {
  const f = 1.8 * t + 32;
  return f - (0.55 - 0.0055 * rh) * (1.8 * t - 26);
};

/** коммиты до этого момента писали ветер в км/ч (юнит-баг) */
const WIND_FIX_TS = Date.parse('2026-09-07T19:40:00Z');
const windFix = (v, tsMs) => (v == null || tsMs == null || tsMs >= WIND_FIX_TS ? v : v / 3.6);

const pad = (n) => String(n).padStart(2, '0');
const addDays = (iso, d) => {
  const [y, m, dd] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd + d));
  return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate());
};
/** 'YYYY-MM-DD' текущего дня по МСК (даты API-ов — в Europe/Moscow) */
const mskToday = () => {
  const d = new Date(Date.now() + 3 * 3600e3);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
};
const addH = (h0, k) => {
  const [y, m, d, h] = [h0.slice(0, 4), h0.slice(5, 7), h0.slice(8, 10), h0.slice(11, 13)].map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, h + k));
  return dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate()) + 'T' + pad(dt.getUTCHours()) + ':00';
};

async function fetchJsonRetry(url, ms = 45000, tries = 3) {
  let err;
  for (let i = 1; i <= tries; i++) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), ms);
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error(String(r.status));
      return await r.json();
    } catch (e) {
      err = e;
      if (i < tries) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw err;
}

/* ---------- статистика ---------- */
const r1 = (v) => (v == null || !isFinite(v) ? null : +v.toFixed(1));
class Acc {
  constructor() { this.a = []; }          // signed errors
  add(v) { if (v != null && isFinite(v)) this.a.push(v); }
  get n() { return this.a.length; }
  get mae() { return this.n ? this.a.reduce((s, v) => s + Math.abs(v), 0) / this.n : null; }
  get bias() { return this.n ? this.a.reduce((s, v) => s + v, 0) / this.n : null; }
}

/* ══════════════ СЛОЙ A: модель vs ERA5, 30 дней ══════════════ */
async function tierModel(prev) {
  const to = addDays(mskToday(), -1);          // ERA5 доступна до вчера
  const stale = !prev || !prev.generatedAt || Date.now() - Date.parse(prev.generatedAt) > 12 * 3600e3 || prev.to !== to;
  if (!stale) return prev;
  const from = addDays(to, -29);               // 30 дней
  const HOURLY = 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation';
  const COMMON = `hourly=${HOURLY}&timezone=Europe/Moscow&windspeed_unit=ms&start_date=${from}&end_date=${to}`;

  const perSt = STATIONS.map((s) => ({ id: s.id, name: s.name, accT: new Acc(), accRh: new Acc(), accW: new Acc(), accThi: new Acc(), ev: { fc: 0, obs: 0, hits: 0, misses: 0, false: 0 }, pr: { fc: 0, obs: 0, hits: 0, misses: 0, false: 0 } }));
  const CH = 25;
  let ok = 0;
  for (let i = 0; i < STATIONS.length; i += CH) {
    const chunk = STATIONS.slice(i, i + CH);
    const geo = `latitude=${chunk.map((s) => s.lat).join(',')}&longitude=${chunk.map((s) => s.lon).join(',')}`;
    const [fcJ, eraJ] = await Promise.all([
      fetchJsonRetry(`https://historical-forecast-api.open-meteo.com/v1/forecast?${geo}&${COMMON}`).catch((e) => (console.error('HFA чанк ' + i + ': ' + e.message), null)),
      fetchJsonRetry(`https://archive-api.open-meteo.com/v1/archive?${geo}&${COMMON}`).catch((e) => (console.error('ERA5 чанк ' + i + ': ' + e.message), null)),
    ]);
    if (!fcJ || !eraJ) continue;
    const fcs = Array.isArray(fcJ) ? fcJ : [fcJ];
    const eras = Array.isArray(eraJ) ? eraJ : [eraJ];
    for (let c = 0; c < fcs.length; c++) {
      const st = perSt[i + c];
      const ft = fcs[c].hourly?.time ?? [];
      const et = eras[c]?.hourly?.time ?? [];
      if (!ft.length || !et.length) continue;
      ok++;
      // выравнивание по общим часам (обе стороны — МСК, интервалы [from; to])
      const em = new Map(et.map((t, k) => [t, k]));
      for (let k = 0; k < ft.length; k++) {
        const j = em.get(ft[k]);
        if (j == null) continue;
        const tF = fcs[c].hourly.temperature_2m[k], rhF = fcs[c].hourly.relative_humidity_2m[k], wF = fcs[c].hourly.wind_speed_10m[k], prF = fcs[c].hourly.precipitation[k];
        const tE = eras[c].hourly.temperature_2m[j], rhE = eras[c].hourly.relative_humidity_2m[j], wE = eras[c].hourly.wind_speed_10m[j], prE = eras[c].hourly.precipitation[j];
        if (tF == null || rhF == null || tE == null || rhE == null) continue;
        st.accT.add(tF - tE);
        st.accRh.add(rhF - rhE);
        if (wF != null && wE != null) st.accW.add(wF - wE);
        const thiF = thi(tF, rhF), thiE = thi(tE, rhE);
        st.accThi.add(thiF - thiE);
        /* окна стресса THI>72: прогноз против факта */
        const sF = thiF > 72, sE = thiE > 72;
        if (sE) { st.ev.obs++; sF ? st.ev.hits++ : st.ev.misses++; }
        if (sF) { st.ev.fc++; if (!sE) st.ev.false++; }
        /* лёгкий стресс THI>68 — вторым агрегатом (сентябрь: событий 68+ больше) */
        st.ev68 = st.ev68 || { fc: 0, obs: 0, hits: 0, misses: 0, false: 0 };
        const mF = thiF > 68, mE = thiE > 68;
        if (mE) { st.ev68.obs++; mF ? st.ev68.hits++ : st.ev68.misses++; }
        if (mF) { st.ev68.fc++; if (!mE) st.ev68.false++; }
        /* осадки: события ≥ 0,5 мм/ч */
        const pF = (prF ?? 0) >= 0.5, pE = (prE ?? 0) >= 0.5;
        if (pE) { st.pr.obs++; pF ? st.pr.hits++ : st.pr.misses++; }
        if (pF) { st.pr.fc++; if (!pE) st.pr.false++; }
      }
    }
  }
  if (!ok) {
    console.error('Слой A: оба API недоступны — оставляю прежний (кэш)');
    return prev || null;
  }
  const agg = (sel) => {
    const a = new Acc();
    let n = 0;
    for (const st of perSt) { const x = st[sel]; if (x.n) { for (const v of x.a) a.add(v); n += x.n; } }
    return { n, mae: r1(a.mae), bias: r1(a.bias) };
  };
  const ev = (key) => {
    const o = { fc: 0, obs: 0, hits: 0, misses: 0, false: 0 };
    for (const st of perSt) for (const k in o) o[k] += (st[key] || {})[k] || 0;
    o.pod = o.obs ? r1(100 * o.hits / o.obs) : null;      // доля пойманных событий, %
    o.far = o.fc ? r1(100 * o.false / o.fc) : null;       // доля ложных тревог, %
    return o;
  };
  const worst = perSt
    .map((st) => ({ id: st.id, name: st.name, maeThi: r1(st.accThi.mae) }))
    .sort((a, b) => (b.maeThi ?? -1) - (a.maeThi ?? -1))
    .slice(0, 5);
  return {
    generatedAt: new Date().toISOString(),
    days: 30, from, to,
    stations: ok, hours: perSt.reduce((s, st) => s + st.accThi.n, 0),
    mae: { t: r1(agg('accT').mae), rh: r1(agg('accRh').mae), wind: r1(agg('accW').mae), thi: r1(agg('accThi').mae) },
    bias: { t: r1(agg('accT').bias), rh: r1(agg('accRh').bias), wind: r1(agg('accW').bias), thi: r1(agg('accThi').bias) },
    win72: ev('ev'), win68: ev('ev68'), prEvents: ev('pr'),
    worst,
  };
}

/* ══════════════ СЛОЙ B: наш прогноз по git-истории vs срезы ══════════════ */
function tierRadar() {
  /* 1) факты: снапшоты → id → час МСК → {t, rh, wind, thi} (последняя запись часа) */
  const actuals = {};
  const snapDir = join(ROOT, 'data', 'snapshots');
  let snapFiles = 0, snapHours = 0;
  if (existsSync(snapDir)) {
    for (const f of readdirSync(snapDir).filter((f) => f.endsWith('.json')).sort()) {
      let snap;
      try { snap = JSON.parse(readFileSync(join(snapDir, f), 'utf8')); } catch { continue; }
      snapFiles++;
      for (const h of snap.hours || []) {
        const ts = Date.parse(h.ts);
        if (!isFinite(ts)) continue;
        snapHours++;
        const msk = new Date(ts + 3 * 3600e3);                    // час по МСК
        const hourKey = msk.getUTCFullYear() + '-' + pad(msk.getUTCMonth() + 1) + '-' + pad(msk.getUTCDate()) + 'T' + pad(msk.getUTCHours()) + ':00';
        for (const id in h.s || {}) {
          const v = h.s[id];
          if (!Array.isArray(v) || v.length < 4 || v[0] == null) continue;
          (actuals[id] = actuals[id] || {})[hourKey] = { t: v[0], rh: v[1], wind: windFix(v[2], ts), thi: v[3] };
        }
      }
    }
  }

  /* 2) прогнозы: git-история forecast.json, ПЕРВЫЙ выпуск на каждый h0 */
  const issues = [];
  try {
    const hashes = execFileSync('git', ['-C', ROOT, 'log', '--since=30 days ago', '--format=%H', '--', 'data/forecast.json'], { maxBuffer: 256 * 1024 * 1024 })
      .toString().split('\n').filter(Boolean).reverse();          // старые → новые
    const seenH0 = new Set();
    for (const h of hashes) {
      let txt;
      try { txt = execFileSync('git', ['-C', ROOT, 'show', h + ':data/forecast.json'], { maxBuffer: 256 * 1024 * 1024 }).toString(); }
      catch { continue; }
      let F;
      try { F = JSON.parse(txt); } catch { continue; }
      if (!F || !F.h0 || !Array.isArray(F.stations)) continue;
      if (seenH0.has(F.h0)) continue;                             // только первый выпуск часа
      seenH0.add(F.h0);
      issues.push(F);
    }
  } catch (e) {
    console.error('git-история недоступна (' + e.message + ') — слой B пуст');
  }

  /* 3) сверка по горизонтам */
  const BUCKETS = [
    { h: '1–3 ч', from: 1, to: 3 },
    { h: '4–12 ч', from: 4, to: 12 },
    { h: '13–24 ч', from: 13, to: 24 },
    { h: '25–48 ч', from: 25, to: 48 },
  ];
  const rows = BUCKETS.map((b) => ({ h: b.h, aT: new Acc(), aRh: new Acc(), aW: new Acc(), aThi: new Acc() }));
  const ev = { fc: 0, obs: 0, hits: 0, misses: 0, false: 0 };
  let checked = 0;
  let span = [null, null];
  for (const F of issues) {
    const genTs = Date.parse(F.generatedAt);
    for (const st of F.stations) {
      const act = actuals[st.id];
      if (!act) continue;
      const n = (st.thi || []).length;
      for (let k = 1; k < n; k++) {
        const target = addH(F.h0, k);
        const a = act[target];
        if (!a) continue;
        checked++;
        if (!span[0] || target < span[0]) span[0] = target;
        if (!span[1] || target > span[1]) span[1] = target;
        let bi = BUCKETS.findIndex((x) => k >= x.from && k <= x.to);
        if (bi < 0) bi = rows.length - 1;                          // горизонт >48 ч (обрезан) → последний бакет
        const b = rows[bi];
        const fcT = st.t?.[k], fcRh = st.rh?.[k], fcThi = st.thi?.[k];
        let fcW = st.wind?.[k];
        if (fcW != null) fcW = windFix(fcW, genTs);               // юнит-баг км/ч
        if (fcT != null && a.t != null) b.aT.add(fcT - a.t);
        if (fcRh != null && a.rh != null) b.aRh.add(fcRh - a.rh);
        if (fcW != null && a.wind != null) b.aW.add(fcW - a.wind);
        if (fcThi != null && a.thi != null) b.aThi.add(fcThi - a.thi);
        const sF = fcThi != null && fcThi > 72, sE = a.thi != null && a.thi > 72;
        if (sE) { ev.obs++; sF ? ev.hits++ : ev.misses++; }
        if (sF) { ev.fc++; if (!sE) ev.false++; }
      }
    }
  }
  ev.pod = ev.obs ? r1(100 * ev.hits / ev.obs) : null;
  ev.far = ev.fc ? r1(100 * ev.false / ev.fc) : null;
  return {
    generatedAt: new Date().toISOString(),
    issues: issues.length, hours: checked,
    span: span[0] ? span : null,
    snapshots: { files: snapFiles, hours: snapHours },
    horizons: rows.map((b) => ({ h: b.h, n: b.aThi.n, maeThi: r1(b.aThi.mae), biasThi: r1(b.aThi.bias), maeT: r1(b.aT.mae), maeRh: r1(b.aRh.mae), maeWind: r1(b.aW.mae) })),
    win72: ev,
  };
}

/* ══════════════ вердикт + запись ══════════════ */
const prev = existsSync(OUT) ? (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')); } catch { return null; } })() : null;
const model = await tierModel(prev ? prev.model : null);
const radar = tierRadar();

function verdict(model, radar) {
  const cands = [];
  if (model && model.mae && model.mae.thi != null) cands.push(model.mae.thi);
  const rel = (radar && radar.horizons || []).filter((x) => x.n >= 24).map((x) => x.maeThi).filter((v) => v != null);
  if (rel.length) cands.push(...rel);
  if (!cands.length) return { verdict: '—', thi: null };
  const v = Math.max(...cands);
  const txt = v < 1.2 ? 'малые' : v < 2.5 ? 'умеренные' : v < 4 ? 'заметные' : 'большие';
  return { verdict: txt, thi: r1(v) };
}
const vd = verdict(model, radar);
const out = { generatedAt: new Date().toISOString(), verdict: vd.verdict, thi: vd.thi, model, radar };
writeFileSync(OUT, JSON.stringify(out) + '\n');

/* stdout-сводка (воркфлоу подхватит в шаг-саммари) */
const L = [];
L.push('СЛОЙ A · модель vs ERA5, 30 дней: ' + (model
  ? model.stations + ' станций × ' + model.hours + ' ч · MAE: T ' + model.mae.t + ' °C · THI ' + model.mae.thi + ' · ветер ' + model.mae.wind + ' м/с · bias THI ' + model.bias.thi
  : 'нет (API недоступны)'));
if (model && model.win72 && model.win72.obs) L.push('  окна THI>72: факт ' + model.win72.obs + ' ч · поймано ' + model.win72.pod + '% · ложных ' + model.win72.far + '%');
if (model && model.prEvents && model.prEvents.obs) L.push('  осадки ≥0,5 мм/ч: поймано ' + model.prEvents.pod + '% · ложных ' + model.prEvents.far + '%');
L.push('СЛОЙ B · наш прогноз по git-истории: ' + radar.issues + ' выпусков · проверено ' + radar.hours + ' станций-часов' + (radar.span ? ' (' + radar.span[0].slice(5, 16).replace('T', ' ') + ' → ' + radar.span[1].slice(5, 16).replace('T', ' ') + ' МСК)' : ''));
for (const b of radar.horizons) L.push('  горизонт ' + b.h + ': n=' + b.n + (b.n ? ' · MAE THI ' + b.maeThi + ' · T ' + b.maeT + ' °C' : ' — копится'));
L.push('ВЕРДИКТ: расхождения ' + out.verdict + (out.thi != null ? ' (MAE THI ≤ ' + out.thi + ')' : ' — мало данных'));
console.log(L.join('\n'));
