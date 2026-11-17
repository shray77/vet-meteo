#!/usr/bin/env node
/**
 * tools/ensemble.mjs — вероятностный слой витрины: два ансамбля ECMWF по всем
 * станциям → data/ensemble.json.
 *
 * МОДЕЛИ (один запрос на чанк, 25 станций):
 *   - ecmwf_ifs025  — физическая модель IFS 0.25°, 50 членов ансамбля;
 *   - ecmwf_aifs025 — ИИ-модель AIFS 0.25° (Lang et al., Nature 2024), 50 членов.
 *   Второе независимое мнение поверх детерминированного прогноза: веер
 *   p10–p90 THImax и вероятности P(THImax>72 / >80) по дням.
 *
 * Формат ключей (проверен живым запросом 17.11.2026): при models=«две модели»
 * члены приходят как temperature_2m_max_memberNN_<model>_ensemble; при одиночной
 * модели — temperature_2m_max_memberNN. Парсер понимает оба.
 *
 * Age-gate 3 ч (паттерн verify.json с его 12 ч): свежий файл — шаг мгновенный,
 * воркфлоу не гоняет ансамбль каждые 20 минут. --force — пересчитать всё равно.
 *
 * Порт формул 1:1 из src/lib/models/ensemble.ts (THI, коррекция RH, перцентиль)
 * с той же пометкой: rh − 10 — консервативное допущение приложения, не статья.
 * Без зависимостей: Node 20+ (глобальный fetch).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const STATIONS = JSON.parse(readFileSync(join(ROOT, 'data', 'stations.json'), 'utf8')).stations;
const OUT = join(ROOT, 'data', 'ensemble.json');
const FORCE = process.argv.includes('--force');
const AGE_MS = 3 * 3600e3;

const ENS_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble';
const MODELS = ['ecmwf_ifs025', 'ecmwf_aifs025'];

/* ── чистые функции (гейт: tools/ensemble.test.mjs) ───────────────────────── */

/** THI (NRC-1971 форма, как во всём приложении). */
export const thi = (t, rh) => {
  const f = 1.8 * t + 32;
  return f - (0.55 - 0.0055 * rh) * (1.8 * t - 26);
};

/** Коррекция RH для THImax из суточных агрегатов — порт ensemble.ts (кламп 30..98). */
export const rhAdj = (rh) => Math.max(30, Math.min(98, (rh ?? 55) - 10));

