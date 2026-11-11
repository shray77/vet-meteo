/** Проверка моделей: плюм, surveillance, ансамбль + ревизия 2026-09-07 (THIadj, HLI, Tw) + DEM 2026-09-08
 * + векторные known-answer (аудит формул 2026-11-12, Task 238 «Сезон векторов»). */
import { getPlume, PLUME_PRESETS } from '../src/lib/models/plume';
import { demoSeries, ears, rtCori, kulldorffScan, demoScanData, farrington } from '../src/lib/models/surveillance';
import { perturbedEnsemble } from '../src/lib/models/ensemble';
import { thi, thiMader, milkLoss } from '../src/lib/models/thi';
import { wetBulb, hli, ahlAccumulate, thiPoultry, dirofilaria, wnvRisk, midgeDays } from '../src/lib/models/advanced';
import { et0, gdd10, ticksOutlook, cchfRisk, fasciolaIndex } from '../src/lib/models/parasites';
import { hyalommaSeason, questingClass, questingStats, monthlyMeansFromDaily, HYALOMMA_ANCHORS, monthRu } from '../src/lib/models/season';
import { demElevation } from '../src/lib/geo/rostov';
import { slopeAt, coldPoolIndex, windExposure, topoInfoAt } from '../src/lib/topo/topo';

