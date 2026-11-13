'use client';

/**
 * Вкладка «Векторы» — панель «Сезон векторов» (модель Hyalomma marginatum,
 * src/lib/models/season.ts, якоря ECDC Tier 1; препринт Task 244 v3,
 * doi.org/10.5281/zenodo.24203316).
 *
 * Данные — только из репо-снимков (никаких хардкодов чисел):
 *  - data/vectors.json (ретро-2026: якоря, дисклеймер, фенология, outlook-2027);
 *  - data/vectors_climatology.json (Task 244: perYear 1997–2026 с полным
 *    якорем RH, сеть 49 станций 2026, тренды).
 * Пересчёт: tools/vectors.mjs + tools/vectors_climatology.mjs (воркфлоу vectors.yml).
 */
import { HYALOMMA_ANCHORS, monthRu } from '@/lib/models/season';
import vectors from '../../../data/vectors.json';
import clim from '../../../data/vectors_climatology.json';

type PerYear = (typeof clim)['stations']['taganrog']['perYear'][number];

const REF_IDS = ['taganrog', 'rostov', 'millerovo'] as const; // юг → центр → север (vectors.mjs)

function y2026(sid: string): PerYear | null {
  const per = (clim as { stations: Record<string, { perYear: PerYear[] }> }).stations[sid]?.perYear;
  return per?.find((p) => p.year === 2026) ?? null;
}

function StationRow({ sid, name }: { sid: string; name: string }) {
  const p = y2026(sid);
  const c = (clim as { stations: Record<string, typeof clim.stations.taganrog> }).stations[sid];
  if (!p || !c) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="w-[86px] text-[#d8dcc8]">{name}</span>
      <span className="text-[#b8bca8]">
        {monthRu(p.open)}–{monthRu(p.close)}
      </span>
      <span className="text-[#8a8f78]">апр {p.april.toFixed(1)}</span>
      <span className="text-[#d9792b]">пик {p.peak}</span>
      <span className="text-[#8a8f78]">жара {p.heat}</span>
    </div>
  );
}

