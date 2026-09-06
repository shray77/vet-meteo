'use client';

/**
 * Таблица станций: live-метео (Open-Meteo в браузере) + METAR + архив
 * GitHub Actions + спарклайн THI из снапшотов.
 */
import type { MetarObs, ArchiveBundle, PointAssessment } from '@/lib/types';
import { archiveAgeHours } from '@/lib/archive';
import { thiColor } from './StationColor';

function Spark({ rows }: { rows: [string, number, number, number, number][] }) {
  if (rows.length < 2) return null;
  const w = 120;
  const hg = 26;
  const thi = rows.map((r) => r[4]);
  const min = Math.min(...thi);
  const max = Math.max(...thi);
  const span = Math.max(1, max - min);
  const pts = thi
    .map((v, i) => `${(i / (rows.length - 1)) * w},${hg - ((v - min) / span) * hg}`)
    .join(' ');
  return (
    <svg width={w} height={hg} className="inline-block align-middle">
      <polyline points={pts} fill="none" stroke="#f0c674" strokeWidth="1.2" />
      <line x1="0" y1={hg - ((72 - min) / span) * hg} x2={w} y2={hg - ((72 - min) / span) * hg} stroke="#6b5a28" strokeDasharray="3 3" strokeWidth="0.7" />
    </svg>
  );
}

function srcBadge(s: string) {
  if (s === 'openmeteo') return <span className="text-[#7fbf6f]">live</span>;
  if (s === 'proxy') return <span className="text-[#f0c674]">прокси</span>;
  return <span className="text-[#d98a80]">синт</span>;
}

function metarNearest(a: PointAssessment, stations: MetarObs[]): MetarObs | null {
  let best: MetarObs | null = null;
  let bd = Infinity;
  for (const m of stations) {
    if (m.lat == null || m.lon == null) continue;
    const d = Math.hypot(m.lat - a.point.lat, m.lon - a.point.lon) * 111;
    if (d < bd) {
      bd = d;
      best = m;
    }
  }
  return best;
}

export default function StationTable({
  assessments,
  metarStations,
  archive,
  hourIdx,
  selectedId,
  onSelectPoint,
}: {
  assessments: Record<string, PointAssessment>;
  metarStations: MetarObs[];
  archive: ArchiveBundle | null;
  hourIdx: number;
  selectedId: string | null;
  onSelectPoint: (id: string) => void;
}) {
  const rows = Object.values(assessments);
  const age = archive?.latest ? archiveAgeHours(archive.latest.generatedAt) : null;
  const last = archive?.latest;

  return (
    <div className="space-y-2">
      <div className="rounded border border-[#3a4030] bg-[#14170f] p-2 font-mono text-[10px] leading-4 text-[#8a8f78]">
        <div className="text-[#f0c674]">АРХИВ GITHUB ACTIONS (hourly)</div>
        {last ? (
          <>
            последний срез: {last.generatedAt.replace('T', ' ').slice(0, 16)} UTC
            {age != null ? ` · ${age < 1 ? '<1' : age.toFixed(0)} ч назад` : ''} · станций:{' '}
            {last.stations.length} · METAR: {last.metar.length}
          </>
        ) : (
          <>срезов пока нет — воркфлоу .github/workflows/stations.yml пишется каждый час</>
        )}
        <div className="mt-1">
          снапшотов в истории: {Object.keys(archive?.history ?? {}).length > 0
            ? `${Object.keys(archive?.history ?? {}).length} станций × до 72 ч`
            : '— (первые сутки после запуска Actions)'}
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto rounded border border-[#3a4030]">
        <table className="w-full border-collapse font-mono text-[10px]">
          <thead className="sticky top-0 bg-[#1a1e12] text-[#8a8f78]">
            <tr>
              <th className="px-2 py-1.5 text-left">станция</th>
              <th className="px-1 text-right">T°</th>
              <th className="px-1 text-right">RH</th>
              <th className="px-1 text-right">ветер</th>
              <th className="px-1 text-right">THI ч</th>
              <th className="px-1 text-right">THImax 7д</th>
              <th className="px-2 text-left">источник</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const h = a.hourly[Math.min(hourIdx, a.hourly.length - 1)];
              const thi7 = Math.max(...a.outlook.map((d) => d.thiMax));
              const met = metarNearest(a, metarStations);
              const sel = a.point.id === selectedId;
              return (
                <tr
                  key={a.point.id}
                  onClick={() => onSelectPoint(a.point.id)}
                  className={`cursor-pointer border-t border-[#232819] hover:bg-[#1a1e12] ${sel ? 'bg-[#1a1e12]' : 'bg-[#14170f]'}`}
                >
                  <td className="px-2 py-1 text-[#d8dcc8]">
                    {a.point.name}
                    {met && metarStations.length > 0 && (
                      <span className="ml-1 text-[#e8d9a0]" title={`${met.icao} ${met.name}`}>✈</span>
                    )}
                  </td>
                  <td className="px-1 text-right text-[#d8dcc8]">{h ? h.temp.toFixed(0) : '—'}</td>
                  <td className="px-1 text-right text-[#d8dcc8]">{h ? `${h.rh.toFixed(0)}%` : '—'}</td>
                  <td className="px-1 text-right text-[#d8dcc8]">
                    {h ? `${h.wind.toFixed(0)} м/с` : '—'}
                  </td>
                  <td className="px-1 text-right font-bold" style={{ color: thiColor(h?.thi) }}>
                    {h ? h.thi.toFixed(0) : '—'}
                  </td>
                  <td className="px-1 text-right font-bold" style={{ color: thiColor(thi7) }}>
                    {thi7.toFixed(0)}
                  </td>
                  <td className="px-2">{srcBadge(a.source)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedId && archive?.history?.[selectedId] && archive.history[selectedId].length > 1 && (
        <div className="rounded border border-[#3a4030] bg-[#14170f] p-2 font-mono text-[10px] text-[#8a8f78]">
          THI из архива, {selectedId} ({archive.history[selectedId].length} срезов):
          <div className="mt-1">
            <Spark rows={archive.history[selectedId]} />
          </div>
        </div>
      )}
    </div>
  );
}
