/** Проверка моделей: плюм, surveillance, ансамбль + ревизия 2026-09-07 (THIadj, HLI, Tw) + DEM 2026-09-08. */
import { getPlume, PLUME_PRESETS } from '../src/lib/models/plume';
import { demoSeries, ears, rtCori, kulldorffScan, demoScanData, farrington } from '../src/lib/models/surveillance';
import { perturbedEnsemble } from '../src/lib/models/ensemble';
import { thi, thiMader, milkLoss } from '../src/lib/models/thi';
import { wetBulb, hli, ahlAccumulate, thiPoultry } from '../src/lib/models/advanced';
import { et0 } from '../src/lib/models/parasites';
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
/* THI птицы = 0.6·Tdb + 0.4·Twb */
eq('thiPoultry(30,60)', thiPoultry(30, 60).value, 0.6 * 30 + 0.4 * wetBulb(30, 60), 0.25);

/* HLI Gaughan 2008: BG≥25 → 8.62 + 0.38·RH + 1.55·BG − 0.5·WS + e^(2.4−WS) */
// Tdb=30, SR=400 → BG≈36.4; RH=60; WS=2
{
  const bg = 30 + 0.016 * 400;
  const want = 8.62 + 0.38 * 60 + 1.55 * bg - 0.5 * 2 + Math.exp(2.4 - 2);
  eq('HLI(30,60,400,2)', hli(30, 60, 400, 2), want);
  // холодная ветвь: BG<25
  const bg2 = 20;
  const want2 = 1.3 + 0.38 * 70 + 1.55 * bg2 - 0.5 * 3 + Math.exp(2.4 - 3);
  eq('HLI холод(20,70,0,3)', hli(20, 70, 0, 3), want2);
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
