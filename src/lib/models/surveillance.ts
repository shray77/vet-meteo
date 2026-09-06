/**
 * СИСТЕМА НАДЗОРА: алгоритмы раннего обнаружения + оценка эпидкривой.
 * - EARS C1/C2/C3 (CDC/ECDC)
 * - Фаррингтон-подобный скоринг (log-линейный базлайн + верхняя граница)
 * - Rt по Cori (2013) с гамма-апостериором
 * - Пространственный скан-статистики Кульдорфа (Пуассон, Монте-Карло)
 * Демо-ряды — детерминированный сид, чтобы UI был воспроизводим.
 */

/* ---------- детерминированный ГПСЧ (mulberry32) ---------- */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(r: () => number, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L && k < 500);
  return k - 1;
}

/* ---------- демо-ряд: 60 дней, вспышка с 45-го дня ---------- */
export interface DailyCase {
  day: number; // 0..59
  date: string;
  cases: number;
}

export function demoSeries(seed = 61): DailyCase[] {
  const r = rng(seed);
  const out: DailyCase[] = [];
  const now = new Date();
  for (let i = 59; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400_000);
    const idx = 59 - i;
    let lambda = 1.6 + 0.05 * Math.sin(idx / 9);
    if (idx >= 44) lambda = 1.8 + (idx - 44) * 0.65; // волна
    out.push({
      day: idx,
      date: d.toISOString().slice(0, 10),
      cases: poisson(r, lambda),
    });
  }
  return out;
}

/* ---------- EARS C1/C2/C3 ---------- */
export interface EarsResult {
  day: number;
  date: string;
  cases: number;
  c1: number;
  c2: number;
  c3: number;
  alarm: 'ok' | 'watch' | 'alarm';
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}

/**
 * C1: (x_t − μ₇)/√μ₇ (Пуассон-дисперсия), базлайн — 7 предыдущих дней.
 * C2: то же для μ₃ с лагом 2 дня. C3: сумма отклонений за 3 дня.
 * watch ≥ 2, alarm ≥ 3 (грубо, как в ECDC EARS).
 */
export function ears(series: DailyCase[]): EarsResult[] {
  return series.map((d, i) => {
    const prev7 = series.slice(Math.max(0, i - 7), i).map((x) => x.cases);
    const last3 = series.slice(Math.max(0, i - 3), i).map((x) => x.cases);
    const base7 = Math.max(0.5, mean(prev7));
    const sd7 = Math.sqrt(base7);

    const c1 = (d.cases - base7) / sd7;

    const prev7b = series.slice(Math.max(0, i - 9), Math.max(0, i - 2)).map((x) => x.cases);
    const base7b = Math.max(0.5, mean(prev7b));
    const sdb = Math.sqrt(base7b);
    const c2 = (mean(last3) - base7b) / (sdb / Math.sqrt(Math.max(1, last3.length)));

    const dev3 = series.slice(Math.max(0, i - 3), i + 1).map((x) => x.cases - base7);
    const c3 = dev3.reduce((a, b) => a + b, 0) / sd7;

    const m = Math.max(Math.abs(c1), Math.abs(c2), Math.abs(c3));
    return {
      day: d.day,
      date: d.date,
      cases: d.cases,
      c1: +c1.toFixed(2),
      c2: +c2.toFixed(2),
      c3: +c3.toFixed(2),
      alarm: m >= 3 ? 'alarm' : m >= 2 ? 'watch' : 'ok',
    };
  });
}

/* ---------- Фаррингтон-подобный скоринг ---------- */
export interface FarringtonFlag {
  date: string;
  cases: number;
  expected: number;
  upper: number;
  flag: boolean;
}

