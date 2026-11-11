#!/usr/bin/env node
/**
 * tools/vectors.mjs — «Сезон векторов» (Task 238, идея №6): ретро-расчёт
 * сезонной модели активности взрослых Hyalomma marginatum (КГЛ) по
 * ERA5-архиву Open-Meteo (3 опорные станции: юг/центр/север Ростовской обл.)
 * → data/vectors.json для панели «Сезон векторов» на дашборде.
 *
 * Модель — mjs-дубликат src/lib/models/season.ts (паттерн tools/: как thi
 * дублируется в outlook.mjs). Якоря аудита 2026-11-12 (download/vet-meteo-vector-audit.md):
 *  - ECDC factsheet (Tier 1): активация взрослых при среднемесячной 10.5°C;
 *    квестинг при суточной 22–27°C (RH 75–100%); затишье при воздухе >30°C.
 *  - Carrera-Faja 2023 (Tier 2): взрослые на хозяевах март–ноябрь, пик апр–июн (кросс-чек).
 *  - КГЛ Ростовской обл. эндемичен: 750 случаев 1999–2020 (Volynkina 2022, PLOS ONE).
 *
 * Воркфлоу vectors.yml — workflow_dispatch (ручной запуск; schedule НЕ включён
 * до апреля 2027: дебаты Task 238 — «не кормить нули всю зиму»; строка cron
 * в файле воркфлоу закомментирована, включение — одной правкой в апреле).
 * Гейт: known-answer тесты scripts/test_models.ts (TS-модель) + числа
 * data/vectors.json пересчитываются этими же формулами (проверяемо руками).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const STATIONS = JSON.parse(readFileSync(join(ROOT, 'data', 'stations.json'), 'utf8'));

/* === якоря (дубликат src/lib/models/season.ts — HYALOMMA_ANCHORS) === */
const ACTIVATION_MONTHLY_MEAN = 10.5; // ECDC
const QUESTING_MIN = 22;             // ECDC
const QUESTING_MAX = 27;             // ECDC
const HEAT_HIDE = 30;                // ECDC: выше — клещи прячутся в почву

const MONTH_RU = ['', 'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTH_RU_SHORT = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const REF_IDS = ['taganrog', 'rostov', 'millerovo']; // юг → центр → север

async function fetchJson(url, ms = 30000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchJsonRetry(url, ms = 45000, tries = 3) {
  let err;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fetchJson(url, ms);
    } catch (e) {
      err = e;
      if (i < tries) await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw err;
}

/** ERA5-архив Open-Meteo: суточные tMax/tMin за 2026-01-01..end. Лаг ERA5 ~5 сут. */
async function fetchArchive(lat, lon, end) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: '2026-01-01',
    end_date: end,
    daily: 'temperature_2m_max,temperature_2m_min',
    timezone: 'UTC',
  });
  return fetchJsonRetry(`https://archive-api.open-meteo.com/v1/archive?${params}`);
}

/** Месячные средние Tmean (янв..дек; месяц без данных — null). Дубликат season.ts. */
function monthlyMeans(dates, tMaxs, tMins) {
  const sums = new Array(12).fill(0);
  const counts = new Array(12).fill(0);
  dates.forEach((d, i) => {
    const m = Number(d.slice(5, 7));
    if (m >= 1 && m <= 12 && tMaxs[i] != null && tMins[i] != null) {
      sums[m - 1] += (tMaxs[i] + tMins[i]) / 2;
      counts[m - 1]++;
    }
  });
  return sums.map((s, i) => (counts[i] ? +(s / counts[i]).toFixed(1) : null));
}

function questingClass(tMean) {
  if (tMean > HEAT_HIDE) return 'heat';
  if (tMean >= QUESTING_MIN && tMean <= QUESTING_MAX) return 'peak';
  if (tMean >= ACTIVATION_MONTHLY_MEAN) return 'active';
  return 'off';
}

function questingStats(dates, tMaxs, tMins, fromMonth, toMonth) {
  const s = { peak: 0, active: 0, heat: 0, off: 0 };
  dates.forEach((d, i) => {
    const m = Number(d.slice(5, 7));
    if (m >= fromMonth && m <= toMonth && tMaxs[i] != null && tMins[i] != null) {
      s[questingClass((tMaxs[i] + tMins[i]) / 2)]++;
    }
  });
  return s;
}

