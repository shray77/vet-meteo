/**
 * Transport graph — упрощённый граф транспортных связей между регионами РФ.
 *
 * Основан на федеральных трассах и железнодорожных узлах.
 * Используется для оценки риска распространения болезней
 * вдоль транспортных маршрутов (скотовозы, птицевозный транспорт).
 *
 * Каждый узел — регион (сопоставление по region_geo из REGIONS).
 * Каждое ребро — наличие прямой федеральной трассы между регионами.
 */

export interface TransportEdge {
  from: string; // region_geo name
  to: string;
  highway?: string; // название трассы
  distance_km: number; // примерное расстояние
  risk_weight: number; // 1.0 = высокая нагрузка, 0.5 = средняя
}

// Упрощённый граф основных федеральных трасс РФ
export const TRANSPORT_EDGES: TransportEdge[] = [
  // М-4 «Дон» (Москва — Ростов — Краснодар)
  { from: "Moscow", to: "Tula", highway: "M-4", distance_km: 190, risk_weight: 1.0 },
  { from: "Tula", to: "Lipetsk", highway: "M-4", distance_km: 240, risk_weight: 1.0 },
  { from: "Lipetsk", to: "Voronezh", highway: "M-4", distance_km: 130, risk_weight: 1.0 },
  { from: "Voronezh", to: "Rostov", highway: "M-4", distance_km: 560, risk_weight: 1.0 },
  { from: "Rostov", to: "Krasnodar", highway: "M-4", distance_km: 270, risk_weight: 1.0 },
  { from: "Krasnodar", to: "Adygey", highway: "M-4", distance_km: 80, risk_weight: 0.8 },

  // М-7 «Волга» (Москва — Нижний — Казань — Уфа)
  { from: "Moscow", to: "Vladimir", highway: "M-7", distance_km: 180, risk_weight: 0.9 },
  { from: "Vladimir", to: "Nizhegorod", highway: "M-7", distance_km: 230, risk_weight: 0.9 },
  { from: "Nizhegorod", to: "Tatarstan", highway: "M-7", distance_km: 380, risk_weight: 1.0 },
  { from: "Tatarstan", to: "Bashkortostan", highway: "M-7", distance_km: 520, risk_weight: 0.7 },

  // М-10 «Россия» (Москва — Тверь — Новгород — СПб)
  { from: "Moscow", to: "Tver", highway: "M-10", distance_km: 170, risk_weight: 1.0 },
  { from: "Tver", to: "Novgorod", highway: "M-10", distance_km: 400, risk_weight: 0.7 },
  { from: "Novgorod", to: "StPetersburg", highway: "M-10", distance_km: 200, risk_weight: 1.0 },

  // М-5 «Урал» (Москва — Рязань — Пенза — Самара — Уфа — Челябинск)
  { from: "Moscow", to: "Ryazan", highway: "M-5", distance_km: 200, risk_weight: 0.9 },
  { from: "Ryazan", to: "Penza", highway: "M-5", distance_km: 320, risk_weight: 0.7 },
  { from: "Penza", to: "Samara", highway: "M-5", distance_km: 340, risk_weight: 0.8 },
  { from: "Samara", to: "Bashkortostan", highway: "M-5", distance_km: 460, risk_weight: 0.8 },
  { from: "Bashkortostan", to: "Chelyabinsk", highway: "M-5", distance_km: 400, risk_weight: 0.7 },

  // Р-22 «Каспий» (Москва — Тамбов — Волгоград — Астрахань)
  { from: "Moscow", to: "Tambov", highway: "R-22", distance_km: 420, risk_weight: 0.6 },
  { from: "Tambov", to: "Volgograd", highway: "R-22", distance_km: 400, risk_weight: 0.7 },
  { from: "Volgograd", to: "Astrakhan", highway: "R-22", distance_km: 350, risk_weight: 0.6 },

  // М-6 «Каспий» (подключение Кавказа)
  { from: "Volgograd", to: "Rostov", highway: "M-6", distance_km: 480, risk_weight: 0.7 },
  { from: "Rostov", to: "Kalmyk", highway: "M-6", distance_km: 200, risk_weight: 0.4 },
  { from: "Krasnodar", to: "Stavropol", highway: "R-217", distance_km: 260, risk_weight: 0.7 },
  { from: "Stavropol", to: "Dagestan", highway: "R-217", distance_km: 320, risk_weight: 0.6 },
  { from: "Stavropol", to: "Chechnya", highway: "R-217", distance_km: 250, risk_weight: 0.5 },
  { from: "Chechnya", to: "Dagestan", highway: "R-217", distance_km: 120, risk_weight: 0.5 },

  // Сибирь
  { from: "Chelyabinsk", to: "Kurgan", highway: "M-51", distance_km: 260, risk_weight: 0.5 },
  { from: "Kurgan", to: "Omsk", highway: "M-51", distance_km: 320, risk_weight: 0.5 },
  { from: "Omsk", to: "Novosibirsk", highway: "M-51", distance_km: 670, risk_weight: 0.6 },
  { from: "Novosibirsk", to: "Kemerovo", highway: "M-53", distance_km: 270, risk_weight: 0.4 },

  // Северо-Запад
  { from: "StPetersburg", to: "Pskov", highway: "R-23", distance_km: 280, risk_weight: 0.4 },
  { from: "StPetersburg", to: "Karelia", highway: "R-21", distance_km: 400, risk_weight: 0.3 },

  // Центральная Россия
  { from: "Moscow", to: "Smolensk", highway: "M-1", distance_km: 380, risk_weight: 0.6 },
  { from: "Moscow", to: "Kalinigrad", highway: "M-1", distance_km: 1100, risk_weight: 0.3 },
  { from: "Moscow", to: "Yaroslavl", highway: "M-8", distance_km: 280, risk_weight: 0.5 },
  { from: "Yaroslavl", to: "Vologda", highway: "M-8", distance_km: 200, risk_weight: 0.4 },
  { from: "Moscow", to: "Bryansk", highway: "M-3", distance_km: 380, risk_weight: 0.5 },
  { from: "Bryansk", to: "Belgorod", highway: "M-3", distance_km: 220, risk_weight: 0.4 },
  { from: "Belgorod", to: "Voronezh", highway: "R-298", distance_km: 250, risk_weight: 0.4 },

  // Поволжье
  { from: "Samara", to: "Saratov", highway: "R-228", distance_km: 320, risk_weight: 0.4 },
  { from: "Saratov", to: "Volgograd", highway: "R-228", distance_km: 360, risk_weight: 0.4 },
  { from: "Nizhegorod", to: "Kirov", highway: "R-176", distance_km: 380, risk_weight: 0.3 },
  { from: "Kirov", to: "Perm", highway: "R-243", distance_km: 400, risk_weight: 0.3 },
  { from: "Perm", to: "Sverdlovsk", highway: "R-242", distance_km: 280, risk_weight: 0.4 },
  { from: "Sverdlovsk", to: "Chelyabinsk", highway: "M-5", distance_km: 250, risk_weight: 0.6 },
];

