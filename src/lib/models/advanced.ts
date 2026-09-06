/**
 * РАСШИРЕННЫЕ БИОКЛИМАТИЧЕСКИЕ ИНДЕКСЫ.
 * Психрометрия + видовые THI + холодовой стресс + HLI/AHL + трансмиссивные модели.
 *
 * Все формулы — для скрининга/прототипа, помечены источниками в README.
 */

/* ============ 1. Психрометрия ============ */

/**
 * Температура смоченного термометра (Stull 2011, приближение, RH 5–99%).
 * ФИКС 2026-09-07: RH подаётся в ПРОЦЕНТАХ (5–99), а не долей — раньше
 * делился на 100, и Tw занижался на ~10° (ломало THI птицы).
 */
export function wetBulb(t: number, rh: number): number {
  const r = Math.max(5, Math.min(99, rh));
  const v =
    t * Math.atan(0.151977 * Math.sqrt(r + 8.313659)) +
    Math.atan(t + r) -
    Math.atan(r - 1.676331) +
    0.00391838 * Math.pow(r, 1.5) * Math.atan(0.023101 * r) -
    4.686035;
  return +v.toFixed(1);
}

/** Насыщенное давление пара (Tetens), кПа. */
export function satVap(t: number): number {
  return 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
}

/** Дефицит давления пара VPD, кПа. Низкий VPD = «влага липнет» — риск клещей/миджсов. */
export function vpd(t: number, rh: number): number {
  return +Math.max(0, satVap(t) * (1 - rh / 100)).toFixed(2);
}

/* ============ 2. Видовые THI ============ */

export interface SpeciesThi {
  value: number;
  label: string;
  zone: string;
  color: string;
}

/** Птица: THI = 0.6·Tdb + 0.4·Twb (индекс теплового стресса бройлеров/кур). */
export function thiPoultry(tdb: number, rh: number): SpeciesThi {
  const twb = wetBulb(tdb, rh);
  const v = 0.6 * tdb + 0.4 * twb;
  if (v < 70) return { value: v, label: 'птица', zone: 'норма', color: '#5f9e5f' };
  if (v < 75) return { value: v, label: 'птица', zone: 'лёгкий стресс', color: '#e0a636' };
  if (v < 80) return { value: v, label: 'птица', zone: 'опасный (питьё/вент.)', color: '#d95f2b' };
  return { value: v, label: 'птица', zone: 'критический (падёж)', color: '#c0392b' };
}

/** Свиноматки лактирующие: тот же NRC-THI, но сдвинутые пороги (дыхание начинается ~72). */
export function thiSow(tdb: number, rh: number): SpeciesThi {
  const f = 1.8 * tdb + 32;
  const v = f - (0.55 - 0.0055 * rh) * (1.8 * tdb - 26);
  if (v < 72) return { value: v, label: 'свиноматка', zone: 'норма', color: '#5f9e5f' };
  if (v < 78) return { value: v, label: 'свиноматка', zone: 'стресс (аппетит ↓)', color: '#e0a636' };
  if (v < 84) return { value: v, label: 'свиноматка', zone: 'опасный (молоко ↓)', color: '#d95f2b' };
  return { value: v, label: 'свиноматка', zone: 'критический', color: '#c0392b' };
}

/* ============ 3. Холодовой стресс КРС ============ */

export interface ColdStress {
  wci: number;
  zone: string;
  note: string;
}

/**
 * WCI (wind chill index, kcal/м²·ч) — классическая форма
 * (10.45 + 10·√v − v)·(33 − T), применяемая в гайд-лайнax содержания КРС.
 * Пороги — по мотивам Iowa State Extension (схематично).
 */
export function coldStress(t: number, vMs: number): ColdStress {
  const v = Math.max(0.1, Math.min(18, vMs));
  const wci = +((10.45 + 10 * Math.sqrt(v) - v) * (33 - t)).toFixed(0);
  if (wci < 600) return { wci, zone: 'норма', note: 'норма' };
  if (wci < 1000)
    return { wci, zone: 'лёгкий', note: 'лёгкий холодовой стресс: +энергия на обогрев ~5%' };
  if (wci < 1400)
    return { wci, zone: 'умеренный', note: 'умеренный: сухостой/молодняк — подветренные укрытия, +10% корма' };
  return { wci, zone: 'сильный', note: 'сильный: LCT выше факта — новорождённые телята в домики, ветрозащита' };
}

/* ============ 4. HLI / AHL (Gaughan et al. 2008, JAS 86:329) ============ */

/**
 * HLI (Heat Load Index, Gaughan et al. 2008) — каноническая двухчастная форма:
 *   BG ≥ 25°C: HLI = 8.62 + 0.38·RH + 1.55·BG − 0.5·WS + e^(2.4−WS)
 *   BG < 25°C: HLI = 1.3  + 0.38·RH + 1.55·BG − 0.5·WS + e^(2.4−WS)
 * BG — температура чёрного глобуса (°C), RH — %, WS — м/с.
 * Глобус оцениваем: BG ≈ Tdb + 0.016·SWR (солнечная радиация, Вт/м²).
 * Ревизия 2026-09-07: было «THI + 0.35·(TG−Tdb) − 1.4·WS» — не HLI;
 * заменено на опубликованную формулу.
 */
