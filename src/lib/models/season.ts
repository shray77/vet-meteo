/**
 * «Сезон векторов» — сезонная модель активности взрослых Hyalomma marginatum
 * (переносчик КГЛ; Culicoides/дирофилярия/ВЗН — в advanced.ts, клещевой
 * 7-дневный датчик — в parasites.ts: это другой масштаб, окно, не сезон).
 *
 * Аудит 2026-11-12 (formula-science-audit, Task 238) — якоря из первоисточников:
 *  - ECDC, Factsheet for experts «Hyalomma marginatum» (Tier 1, обновляемый):
 *    взрослые активируются весной при среднемесячной 10.5°C; активно ищут
 *    хозяина при суточной 22–27°C (RH 75–100%); при воздухе >30°C прячутся
 *    в почву; главный вектор ККГЛ в Европе.
 *    https://www.ecdc.europa.eu/en/disease-vectors/facts/tick-factsheets/hyalomma-marginatum
 *  - Carrera-Faja et al. 2023 (Tier 2): взрослые на хозяевах март–ноябрь,
 *    пик апрель–июнь (https://www.sciencedirect.com/science/article/pii/S2352771423001428).
 *  - ККГЛ эндемичен в Ростовской обл.: 750 случаев, 29 смертей 1999–2020
 *    (Volynkina et al. 2022, PLOS ONE); 710 случаев 2000–2019 (Pshenichnaya 2020).
 *
 * Модель детерминирована: среднемесячная → окно сезона; суточная Tmean →
 * класс квестинга. Никакого ML, скрытых констант нет — только якоря выше.
 * Фенологический сезон (март–ноябрь) шире модельного (месячная ≥10.5°C):
 * расхождение честно фиксируется как «модельный сезон уже фенологического».
 */

export const HYALOMMA_ANCHORS = {
  /** ECDC: активация взрослых при среднемесячной, °C */
  activationMonthlyMean: 10.5,
  /** ECDC: суточное окно активного квестинга [min, max], °C */
  questingMin: 22,
  questingMax: 27,
  /** ECDC: суточная выше — затишье (клещи прячутся в почву) */
  heatHide: 30,
} as const;

const MONTH_RU_SHORT = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** Месяц по-русски (коротко): monthNum 1..12 → 'апр'. */
export function monthRu(m: number | null): string {
  return m == null ? '—' : MONTH_RU_SHORT[m] ?? String(m);
}

export interface HyalommaSeasonResult {
  /** первый месяц со среднемесячной ≥ 10.5°C (1..12) */
  openMonth: number | null;
  /** последний месяц со среднемесячной ≥ 10.5°C (1..12) */
  closeMonth: number | null;
  /** все «открытые» месяцы сезона */
  activeMonths: number[];
  /** стата по квестингу внутри сезона (считается по суточным, если переданы) */
  questing: QuestingStats | null;
  label: string;
}

/**
 * Окно сезона взрослых Hyalomma по среднемесячным температурам (янв..дек).
 * monthlyMeans — ровно 12 значений (короткие месяцы допускаются NaN → месяц
 * игнорируется). Сезон считается открытым в месяце, чья средняя ≥ 10.5°C;
 * если все 12 ниже — сезон в этом году не открывался (нулевая фаза).
 */
export function hyalommaSeason(monthlyMeans: number[], daily?: { tMax: number; tMin: number }[]): HyalommaSeasonResult {
  const active: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const v = monthlyMeans[m - 1];
    if (Number.isFinite(v) && v >= HYALOMMA_ANCHORS.activationMonthlyMean) active.push(m);
  }
  const openMonth = active.length ? Math.min(...active) : null;
  const closeMonth = active.length ? Math.max(...active) : null;
  const questing = daily ? questingStats(daily) : null;
  const label =
    openMonth == null
      ? 'сезон не открывался (среднемесячная ни разу не достигла 10.5°C)'
      : `сезон ${monthRu(openMonth)}–${monthRu(closeMonth)} (среднемесячная ≥10.5°C)`;
  return { openMonth, closeMonth, activeMonths: active, questing, label };
}

/** Класс суточной активности (квестинга) взрослых по Tmean. */
export type QuestingClass = 'peak' | 'active' | 'heat' | 'off';

export function questingClass(dailyTMean: number): QuestingClass {
  if (dailyTMean > HYALOMMA_ANCHORS.heatHide) return 'heat';
  if (dailyTMean >= HYALOMMA_ANCHORS.questingMin && dailyTMean <= HYALOMMA_ANCHORS.questingMax) return 'peak';
  if (dailyTMean >= HYALOMMA_ANCHORS.activationMonthlyMean) return 'active';
  return 'off';
}

export const QUESTING_LABELS: Record<QuestingClass, string> = {
  peak: 'пик квестинга (22–27°C)',
  active: 'активны',
  heat: 'затишье: жара >30°C, клещи в почве',
  off: 'не активны (<10.5°C)',
};

export interface QuestingStats {
  peakDays: number;
  activeDays: number;
  heatDays: number;
  offDays: number;
}

/** Подсчёт дней по классам квестинга за сезон (суточные Tmean). */
export function questingStats(daily: { tMax: number; tMin: number }[]): QuestingStats {
  const s: QuestingStats = { peakDays: 0, activeDays: 0, heatDays: 0, offDays: 0 };
  for (const d of daily) {
    const cls = questingClass((d.tMax + d.tMin) / 2);
    if (cls === 'peak') s.peakDays++;
    else if (cls === 'active') s.activeDays++;
    else if (cls === 'heat') s.heatDays++;
    else s.offDays++;
  }
  return s;
}

/**
 * Среднемесячные из суточного ряда (год целиком или неполный):
 * для каждого месяца со днями — среднее Tmean=(tMax+tMin)/2.
 * Возвращает массив из 12 (индексы 0..11 = янв..дек; месяц без данных — NaN).
 */
export function monthlyMeansFromDaily(daily: { date: string; tMax: number; tMin: number }[]): number[] {
  const sums = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  for (const d of daily) {
    const m = Number(d.date.slice(5, 7));
    if (m >= 1 && m <= 12) {
      sums[m - 1] += (d.tMax + d.tMin) / 2;
      counts[m - 1]++;
    }
  }
  return sums.map((s, i) => (counts[i] ? s / counts[i] : NaN));
}