/** Базлайн: регрессия log(x+0.5) на первых n0 днях; верхняя граница +95%. */
export function farrington(series: DailyCase[], n0 = 42): FarringtonFlag[] {
  const train = series.slice(0, n0);
  const xs = train.map((d, i) => i + 1);
  const ys = train.map((d) => Math.log(d.cases + 0.5));
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  const b = den > 0 ? num / den : 0;
  const a = my - b * mx;
  const resid = ys.map((y, i) => y - (a + b * xs[i]));
  const sd = Math.sqrt(mean(resid.map((r2) => r2 * r2)));

  return series.slice(n0).map((d) => {
    const expected = Math.exp(a + b * (d.day + 1)) - 0.5;
    const upper = Math.exp(a + b * (d.day + 1) + 1.645 * Math.max(0.15, sd)) - 0.5;
    return {
      date: d.date,
      cases: d.cases,
      expected: +expected.toFixed(1),
      upper: +upper.toFixed(1),
      flag: d.cases > upper,
    };
  });
}

/* ---------- Rt по Cori (2013) ---------- */
export interface RtPoint {
  date: string;
  rt: number;
  lo: number;
  hi: number;
}

/** Дискретизированный SI: гамма-форма по mean/sd, нормировка суммы. */
function siSerial(meanSi: number, sdSi: number, maxK = 14): number[] {
  const shape = (meanSi * meanSi) / (sdSi * sdSi);
  const rate = meanSi / (sdSi * sdSi);
  const w: number[] = [];
  for (let k = 1; k <= maxK; k++) w.push(Math.pow(k, shape - 1) * Math.exp(-rate * k));
  const tot = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / tot);
}

