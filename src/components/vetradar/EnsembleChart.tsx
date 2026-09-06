'use client';

/**
 * Ансамблевый веер: p10–p90 THImax по дням + P(THI>80).
 * Источник: ECMWF ensemble (ensemble-api.open-meteo) либо пертурбация.
 */
import type { EnsembleResult } from '@/lib/types';
import { thiColor } from './StationColor';

export default function EnsembleChart({ ens }: { ens: EnsembleResult | null }) {
  if (!ens || ens.days.length === 0) {
    return (
      <div className="rounded border border-[#3a4030] bg-[#14170f] p-3 font-mono text-[10px] text-[#8a8f78]">
        ансамбль загружается / недоступен — вероятности строим на пертурбации
      </div>
    );
  }

  const W = 340;
  const H = 130;
  const pad = { l: 26, r: 26, t: 10, b: 18 };
  const days = ens.days;
  const all = days.flatMap((d) => [d.p10, d.p90]);
  const min = Math.min(64, ...all) - 2;
  const max = Math.max(...all) + 2;
  const x = (i: number) => pad.l + (i / Math.max(1, days.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - ((v - min) / Math.max(1, max - min)) * (H - pad.t - pad.b);

  const band10 = days.map((d, i) => `${x(i)},${y(d.p90)}`).join(' ');
  const band90 = [...days].reverse().map((d, i) => `${x(days.length - 1 - i)},${y(d.p10)}`).join(' ');
  const mid = days.map((d, i) => `${x(i)},${y(d.p50)}`).join(' ');

  return (
    <div className="rounded border border-[#3a4030] bg-[#14170f] p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[11px] text-[#f0c674]">THImax: ансамбль-веер</span>
        <span
          className={`font-mono text-[9px] ${ens.source === 'ecmwf' ? 'text-[#7fbf6f]' : 'text-[#f0c674]'}`}
        >
          {ens.source === 'ecmwf' ? 'ECMWF 51 members' : 'пертурбация'}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
        {[68, 72, 80, 90].map((thr) => (
          <g key={thr}>
            <line x1={pad.l} y1={y(thr)} x2={W - pad.r} y2={y(thr)} stroke={thiColor(thr)} strokeWidth="0.6" strokeDasharray="4 4" opacity="0.7" />
            <text x={2} y={y(thr) + 3} fill="#8a8f78" fontSize="8" fontFamily="monospace">
              {thr}
            </text>
          </g>
        ))}
        <polygon points={`${band10} ${band90}`} fill="#f0c674" opacity="0.18" />
        <polyline points={mid} fill="none" stroke="#f0c674" strokeWidth="1.4" />
        {days.map((d, i) => (
          <g key={d.date}>
            <rect
              x={x(i) - 7}
              y={H - 6 - d.p80 * 26}
              width="14"
              height={d.p80 * 26}
              fill="#d95f2b"
              opacity={0.35 + 0.6 * d.p80}
            />
            <text x={x(i)} y={H - 9 + 3} textAnchor="middle" fill="#8a8f78" fontSize="7.5" fontFamily="monospace">
              {d.label.slice(0, 2)}
            </text>
            <text x={x(i)} y={y(d.p50) - 3} textAnchor="middle" fill="#f2f0e4" fontSize="8" fontFamily="monospace">
              {d.p50.toFixed(0)}
            </text>
          </g>
        ))}
        <text x={W - pad.r + 2} y={H - 4} fill="#8a8f78" fontSize="7" fontFamily="monospace">
          P(&gt;80)
        </text>
      </svg>
      <div className="mt-1 font-mono text-[10px] leading-4 text-[#b8bca8]">
        {days.map((d) => (
          <div key={d.date} className="flex items-center gap-2">
            <span className="w-[52px] text-[#8a8f78]">{d.label}</span>
            <span>
              p10 <b style={{ color: thiColor(d.p10) }}>{d.p10.toFixed(0)}</b> · p50{' '}
              <b style={{ color: thiColor(d.p50) }}>{d.p50.toFixed(0)}</b> · p90{' '}
              <b style={{ color: thiColor(d.p90) }}>{d.p90.toFixed(0)}</b>
            </span>
            <span className={d.p80 > 0.3 ? 'text-[#d95f2b]' : 'text-[#8a8f78]'}>
              P(&gt;80) {(d.p80 * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 font-mono text-[9px] text-[#8a8f78]">
        вероятностный прогноз: p90 высокий — планируй охлаждение/сдвиг кормлений заранее
      </div>
    </div>
  );
}
