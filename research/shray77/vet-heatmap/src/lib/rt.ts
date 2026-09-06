/**
 * Rt (effective reproduction number) calculation.
 *
 * Implements the Cori et al. 2013 method (EpiEstim) — the standard for
 * real-time Rt estimation from incidence time series.
 *
 * Rt = (new cases in window) / (expected cases given past incidence)
 *
 * For each day t, we look at a sliding window [t-w, t] of new cases
 * and estimate Rt using a Poisson process with serial interval
 * derived from the disease's incubation period.
 *
 * Reference: Cori A, Ferguson NM, Fraser C, Cauchemez S. (2013)
 * "A new framework and software to estimate time-varying reproduction
 * numbers during epidemics." Am J Epidemiol.
 *
 * Usage:
 *   const rt = calculateRt(dailyCases, { serialInterval: 7, windowSize: 7 });
 *   // rt[day] = { date, rt, ciLower, ciUpper }
 */

export interface RtDataPoint {
  /** ISO date string. */
  date: string;
  /** Point estimate of Rt. */
  rt: number;
  /** 95% confidence interval lower bound. */
  ciLower: number;
  /** 95% confidence interval upper bound. */
  ciUpper: number;
  /** Number of new cases on this day. */
  cases: number;
}

export interface RtParams {
  /** Serial interval in days (time between symptom onset in primary and
   * secondary case). For ASF: ~7-14 days, for FMD: ~5-7, for HPAI: ~3-5.
   * Defaults to 7 if not specified. */
  serialInterval: number;
  /** Sliding window size in days. EpiEstim default is 7. */
  windowSize: number;
  /** Smoothing — if true, uses a rolling mean instead of raw daily counts
   * to handle reporting delays (weekend dips). */
  smooth: boolean;
}

/**
 * Build a daily case count time series from outbreak records.
 *
 * @param outbreaks — array of outbreaks with `date` (ISO) and `cases` fields
 * @param startDate — optional ISO date to start from (default: earliest outbreak)
 * @param endDate — optional ISO date to end at (default: latest outbreak)
 * @returns array of { date, cases } sorted by date
 */
export function buildDailyCases(
  outbreaks: { date: string; cases: number }[],
  startDate?: string,
  endDate?: string,
): { date: string; cases: number }[] {
  if (outbreaks.length === 0) return [];

  // Group by date and sum cases
  const byDate = new Map<string, number>();
  for (const o of outbreaks) {
    const d = o.date.slice(0, 10); // YYYY-MM-DD
    byDate.set(d, (byDate.get(d) ?? 0) + (o.cases || 0));
  }

  // Fill the date range with 0s for missing days
  const dates = Array.from(byDate.keys()).sort();
  const start = startDate ?? dates[0];
  const end = endDate ?? dates[dates.length - 1];

  const result: { date: string; cases: number }[] = [];
  const cursor = new Date(start);
  const endD = new Date(end);
  while (cursor <= endD) {
    const iso = cursor.toISOString().slice(0, 10);
    result.push({ date: iso, cases: byDate.get(iso) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

/**
 * Calculate Rt using the Cori et al. 2013 method.
 *
 * The key insight: if we know the incidence history I(t) and the serial
 * interval distribution w(s), then the expected number of cases at time t
 * from past infections is:
 *
 *   Λ(t) = Σ I(t-s) * w(s)
 *
 * Rt is then estimated as I(t) / Λ(t) using a Poisson model with a
 * Gamma prior (posterior is Gamma, giving us CI).
 *
 * For simplicity we use a fixed serial interval (delta function at
 * `serialInterval` days) rather than a full distribution. This is less
 * precise than EpiEstim but computationally trivial and good enough
 * for the dashboard's "is it growing or fading?" question.
 */
export function calculateRt(
  dailyCases: { date: string; cases: number }[],
  params: RtParams,
): RtDataPoint[] {
  const { serialInterval, windowSize, smooth } = params;
  if (dailyCases.length < serialInterval + windowSize) return [];

  // Optional smoothing: 3-day rolling mean to handle weekend reporting dips
  let cases = dailyCases.map((d) => ({ ...d }));
  if (smooth) {
    cases = cases.map((d, i) => {
      const start = Math.max(0, i - 1);
      const end = Math.min(cases.length, i + 2);
      const window = cases.slice(start, end);
      const avg = Math.round(window.reduce((s, w) => s + w.cases, 0) / window.length);
      return { date: d.date, cases: avg };
    });
  }

  const result: RtDataPoint[] = [];

  for (let t = serialInterval + windowSize - 1; t < cases.length; t++) {
    // Sum cases in the window [t - windowSize + 1, t]
    let windowCases = 0;
    for (let i = t - windowSize + 1; i <= t; i++) {
      windowCases += cases[i].cases;
    }

    // Calculate Λ(t) — expected cases given past incidence
    // For fixed serial interval: Λ = sum of cases in window [t - SI - windowSize, t - SI]
    let lambda = 0;
    for (let i = t - serialInterval - windowSize + 1; i <= t - serialInterval; i++) {
      if (i >= 0 && i < cases.length) {
        lambda += cases[i].cases;
      }
    }

    // Rt estimate with Gamma posterior (Cori 2013, equation 4)
    // Posterior: Rt ~ Gamma(1 + windowCases, 1 / (1/epsilon + lambda))
    // where epsilon is the prior mean (default 1, weakly informative)
    const epsilon = 1;
    const alpha = 1 + windowCases;
    const beta = 1 / epsilon + lambda;

    if (lambda === 0) {
      // No past cases → can't estimate Rt, use prior mean
      result.push({
        date: cases[t].date,
        rt: 1,
        ciLower: 0.3,
        ciUpper: 3.0,
        cases: cases[t].cases,
      });
      continue;
    }

    const rt = alpha / beta;
    // 95% CI from Gamma quantiles (approximation using normal for speed)
    const variance = alpha / (beta * beta);
    const stdDev = Math.sqrt(variance);
    const ciLower = Math.max(0, rt - 1.96 * stdDev);
    const ciUpper = rt + 1.96 * stdDev;

    result.push({
      date: cases[t].date,
      rt: Math.round(rt * 100) / 100,
      ciLower: Math.round(ciLower * 100) / 100,
      ciUpper: Math.round(ciUpper * 100) / 100,
      cases: cases[t].cases,
    });
  }

  return result;
}

/**
 * Get a human-readable interpretation of Rt value.
 * Used in UI to show "эпидемия растёт" / "затухает" / "стабильна".
 */
export function interpretRt(rt: number): { label: string; color: string; emoji: string } {
  if (rt < 0.8) return { label: "Эпидемия затухает", color: "#16a34a", emoji: "📉" };
  if (rt < 1.0) return { label: "Стабильно снижается", color: "#65a30d", emoji: "⬇️" };
  if (rt < 1.2) return { label: "Стабильна", color: "#ca8a04", emoji: "➡️" };
  if (rt < 1.5) return { label: "Медленный рост", color: "#ea580c", emoji: "📈" };
  return { label: "Активный рост", color: "#dc2626", emoji: "🚨" };
}
