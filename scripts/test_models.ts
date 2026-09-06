/** Проверка плюм-модели и surveillance на синтетике. */
import { getPlume, PLUME_PRESETS } from '../src/lib/models/plume';
import { demoSeries, ears, rtCori, kulldorffScan, demoScanData, farrington } from '../src/lib/models/surveillance';
import { perturbedEnsemble } from '../src/lib/models/ensemble';

const hourly = Array.from({ length: 72 }, (_, i) => ({
  time: `${String(i % 24).padStart(2, '0')}:00`,
  temp: 20,
  rh: 60,
  wind: 5,
  wdir: 270,
  precip: 0,
  thi: 65,
}));

const cells = getPlume({ lat: 47.5, lon: 42.1 }, hourly, PLUME_PRESETS.generic);
console.log('plume cells:', cells.length, 'max dose:', Math.max(0, ...cells.map((c) => c.dose)));
console.log('sample:', cells.slice(0, 3).map((c) => `${c.lat},${c.lon}:${c.dose}`).join(' | '));

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