/** Перцентиль с линейной интерполяцией (порт ensemble.ts). Пустой массив → NaN. */
export function pct(sorted, p) {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/** Собрать массивы членов ансамбля из daily-блока ответа.
 *  model=null → одиночная модель (ключи var_memberNN), иначе var_memberNN_model_ensemble. */
export function collectMembers(daily, varName, model = null) {
  const members = [];
  const re = model
    ? new RegExp(`^${varName}_member(\\d+)_${model}_ensemble$`)
    : new RegExp(`^${varName}_member(\\d+)$`);
  for (const key of Object.keys(daily)) {
    if (key === varName) continue; // агрегат/контроль — не член
    const m = key.match(re);
    if (m) members.push(daily[key]);
  }
  return members;
}

/** Дни ансамбля: перцентили THImax и вероятности порогов.
 *  tMembers/rhMembers — массивы (по членам) массивов (по дням). */
export function ensembleDays(dates, tMembers, rhMembers) {
  const nDays = dates.length;
  const out = { p10: [], p50: [], p90: [], p72: [], p80: [] };
  for (let d = 0; d < nDays; d++) {
    const thiMaxes = [];
    for (let m = 0; m < tMembers.length; m++) {
      const tMax = tMembers[m][d];
      if (tMax == null) continue;
      thiMaxes.push(thi(tMax, rhAdj(rhMembers[m]?.[d])));
    }
    thiMaxes.sort((a, b) => a - b);
    const n = thiMaxes.length || 1;
    out.p10.push(+pct(thiMaxes, 0.1).toFixed(1));
    out.p50.push(+pct(thiMaxes, 0.5).toFixed(1));
    out.p90.push(+pct(thiMaxes, 0.9).toFixed(1));
    out.p72.push(+(thiMaxes.filter((v) => v > 72).length / n).toFixed(2));
    out.p80.push(+(thiMaxes.filter((v) => v > 80).length / n).toFixed(2));
  }
  return out;
}

/** Свеж ли ensemble.json (age-gate воркфлоу). */
export function isFresh(prevJson, nowMs = Date.now(), ageMs = AGE_MS) {
  if (!prevJson || !prevJson.generatedAt) return false;
  const ts = Date.parse(prevJson.generatedAt);
  return isFinite(ts) && nowMs - ts < ageMs;
}

/* ── fetch ────────────────────────────────────────────────────────────────── */

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

async function fetchAll() {
  const byId = {};
  const CH = 25;
  for (let i = 0; i < STATIONS.length; i += CH) {
    const chunk = STATIONS.slice(i, i + CH);
    const params = new URLSearchParams({
      latitude: chunk.map((s) => s.lat).join(','),
      longitude: chunk.map((s) => s.lon).join(','),
      daily: 'temperature_2m_max,relative_humidity_2m_mean',
      models: MODELS.join(','),
      timezone: 'Europe/Moscow',
      forecast_days: '7',
    });
    const json = await fetchJsonRetry(`${ENS_URL}?${params}`);
    const arr = Array.isArray(json) ? json : [json];
    for (let c = 0; c < arr.length; c++) {
      const st = chunk[c];
      const daily = arr[c]?.daily ?? {};
      const dates = daily.time ?? [];
      if (!dates.length) continue;
      const rec = { dates };
      for (const model of MODELS) {
        const t = collectMembers(daily, 'temperature_2m_max', model);
        const rh = collectMembers(daily, 'relative_humidity_2m_mean', model);
        rec[model === 'ecmwf_ifs025' ? 'ifs' : 'aifs'] =
          t.length >= 10 ? ensembleDays(dates, t, rh) : null; // порог живости — как ensemble.ts
      }
      byId[st.id] = rec;
    }
  }
  return byId;
}

/* ── main ─────────────────────────────────────────────────────────────────── */

const prev = existsSync(OUT) ? (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')); } catch { return null; } })() : null;
if (!FORCE && isFresh(prev)) {
  const min = Math.round((Date.now() - Date.parse(prev.generatedAt)) / 60000);
  console.log(`ансамбль свежий (${min} мин < 3 ч) — пропуск (пересчёт принудительно: --force)`);
  process.exit(0);
}

const stations = await fetchAll();
const nOk = Object.keys(stations).length;
const nIifs = Object.values(stations).filter((s) => s.ifs).length;
const nAifs = Object.values(stations).filter((s) => s.aifs).length;
if (!nOk || (!nIifs && !nAifs)) {
  console.error('ансамбль недоступен — оставляю прежний файл');
  process.exit(0); // не роняем воркфлоу: витрина честно покажет заглушку
}

const out = {
  generatedAt: new Date().toISOString(),
  source: 'open-meteo ensemble API · ecmwf_ifs025 + ecmwf_aifs025 (50 членов каждая)',
  models: {
    ifs: { name: 'ecmwf_ifs025', label: 'IFS 0.25° — физическая модель ECMWF' },
    aifs: { name: 'ecmwf_aifs025', label: 'AIFS 0.25° — ИИ-модель ECMWF (второе мнение)' },
  },
  note: 'THImax p10/p50/p90 за сутки (Europe/Moscow); p72/p80 — доля членов с THImax>72/>80. RH-коррекция −10 (кламп 30..98) — консервативное допущение приложения, порт src/lib/models/ensemble.ts.',
  stations,
};
writeFileSync(OUT, JSON.stringify(out) + '\n');

/* stdout-сводка для шаг-саммари */
const L = [];
L.push(`АНСАМБЛЬ: ${nOk}/${STATIONS.length} станций · IFS-веер ${nIifs} · AIFS-веер ${nAifs} · горизонт 7 дней`);
const anyId = Object.keys(stations)[0];
const d = stations[anyId];
if (d?.ifs && d?.aifs) {
  const n = Math.min(d.ifs.p50.length, d.aifs.p50.length);
  let maxDelta = 0, at = 0;
  for (let k = 0; k < n; k++) {
    const delta = Math.abs(d.ifs.p50[k] - d.aifs.p50[k]);
    if (delta > maxDelta) { maxDelta = delta; at = k; }
  }
  L.push(`  пример ${anyId}: p50 IFS ${d.ifs.p50.join('/')} · p50 AIFS ${d.aifs.p50.join('/')}`);
  L.push(`  макс. расхождение моделей (p50): ${maxDelta.toFixed(1)} THI на день +${at}`);
}
console.log(L.join('\n'));
