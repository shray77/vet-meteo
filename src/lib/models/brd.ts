/**
 * BRD-скоринг — риск респираторных болезней телят (0–100).
 * Драйверы по литературе (enzootic pneumonia / shipping fever):
 *  — большая амплитуда T суток (термический стресс ≥10°),
 *  — сырость/осадки + высокая RH,
 *  — застой воздуха в телятниках ИЛИ сквозняк (оба плохо),
 *  — резкое похолодание против предыдущих суток.
 * Веса эвристические, для прототипа.
 */
import type { BrdResult } from '../types';

export function brdScore(input: {
  tMax: number;
  tMin: number;
  rhMean: number;
  precip: number;
  windMean: number;
  coldPool: number;
  windExposure: number;
  tempDrop: number; // T сегодня − T вчера, °C (отрицательное = похолодание)
}): BrdResult {
  const amp = input.tMax - input.tMin;
  const drivers: string[] = [];
  let s = 0;

  const ampPts = Math.max(0, Math.min(35, (amp - 8) * 5.5));
  if (ampPts > 10) drivers.push(`амплитуда T за сутки ${amp.toFixed(0)}°`);
  s += ampPts;

  const wetPts = Math.max(0, Math.min(25, (input.rhMean - 65) * 0.8 + input.precip * 4));
  if (wetPts > 8) drivers.push(`сырость RH ${input.rhMean.toFixed(0)}%${input.precip > 0.5 ? ' + осадки' : ''}`);
  s += wetPts;

  // застой ИЛИ сквозняк — оба повышают риск
  const stagnant = input.coldPool > 0.5 && input.windMean < 2;
  const drafty = input.windExposure > 0.65 && input.windMean > 5;
  let ventPts = 0;
  if (stagnant) { ventPts = 18; drivers.push('застой воздуха (корыто рельефа, штиль)'); }
  if (drafty) { ventPts = 15; drivers.push('сквозняк на наветренном склоне'); }
  s += ventPts;

  const coldPts = Math.max(0, Math.min(20, -input.tempDrop * 2.4));
  if (coldPts > 8) drivers.push(`похолодание ${(-input.tempDrop).toFixed(1)}° к прошлым суткам`);
  s += coldPts;

  const score = Math.round(Math.max(0, Math.min(100, s)));
  const level = score >= 60 ? 'high' : score >= 35 ? 'moderate' : 'low';
  const label =
    level === 'high' ? 'высокий риск BRD' :
    level === 'moderate' ? 'умеренный риск BRD' : 'низкий риск BRD';
  return { score, level, label, drivers };
}
