/**
 * Векторные и паразитарные модели.
 * 1) Активность клещей: GDD с базой 10°C, отдельно Hyalomma marginatum
 *    (переносчик КГЛ, степной, летний пик) и Dermacentor (весенний пик).
 * 2) Риск КГЛ: эндемичность района × GDD Hyalomma × сухость (VPD-фактор).
 * 3) Фасциолёз: влагостат Ollerenshaw-подобный Σ(P − 0.8·ET₀),
 *    ET₀ упрощённо по Hargreaves от радиации/температуры.
 */
import type { CchfResult, FasciolaResult, TickResult } from '../types';

/** GDD base 10°C за окно дней (максимум из Tmean и Tmin-обрезки). */
export function gdd10(daily: { tMax: number; tMin: number }[]): number {
  return daily.reduce((s, d) => {
    const tMean = (d.tMax + d.tMin) / 2;
    const upper = Math.min(tMean, 35);
    return s + Math.max(0, upper - 10);
  }, 0);
}

export function ticksOutlook(daily: { tMax: number; tMin: number }[]): TickResult {
  const g = gdd10(daily);
  // Hyalomma: степной юг, активен при тёплой сухой погоде (накопленные GDD)
  const hyalomma = Math.max(0, Math.min(100, (g / 140) * 100));
  // Dermacentor: холодостойкий, пик весной; осенью в окне 7д обычно спад
  const derm = Math.max(0, Math.min(100, (g / 90) * 100 * 0.75));
  const label =
    hyalomma > 70 ? 'клещи очень активны' :
    hyalomma > 45 ? 'клещи активны' :
    hyalomma > 20 ? 'умеренная активность' : 'низкая активность';
  return {
    gdd: +g.toFixed(0),
    hyalomma: Math.round(hyalomma),
    dermacentor: Math.round(derm),
    label,
  };
}

/** Насыщенный дефицит (гПа): сухость подавляет активность голодных клещей. */
export function vpd(tMean: number, rhMean: number): number {
  const es = 6.112 * Math.exp((17.67 * tMean) / (tMean + 243.5));
  return es * (1 - rhMean / 100);
}

export function cchfRisk(input: {
  endemic: boolean;
  daily: { tMax: number; tMin: number }[];
  rhMean: number;
  tMean: number;
}): CchfResult {
  const g = gdd10(input.daily);
  const v = vpd(input.tMean, input.rhMean);
  // Hyalomma хорошо переносит сухость, но при сильном VPD активность снижается
  const activity = Math.min(1, g / 140);
  const dryPenalty = v > 18 ? 0.6 : v > 12 ? 0.85 : 1;
  const base = input.endemic ? 45 : 8;
  const risk = Math.round(Math.min(100, base + activity * dryPenalty * 55));
  const label = input.endemic
    ? risk > 60 ? 'высокий риск КГЛ (эндемичный район!)' :
      risk > 35 ? 'средний риск КГЛ' : 'низкий риск КГЛ'
    : 'неэндемичный район по КГЛ';
  return { risk, label };
}

/** ET₀ (мм/сут) по Hargreaves (упрощённо, без Rx). */
export function et0(tMax: number, tMin: number, lat: number): number {
  const tMean = (tMax + tMin) / 2;
  const month = new Date().getMonth() + 1;
  const Ra = 15 + 10 * Math.sin(((month - 3) / 12) * 2 * Math.PI) * Math.cos((lat / 90) * 1.2);
  return +Math.max(0, 0.0023 * Ra * (tMax - tMin) ** 0.5 * (tMean + 17.8)).toFixed(2);
}

/**
 * Влагостат фасциолёза за окно: Σ(P − 0.8·ET₀), суммируем по дням.
 * > 50 мм-избытка → «высокий» (пруды-биотопы Lymnaea переполнены),
 * > 20 → средний.
 */
export function fasciolaIndex(input: {
  daily: { tMax: number; tMin: number; precipSum: number }[];
  lat: number;
}): FasciolaResult {
  let acc = 0;
  for (const d of input.daily) {
    const e = et0(d.tMax, d.tMin, input.lat);
    acc += d.precipSum - 0.8 * e;
  }
  const moisture = +acc.toFixed(1);
  const level = moisture > 50 ? 'high' : moisture > 20 ? 'medium' : 'low';
  const label =
    level === 'high' ? 'высокий риск фасциолёза (влагостат >50)' :
    level === 'medium' ? 'средний риск фасциолёза' :
    'низкий риск фасциолёза';
  return { moisture, level, label };
}
