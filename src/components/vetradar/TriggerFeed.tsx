'use client';

/** Лента триггеров: клик — выбор точки на карте. */
import type { TriggerItem } from '@/lib/types';

const COLORS = { info: '#6a8f5f', warn: '#e0a636', danger: '#c0392b' } as const;
const ICONS = { info: 'ℹ', warn: '▲', danger: '!!' } as const;

export default function TriggerFeed({
  triggers,
  selectedId,
  onSelect,
}: {
  triggers: TriggerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
      {triggers.length === 0 && (
        <div className="rounded border border-[#3a4030] p-2 font-mono text-[11px] text-[#8a8f78]">
          загрузка…
        </div>
      )}
      {triggers.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.pointId)}
          className={`w-full rounded border p-2 text-left font-mono text-[11px] leading-4 transition-colors ${
            selectedId === t.pointId
              ? 'border-[#f0c674] bg-[#1d2114]'
              : 'border-[#3a4030] bg-[#14170f] hover:border-[#5a6248]'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span style={{ color: COLORS[t.severity] }}>{ICONS[t.severity]}</span>
            <span className="text-[#f0c674]">{t.date}</span>
            <span className="text-[#8a8f78]">·</span>
            <span className="text-[#d8dcc8]">{t.pointName}</span>
          </div>
          <div className="mt-0.5 text-[#b8bc a8] text-[#b8bca8]">{t.text}</div>
        </button>
      ))}
    </div>
  );
}