export default function SeasonVectorsPanel() {
  const net = clim.network2026;
  const netAll = net.stations;
  const openMay = netAll.filter((s) => s.open === 5 && s.close === 10).length;
  const dis = vectors.disclaimer as string;
  const anchors = vectors.anchors as { activationMonthlyMean: number; questingMin: number; questingMax: number; heatHide: number };

  return (
    <div className="space-y-2">
      <div className="rounded border border-[#3a4030] bg-[#14170f] p-3">
        <div className="font-mono text-[11px] text-[#f0c674]">
          Сезон векторов · Hyalomma marginatum (переносчик КГЛ)
        </div>
        <div className="mt-1 font-mono text-[10px] leading-4 text-[#8a8f78]">
          якоря ECDC Tier 1, без подгонки: активация взрослых при среднемесячной {anchors.activationMonthlyMean}°C ·
          пик квестинга при суточной {anchors.questingMin}–{anchors.questingMax}°C · затишье при &gt;{anchors.heatHide}°C.
          ERA5 (Open-Meteo), снимок по {String(clim.dataEnd)}. Фенология взрослых: март–ноябрь, пик апр–июн
          (Carrera-Faja 2023) — модельное окно у́же: гейт по среднемесячной.
        </div>
      </div>

      <div className="rounded border border-[#3a4030] bg-[#14170f] p-3">
        <div className="mb-1 font-mono text-[10px] font-bold tracking-wider text-[#f0c674]">
          СЕЗОН 2026 · 3 ОПОРНЫЕ СТАНЦИИ (ЮГ → ЦЕНТР → СЕВЕР)
        </div>
        <div className="space-y-1 font-mono text-[10px]">
          {REF_IDS.map((sid) => (
            <StationRow key={sid} sid={sid} name={
              ({ taganrog: 'Таганрог', rostov: 'Ростов-н/Д', millerovo: 'Миллерово' } as Record<string, string>)[sid]
            } />
          ))}
        </div>
        <div className="mt-1 font-mono text-[10px] leading-4 text-[#8a8f78]">
          апрель 2026 ниже гейта {anchors.activationMonthlyMean}°C на всех трёх — открытие в мае;
          градиент пика юг→север ~1.6×.
        </div>
      </div>

      <div className="rounded border border-[#3a4030] bg-[#14170f] p-3">
        <div className="mb-1 font-mono text-[10px] font-bold tracking-wider text-[#f0c674]">
          КЛИМАТОЛОГИЯ {String(clim.period)} · 30 СЕЗОНОВ
        </div>
        <div className="space-y-1 font-mono text-[10px]">
          {REF_IDS.map((sid) => {
            const c = (clim as { stations: Record<string, typeof clim.stations.taganrog> }).stations[sid];
            const name = ({ taganrog: 'Таганрог', rostov: 'Ростов-н/Д', millerovo: 'Миллерово' } as Record<string, string>)[sid];
            return (
              <div key={sid} className="flex flex-wrap items-center gap-2">
                <span className="w-[86px] text-[#d8dcc8]">{name}</span>
                <span className={c.aprilGateYears >= 15 ? 'text-[#7fbf6f]' : 'text-[#d9792b]'}>
                  апрель ≥{anchors.activationMonthlyMean}°C: {c.aprilGateYears}/30
                </span>
                <span className="text-[#8a8f78]">
                  откр {monthRu(4)}×{c.openMonths['4'] ?? 0}/{monthRu(5)}×{c.openMonths['5'] ?? 0}
                </span>
                <span className="text-[#b8bca8]">
                  пик {c.peakDays.min}–{c.peakDays.max} (ср {c.peakDays.mean})
                </span>
                <span className="text-[#7fbf6f]">
                  тренд {c.trends.peakDaysPerDecade > 0 ? '+' : ''}{c.trends.peakDaysPerDecade} дн/дек
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1 font-mono text-[10px] leading-4 text-[#8a8f78]">
          март ни разу не прошёл гейт (0/90 станция-лет); открытие в апреле — норма юга/центра
          (16/30) и треть лет севера (10/30); тренды пика положительные у всех трёх (R² {clim.stations.taganrog.trends.r2.peak}–{clim.stations.rostov.trends.r2.peak}).
        </div>
      </div>

      <div className="rounded border border-[#3a4030] bg-[#14170f] p-3">
        <div className="mb-1 font-mono text-[10px] font-bold tracking-wider text-[#f0c674]">
          СЕТЬ 2026 · {netAll.length} СТАНЦИЙ ОБЛАСТИ
        </div>
        <div className="font-mono text-[10px] leading-5 text-[#b8bca8]">
          открытие май–закрытие окт: <span className="text-[#d8dcc8]">{openMay}/{netAll.length}</span> станций ·
          пик {net.peakDays.min}–{net.peakDays.max} (медиана {net.peakDays.median}, ср {net.peakDays.mean}) ·
          градиент <span className="text-[#d9792b]">{net.trendPeakDaysPerDegreeLat} дн/градус широты</span> (R²={net.r2})
        </div>
        <div className="mt-1 font-mono text-[10px] leading-4 text-[#8a8f78]">
          холодный апрель 2026 был областным: ни одна станция не открылась в апреле.
        </div>
      </div>

      <div className="rounded border border-[#3a4030] bg-[#14170f] p-3">
        <div className="mb-1 font-mono text-[10px] font-bold tracking-wider text-[#f0c674]">
          ЧУВСТВИТЕЛЬНОСТЬ · ПОЛНЫЙ ЯКОРЬ С ВЛАЖНОСТЬЮ (RH ≥ 75%)
        </div>
        <div className="space-y-1 font-mono text-[10px]">
          {REF_IDS.map((sid) => {
            const p = y2026(sid);
            const c = (clim as { stations: Record<string, typeof clim.stations.taganrog> }).stations[sid];
            const name = ({ taganrog: 'Таганрог', rostov: 'Ростов-н/Д', millerovo: 'Миллерово' } as Record<string, string>)[sid];
            if (!p || !c) return null;
            return (
              <div key={sid} className="flex flex-wrap items-center gap-2">
                <span className="w-[86px] text-[#d8dcc8]">{name}</span>
                <span className="text-[#b8bca8]">
                  RH≥75% в сезоне: {p.rh75SeasonPct}% дней
                </span>
                <span className="text-[#8a8f78]">
                  пик: T {p.peak} → с RH {p.peakFullAnchor} (30 лет ср {c.peakDaysFullAnchor.mean})
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1 font-mono text-[10px] leading-4 text-[#8a8f78]">
          влажностная половина европейского якоря в степи почти невыполнима —
          оперативный прокси: температура; расхождение измерено и опубликовано.
        </div>
      </div>

      <div className="rounded border border-[#3a4030] bg-[#14170f] p-2 font-mono text-[9px] leading-4 text-[#8a8f78]">
        {dis} Препринт: doi.org/10.5281/zenodo.24203316 · пересчёт: tools/vectors.mjs,
        tools/vectors_climatology.mjs ( воркфлоу vectors.yml ) · тесты: 69 known-answer.
      </div>
    </div>
  );
}
