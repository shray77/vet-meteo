/**
 * Гео-слой Ростовской области.
 * Рельеф — РЕАЛЬНЫЙ DEM (SRTM, сетка 0.05°, src/lib/geo/dem.json), см. scripts/build_dem.py.
 * Точки мониторинга и города — реальные координаты и высоты.
 * Реки и леса — схематичные приближения (прод-замена: OSM waterways).
 * ВетИС — прод-замена для очагов (демо-очаги помечены в UI).
 */

import demData from './dem.json';

export const RO_BBOX = { minLat: 46.6, maxLat: 49.5, minLon: 37.5, maxLon: 43.8 };

export interface RiverLine {
  name: string;
  major: boolean;
  width: number;
  coords: [number, number][];
}

export interface ForestPatch {
  name: string;
  coords: [number, number][];
}

export interface AsfOutbreak {
  name: string;
  lat: number;
  lon: number;
  date: string;
  pigs: number;
}

export interface CchfDistrict {
  name: string;
  lat: number;
  lon: number;
}

interface FieldPointRo {
  id: string;
  name: string;
  lat: number;
  lon: number;
  alt: number;
  animals: string;
}

/** 16 точек мониторинга (животноводческая нагрузка — описание условное; высоты из SRTM). */
export const FIELD_POINTS: FieldPointRo[] = [
  { id: 'rostov', name: 'Ростов-на-Дону', lat: 47.23, lon: 39.72, alt: 68, animals: 'КРС, МРС, птица' },
  { id: 'taganrog', name: 'Таганрог', lat: 47.21, lon: 38.93, alt: 41, animals: 'МРС, птица' },
  { id: 'shakhty', name: 'Шахты', lat: 47.71, lon: 40.21, alt: 117, animals: 'КРС, МРС' },
  { id: 'volgodonsk', name: 'Волгодонск', lat: 47.51, lon: 42.15, alt: 48, animals: 'КРС, свиньи' },
  { id: 'novocherkassk', name: 'Новочеркасск', lat: 47.42, lon: 40.09, alt: 88, animals: 'КРС, МРС' },
  { id: 'bataysk', name: 'Батайск', lat: 47.14, lon: 39.75, alt: 11, animals: 'птица, КРС' },
  { id: 'azov', name: 'Азов', lat: 47.11, lon: 39.42, alt: 39, animals: 'КРС, МРС' },
  { id: 'salsk', name: 'Сальск', lat: 46.48, lon: 41.54, alt: 30, animals: 'КРС, МРС' },
  { id: 'millerovo', name: 'Миллерово', lat: 48.92, lon: 40.4, alt: 131, animals: 'КРС, МРС' },
  { id: 'morozovsk', name: 'Морозовск', lat: 48.35, lon: 41.83, alt: 78, animals: 'КРС' },
  { id: 'belaya_kalitva', name: 'Белая Калитва', lat: 48.17, lon: 40.8, alt: 56, animals: 'КРС, МРС' },
  { id: 'zernograd', name: 'Зерноград', lat: 46.85, lon: 40.3, alt: 84, animals: 'КРС, птица' },
  { id: 'semikarakorsk', name: 'Семикаракорск', lat: 47.52, lon: 40.83, alt: 13, animals: 'КРС, МРС' },
  { id: 'konstantinovsk', name: 'Константиновск', lat: 47.63, lon: 41.09, alt: 85, animals: 'КРС' },
  { id: 'vyoshenskaya', name: 'Вёшенская', lat: 49.62, lon: 41.72, alt: 64, animals: 'КРС, МРС' },
  { id: 'ust_donetsk', name: 'Усть-Донецкий', lat: 47.85, lon: 40.9, alt: 97, animals: 'КРС, МРС' },
];

/** 7 схематичных рек. Прод-замена: OSM waterways. */
export const RIVERS: RiverLine[] = [
  {
    name: 'Дон',
    major: true,
    width: 4,
    coords: [
      [49.55, 41.7], [48.9, 41.2], [48.35, 41.9], [47.85, 40.95], [47.63, 41.1],
      [47.42, 40.55], [47.52, 40.83], [47.35, 40.1], [47.23, 39.72], [47.11, 39.42], [47.21, 38.93],
    ],
  },
  {
    name: 'Северский Донец',
    major: true,
    width: 3,
    coords: [
      [49.9, 40.0], [49.4, 40.4], [48.92, 40.4], [48.6, 40.3], [48.35, 40.4], [48.0, 40.55], [47.63, 41.09],
    ],
  },
  {
    name: 'Западный Маныч',
    major: false,
    width: 3,
    coords: [
      [46.85, 40.3], [46.8, 41.0], [46.75, 41.8], [46.7, 42.3], [46.65, 42.9], [46.62, 43.3],
    ],
  },
  {
    name: 'Восточный Маныч',
    major: false,
    width: 2,
    coords: [[46.6, 42.4], [46.55, 42.8], [46.5, 43.4], [46.45, 43.7]],
  },
  {
    name: 'Сал',
    major: false,
    width: 2,
    coords: [[47.0, 43.2], [46.9, 42.6], [46.8, 42.0], [46.65, 41.6], [46.48, 41.54]],
  },
  {
    name: 'Егорлык',
    major: false,
    width: 2,
    coords: [[46.3, 41.4], [46.5, 41.0], [46.7, 40.8], [46.85, 40.3]],
  },
  {
    name: 'Миус',
    major: false,
    width: 2,
    coords: [[48.05, 39.05], [47.8, 39.0], [47.5, 38.9], [47.21, 38.93]],
  },
];

