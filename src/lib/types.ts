/** Общие типы ВЕТРАДАР-61. */

export interface MetarObs {
  icao: string;
  name: string;
  lat: number | null;
  lon: number | null;
  raw: string;
  time: string;
  temp: number | null;
  dewp: number | null;
  rh: number | null;
  wdir: number | null;
  wspd: number | null;
  altim: number | null;
}

export interface MqttPoint {
  ip: string;
  port: number;
  lat: number;
  lon: number;
  org: string;
  provider: string;
  label: string;
  banner: string;
  weatherLike: boolean;
}

export interface HourlyPoint {
  time: string;
  temp: number;
  rh: number;
  wind: number;
  precip: number;
  thi: number;
}

export interface DailyPoint {
  date: string;
  tMax: number;
  tMin: number;
  rhMean: number;
  windMean: number;
  precipSum: number;
  thiMax: number;
  thiMin: number;
}

export interface OutlookDay {
  date: string;
  label: string;
  thiMax: number;
  thiMin: number;
  thiClass: ThiClass;
  brd: BrdResult;
  ticks: TickResult;
  fasciola: FasciolaResult;
  cchf: CchfResult;
  triggers: string[];
}

export interface ThiClass {
  key: 'ok' | 'mild' | 'moderate' | 'severe' | 'extreme';
  label: string;
  color: string;
}

export interface BrdResult {
  score: number;
  level: 'low' | 'moderate' | 'high';
  label: string;
  drivers: string[];
}

export interface TickResult {
  gdd: number;
  hyalomma: number;
  dermacentor: number;
  label: string;
}

export interface FasciolaResult {
  moisture: number;
  level: 'low' | 'medium' | 'high';
  label: string;
}

export interface CchfResult {
  risk: number;
  label: string;
}

export interface TriggerItem {
  id: string;
  date: string;
  severity: 'info' | 'warn' | 'danger';
  pointId: string;
  pointName: string;
  text: string;
}

export interface PointAssessment {
  point: FieldPoint;
  topo: TopoInfo;
  source: 'openmeteo' | 'proxy' | 'synthetic';
  hourly: HourlyPoint[];
  outlook: OutlookDay[];
  triggers: TriggerItem[];
}

export interface FieldPoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  alt: number;
  animals: string;
}

export interface TopoInfo {
  slope: number;
  aspectDeg: number;
  aspectLabel: string;
  coldPool: number;
  windExposure: number;
  note: string;
}

export type WeatherSource = 'openmeteo' | 'proxy' | 'synthetic';