const eq = (name: string, got: number, want: number, eps = 0.15) => {
  const ok = Math.abs(got - want) <= eps;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${got} (ожидалось ~${want})`);
  if (!ok) process.exitCode = 1;
};

/* THI опорные точки (NRC-Yousef): 30°/70% → 81.4; 25°/50% → 71.8 (сверено) */
eq('THI(30,70)', thi(30, 70), 81.4);
eq('THI(25,50)', thi(25, 50), 71.8);
/* Mader 2006: THIadj = 4.51 + THI − 1.992·WS + 0.0068·SR */
eq('THIadj(25,50,2,600)', thiMader(25, 50, 2, 600), 4.51 + 71.8 - 3.984 + 4.08);
eq('THIadj ночь, штиль', thiMader(20, 60, 0, 0), 4.51 + thi(20, 60));
/* Ravagnolo & Misztal 2000: 0.2 кг/ед. THI>72 */
eq('milkLoss(78)', milkLoss(78), 1.2);

/* Stull 2011: RH в ПРОЦЕНТАХ (20°/50% → 13.7 — пример из статьи) */
eq('wetBulb(20,50) — пример Stull', wetBulb(20, 50), 13.7, 0.3);
eq('wetBulb(25,50)', wetBulb(25, 50), 18.0, 0.4);
eq('wetBulb(30,30)', wetBulb(30, 30), 18.3, 0.6);
/* THI птицы = 0.6·Tdb + 0.4·Twb. Пороги — Lallo et al. 2018 (шкала подтверждена
 * Poultry Science 2025, PMC12098143): comfort <27.8, moderate 27.8–28.8,
 * severe 28.9–29.9, emergency ≥30.0.
 * ФИКС 2026-11-01 (SW-05): якорь был 70/75/80 — пороги чужой шкалы THI₃
 * (Du 2020); обновлены на значения своей шкалы. */
eq('thiPoultry(30,60)', thiPoultry(30, 60).value, 0.6 * 30 + 0.4 * wetBulb(30, 60), 0.25);
{
  const zp = (t: number, rh: number) => thiPoultry(t, rh).zone;
  const okZones =
    zp(25, 60) === 'норма' &&
    zp(32, 50) === 'лёгкий стресс' && /* 28.80 — moderate 27.8–28.8 */
    zp(32, 60) === 'опасный (питьё/вент.)' && /* 29.52 — severe 28.9–29.9 */
    zp(35, 50) === 'критический (падёж)'; /* 31.64 — emergency ≥30.0 */
  console.log(`${okZones ? 'PASS' : 'FAIL'} THI птицы зоны Lallo 2018 (27.8/28.85/30.0): 25°→норма, 32°→лёгкий/опасный, 35°→критический`);
  if (!okZones) process.exitCode = 1;
  eq('thiPoultry(35,50) = 31.6 → emergency (Lallo)', thiPoultry(35, 50).value, 31.6, 0.3);
}

/* HLI Gaughan 2008: BG≥25 → 8.62 + 0.38·RH + 1.55·BG − 0.5·WS + e^(2.4−WS) */
// Tdb=30, SR=400 → BG≈36.4; RH=60; WS=2
{
  const bg = 30 + 0.016 * 400;
  const want = 8.62 + 0.38 * 60 + 1.55 * bg - 0.5 * 2 + Math.exp(2.4 - 2);
  eq('HLI(30,60,400,2)', hli(30, 60, 400, 2), want);
  // холодная ветвь: BG<25 → 10.66 + 0.28·RH + 1.3·BG − WS (без exp-члена).
  // ФИКС 2026-11-01 (SW-05): якорь 57.9 был от ошибочной копии горячей ветки;
  // опубликованное значение Gaughan 2008 при (20,70,0,3) — 53.26.
  eq('HLI холод(20,70,0,3) = 53.26 (Gaughan 2008)', hli(20, 70, 0, 3), 53.26, 0.05);
  eq('HLI холод(15,80,0,1) = 51.6', hli(15, 80, 0, 1), 10.66 + 0.28 * 80 + 1.3 * 15 - 1, 0.05);
}
/* AHL: порог 78, распад 0.98 */
{
  const hours = Array.from({ length: 5 }, () => ({ hli: 88 })); // +10/ч над порогом
  const a = ahlAccumulate(hours);
  let acc = 0; for (let i = 0; i < 5; i++) acc = 0.98 * acc + 10;
  eq('AHL 5ч×HLI88', a.ahl, acc, 0.6);
}

/* FAO-56 Ra: сентябрь, 47°N → ET0 Hargreaves при (Tmax=25,Tmin=12) ~3—4 мм/сут */
{
  const v = et0(25, 12, 47, 250);
  console.log(`${v > 2 && v < 5.5 ? 'PASS' : 'FAIL'} et0(25,12,47,doy250): ${v} (ожидалось 3—4.5)`);
  if (!(v > 2 && v < 5.5)) process.exitCode = 1;
  const vj = et0(25, 12, 47, 170); // июнь — больше
  console.log(`${vj > v ? 'PASS' : 'FAIL'} et0 июнь > сентябрь: ${vj} > ${v}`);
  if (!(vj > v)) process.exitCode = 1;
}

/* ==== Реальный DEM (SRTM 0.05°) ==== */
{
  // узлы сетки: сверка с финальной сборкой (валидация против SRTM90 — в build_dem.py)
  eq('DEM Таганрог', demElevation(47.21, 38.93), 14, 3);
  eq('DEM Батайск', demElevation(47.14, 39.75), 6, 3);
  eq('DEM Миллерово', demElevation(48.92, 40.4), 144, 3);
  eq('DEM Семикаракорск (пойма Дона)', demElevation(47.52, 40.83), 8, 3);
  // билинейность КОДА: ручной расчёт из dem.json vs demElevation (точка между узлами)
  {
    const dem = (await import('../src/lib/geo/dem.json')).default as {
      bbox: number[]; step: number; rows: number; cols: number; z: number[][];
    };
    const [minLat, minLon, maxLat] = dem.bbox;
    const lat = 48.62, lon = 42.34;
    const r = (maxLat - lat) / dem.step, c = (lon - minLon) / dem.step;
    const i = Math.floor(r), j = Math.floor(c), fy = r - i, fx = c - j;
    const manual =
      dem.z[i][j] * (1 - fy) * (1 - fx) + dem.z[i + 1][j] * fy * (1 - fx) +
      dem.z[i][j + 1] * (1 - fy) * fx + dem.z[i + 1][j + 1] * fy * fx;
    eq('DEM билинейность (код vs JSON)', demElevation(lat, lon), Math.round(manual), 0.5);
  }
  // уклон: Каменская гряда против Сальских степей
  {
    const slopeRidge = slopeAt(48.35, 40.55);
    const slopePlain = slopeAt(46.5, 42.5);
    console.log(`PASS DEM уклон гряда=${slopeRidge.toFixed(2)}° степь=${slopePlain.toFixed(2)}° (${slopeRidge > slopePlain ? 'OK' : 'НЕ ОЖИДАЛИ'})`);
    if (slopeRidge <= slopePlain) process.exitCode = 1;
  }
  // индексы в границах
  const checks: [string, number][] = [
    ['coldPool', coldPoolIndex(47.3, 40.9)],
    ['windExposure', windExposure(47.3, 40.9)],
  ];
  for (const [n, v] of checks) {
    const ok = v >= 0 && v <= 1;
    console.log(`${ok ? 'PASS' : 'FAIL'} DEM ${n}∈[0,1]: ${v}`);
    if (!ok) process.exitCode = 1;
  }
  const info = topoInfoAt(47.3, 40.9);
  console.log('PASS DEM topoInfo:', JSON.stringify(info));
}

/* Плюм и surveillance — прежние проверки */
const hourly = Array.from({ length: 72 }, (_, i) => ({
  time: `${String(i % 24).padStart(2, '0')}:00`,
  temp: 20, rh: 60, wind: 5, wdir: 270, precip: 0, thi: 65,
}));
const cells = getPlume({ lat: 47.5, lon: 42.1 }, hourly, PLUME_PRESETS.generic);
console.log('plume cells:', cells.length, 'max dose:', Math.max(0, ...cells.map((c) => c.dose)));

const series = demoSeries(61);
const e = ears(series);
console.log('EARS alarms:', e.filter((r) => r.alarm === 'alarm').length, 'watch:', e.filter((r) => r.alarm === 'watch').length);
const f = farrington(series);
console.log('Farrington flags:', f.filter((r) => r.flag).length, '/', f.length);
const rt = rtCori(series, 3, 14, 7);
console.log('Rt points:', rt.length, 'last:', JSON.stringify(rt[rt.length - 1]));
const scan = kulldorffScan(demoScanData(), [20, 40, 60, 80], 199);
console.log('scan clusters:', scan.length, 'top:', JSON.stringify(scan[0]));
const ens = perturbedEnsemble([{ date: '2026-09-06', thiMax: 74 }, { date: '2026-09-07', thiMax: 78 }]);
console.log('perturbed ens:', ens.source, JSON.stringify(ens.days[0]));

/* CCI (Mader et al. 2010; Erratum 2011) — ревизия 2026-10-15.
 * Порт сверён со сканом erratum (OK Mesonet Cattle Comfort Description 2016,
 * стр. 2) и sanity-цифрами Lee et al. 2025 (Sci Rep s41598-025-99621-5).
 * WSC-кривая: штиль +3.33 → 1 м/с +0.59 → 2 −2.41 → 5 −6.51 → 10 −8.76 (гладкая).
 * ВНИМАНИЕ: порт Montana Mesonet читает [log]^(−2) вместо log(y^(−2)) — их
 * ветер почти нулевой; это расхождение зафиксировано в комментарии модели. */
import { cci, cciRhCorr, cciWindCorr, cciRadCorr, cciClass } from '../src/lib/models/advanced';

eq('CCI RHC(45,100) ~ +15.6 (Lee 2025: +16)', cciRhCorr(45, 100), 15.6, 0.7);
eq('CCI RHC(-30,100) ~ −2.7 (Lee 2025: −3)', cciRhCorr(-30, 100), -2.7, 0.5);
eq('CCI RHC(*,30)=0 база', cciRhCorr(25, 30), 0, 1e-9);

eq('CCI WSC(0) штиль +3.33', cciWindCorr(0), 3.33, 0.01);
eq('CCI WSC(1) +0.59', cciWindCorr(1), 0.59, 0.05);
eq('CCI WSC(2) −2.41', cciWindCorr(2), -2.41, 0.1);
eq('CCI WSC(5) −6.51', cciWindCorr(5), -6.51, 0.15);
eq('CCI WSC(10) −8.76', cciWindCorr(10), -8.76, 0.2);
{
  // монотонность и конечность WSC на (0..25]
  let mono = true;
  let prev = Number.POSITIVE_INFINITY;
  for (let ws = 0.05; ws <= 25; ws += 0.05) {
    const v = cciWindCorr(ws);
    if (!Number.isFinite(v) || v > prev + 1e-9) { mono = false; break; }
    prev = v;
  }
  if (!mono) { console.log('FAIL CCI WSC монотонность/конечность'); process.exitCode = 1; }
  else console.log('PASS CCI WSC монотонно убывает и конечна на (0..25]');
}

eq('CCI RADC(30,0) ночь +1.0', cciRadCorr(30, 0), 1.0, 1e-9);
eq('CCI RADC(30,800) +7.87', cciRadCorr(30, 800), 7.87, 0.05);
eq('CCI RADC(-30,0) ночь −5.0', cciRadCorr(-30, 0), -5.0, 1e-9);
eq('CCI RADC(-30,500) солнце смягчает ~0.1', cciRadCorr(-30, 500), 0.1, 0.3);
eq('CCI RADC отриц. радиация → clamp 0', cciRadCorr(20, -50), cciRadCorr(20, 0), 1e-12);

/* цельный CCI: типовые срезы (значения из research/cci_verify.mjs) */
eq('CCI(30,60,3,500)=34.0', cci(30, 60, 3, 500), 34.0, 0.15);
eq('CCI(-15,85,2,0)=−23.5', cci(-15, 85, 2, 0), -23.5, 0.15);
eq('CCI(25,55,4,600)=26.5', cci(25, 55, 4, 600), 26.5, 0.15);

/* классификация (пороги Mader/OK Mesonet, °C) */
const cls = (v: number, nb = false) => cciClass(v, nb).zone;
if (cls(46) !== 'жара: экстремальная опасность' || cls(32) !== 'жара: умеренная' ||
    cls(20) !== 'комфорт' || cls(-25) !== 'холод: сильный' || cls(-42) !== 'холод: экстремальная опасность') {
  console.log('FAIL CCI классы взрослых'); process.exitCode = 1;
} else console.log('PASS CCI классы взрослых');
if (cls(6, true) !== 'комфорт' || cls(2, true) !== 'холод: лёгкий' || cls(-7, true) !== 'холод: сильный' || cls(-12, true) !== 'холод: экстремальный') {
  console.log('FAIL CCI классы новорождённых'); process.exitCode = 1;
} else console.log('PASS CCI классы новорождённых');

/* сетка: CCI конечен и в разумном коридоре */
{
  let sane = true;
  for (let t = -30; t <= 45; t += 5)
    for (const rh of [20, 50, 90])
      for (const ws of [0.5, 2, 5, 10])
        for (const r of [0, 300, 900]) {
          const v = cci(t, rh, ws, r);
          if (!Number.isFinite(v) || v < -75 || v > 85) { sane = false; }
        }
  if (!sane) { console.log('FAIL CCI сетка'); process.exitCode = 1; }
  else console.log('PASS CCI конечен и в коридоре [-75..85] на сетке');
}

/* АЧС-коридор: скорость фронта 2 км/мес (PMC7157679: локальное распространение
 * АЧС в популяции кабана 2–5 км/мес, консервативное значение) × горизонт
 * 20 мес = ≤40 км хода. ФИКС 2026-11-01 (SW-05): было 12 км/ночь
 * (240 км за 20 ночей ≈ 360 км/мес — на два порядка выше реального фронта). */
import { getAsfSpread, ASF_KM_PER_MONTH } from '../src/lib/models/asf';
{
  const cells = getAsfSpread(0, 20);
  const maxMonths = cells.length ? Math.max(...cells.map((c) => c.months)) : 0;
  const okAsf = cells.length > 0 && maxMonths <= 20 && ASF_KM_PER_MONTH === 2;
  console.log(`${okAsf ? 'PASS' : 'FAIL'} АЧС коридор: ${cells.length} клеток · макс ${maxMonths} мес · фронт ${ASF_KM_PER_MONTH} км/мес (PMC7157679)`);
  if (!okAsf) process.exitCode = 1;
}

/* ==== ВЕКТОРНЫЕ МОДЕЛИ — known-answer (аудит формул 2026-11-12, Task 238) ====
 * Якоря первоисточников (полный отчёт — download/vet-meteo-vector-audit.md):
 *  - ECDC (Tier 1): Hyalomma — активация при среднемесячной 10.5°C, квестинг 22–27°C, затишье >30°C.
 *  - EFSA AHAW 2017 (Tier 1): Culicoides — порог активности 10°C, трансмиссия БТВ 9–12°C (фикс базы 13→10, окна 15→12).
 *  - Fortin & Slocombe 1981 (via Ledesma 2015, Tier 2): HDU = Σ(Tmean−14)⁺, L3 при 130 HDU.
 *  - Platonov 2014 (Tier 2): ВЗН юга РФ — эпидсезон июль–октябрь, пик нед. 34–36; каркас температур 18–30°C.
 *  - Volynkina 2022 / Pshenichnaya 2020 (Tier 2): КГЛ Ростовской обл. эндемичен (750/710 случаев).
 * Эвристики без первоисточника (нормировки 140/90 клещей, VPD-штрафы КГЛ, пороги 50/20 фасциолёза,
 * осадочный член ВЗН) — тесты ПИНУЮТ текущее поведение как регрессию, не как «науку». */

/* --- Пороги-константы со ссылкой (сверка) --- */
{
  const okA =
    HYALOMMA_ANCHORS.activationMonthlyMean === 10.5 &&
    HYALOMMA_ANCHORS.questingMin === 22 &&
    HYALOMMA_ANCHORS.questingMax === 27 &&
    HYALOMMA_ANCHORS.heatHide === 30;
  console.log(`${okA ? 'PASS' : 'FAIL'} якоря Hyalomma ECDC: активация 10.5°C / квестинг 22–27°C / затишье >30°C`);
  if (!okA) process.exitCode = 1;
}

/* --- GDD₁₀ (parasites.ts) --- */
eq('GDD₁₀ 3×(30,20) = 45', gdd10([{ tMax: 30, tMin: 20 }, { tMax: 30, tMin: 20 }, { tMax: 30, tMin: 20 }]), 45);
eq('GDD₁₀ обрезка 35°C: (40,30) → 25', gdd10([{ tMax: 40, tMin: 30 }]), 25);
eq('GDD₁₀ холод (10,0) → 0', gdd10([{ tMax: 10, tMin: 0 }]), 0);

/* --- Клещевой 7-дневный датчик (эвристика, пин регрессии) --- */
{
  const t7 = ticksOutlook(Array.from({ length: 7 }, () => ({ tMax: 30, tMin: 20 })));
  const ok = t7.gdd === 105 && t7.hyalomma === 75 && t7.dermacentor === 88;
  console.log(`${ok ? 'PASS' : 'FAIL'} ticksOutlook 7×(30,20): GDD 105, Hyalomma 75, Dermacentor 88 (пин эвристики 140/90)`);
  if (!ok) process.exitCode = 1;
  const t0 = ticksOutlook(Array.from({ length: 7 }, () => ({ tMax: 10, tMin: 0 })));
  const ok0 = t0.gdd === 0 && t0.hyalomma === 0 && t0.label === 'низкая активность';
  console.log(`${ok0 ? 'PASS' : 'FAIL'} ticksOutlook холод: GDD 0, низкая активность`);
  if (!ok0) process.exitCode = 1;
}

/* --- КГЛ (эвристика поверх эндемичности, пин) --- */
{
  // tMean=25, rh=50 → es≈31.7 гПа → VPD≈15.8 (>12 → штраф 0.85); activity=105/140=0.75
  const r = cchfRisk({ endemic: true, daily: Array.from({ length: 7 }, () => ({ tMax: 30, tMin: 20 })), rhMean: 50, tMean: 25 });
  eq('КГЛ эндем 7×(30,20), rh50 → 80', r.risk, 80);
  const rne = cchfRisk({ endemic: false, daily: Array.from({ length: 7 }, () => ({ tMax: 30, tMin: 20 })), rhMean: 50, tMean: 25 });
  eq('КГЛ неэндем база 8 + 35 → 43', rne.risk, 43);
}

/* --- Фасциолёз (качественные якоря, сезон-независимые) --- */
{
  const wet = fasciolaIndex({ daily: Array.from({ length: 7 }, () => ({ tMax: 22, tMin: 12, precipSum: 80 })), lat: 47 });
  const dry = fasciolaIndex({ daily: Array.from({ length: 7 }, () => ({ tMax: 22, tMin: 12, precipSum: 0 })), lat: 47 });
  const ok = wet.level === 'high' && dry.level === 'low';
  console.log(`${ok ? 'PASS' : 'FAIL'} фасциолёз: 7×80 мм → high, 0 мм → low (Ollerenshaw-подход: осадки − ET₀)`);
  if (!ok) process.exitCode = 1;
}

/* --- Дирофилярия (подтверждено: Fortin & Slocombe 1981, база 14°C, L3 ≈ 130 HDU) --- */
{
  const d22 = dirofilaria(Array.from({ length: 22 }, () => ({ tMax: 24, tMin: 16 }))); // tMean 20 → 6 HDU/сут
  eq('HDU 22×tMean20 = 132', d22.hdu8d, 132);
  const okInf = d22.infective === true; // 132 ≥ 130 → L3 инфективны
  console.log(`${okInf ? 'PASS' : 'FAIL'} дирофилярия: 22 дня tMean 20 → 132 HDU ≥ 130 → L3 инфективны (Fortin & Slocombe)`);
  if (!okInf) process.exitCode = 1;
  const cold = dirofilaria(Array.from({ length: 10 }, () => ({ tMax: 18, tMin: 12 }))); // tMean 15 → 1 HDU/сут
  const okCold = cold.hdu8d === 10 && cold.infective === false && cold.hdu30d === 30;
  console.log(`${okCold ? 'PASS' : 'FAIL'} дирофилярия холод: 10×tMean15 → 10 HDU, hdu30 30 < 130, L3 нет`);
  if (!okCold) process.exitCode = 1;
}

/* --- ВЗН/Culex (композит, пин арифметики) --- */
eq('ВЗН 7×(30,20), сухо → score 80', wnvRisk(Array.from({ length: 7 }, () => ({ tMax: 30, tMin: 20, precipSum: 0 }))).score, 80);
eq('ВЗН 7×(10,0) → score 0', wnvRisk(Array.from({ length: 7 }, () => ({ tMax: 10, tMin: 0, precipSum: 0 }))).score, 0);

/* --- Culicoides (фикс аудита: база 10°C EFSA, окно ≥12°C) --- */
{
  const md = midgeDays(Array.from({ length: 5 }, () => ({ tMax: 25, tMin: 15 }))); // tMean 20 → 10 мидж-дней/сут
  eq('midge-days 5×tMean20 = 50 (база 10, EFSA 2017)', md.midgeDays, 50);
  const okW = md.active && md.note.startsWith('окно передачи');
  const cool = midgeDays(Array.from({ length: 5 }, () => ({ tMax: 14, tMin: 8 }))); // tMean 11: активны, окно <12
  const okC = cool.midgeDays === 5 && cool.active && cool.note.startsWith('миджсы активны');
  const off = midgeDays(Array.from({ length: 5 }, () => ({ tMax: 12, tMin: 6 }))); // tMean 9: неактивны
  const okO = off.midgeDays === 0 && !off.active && off.note.includes('неактивны');
  console.log(`${okW && okC && okO ? 'PASS' : 'FAIL'} Culicoides EFSA: tMean20→50 md+окно; tMean11→активны без окна; tMean10→неактивны`);
  if (!(okW && okC && okO)) process.exitCode = 1;
}

/* --- Сезонная модель Hyalomma («Сезон векторов», якоря ECDC Tier 1) --- */
{
  const mm = [-5.2, -4.1, 3.2, 11.2, 17.1, 21.0, 24.4, 23.3, 17.4, 11.0, 4.4, -2.1];
  const s = hyalommaSeason(mm);
  const ok1 = s.openMonth === 4 && s.closeMonth === 10 && s.activeMonths.length === 7;
  console.log(`${ok1 ? 'PASS' : 'FAIL'} сезон Hyalomma: среднемесячные [апр 11.2 … окт 11.0] → окно апр–окт (${s.label})`);
  if (!ok1) process.exitCode = 1;
  const none = hyalommaSeason([-5, -4, 3, 9.9, 17, 21, 24, 23, 17, 9.8, 4, -2]);
  const okN = none.openMonth === 5 && none.closeMonth === 9; // апр/окт ниже 10.5 → окно ужмётся
  console.log(`${okN ? 'PASS' : 'FAIL'} сезон Hyalomma ужатие: апр 9.9/окт 9.8 < 10.5 → окно май–сен`);
  if (!okN) process.exitCode = 1;
  const arctic = hyalommaSeason([-20, -18, -10, 2, 8, 9.9, 10.2, 10.1, 8, 3, -8, -15]);
  const okA = arctic.openMonth === null && arctic.closeMonth === null; // ни разу 10.5 — нулевая фаза
  console.log(`${okA ? 'PASS' : 'FAIL'} сезон Hyalomma нулевая фаза: ни одного месяца ≥10.5 → сезон не открывался`);
  if (!okA) process.exitCode = 1;
}

/* --- Квестинг-классы (суточные, ECDC) --- */
{
  const ok =
    questingClass(24) === 'peak' &&
    questingClass(22) === 'peak' &&
    questingClass(27) === 'peak' &&
    questingClass(21.9) === 'active' &&
    questingClass(12) === 'active' &&
    questingClass(31) === 'heat' &&
    questingClass(8) === 'off';
  console.log(`${ok ? 'PASS' : 'FAIL'} квестинг-классы: 22–27 пик, 10.5–21.9 активны, >30 затишье, <10.5 офф`);
  if (!ok) process.exitCode = 1;
  const st = questingStats([
    { tMax: 26, tMin: 22 }, // 24 → peak
    { tMax: 28, tMin: 24 }, // 26 → peak
    { tMax: 20, tMin: 16 }, // 18 → active
    { tMax: 36, tMin: 26 }, // 31 → heat
    { tMax: 10, tMin: 6 },  // 8 → off
  ]);
  const okSt = st.peakDays === 2 && st.activeDays === 1 && st.heatDays === 1 && st.offDays === 1;
  console.log(`${okSt ? 'PASS' : 'FAIL'} квестинг-стата: пик×2, активны×1, жара×1, офф×1`);
  if (!okSt) process.exitCode = 1;
}

/* --- Месячные средние из суточных (для ретро-расчёта) --- */
{
  const mm = monthlyMeansFromDaily([
    { date: '2026-01-05', tMax: 0, tMin: -4 }, // янв: tMean −2
    { date: '2026-01-20', tMax: 4, tMin: 0 },  // янв: tMean 2 → среднее янв = 0
    { date: '2026-04-10', tMax: 20, tMin: 8 },  // апр: 14
  ]);
  const ok = mm[0] === 0 && mm[3] === 14 && Number.isNaN(mm[1]);
  console.log(`${ok ? 'PASS' : 'FAIL'} monthlyMeans: янв (−2,2)→0, апр 14, фев NaN (нет дней)`);
  if (!ok) process.exitCode = 1;
  const okRu = monthRu(4) === 'апр' && monthRu(null) === '—';
  if (!okRu) { console.log('FAIL monthRu'); process.exitCode = 1; }
}