export function hli(tdb: number, rh: number, swrWm2: number, windMs: number): number {
  const bg = tdb + 0.016 * Math.max(0, swrWm2 ?? 0);
  const ws = Math.max(0, Math.min(18, windMs));
  const base = (bg >= 25 ? 8.62 : 1.3) + 0.38 * rh + 1.55 * bg - 0.5 * ws;
  return +(base + Math.exp(2.4 - ws)).toFixed(1);
}

export interface AhlResult {
  ahl: number;
  zone: string;
}

/**
 * AHL (накопленная тепловая нагрузка) по почасовому ряду HLI.
 * Порог накопления: HLI > 78 (кормовой скот в умеренном климате;
 * акклиматизированный/тропический — 86). Распад 2%/ч — упрощение.
 * Зоны — по категориям Gaughan (термонейтраль <1; далее нарастание).
 */
export function ahlAccumulate(hourly: { hli: number }[], threshold = 78): AhlResult {
  let a = 0;
  for (const h of hourly) a = Math.max(0, 0.98 * a + Math.max(0, h.hli - threshold));
  if (a < 1) return { ahl: +a.toFixed(1), zone: 'термонейтрально' };
  if (a < 10) return { ahl: +a.toFixed(1), zone: 'лёгкое накопление: тени + вода' };
  if (a < 50) return { ahl: +a.toFixed(0), zone: 'накопление: вода + ночная вентиляция' };
  if (a < 100) return { ahl: +a.toFixed(0), zone: 'высокое: падение поедания' };
  return { ahl: +a.toFixed(0), zone: 'опасное: кормления на ночь, охлаждение' };
}

/* ============ 5. Дирофиляриоз (HDU) ============ */

export interface DiroResult {
  hdu8d: number;
  hdu30d: number;
  infective: boolean;
  note: string;
}

/**
 * Heartworm Development Units (Knight & Lok):
 * HDU = Σ(Tmean − 14) за дни с Tmean > 14 °C. L3 личинки D. immitis
 * становятся инфективными ≈ при 130 HDU. Сезон — окно прогноза + экстраполяция.
 */
export function dirofilaria(daily: { tMax: number; tMin: number }[]): DiroResult {
  let hdu = 0;
  let n = 0;
  for (const d of daily) {
    const m = (d.tMax + d.tMin) / 2;
    if (m > 14) {
      hdu += m - 14;
      n++;
    }
  }
  const perDay = n > 0 ? hdu / n : 0;
  const hdu30 = +(hdu + perDay * (30 - n)).toFixed(0);
  const infective = hdu30 >= 130;
  return {
    hdu8d: +hdu.toFixed(0),
    hdu30,
    infective,
    note: infective
      ? 'прогноз ≥130 HDU: передача Dirofilaria возможна — макролектические профилактики по схеме'
      : 'окно передачи не достигается (нужно 130 HDU)',
  };
}

/* ============ 6. ВЗН (West Nile, Culex) ============ */

export interface WnvResult {
  score: number; // 0–100
  note: string;
}

/**
 * Векторная активность Culex pipiens: GDD₁₀ (база 10°С) за окно
 * + оптимум 22–28°С + увлажнение. Схематично, скрининг.
 */
export function wnvRisk(daily: { tMax: number; tMin: number; precipSum: number }[]): WnvResult {
  let gdd = 0;
  let tSum = 0;
  let pSum = 0;
  for (const d of daily) {
    const m = (d.tMax + d.tMin) / 2;
    gdd += Math.max(0, m - 10);
    tSum += m;
    pSum += d.precipSum ?? 0;
  }
  const tMean = tSum / Math.max(1, daily.length);
  const tOpt = Math.exp(-Math.pow((tMean - 25) / 6, 2)); // оптимум 25±6°С
  const wet = Math.min(1, pSum / 25);
  const score = Math.round(Math.min(100, 55 * tOpt + 25 * Math.min(1, gdd / 90) + 20 * wet));
  return {
    score,
    note:
      score > 60
        ? 'Culex активны: ВЗН-сезон — комариная защита конюшен, репелленты'
        : 'векторная активность низкая',
  };
}

/* ============ 7. Culicoides (миджсы, Шмалленберг/блютанг) ============ */

export interface MidgeResult {
  midgeDays: number;
  active: boolean;
  note: string;
}

/**
 * «Midge-day» (по мотивам EFSA AHAW): активность Culicoides при
 * Tmean ≥ 13 °С; transmission-окно при Tmean ≥ 15 °С.
 */
export function midgeDays(daily: { tMax: number; tMin: number }[]): MidgeResult {
  let md = 0;
  let tMean7 = 0;
  for (const d of daily) {
    const m = (d.tMax + d.tMin) / 2;
    tMean7 += m;
    md += Math.max(0, m - 13);
  }
  const tm = tMean7 / Math.max(1, daily.length);
  return {
    midgeDays: +md.toFixed(1),
    active: tm >= 13,
    note:
      tm >= 15
        ? 'окно передачи BTV/SBV: карантинные перемещения — по правилам зонирования'
        : tm >= 13
          ? 'миджсы активны, но окно передачи <15°С — низкое'
          : 'Culicoides неактивны (вектор-фри период)',
  };
}
