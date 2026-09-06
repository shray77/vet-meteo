/**
 * Пайплайн оценки: погода → топо-поправки → модели → триггер-лента.
 */
import type { PointAssessment, TriggerItem } from './types';
export type { PointAssessment };
import { FIELD_POINTS, CCHF_DISTRICTS } from './geo/rostov';
import { topoInfoAt, topoAdjust } from './topo/topo';
import { thi, thiClass, milkLoss } from './models/thi';
import { brdScore } from './models/brd';
import { ticksOutlook, cchfRisk, fasciolaIndex } from './models/parasites';
import { loadPointWeather } from './field-data';

const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function dayLabel(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return `${DAY_LABELS[d.getDay()]} ${date.slice(8, 10)}.${date.slice(5, 7)}`;
}

function nearestDistrict(lat: number, lon: number): { name: string; dist: number } | null {
  let best: { name: string; dist: number } | null = null;
  for (const d of CCHF_DISTRICTS) {
    const dist = Math.hypot(d.lat - lat, d.lon - lon) * 111;
    if (!best || dist < best.dist) best = { name: d.name, dist };
  }
  return best;
}

export async function assessPoint(fp: (typeof FIELD_POINTS)[number]): Promise<PointAssessment> {
  const weather = await loadPointWeather(fp.id, fp.lat, fp.lon);
  const topo = topoInfoAt(fp.lat, fp.lon);

  // ночные часы (22–05) для топо-поправок, применяем к hourly
  const hourly = weather.hourly.map((h) => {
    const hh = Number(h.time.slice(0, 2));
    const adj = topoAdjust(h.temp, h.rh, h.wind, fp.lat, fp.lon, fp.alt, hh >= 22 || hh <= 5);
    return { ...h, ...adj, thi: +thi(adj.temp, adj.rh).toFixed(1) };
  });

  // дни: topo-поправка на суточные величины (ночной минимум с холодным застоем)
  const dailyAdj = weather.daily.map((d) => {
    const night = topoAdjust(d.tMin, Math.min(98, d.rhMean + 10), d.windMean, fp.lat, fp.lon, fp.alt, true);
    return {
      ...d,
      tMin: night.temp,
      rhMean: Math.round((d.rhMean + night.rh) / 2),
      thiMax: +thi(d.tMax, Math.max(30, d.rhMean - 12)).toFixed(1),
      thiMin: +thi(night.temp, night.rh).toFixed(1),
    };
  });

  const district = nearestDistrict(fp.lat, fp.lon);
  const endemic = district != null && district.dist < 55;

  const triggers: TriggerItem[] = [];
  const outlook = dailyAdj.slice(0, 8).map((d, i) => {
    const prev = dailyAdj[i - 1] ?? d;
    const tMean = (d.tMax + d.tMin) / 2;
    const brd = brdScore({
      tMax: d.tMax, tMin: d.tMin, rhMean: d.rhMean, precip: d.precipSum,
      windMean: d.windMean, coldPool: topo.coldPool, windExposure: topo.windExposure,
      tempDrop: (d.tMax + d.tMin) / 2 - (prev.tMax + prev.tMin) / 2,
    });
    const ticks = ticksOutlook(dailyAdj.slice(Math.max(0, i - 6), i + 1));
    const cchf = cchfRisk({ endemic, daily: dailyAdj.slice(Math.max(0, i - 6), i + 1), rhMean: d.rhMean, tMean });
    const fasc = fasciolaIndex({ daily: dailyAdj.slice(Math.max(0, i - 6), i + 1), lat: fp.lat });
    const cls = thiClass(d.thiMax);
    const loss = milkLoss(d.thiMax);

    const dayTriggers: string[] = [];
    if (cls.key === 'severe' || cls.key === 'extreme') {
      dayTriggers.push(`THI ${d.thiMax.toFixed(0)} (${cls.label}) — потери удоя ~${loss} кг/сут`);
    }
    if (brd.level === 'high') dayTriggers.push(`BRD ${brd.score}/100: ${brd.drivers.join(', ')}`);
    if (ticks.hyalomma > 70 && (endemic || ticks.hyalomma > 85)) dayTriggers.push(`Клещи ${ticks.label} (GDD₁₀ ${ticks.gdd})`);
    if (cchf.risk > 60) dayTriggers.push(cchf.label);
    if (fasc.level === 'high') dayTriggers.push(fasc.label);

    const date = dayLabel(d.date);
    for (const text of dayTriggers) {
      triggers.push({
        id: `${fp.id}:${d.date}:${text.slice(0, 24)}`,
        date, severity: text.startsWith('THI') && (cls.key === 'extreme') || brd.level === 'high' ? 'danger' : 'warn',
        pointId: fp.id, pointName: fp.name, text,
      });
    }

    return {
      date: d.date, label: date,
      thiMax: d.thiMax, thiMin: d.thiMin, thiClass: cls,
      brd, ticks, fasciola: fasc, cchf,
      triggers: dayTriggers,
    };
  });

  // инфо-триггер текущего дня с рельефом, если нет ничего горячего
  if (triggers.length === 0 && outlook[0]) {
    triggers.push({
      id: `${fp.id}:calm`,
      date: outlook[0].label, severity: 'info',
      pointId: fp.id, pointName: fp.name,
      text: `Спокойный режим: THI ${outlook[0].thiMax.toFixed(0)}, ${outlook[0].brd.label}`,
    });
  }

  return { point: fp, topo, source: weather.source, hourly, outlook, triggers };
}

export async function assessAll(): Promise<Record<string, PointAssessment>> {
  const results = await Promise.all(FIELD_POINTS.map(assessPoint));
  const map: Record<string, PointAssessment> = {};
  for (const r of results) map[r.point.id] = r;
  return map;
}

/** Все триггеры по всем точкам, отсортированные по дате/серьёзности. */
export function allTriggers(assessments: Record<string, PointAssessment>): TriggerItem[] {
  const out: TriggerItem[] = [];
  for (const a of Object.values(assessments)) out.push(...a.triggers);
  const order = { danger: 0, warn: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
