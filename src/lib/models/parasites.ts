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

/**
 * ET₀ (мм/сут) по Hargreaves: 0.0023·Ra·(Tmax−Tmin)^0.5·(Tmean+17.8).
 * Ra — внеатмосферная радиация (мм/сут экв.) по FAO-56 (астрономия:
 * dr, δ, ωs; Gsc=0.0820 МДж/м²·мин). Раньше Ra был грубой синусоидой
 * по месяцу — завышал осенью; заменено на точную формулу.
 * doy — день года (по умолчанию текущий).
 */
export function et0(tMax: number, tMin: number, lat: number, doy?: number): number {
  const J = doy ?? Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
  const φ = (lat * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * J) / 365);
  const δ = 0.409 * Math.sin((2 * Math.PI * J) / 365 - 1.39);
  const cosωs = -Math.tan(φ) * Math.tan(δ);
  const ωs = Math.acos(Math.max(-1, Math.min(1, cosωs)));
  // МДж/м²·сут → мм/сут (эквивалент испарения, λ≈2.45 МДж/кг)
  const Ra = ((24 * 60 * 0.082 * dr) / Math.PI) * (ωs * Math.sin(φ) * Math.sin(δ) + Math.cos(φ) * Math.cos(δ) * Math.sin(ωs)) / 2.45;
  const tMean = (tMax + tMin) / 2;
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