export interface RiskNode {
  region: string;
  distance: number; // суммарное расстояние от очага (км)
  path: string[]; // маршрут (регионы)
  highway: string; // последняя трасса
  riskWeight: number; // суммарный вес риска (0..1)
  hops: number; // кол-во пересадок
  travelHours: number; // время в пути скотовоза (часы)
  arrivalDate: string | null; // расчётная дата прибытия (ISO)
}

/**
 * Средняя скорость скотовоза в России (км/ч).
 * Источник: ФДА-1.1, практические данные транспортных компаний.
 * Учитывает проверки на постах, заправки, отдых животных.
 */
const LIVESTOCK_TRUCK_SPEED_KMH = 55;

/**
 * Дневной лимит движения скотовоза (часы).
 * По правилам перевозки животных — не более 8 часов в сутки.
 */
const DAILY_DRIVING_LIMIT_H = 8;

/**
 * Находит все регионы в радиусе N хопов от указанного региона
 * по транспортному графу. Возвращает отсортированный по риску список.
 *
 * Для каждого узла считает:
 *   - travelHours = distance / 55 км/ч (средняя скорость скотовоза)
 *   - arrivalDate = сегодня + ceil(travelHours / 8) дней (дневной лимит 8ч)
 *   - riskWeight = произведение весов нагрузки трасс
 */
export function findConnectedRegions(
  startRegion: string,
  maxHops: number = 2,
): RiskNode[] {
  const adj = new Map<string, TransportEdge[]>();
  for (const e of TRANSPORT_EDGES) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push(e);
    adj.get(e.to)!.push({ ...e, from: e.to, to: e.from });
  }

  const visited = new Set<string>([startRegion]);
  const now = new Date();
  const queue: RiskNode[] = [
    {
      region: startRegion,
      distance: 0,
      path: [startRegion],
      highway: "",
      riskWeight: 1.0,
      hops: 0,
      travelHours: 0,
      arrivalDate: now.toISOString().split("T")[0],
    },
  ];
  const results: RiskNode[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.hops >= maxHops) continue;

    const edges = adj.get(node.region) || [];
    for (const e of edges) {
      if (visited.has(e.to)) continue;
      visited.add(e.to);

      const segmentDistance = node.distance + e.distance_km;
      const segmentHours = segmentDistance / LIVESTOCK_TRUCK_SPEED_KMH;

      // Arrival date: account for daily driving limit (8h/day → 1 day per 440 km)
      const drivingDays = Math.ceil(segmentHours / DAILY_DRIVING_LIMIT_H);
      const arrival = new Date(now);
      arrival.setDate(arrival.getDate() + drivingDays);

      const next: RiskNode = {
        region: e.to,
        distance: segmentDistance,
        path: [...node.path, e.to],
        highway: e.highway || node.highway,
        riskWeight: node.riskWeight * e.risk_weight,
        hops: node.hops + 1,
        travelHours: Math.round(segmentHours * 10) / 10,
        arrivalDate: arrival.toISOString().split("T")[0],
      };
      results.push(next);
      queue.push(next);
    }
  }

  return results.sort((a, b) => b.riskWeight - a.riskWeight);
}
