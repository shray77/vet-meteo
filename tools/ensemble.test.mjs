/*!
 * ensemble.test.mjs — гейт вероятностного слоя (tools/ensemble.mjs).
 *
 * Известные ответы: THI/перцентили/вероятности посчитаны руками и сверены
 * с портом src/lib/models/ensemble.ts; парсер членов — против живого формата
 * ключей Open-Meteo ensemble API (проверен запросом 17.11.2026).
 *
 * Запуск: node --test tools/ensemble.test.mjs   (CI: .github/workflows/ci.yml)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { thi, rhAdj, pct, collectMembers, ensembleDays, isFresh } from './ensemble.mjs';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

/* ---------- THI и коррекция RH ---------- */

test('thi: точечные значения (руки + форма приложения)', () => {
  assert.ok(near(thi(30, 60), 79.84));    // f=86; (0.55−0.33)·28=6.16
  assert.ok(near(thi(25, 50), 71.775));   // f=77; 0.275·19=5.225
  assert.ok(near(thi(20, 40), 64.7));     // f=68; 0.33·10=3.3
  assert.ok(near(thi(34, 40), 81.584));   // f=93.2; 0.33·35.2=11.616
});

test('rhAdj: минус 10 и кламп 30..98 (порт ensemble.ts)', () => {
  assert.equal(rhAdj(50), 40);
  assert.equal(rhAdj(35), 30);   // 25 → кламп снизу
  assert.equal(rhAdj(120), 98);  // 110 → кламп сверху
  assert.equal(rhAdj(null), 45); // фолбэк 55−10
});

/* ---------- перцентиль ---------- */

test('pct: интерполяция, края, пустота', () => {
  assert.ok(near(pct([10, 20], 0.5), 15));
  assert.ok(near(pct([10, 20], 0), 10));
  assert.ok(near(pct([10, 20], 1), 20));
  assert.ok(near(pct([10], 0.9), 10));
  assert.ok(near(pct([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 0.1), 0.9));
  assert.ok(Number.isNaN(pct([], 0.5)));
});

/* ---------- парсер членов (живой формат ключей API) ---------- */

const DAILY = {
  time: ['2026-11-17', '2026-11-18'],
  temperature_2m_max: [10, 11],                                        // агрегат — не член
  temperature_2m_max_member01_ecmwf_ifs025_ensemble: [20, 21],
  temperature_2m_max_member02_ecmwf_ifs025_ensemble: [22, 23],
  temperature_2m_max_member01_ecmwf_aifs025_ensemble: [30, 31],
  temperature_2m_max_member02_ecmwf_aifs025_ensemble: [32, 33],
  temperature_2m_max_member01: [40, 41],                               // одиночный формат
  relative_humidity_2m_mean_member01_ecmwf_ifs025_ensemble: [60, 61],  // другая переменная
};

test('collectMembers: мульти-модель — суффикс _model_ensemble', () => {
  const ifs = collectMembers(DAILY, 'temperature_2m_max', 'ecmwf_ifs025');
  assert.equal(ifs.length, 2);
  assert.deepEqual(ifs[0], [20, 21]);
  assert.deepEqual(ifs[1], [22, 23]);
  const aifs = collectMembers(DAILY, 'temperature_2m_max', 'ecmwf_aifs025');
  assert.equal(aifs.length, 2);
  assert.deepEqual(aifs[0], [30, 31]);
});

test('collectMembers: одиночная модель — голые _memberNN', () => {
  const single = collectMembers(DAILY, 'temperature_2m_max', null);
  assert.equal(single.length, 1);
  assert.deepEqual(single[0], [40, 41]);
});

test('collectMembers: агрегат и чужие переменные не попадают в члены', () => {
  for (const model of ['ecmwf_ifs025', 'ecmwf_aifs025', null]) {
    const ms = collectMembers(DAILY, 'temperature_2m_max', model);
    assert.ok(ms.length > 0);
    for (const m of ms) assert.ok(!m.includes(10), 'агрегат temperature_2m_max утёк в члены');
  }
  assert.deepEqual(collectMembers(DAILY, 'nope_2m', 'ecmwf_ifs025'), []);
});

/* ---------- дни ансамбля: перцентили THImax + вероятности ---------- */

test('ensembleDays: 4 члена — p10/p50/p90 и p72/p80 руками', () => {
  // rh=50 → rhAdj=40 → THI: t21→65.906, t27→73.142 (>72), t34→81.584 (>80)
  const dates = ['2026-11-17'];
  const t = [[21], [27], [27], [34]];
  const rh = [[50], [50], [50], [50]];
  const d = ensembleDays(dates, t, rh);
  assert.equal(d.p10.length, 1);
  assert.ok(near(d.p10[0], 68.1, 0.051));    // 65.906+0.3·(73.142−65.906)=68.077
  assert.ok(near(d.p50[0], 73.1, 0.051));    // интерполяция между равными 73.142
  assert.ok(near(d.p90[0], 79.1, 0.06));     // 73.142+0.7·(81.584−73.142)=79.051
  assert.ok(near(d.p72[0], 0.75));           // 3 из 4 членов >72
  assert.ok(near(d.p80[0], 0.25));           // 1 из 4 >80
});

test('ensembleDays: одинаковые члены — веер схлопывается', () => {
  const d = ensembleDays(['d1', 'd2'], [[20, 20], [20, 20], [20, 20]], [[50, 50], [50, 50], [50, 50]]);
  for (const k of ['p10', 'p50', 'p90']) {
    assert.ok(near(d[k][0], 64.7, 1e-6));
    assert.ok(near(d[k][1], 64.7, 1e-6));
  }
  assert.equal(d.p72[0], 0);
  assert.equal(d.p80[0], 0);
});

test('ensembleDays: null в члене пропускается, а не роняет день', () => {
  const d = ensembleDays(['d1', 'd2'], [[27, null], [21, 27]], [[50, 50], [50, 50]]);
  // день 0: члены [73.142, 65.906] → p50 = 69.524; день 1: только t=27 → 73.142
  assert.ok(near(d.p50[0], 69.524, 1e-3));
  assert.ok(near(d.p50[1], 73.142, 1e-3));
  assert.ok(near(d.p72[1], 1));              // единственный член >72 → 1.00
});

test('ensembleDays: все члены null — NaN-перцентили не ломают JSON', () => {
  const d = ensembleDays(['d1'], [[null]], [[null]]);
  assert.ok(Number.isNaN(d.p50[0]));
  assert.equal(d.p72[0], 0);                 // пустой набор → 0/n=0 → NaN? нет: length||1
});

/* ---------- age-gate ---------- */

test('isFresh: 3-часовой порог и мусор', () => {
  const NOW = 1_000_000_000_000;
  assert.equal(isFresh({ generatedAt: new Date(NOW - 10 * 60e3).toISOString() }, NOW), true);
  assert.equal(isFresh({ generatedAt: new Date(NOW - 4 * 3600e3).toISOString() }, NOW), false);
  assert.equal(isFresh(null, NOW), false);
  assert.equal(isFresh({ generatedAt: 'не дата' }, NOW), false);
  assert.equal(isFresh({}, NOW), false);
});