/** Обратная нормальная CDF (аппроксимация Акклама). */
function normInv(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Гамма-квантиль (Вилсон–Хилферти: χ²(2α)/(2β)). */
function gammaQ(shape: number, rate: number, p: number): number {
  const z = normInv(p);
  const core = Math.max(1e-6, 1 - 1 / (9 * shape) + z / (3 * Math.sqrt(shape)));
  return (shape * Math.pow(core, 3)) / rate;
}

/**
 * Cori et al. 2013: Rt|I ~ Gamma(a + ΣI_t, 1/(1/b + ΣΛ_t)) на окне τ.
 * Приор R ~ Gamma(1, 5) (a=1, b=5). Точечная оценка — среднее апостериора.
 */
export function rtCori(series: DailyCase[], window = 3, meanSi = 14, sdSi = 7): RtPoint[] {
  const w = siSerial(meanSi, sdSi);
  const I = series.map((d) => d.cases);
  const out: RtPoint[] = [];
  const a = 1;
  const b = 5;

  for (let t = 1; t < I.length; t++) {
    // Λ_t
    let lam = 0;
    for (let k = 1; k <= Math.min(w.length, t); k++) lam += I[t - k] * w[k - 1];
    if (lam <= 0.01) continue;

    // окно [t-τ+1, t]
    let sumI = 0;
    let sumLam = 0;
    let ok = true;
    for (let j = 0; j < window; j++) {
      const tt = t - j;
      if (tt < 1) {
        ok = false;
        break;
      }
      let l = 0;
      for (let k = 1; k <= Math.min(w.length, tt); k++) l += I[tt - k] * w[k - 1];
      if (l <= 0.01) {
        ok = false;
        break;
      }
      sumI += I[tt];
      sumLam += l;
    }
    if (!ok || sumLam <= 0.01) continue;

    const shape = a + sumI;
    const rate = 1 / b + sumLam;
    const mean0 = shape / rate;
    const lo = gammaQ(shape, rate, 0.025);
    const hi = gammaQ(shape, rate, 0.975);
    out.push({
      date: series[t].date,
      rt: +mean0.toFixed(2),
      lo: +lo.toFixed(2),
      hi: +hi.toFixed(2),
    });
  }
  return out;
}

/* ---------- Кульдорфф скан (Пуассон) ---------- */
export interface ScanCluster {
  center: string;
  radiusKm: number;
  observed: number;
  expected: number;
  llr: number;
  p: number;
}

interface ScanUnit {
  name: string;
  lat: number;
  lon: number;
  cases: number;
  pop: number;
}

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dy = (a.lat - b.lat) * 111.32;
  const dx = (a.lon - b.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

/**
 * Круговой Пуассон-скан: окна = центры×радиусы (≤50% популяции),
 * LLR = c·ln(c/μ) + (C−c)·ln((C−c)/(C−μ)) при c>μ; p-value — Монте-Карло.
 */
export function kulldorffScan(units: ScanUnit[], radiiKm: number[], nMc = 199): ScanCluster[] {
  const C = units.reduce((a, u) => a + u.cases, 0);
  const P = units.reduce((a, u) => a + u.pop, 0);

  const clusters: ScanCluster[] = [];
  for (const center of units) {
    for (const r of radiiKm) {
      const inside = units.filter((u) => km(center, u) <= r);
      const pop = inside.reduce((a, u) => a + u.pop, 0);
      if (pop > P / 2) break; // окно захватило больше половины населения — дальше не растём
      const c = inside.reduce((a, u) => a + u.cases, 0);
      const mu = (C * pop) / P;
      if (c <= mu || mu <= 0) continue;
      const llr =
        c * Math.log(c / mu) + (C - c) * Math.log(Math.max(1e-9, (C - c) / Math.max(1e-9, C - mu)));
      clusters.push({ center: center.name, radiusKm: r, observed: c, expected: +mu.toFixed(1), llr: +llr.toFixed(2), p: 0 });
    }
  }
  clusters.sort((a, b) => b.llr - a.llr);
  const top = clusters.slice(0, 5);
  if (top.length === 0) return [];

  // Монте-Карло: полиномиальная выборка C случаев пропорционально населению
  const r = rng(4242);
  for (let m = 0; m < nMc; m++) {
    const left = units.map((u) => u.pop);
    let pleft = P;
    const sim = units.map(() => 0);
    for (let k = 0; k < C; k++) {
      let pick = r() * pleft;
      let idx = 0;
      while (idx < units.length - 1 && pick > left[idx]) {
        pick -= left[idx];
        idx++;
      }
      sim[idx]++;
      left[idx]--;
      pleft--;
    }
    // максимум LLR на симуляции (те же окна)
    let maxL = 0;
    for (const center of units) {
      for (const rr of radiiKm) {
        let popIn = 0;
        let c2 = 0;
        for (let i = 0; i < units.length; i++) {
          if (km(center, units[i]) <= rr) {
            popIn += units[i].pop;
            c2 += sim[i];
          }
        }
        if (popIn > P / 2) break;
        const mu = (C * popIn) / P;
        if (c2 > mu && mu > 0) {
          const llr =
            c2 * Math.log(c2 / mu) + (C - c2) * Math.log(Math.max(1e-9, (C - c2) / Math.max(1e-9, C - mu)));
          if (llr > maxL) maxL = llr;
        }
      }
    }
    for (const t of top) if (maxL >= t.llr) t.p += 1 / (nMc + 1);
  }
  for (const t of top) t.p = +Math.max(1 / (nMc + 1), t.p).toFixed(3);
  return top;
}

/** Демо-кластеризация: 10 КГЛ-районов, всплеск в 3 соседних. */
export function demoScanData() {
  const base: [string, number, number, number][] = [
    ['Верхнедонской', 49.75, 41.1, 8],
    ['Шолоховский', 49.6, 41.7, 9],
    ['Миллеровский', 48.92, 40.4, 12],
    ['Чертковский', 49.35, 40.15, 7],
    ['Тарасовский', 48.65, 40.35, 6],
    ['Кашарский', 48.4, 41.6, 9],
    ['Боковский', 48.95, 41.75, 6],
    ['Советский', 49.0, 41.0, 8],
    ['Каменский', 48.35, 40.5, 5],
    ['Тацинский', 48.4, 41.7, 7],
  ];
  const r = rng(7);
  const units = base.map(([name, lat, lon, pop]) => ({
    name,
    lat,
    lon,
    pop: pop * 1000,
    cases: poisson(r, 2 + (name === 'Миллеровский' || name === 'Чертковский' || name === 'Тарасовский' ? 12 : 0)),
  }));
  return units;
}
