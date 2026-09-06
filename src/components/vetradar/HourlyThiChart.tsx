'use client';

/** Почасовой график THI (SVG) с порогами и перекрестием. */
import { useState } from 'react';
import type { HourlyPoint } from '@/lib/types';

const THRESHOLDS = [
  { v: 72, color: '#e0a636', label: '72' },
  { v: 80, color: '#d95f2b', label: '80' },
  { v: 90, color: '#c0392b', label: '90' },
];

export default function HourlyThiChart({
  hourly,
  dayFilter,
  hourIdx,
}: {
  hourly: HourlyPoint[];
  dayFilter?: number;
  /** глобальный час скраббера — рисуем курсор, если он в окне графика */
  hourIdx?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const points = dayFilter == null ? hourly : hourly.slice(dayFilter * 24, dayFilter * 24 + 24);
  if (points.length === 0) return <div className="p-4 text-sm text-muted-foreground">нет данных</div>;
  const globalStart = dayFilter == null ? 0 : dayFilter * 24;
  const cursor =
    hourIdx != null && hourIdx >= globalStart && hourIdx < globalStart + points.length
      ? hourIdx - globalStart
      : null;

  const W = 640, H = 180, P = 26;
  const minT = Math.min(...points.map((p) => p.thi)) - 3;
  const maxT = Math.max(...points.map((p) => p.thi)) + 3;
  const lo = Math.min(minT, 65), hi = Math.max(maxT, 92);
  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.thi).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect();
          const rel = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((rel - P) / (W - 2 * P)) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        {/* сетка */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} stroke="#3a4030" strokeWidth="0.5" />
        ))}
        {/* пороги */}
        {THRESHOLDS.filter((t) => t.v >= lo && t.v <= hi).map((t) => (
          <g key={t.v}>
            <line x1={P} x2={W - P} y1={y(t.v)} y2={y(t.v)} stroke={t.color} strokeWidth="1" strokeDasharray="5 4" opacity="0.8" />
            <text x={W - P + 2} y={y(t.v) + 3} fill={t.color} fontSize="9" fontFamily="monospace">{t.label}</text>
          </g>
        ))}
        {/* THI */}
        <path d={area} fill="#e0a636" opacity="0.12" />
        <path d={path} fill="none" stroke="#f0c674" strokeWidth="1.8" />
        {/* курсор скраббера */}
        {cursor != null && (
          <g>
            <line x1={x(cursor)} x2={x(cursor)} y1={P} y2={H - P} stroke="#7fbf6f" strokeWidth="1.4" opacity="0.9" />
            <circle cx={x(cursor)} cy={y(points[cursor].thi)} r="4" fill="none" stroke="#7fbf6f" strokeWidth="1.6" />
          </g>
        )}
        {/* перекрестие */}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P} y2={H - P} stroke="#d8dcc8" strokeWidth="0.6" opacity="0.6" />
            <circle cx={x(hover)} cy={y(points[hover].thi)} r="3" fill="#f0c674" />
          </g>
        )}
        {/* подписи часов */}
        {points.map((p, i) =>
          i % 6 === 0 ? (
            <text key={i} x={x(i)} y={H - 8} fill="#8a8f78" fontSize="9" fontFamily="monospace" textAnchor="middle">
              {p.time}
            </text>
          ) : null,
        )}
        {/* Y-подписи */}
        <text x={4} y={y(lo) + 3} fill="#8a8f78" fontSize="9" fontFamily="monospace">{lo.toFixed(0)}</text>
        <text x={4} y={y(hi) + 3} fill="#8a8f78" fontSize="9" fontFamily="monospace">{hi.toFixed(0)}</text>
      </svg>
      {hover != null && (
        <div className="absolute right-2 top-1 rounded border border-[#3a4030] bg-[#14170f] px-2 py-1 font-mono text-[10px] text-[#d8dcc8]">
          {points[hover].time} · THI <b className="text-[#f0c674]">{points[hover].thi.toFixed(0)}</b>
          {' · '}{points[hover].temp.toFixed(1)}°C · RH {points[hover].rh}% · {points[hover].wind.toFixed(1)} м/с
        </div>
      )}
    </div>
  );
}
