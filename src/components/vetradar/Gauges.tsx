'use client';

/** Датчики: полукруглый THI-гейдж + столбики BRD/клещи/фасциолёз. */
import type { BrdResult, CchfResult, FasciolaResult, TickResult } from '@/lib/types';
import { thiClass } from '@/lib/models/thi';

function Gauge({ value, label }: { value: number; label: string }) {
  const cl = thiClass(value);
  const frac = Math.max(0, Math.min(1, (value - 60) / 40));
  const a = Math.PI * (1 - frac);
  const cx = 90, cy = 82, r = 64;
  const px = cx + r * Math.cos(a);
  const py = cy - r * Math.sin(a);
  const arc = (from: number, to: number) => {
    const a1 = Math.PI * (1 - from);
    const a2 = Math.PI * (1 - to);
    return `M${cx + r * Math.cos(a1)},${cy - r * Math.sin(a1)} A${r},${r} 0 0 1 ${cx + r * Math.cos(a2)},${cy - r * Math.sin(a2)}`;
  };
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 96" className="w-full max-w-[220px]">
        <path d={arc(0, 1)} fill="none" stroke="#232819" strokeWidth="12" strokeLinecap="round" />
        <path d={arc(0, 0.3)} fill="none" stroke="#5f9e5f" strokeWidth="12" opacity="0.5" />
        <path d={arc(0.3, 0.5)} fill="none" stroke="#e0a636" strokeWidth="12" opacity="0.5" />
        <path d={arc(0.5, 0.75)} fill="none" stroke="#d95f2b" strokeWidth="12" opacity="0.5" />
        <path d={arc(0.75, 1)} fill="none" stroke="#c0392b" strokeWidth="12" opacity="0.5" />
        <path d={arc(0, frac)} fill="none" stroke={cl.color} strokeWidth="12" strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={px} y2={py} stroke="#f2f0e4" strokeWidth="2.5" />
        <circle cx={cx} cy={cy} r="4" fill="#f2f0e4" />
        <text x={cx} y={cy - 18} textAnchor="middle" fill={cl.color} fontSize="24" fontWeight="700" fontFamily="monospace">
          {value.toFixed(0)}
        </text>
        <text x={12} y={cy + 12} fill="#8a8f78" fontSize="10" fontFamily="monospace">60</text>
        <text x={cx * 2 - 24} y={cy + 12} fill="#8a8f78" fontSize="10" fontFamily="monospace">100</text>
      </svg>
      <div className="-mt-1 font-mono text-[11px]" style={{ color: cl.color }}>{label}</div>
    </div>
  );
}

function Bar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between font-mono text-[10px] text-[#d8dcc8]">
        <span>{label}</span>
        <span style={{ color }}>{value.toFixed(0)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-[#232819]">
        <div className="h-full rounded" style={{ width: `${Math.min(100, value)}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Gauges(props: {
  thiMax: number;
  brd: BrdResult;
  ticks: TickResult;
  fasciola: FasciolaResult;
  cchf: CchfResult;
}) {
  const cl = thiClass(props.thiMax);
  return (
    <div className="space-y-3">
      <Gauge value={props.thiMax} label={`THI — ${cl.label}`} />
      <Bar value={props.brd.score} label={`BRD (${props.brd.label})`} color={props.brd.level === 'high' ? '#d95f2b' : props.brd.level === 'moderate' ? '#e0a636' : '#5f9e5f'} />
      <Bar value={props.ticks.hyalomma} label={`Клещи Hyalomma, GDD₁₀=${props.ticks.gdd}`} color="#d9792b" />
      <Bar value={props.fasciola.moisture} label={`Фасциолёз, влагостат ${props.fasciola.moisture} мм`} color="#6fa3b5" />
      <Bar value={props.cchf.risk} label={`КГЛ-риск: ${props.cchf.label}`} color="#c0392b" />
    </div>
  );
}
