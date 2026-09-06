/**
 * THI — индекс теплового стресса (Temperature-Humidity Index), КРС.
 * THI = (1.8·T + 32) − (0.55 − 0.0055·RH)·(1.8·T − 26)
 * (NRC—Yousef; классификация Armstrong 1994).
 *
 * Ревизия 2026-09-07 (сверка с первоисточниками):
 *  — потери удоя: Ravagnolo & Misztal (2000, JDS 83:109) — ~0.2 кг/ед. THI>72
 *    (было 0.25 — завышено);
 *  — добавлен THIadj (Mader et al. 2006, JAS 84:712): поправка на ветер
 *    и солнечную радиацию по данным 14:00–17:00.
 */
import type { ThiClass } from '../types';

export function thi(t: number, rh: number): number {
  const f = 1.8 * t + 32;
  return f - (0.55 - 0.0055 * rh) * (1.8 * t - 26);
}

/**
 * THIadj (Mader et al. 2006): THI + поправка на ветер и радиацию.
 * THIadj = 4.51 + THI − 1.992·WS + 0.0068·SR
 * WS — м/с (обезветривание), SR — Вт/м² (солнечная нагрузка).
 * Валидна для дневных условий (получена по часам 14–17); ночью SR=0 —
 * остаётся ветровое облегчение. Тёмная масть — верхняя граница эффекта.
 */
export function thiMader(t: number, rh: number, windMs: number, swrWm2 = 0): number {
  const base = thi(t, rh);
  const ws = Math.max(0, Math.min(18, windMs));
  const sr = Math.max(0, Math.min(1200, swrWm2 ?? 0));
  return +(4.51 + base - 1.992 * ws + 0.0068 * sr).toFixed(1);
}

export function thiClass(v: number): ThiClass {
  if (v < 68) return { key: 'ok', label: 'нет стресса', color: '#5f9e5f' };
  if (v < 72) return { key: 'mild', label: 'лёгкий', color: '#a8b845' };
  if (v < 80) return { key: 'moderate', label: 'умеренный', color: '#e0a636' };
  if (v < 90) return { key: 'severe', label: 'тяжёлый', color: '#d95f2b' };
  return { key: 'extreme', label: 'критический', color: '#c0392b' };
}

/** Потери удоя молочными коровами при THI>72 (кг/сут, Ravagnolo & Misztal 2000). */
export function milkLoss(v: number): number {
  if (v <= 72) return 0;
  return +((v - 72) * 0.2).toFixed(1);
}

/** Снижение потребления корма (%) при THI>80 (эвристика по extension-гайдам). */
export function feedIntakeDrop(v: number): number {
  if (v <= 80) return 0;
  return +Math.min(35, (v - 80) * 1.7).toFixed(0);
}
