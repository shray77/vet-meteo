'use client';

/**
 * ВЕТРАДАР-61 — ветеринарный ГИС-прототип Ростовской области.
 * Клиентская страница: карта слева, панель справа, шапка с бейджем источника.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import RightPanel from '@/components/vetradar/RightPanel';
import MapToolbar from '@/components/vetradar/MapToolbar';
import InfoDialog from '@/components/vetradar/InfoDialog';
import { Badge } from '@/components/ui/badge';
import { assessAll, allTriggers } from '@/lib/assessment';
import type { MetarObs, MqttPoint, PointAssessment, TriggerItem } from '@/lib/types';
import type { LayerToggles } from '@/components/vetradar/GisMap';

/** Leaflet требует window — рендерим карту только на клиенте. */
const GisMap = dynamic(() => import('@/components/vetradar/GisMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#0e100a]" />,
});

export default function Home() {
  const [assessments, setAssessments] = useState<Record<string, PointAssessment>>({});
  const [metarStations, setMetarStations] = useState<MetarObs[]>([]);
  const [osintPoints, setOsintPoints] = useState<MqttPoint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>('rostov');
  const [outbreakIdx, setOutbreakIdx] = useState(0);
  const [tile, setTile] = useState<'topo' | 'dark'>('topo');
  const [layers, setLayers] = useState<LayerToggles>({
    rivers: true, asf: true, metar: true, osint: false, cchl: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [a, m] = await Promise.all([
        assessAll(),
        fetch('/api/metar').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      if (!alive) return;
      setAssessments(a);
      if (m?.stations?.length) setMetarStations(m.stations);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const triggers: TriggerItem[] = useMemo(() => allTriggers(assessments), [assessments]);

  const onOsintScan = useCallback(
    async (provider: 'shodan' | 'censys', key: string, secret: string): Promise<string> => {
      try {
        const r = await fetch('/api/osint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, key, secret }),
        });
        const j = await r.json();
        if (!r.ok) return `ошибка: ${j.error ?? r.status}`;
        setOsintPoints(j.points ?? []);
        setLayers((l) => ({ ...l, osint: (j.count ?? 0) > 0 }));
        return `найдено ${j.count} MQTT-точек`;
      } catch {
        return 'сеть недоступна';
      }
    },
    [],
  );

  const onOsintDemo = useCallback(async () => {
    try {
      const r = await fetch('/osint/demo_mqtt_points.json');
      if (!r.ok) return;
      const fc = await r.json();
      const pts: MqttPoint[] = (fc.features ?? []).map((f: any) => ({
        ip: f.properties?.ip ?? '?',
        port: f.properties?.port ?? 1883,
        lat: f.geometry?.coordinates?.[1] ?? 0,
        lon: f.geometry?.coordinates?.[0] ?? 0,
        org: f.properties?.org ?? '—',
        provider: f.properties?.provider ?? 'demo',
        label: f.properties?.label ?? 'MQTT',
        banner: f.properties?.banner ?? '',
        weatherLike: !!f.properties?.weatherLike,
      }));
      setOsintPoints(pts);
      setLayers((l) => ({ ...l, osint: pts.length > 0 }));
    } catch {
      /* нет демо-файла — молча */
    }
  }, []);

  const sources = Object.values(assessments).map((a) => a.source);
  const badge =
    loading ? { t: 'загрузка…', c: 'bg-[#232819] text-[#8a8f78]' } :
    sources.some((s) => s === 'synthetic')
      ? { t: 'метео: синтетика', c: 'bg-[#3a1d1d] text-[#d98a80]' }
      : sources.some((s) => s === 'proxy')
        ? { t: 'метео: прокси', c: 'bg-[#1d3125] text-[#f0c674]' }
        : { t: 'метео: live', c: 'bg-[#1d3a1d] text-[#7fbf6f]' };
  const metarLive = metarStations.length > 0;

  return (
    <div className="flex h-screen flex-col bg-[#0b0d08] text-[#d8dcc8]">
      <header className="flex flex-wrap items-center gap-2 border-b border-[#3a4030] bg-[#10130a] px-3 py-2">
        <span className="font-mono text-sm font-bold tracking-widest text-[#f0c674]">
          ВЕТРАДАР-61
        </span>
        <span className="hidden font-mono text-[10px] text-[#8a8f78] sm:inline">
          вет. эпид-риски Ростовской обл. · сейчас + 7 дней
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Badge className={`${badge.c} hover:${badge.c} font-mono text-[10px]`}>{badge.t}</Badge>
          <Badge
            className={`font-mono text-[10px] ${
              metarLive ? 'bg-[#1d3a1d] text-[#7fbf6f]' : 'bg-[#3a1d1d] text-[#d98a80]'
            }`}
          >
            METAR {metarLive ? `×${metarStations.length}` : '—'}
          </Badge>
          <Badge className="bg-[#232819] font-mono text-[10px] text-[#8a8f78]">
            {loading ? '…' : `${Object.keys(assessments).length} точек`}
          </Badge>
          <InfoDialog />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-[420px] flex-1 flex-col gap-2 p-2">
          <MapToolbar tile={tile} onTile={setTile} layers={layers} onLayers={setLayers} />
          <div className="min-h-[380px] flex-1 overflow-hidden rounded border border-[#3a4030]">
            <GisMap
              assessments={assessments}
              selectedId={selectedId}
              onSelectPoint={setSelectedId}
              metarStations={metarStations}
              osintPoints={osintPoints}
              outbreakIdx={outbreakIdx}
              onSelectOutbreak={setOutbreakIdx}
              tile={tile}
              layers={layers}
            />
          </div>
        </div>
        <aside className="w-full shrink-0 overflow-hidden border-t border-[#3a4030] p-2 lg:w-[380px] lg:border-l lg:border-t-0">
          <RightPanel
            assessments={assessments}
            selectedId={selectedId}
            onSelectPoint={setSelectedId}
            triggers={triggers}
            outbreakIdx={outbreakIdx}
            onSelectOutbreak={setOutbreakIdx}
            osintPoints={osintPoints}
            onOsintScan={onOsintScan}
            onOsintDemo={onOsintDemo}
          />
        </aside>
      </div>
    </div>
  );
}
