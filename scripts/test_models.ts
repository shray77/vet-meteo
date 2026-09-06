/** Проверка моделей: плюм, surveillance, ансамбль + ревизия 2026-09-07 (THIadj, HLI, Tw). */
import { getPlume, PLUME_PRESETS } from '../src/lib/models/plume';
import { demoSeries, ears, rtCori, kulldorffScan, demoScanData, farrington } from '../src/lib/models/surveillance';
import { perturbedEnsemble } from '../src/lib/models/ensemble';
import { thi, thiMader, milkLoss } from '../src/lib/models/thi';
import { wetBulb, hli, ahlAccumulate, thiPoultry } from '../src/lib/models/advanced';
import { et0 } from '../src/lib/models/parasites';

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