const pad = (n) => String(n).padStart(2, '0');
const isoToday = () => {
  const d = new Date(Date.now() + 3 * 3600e3); // МСК
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

const today = isoToday();
// ERA5 отстаёт ~5 суток: пробуем сегодня, при отказе откатываем окно на 7/14/21 дней
const endCandidates = [today,
  new Date(Date.parse(today) - 7 * 864e5).toISOString().slice(0, 10),
  new Date(Date.parse(today) - 14 * 864e5).toISOString().slice(0, 10),
  new Date(Date.parse(today) - 21 * 864e5).toISOString().slice(0, 10)];

const out = {
  generatedAt: new Date().toISOString(),
  model: 'hyalomma-season v1 (Task 238 «Сезон векторов»)',
  anchors: {
    activationMonthlyMean: ACTIVATION_MONTHLY_MEAN,
    questingMin: QUESTING_MIN,
    questingMax: QUESTING_MAX,
    heatHide: HEAT_HIDE,
    sources: [
      'ECDC, Factsheet for experts «Hyalomma marginatum» (Tier 1): активация взрослых при среднемесячной 10.5°C; квестинг при суточной 22–27°C; затишье при воздухе >30°C — https://www.ecdc.europa.eu/en/disease-vectors/facts/tick-factsheets/hyalomma-marginatum',
      'Carrera-Faja et al. 2023 (Tier 2): взрослые на хозяевах март–ноябрь, пик апрель–июнь — https://www.sciencedirect.com/science/article/pii/S2352771423001428',
      'Volynkina et al. 2022 (Tier 2, PLOS ONE): КГЛ Ростовской обл. эндемичен, 750 случаев 1999–2020',
    ],
  },
  disclaimer: 'Прототип климатического прокси, не оперативная система: данных ловушек нет, пороги — из европейских первоисточников (ECDC Tier 1). Решения об обработках/вакцинации/мерах — за ветслужбой.',
  dataEnd: null,
  stations: [],
};

const stations = STATIONS.stations.filter((s) => REF_IDS.includes(s.id));
if (stations.length !== REF_IDS.length) {
  console.error('Ожидались станции', REF_IDS, '— найдено', stations.map((s) => s.id));
  process.exit(1);
}

for (const st of stations) {
  let data = null;
  let endUsed = null;
  for (const end of endCandidates) {
    try {
      data = await fetchArchive(st.lat, st.lon, end);
      endUsed = end;
      break;
    } catch (e) {
      console.error(`архив ${st.id}: окно до ${end} не взяло (${e.message}), откатываем`);
    }
  }
  if (!data || !data.daily || !data.daily.time) {
    console.error(`архив ${st.id}: нет данных — пропускаем станцию (vectors.json не пишем, панель покажет фолбэк)`);
    process.exit(1);
  }
  const { time: dates, temperature_2m_max: tMaxs, temperature_2m_min: tMins } = data.daily;
  const mm = monthlyMeans(dates, tMaxs, tMins);
  const active = [];
  for (let m = 1; m <= 12; m++) if (mm[m - 1] != null && mm[m - 1] >= ACTIVATION_MONTHLY_MEAN) active.push(m);
  const openMonth = active.length ? Math.min(...active) : null;
  const closeMonth = active.length ? Math.max(...active) : null;
  const q = openMonth ? questingStats(dates, tMaxs, tMins, openMonth, closeMonth) : { peak: 0, active: 0, heat: 0, off: 0 };
  // текущий месяц (частичный): среднее по дням этого месяца
  const curM = Number(endUsed.slice(5, 7));
  const curMean = mm[curM - 1];
  out.dataEnd = endUsed;
  out.stations.push({
    id: st.id,
    name: st.name,
    lat: st.lat,
    lon: st.lon,
    monthsAnalyzed: dates.length,
    monthlyMeans: mm,
    season: {
      openMonth,
      closeMonth,
      openRu: openMonth ? MONTH_RU_SHORT[openMonth] : null,
      closeRu: closeMonth ? MONTH_RU_SHORT[closeMonth] : null,
      // фенологический коридор (кросс-чек Carrera-Faja): модельное окно уже фенологии
      phenologyRu: 'мар–ноя (пик апр–июн, Carrera-Faja 2023)',
      label: openMonth
        ? `сезон ${MONTH_RU_SHORT[openMonth]}–${MONTH_RU_SHORT[closeMonth]}`
        : 'сезон не открывался (ни одного месяца ≥10.5°C)',
    },
    questing: q,
    current: {
      month: curM,
      monthRu: MONTH_RU[curM],
      monthMean: curMean,
      openNow: curMean != null && curMean >= ACTIVATION_MONTHLY_MEAN,
    },
  });
}

/* — регион: окно по самому раннему открытию / самому позднему закрытию — */
const opens = out.stations.map((s) => s.season.openMonth).filter((v) => v != null);
const closes = out.stations.map((s) => s.season.closeMonth).filter((v) => v != null);
out.region = {
  openMonth: opens.length ? Math.min(...opens) : null,
  closeMonth: closes.length ? Math.max(...closes) : null,
  note: `${out.stations.map((s) => `${s.name}: ${s.season.label}`).join('; ')} — юг открывается раньше севера`,
};

/* — ожидаемые даты 2027: ретро-2026 как климатологическая оценка; пометка «проверить» — */
out.outlook2027 = {
  expectedOpen: out.region.openMonth ? `${MONTH_RU[out.region.openMonth]} (ретро-2026: ${MONTH_RU_SHORT[out.region.openMonth]})` : '—',
  expectedClose: out.region.closeMonth ? `${MONTH_RU[out.region.closeMonth]} (ретро-2026: ${MONTH_RU_SHORT[out.region.closeMonth]})` : '—',
  mark: 'проверить: климатологическая оценка с ретро-2026 + литература (Carrera-Faja 2023: март–ноябрь); не модельный прогноз',
};

const OUT_PATH = join(ROOT, 'data', 'vectors.json');
writeFileSync(OUT_PATH, JSON.stringify(out) + '\n');
const kb = (readFileSync(OUT_PATH).length / 1024).toFixed(1);
console.log(`vectors.json: ${out.stations.length} станции · окно 2026-01-01..${out.dataEnd} · ${kb} КБ`);
for (const s of out.stations) {
  console.log(`${s.name}: сезон ${s.season.openRu}–${s.season.closeRu}, дней пика квестинга ${s.questing.peak}, сейчас ${s.current.monthRu} mean=${s.current.monthMean}`);
}
console.log(`регион: открыт ${MONTH_RU_SHORT[out.region.openMonth]}, закрыт ${MONTH_RU_SHORT[out.region.closeMonth]}`);
