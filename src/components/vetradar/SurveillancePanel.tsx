'use client';

/**
 * Панель надзора: демо-ряд заболеваемости 60 дней →
 * EARS C1/C2/C3, Фаррингтон-флаги, Rt (Cori 2013), скан Кульдорффа.
 * Все данные ДЕМО (детерминированный сид) — показать механику алгоритмов.
 */
import { useMemo } from 'react';
import {
  demoSeries,
  ears,
  farrington,
  rtCori,
  kulldorffScan,
  demoScanData,
} from '@/lib/models/surveillance';

export default function SurveillancePanel() {
  const series = useMemo(() => demoSeries(61), []);
  const e = useMemo(() => ears(series), [series]);
  const f = useMemo(() => farrington(series), [series]);
  const rt = useMemo(() => rtCori(series, 3, 14, 7), [series]);
  const scan = useMemo(() => kulldorffScan(demoScanData(), [20, 40, 60, 80], 199), []);

  const W = 340;
  const H = 110;
  const pad = { l: 26, r: 8, t: 8, b: 16 };
  const maxC = Math.max(...series.map((d) => d.cases)) || 1;
  const x = (i: number) => pad.l + (i / (series.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / maxC) * (H - pad.t - pad.b);

  const last12 = e.slice(-12);
  const rtLast = rt.slice(-6);
  const fFlags = f.filter((r) => r.flag).length;

  return (
    <div className="space-y-2">
      <div className="rounded border border-[#3a4030] bg-[#14170f] p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-mono text-[11px] text-[#f0c674]">Эпидкривая (ДЕМО-ряд)</span>
          <span className="font-mono text-[9px] text-[#8a8f78]">60 дней · Пуассон λ→волна</span>
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="block">
          {series.map((d, i) =>
            d.cases > 0 ? (
              <rect key={d.date} x={x(i) - 1.6} y={y(d.cases)} width="3.2" height={H - pad.b - y(d.cases)} fill={i >= 44 ? '#d95f2b' : '#5f9e5f'} opacity="0.85" />
            ) : null,
          )}
          <line x1={x(44)} y1={pad.t} x2={x(44)} y2={H - pad.b} stroke="#6b5a28" strokeDasharray="3 3" />
          <text x={x(44) + 3} y={pad.t + 8} fill="#8a8f78" fontSize="7.5" fontFamily="monospace">
            волна
          </text>
        </svg>
      </div>

      <div className="rounded border border-[#3a4030] bg-[#14170f] p-2">
        <div className="mb-1 font-mono text-[11px] text-[#f0c674]">EARS C1/C2/C3 (последние 12 дней)</div>
        <div className="max-h-40 overflow-y-auto font-mono text-[10px] leading-4">
          {last12.map((r) => (
            <div key={r.date} className="flex items-center gap-2">
              <span className="w-[58px] text-[#8a8f78]">{r.date.slice(5)}</span>
              <span className="w-8 text-right text-[#d8dcc8]">{r.cases}</span>
              <span className={`w-12 text-right ${r.c1 > 2 ? 'text-[#e0a636]' : 'text-[#8a8f78]'}`}>C1 {r.c1.toFixed(1)}</span>
              <span className={`w-12 text-right ${r.c2 > 2 ? 'text-[#e0a636]' : 'text-[#8a8f78]'}`}>C2 {r.c2.toFixed(1)}</span>
              <span className={`w-12 text-right ${r.c3 > 3 ? 'text-[#e0a636]' : 'text-[#8a8f78]'}`}>C3 {r.c3.toFixed(1)}</span>
              {r.alarm !== 'ok' && (
                <span className={r.alarm === 'alarm' ? 'text-[#c0392b]' : 'text-[#e0a636]'}>
                  {r.alarm === 'alarm' ? 'ALARM' : 'watch'}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded border border-[#3a4030] bg-[#14170f] p-2 font-mono text-[10px] leading-4">
        <div className="mb-1 font-mono text-[11px] text-[#f0c674]">Фаррингтон-скоринг</div>
        сработавших флагов: <b className={fFlags > 0 ? 'text-[#e0a636]' : 'text-[#7fbf6f]'}>{fFlags}</b> из {f.length} дней
        <br />
        {f.slice(-4).map((r) => (
          <div key={r.date} className={r.flag ? 'text-[#e0a636]' : 'text-[#8a8f78]'}>
            {r.date.slice(5)}: факт {r.cases} vs верх {r.upper.toFixed(1)}{r.flag ? ' ⚑ превышение' : ''}
          </div>
        ))}
      </div>

      <div className="rounded border border-[#3a4030] bg-[#14170f] p-2">
        <div className="mb-1 font-mono text-[11px] text-[#f0c674]">Rt (Cori 2013, окно 3, SI 14±7)</div>
        <svg width="100%" viewBox={`0 0 ${W} 70`} className="block">
          <line x1="26" y1={35} x2={W - 8} y2={35} stroke="#6b5a28" strokeDasharray="3 3" />
          <text x="2" y="38" fill="#8a8f78" fontSize="8" fontFamily="monospace">Rt=1</text>
          {rtLast.map((r, i) => {
            const cx = 34 + (i / Math.max(1, rtLast.length - 1)) * (W - 52);
            const yv = 35 - (r.rt - 1) * 22;
            const ylo = 35 - (r.lo - 1) * 22;
            const yhi = 35 - (r.hi - 1) * 22;
            return (
              <g key={r.date}>
                <line x1={cx} y1={ylo} x2={cx} y2={yhi} stroke="#f0c674" strokeWidth="1" opacity="0.8" />
                <circle cx={cx} cy={yv} r="2.5" fill={r.rt > 1 ? '#d95f2b' : '#7fbf6f'} />
                <text x={cx} y={yhi - 4} textAnchor="middle" fill="#b8bca8" fontSize="7.5" fontFamily="monospace">
                  {r.rt.toFixed(2)}
                </text>
                <text x={cx} y={66} textAnchor="middle" fill="#8a8f78" fontSize="7" fontFamily="monospace">
                  {r.date.slice(5)}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="font-mono text-[9px] leading-4 text-[#8a8f78]">
          Rt&gt;1 = рост (демо-волна); гамма-апостериор, квантили 2.5/97.5% (Вилсон–Хилферти).
        </div>
      </div>

      <div className="rounded border border-[#3a4030] bg-[#14170f] p-2 font-mono text-[10px] leading-4">
        <div className="mb-1 font-mono text-[11px] text-[#f0c674]">Кульдорфф скан (Пуассон, 199 реплик)</div>
        {scan.length === 0 ? (
          <span className="text-[#8a8f78]">кластеров нет</span>
        ) : (
          scan.slice(0, 3).map((c) => (
            <div key={`${c.center}-${c.radiusKm}`} className={c.p < 0.05 ? 'text-[#e0a636]' : 'text-[#8a8f78]'}>
              {c.center} r{c.radiusKm} км: {c.observed} набл. vs {c.expected} ожид. · LLR {c.llr} · p≈{c.p}
            </div>
          ))
        )}
        <div className="mt-1 text-[9px] text-[#8a8f78]">
          демо-кластер в Миллеровском/Чертковском/Тарасовском — как всплеск КГЛ в соседних р-нах
        </div>
      </div>

      <div className="rounded border border-[#3a4030] bg-[#14170f] p-2 font-mono text-[9px] leading-4 text-[#8a8f78]">
        Подключение реальных данных: выгрузка ВетИС/ФСВПС суточных counts → тот же пайплайн
        (demoSeries → ваши ряды), ничего в алгоритмах не меняется.
      </div>
    </div>
  );
}