/** Схематичные лесные массивы. */
export const FORESTS: ForestPatch[] = [
  {
    name: 'Левобережные леса Дона (схематично)',
    coords: [
      [47.9, 41.0], [47.8, 41.3], [47.6, 41.4], [47.4, 41.2], [47.35, 40.9], [47.5, 40.7], [47.75, 40.8],
    ],
  },
  {
    name: 'Арчединско-Донские пески (схематично)',
    coords: [
      [48.6, 42.3], [48.5, 42.6], [48.3, 42.5], [48.2, 42.2], [48.4, 42.0], [48.55, 42.05],
    ],
  },
  {
    name: 'Леса Шолоховского р-на (схематично)',
    coords: [
      [49.5, 41.5], [49.4, 41.9], [49.2, 41.8], [49.15, 41.4], [49.35, 41.3],
    ],
  },
  {
    name: 'Донская гряда, дубравы (схематично)',
    coords: [
      [48.6, 40.2], [48.5, 40.5], [48.3, 40.45], [48.2, 40.2], [48.35, 40.0], [48.5, 40.0],
    ],
  },
];

/* ===== Реальный DEM (SRTM 0.05°) ===== */

interface DemGrid {
  bbox: [number, number, number, number]; // minLat, minLon, maxLat, maxLon
  step: number;
  rows: number;
  cols: number;
  z: number[][];
}

const DEM = demData as unknown as DemGrid;

/**
 * Высота (м) из реального SRTM-DEM: билинейная интерполяция сетки 0.05°.
 * Вне бокса — краевое значение. Источник: AWS Terrain (terrarium z8),
 * сборка scripts/build_dem.py → src/lib/geo/dem.json.
 */
export function demElevation(lat: number, lon: number): number {
  const [minLat, minLon, maxLat, maxLon] = DEM.bbox;
  const { step, rows, cols, z } = DEM;
  const c = Math.min(cols - 1, Math.max(0, (lon - minLon) / step));
  const r = Math.min(rows - 1, Math.max(0, (maxLat - lat) / step));
  const i = Math.min(rows - 2, Math.floor(r));
  const j = Math.min(cols - 2, Math.floor(c));
  const fy = r - i;
  const fx = c - j;
  const v =
    z[i][j] * (1 - fy) * (1 - fx) +
    z[i + 1][j] * fy * (1 - fx) +
    z[i][j + 1] * (1 - fy) * fx +
    z[i + 1][j + 1] * fy * fx;
  return Math.round(v);
}

/** ДЕМО-очаги АЧС (вымышленные, помечены в UI). */
export const ASF_DEMO_OUTBREAKS: AsfOutbreak[] = [
  { name: 'Волгодонск (демо-очаг)', lat: 47.51, lon: 42.15, date: '2026-08-28', pigs: 340 },
  { name: 'Миллерово (демо-очаг)', lat: 48.92, lon: 40.4, date: '2026-09-01', pigs: 210 },
  { name: 'Орловский р-н (демо-очаг)', lat: 46.9, lon: 41.5, date: '2026-09-03', pigs: 90 },
  { name: 'Кашарский р-н (демо-очаг)', lat: 48.4, lon: 41.6, date: '2026-08-20', pigs: 150 },
];

/** 10 районов, эндемичных по КГЛ (по данным прежних сезонов). */
export const CCHF_DISTRICTS: CchfDistrict[] = [
  { name: 'Верхнедонской', lat: 49.75, lon: 41.1 },
  { name: 'Шолоховский', lat: 49.6, lon: 41.7 },
  { name: 'Миллеровский', lat: 48.92, lon: 40.4 },
  { name: 'Чертковский', lat: 49.35, lon: 40.15 },
  { name: 'Тарасовский', lat: 48.65, lon: 40.35 },
  { name: 'Кашарский', lat: 48.4, lon: 41.6 },
  { name: 'Боковский', lat: 48.95, lon: 41.75 },
  { name: 'Советский', lat: 49.0, lon: 41.0 },
  { name: 'Каменский', lat: 48.35, lon: 40.5 },
  { name: 'Тацинский', lat: 48.4, lon: 41.7 },
];
