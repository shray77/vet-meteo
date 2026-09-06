/**
 * THI — индекс теплового стресса (Therm Temperature-Humidity Index), КРС.
 * THI = (1.8·T + 32) − (0.55 − 0.0055·RH)·(1.8·T − 26)
 * (NRC—Yousef; классификация Armstrong 1994; потери удоя ≈ 0.25 кг/ед. THI>72,
 * Ravagnolo & Mistlall 2000).
 */
import type { ThiClass } from '../types';

export function thi(t: number, rh: number): number {
  const f = 1.8 * t + 32;
  return f - (0.55 - 0.0055 * rh) * (1.8 * t - 26);
}

export function thiClass(v: number): ThiClass {
  if (v < 68) return { key: 'ok', label: 'нет стресса', color: '#5f9e5f' };
  if (v < 72) return { key: 'mild', label: 'лёгкий', color: '#a8b845' };
  if (v < 80) return { key: 'moderate', label: 'умеренный', color: '#e0a636' };
  if (v < 90) return { key: 'severe', label: 'тяжёлый', color: '#d95f2b' };
  return { key: 'extreme', label: 'критический', color: '#c0392b' };
}

/** Потери удоя молочными коровами при THI>72 (кг/сут). */
export function milkLoss(v: number): number {
  if (v <= 72) return 0;
  return +((v - 72) * 0.25).toFixed(1);
}

/** Снижение потребления корма (%) при THI>80. */
export function feedIntakeDrop(v: number): number {
  if (v <= 80) return 0;
  return +Math.min(35, (v - 80) * 1.7).toFixed(0);
}
