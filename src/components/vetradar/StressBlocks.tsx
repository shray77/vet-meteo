'use client';

/**
 * Стресс-матрицы: видовые THI (птица/свиноматка), WCI, HLI/AHL —
 * по текущему часу скраббера и 7-дневному окну.
 * Трансмиссивные: дирофиляриоз HDU, ВЗН, Culicoides midge-days.
 */
import { useMemo } from 'react';
import type { PointAssessment } from '@/lib/assessment';
import type { HourlyPoint } from '@/lib/types';
import { thiPoultry, thiSow, coldStress, hli, ahlAccumulate, dirofilaria, wnvRisk, midgeDays } from '@/lib/models/advanced';

export function SpeciesStressBlock({
  hourly,
  hourIdx,
}: {
  hourly: HourlyPoint[];
  hourIdx: number;
}) {
  const h = hourly[Math.min(hourIdx, hourly.length - 1)];
  const p = useMemo(() => (h ? thiPoultry(h.temp, h.rh) : null), [h]);
  const s = useMemo(() => (h ? thiSow(h.temp, h.rh) : null), [h]);
  const w = useMemo(() => (h ? coldStress(h.temp, h.wind) : null), [h]);
  const ahl = useMemo(
    () => ahlAccumulate(hourly.slice(0, Math.min(hourIdx + 1, 168)).map((x) => ({ hli: hli(x.temp, x.rh, x.swr ?? 0, x.wind) }))),
    [hourly, hourIdx],
  );
  const hliNow = useMemo(() => (h ? hli(h.temp, h.rh, h.swr ?? 0, h.wind) : null), [h]);

  if (!h || !p || !s || !w) return null;

  return (
    <div className="rounded border border-[#3a4030] bg-[#14170f] p-2 font-mono text-[10px] leading-4">
      <div className="mb-1 font-mono text-[11px] text-[#f0c674]">СТРЕСС-МАТРИЦЫ (час {h.time})</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          птица{' '}
          <b style={{ color: p.color }}>
            {p.value.toFixed(0)} {p.zone}
          </b>{' '}
          <span className="text-[#8a8f78]">(0.6·Tdb+0.4·Twb)</span>
        </span>
        <span>
          свиноматки{' '}
          <b style={{ color: s.color }}>
            {s.value.toFixed(0)} {s.zone}
          </b>
        </span>
        <span>
          WCI <b style={{ color: w.wci > 1400 ? '#c0392b' : w.wci > 1000 ? '#d95f2b' : '#8a8f78' }}>{w.wci}</b> —{' '}
          {w.zone}
        </span>
        <span>
          HLI <b className="text-[#b8bca8]">{hliNow?.toFixed(0)}</b> · AHL{' '}
          <b className={ahl.ahl > 80 ? 'text-[#d95f2b]' : 'text-[#b8bca8]'}>{ahl.ahl}</b> — {ahl.zone}
        </span>
      </div>
    </div>
  );
}

export function VectorBlock({ a }: { a: PointAssessment }) {
  const dayAgg = useMemo(() => {
    const out: { tMax: number; tMin: number; precipSum: number }[] = [];
    for (let d = 0; d < Math.ceil(a.hourly.length / 24); d++) {
      const slice = a.hourly.slice(d * 24, d * 24 + 24);
      if (slice.length === 0) continue;
      out.push({
        tMax: Math.max(...slice.map((x) => x.temp)),
        tMin: Math.min(...slice.map((x) => x.temp)),
        precipSum: slice.reduce((s2, x) => s2 + x.precip, 0),
      });
    }
    return out;
  }, [a.hourly]);

  const diro = useMemo(() => dirofilaria(dayAgg), [dayAgg]);
  const wnv = useMemo(() => wnvRisk(dayAgg), [dayAgg]);
  const midge = useMemo(() => midgeDays(dayAgg), [dayAgg]);

  if (dayAgg.length === 0) return null;

  return (
    <div className="rounded border border-[#3a4030] bg-[#14170f] p-2 font-mono text-[10px] leading-4">
      <div className="mb-1 font-mono text-[11px] text-[#f0c674]">ТРАНСМИССИВНЫЕ (окно 7 дн)</div>
      <div className="space-y-0.5">
        <div className={diro.infective ? 'text-[#e0a636]' : 'text-[#b8bca8]'}>
          дирофиляриоз: HDU(8д) {diro.hdu8d} → ~{diro.hdu30d}/130 — {diro.note}
        </div>
        <div className={wnv.score > 60 ? 'text-[#e0a636]' : 'text-[#b8bca8]'}>
          ВЗН/Culex: риск {wnv.score}/100 — {wnv.note}
        </div>
        <div className={midge.active ? 'text-[#e0a636]' : 'text-[#b8bca8]'}>
          Culicoides: midge-days {midge.midgeDays} — {midge.note}
        </div>
      </div>
    </div>
  );
}
