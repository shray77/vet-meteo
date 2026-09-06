'use client';

/**
 * Скраббер времени: двигаем карту по почасовому прогнозу 0..167 ч.
 * hourly[] начинается с 00:00 текущих суток (Europe/Moscow).
 */
import { useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import type { PointAssessment } from '@/lib/assessment';

function moscowHour(): number {
  try {
    const fmt = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: 'numeric', hour12: false });
    const h = Number(fmt.format(new Date()));
    return Number.isFinite(h) ? h : 12;
  } catch {
    return new Date().getHours();
  }
}

export function currentBaseHour(): number {
  return moscowHour();
}

export default function TimeScrubber({
  hourIdx,
  onHour,
  assessments,
}: {
  hourIdx: number;
  onHour: (h: number) => void;
  assessments: Record<string, PointAssessment>;
}) {
  const any = Object.values(assessments)[0];
  const maxIdx = (any?.hourly.length ?? 192) - 1;
  const base = useMemo(() => moscowHour(), []);

  const h = any?.hourly[Math.min(hourIdx, maxIdx)];
  const shift = hourIdx - base;
  const dayShift = Math.floor(Math.max(0, hourIdx) / 24);
  const timeLabel = h ? h.time : '--:--';
  const dayLabel =
    dayShift === 0 ? 'сегодня' : dayShift === 1 ? 'завтра' : `+${dayShift} дн`;

  const quick: [string, number][] = [
    ['сейчас', base],
    ['+6ч', base + 6],
    ['+24ч', base + 24],
    ['+72ч', base + 72],
    ['+7д', Math.min(maxIdx, base + 167)],
  ];

  return (
    <div className="rounded border border-[#3a4030] bg-[#14170f] px-3 py-2">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[10px] tracking-wider text-[#8a8f78]">
          ПРОГНОЗ-СКРАББЕР
        </span>
        <span className="font-mono text-xs font-bold text-[#f0c674]">
          {shift > 0 ? `+${shift} ч` : shift === 0 ? 'сейчас' : `${shift} ч`} · {dayLabel} {timeLabel}
        </span>
        {h && (
          <span className="font-mono text-[10px] text-[#b8bca8]">
            T {h.temp.toFixed(0)}°C · RH {h.rh.toFixed(0)}% · ветер {h.wind.toFixed(0)} м/с
            {h.wdir != null ? ` ${h.wdir.toFixed(0)}°` : ''}
          </span>
        )}
        <div className="ml-auto flex gap-1">
          {quick.map(([label, idx]) => (
            <button
              key={label}
              type="button"
              onClick={() => onHour(Math.max(0, Math.min(maxIdx, idx)))}
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                Math.min(maxIdx, idx) === hourIdx
                  ? 'border-[#f0c674] bg-[#2a2515] text-[#f0c674]'
                  : 'border-[#3a4030] bg-[#14170f] text-[#8a8f78] hover:border-[#6b5a28] hover:text-[#d8dcc8]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Slider
        value={[Math.min(hourIdx, maxIdx)]}
        min={0}
        max={maxIdx}
        step={1}
        onValueChange={(v) => onHour(v[0])}
        className="py-1"
      />
      <div className="flex justify-between font-mono text-[9px] text-[#8a8f78]">
        <span>00:00 сегодня</span>
        <span>+72 ч</span>
        <span>+167 ч (7 дней)</span>
      </div>
    </div>
  );
}
