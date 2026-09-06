'use client';

/** Правая панель: Сводка / Прогноз / Станции / Ансамбль / АЧС / Надзор / OSINT. */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { ArchiveBundle, EnsembleResult, MetarObs, MqttPoint, PointAssessment } from '@/lib/types';
import type { TriggerItem } from '@/lib/types';
import { FIELD_POINTS, ASF_DEMO_OUTBREAKS, CCHF_DISTRICTS } from '@/lib/geo/rostov';
import { getAsfSpread } from '@/lib/models/asf';
import { milkLoss } from '@/lib/models/thi';
import Gauges from './Gauges';
import HourlyThiChart from './HourlyThiChart';
import TriggerFeed from './TriggerFeed';
import StationTable from './StationTable';
import EnsembleChart from './EnsembleChart';
import SurveillancePanel from './SurveillancePanel';
import { SpeciesStressBlock, VectorBlock } from './StressBlocks';

function sourceBadge(s: 'openmeteo' | 'proxy' | 'synthetic') {
  if (s === 'openmeteo') return <Badge className="bg-[#1d3a1d] text-[#7fbf6f] hover:bg-[#1d3a1d]">live Open-Meteo</Badge>;
  if (s === 'proxy') return <Badge className="bg-[#1d3125] text-[#f0c674] hover:bg-[#1d3125]">Open-Meteo через прокси</Badge>;
  return <Badge className="bg-[#3a1d1d] text-[#d98a80] hover:bg-[#3a1d1d]">синтетика (sandbox)</Badge>;
}

export default function RightPanel(props: {
  assessments: Record<string, PointAssessment>;
  selectedId: string | null;
  onSelectPoint: (id: string) => void;
  triggers: TriggerItem[];
  outbreakIdx: number;
  onSelectOutbreak: (idx: number) => void;
  osintPoints: MqttPoint[];
  onOsintScan: (provider: 'shodan' | 'censys', key: string, secret: string) => Promise<string>;
  onOsintDemo: () => void;
  hourIdx: number;
  metarStations: MetarObs[];
  ensemble: EnsembleResult | null;
  archive: ArchiveBundle | null;
}) {
  const [osintProvider, setOsintProvider] = useState<'shodan' | 'censys'>('shodan');
  const [osintKey, setOsintKey] = useState('');
  const [osintSecret, setOsintSecret] = useState('');
  const [osintMsg, setOsintMsg] = useState('');
  const [osintBusy, setOsintBusy] = useState(false);
  const [chartDay, setChartDay] = useState(0);

  const a = props.selectedId ? props.assessments[props.selectedId] : null;
  const today = a?.outlook[0];
  const outbreak = ASF_DEMO_OUTBREAKS[props.outbreakIdx];
  const corridor = getAsfSpread(props.outbreakIdx, 20);
  const cchlNear = a
    ? CCHF_DISTRICTS.reduce((best, d) => {
        const dist = Math.hypot(d.lat - a.point.lat, d.lon - a.point.lon) * 111;
        return dist < best.d ? { name: d.name, d: dist } : best;
      }, { name: '', d: 999 })
    : null;

  return (
    <Tabs defaultValue="summary" className="flex h-full flex-col gap-2">
      <TabsList className="grid h-auto w-full grid-cols-4 gap-0.5 bg-[#1a1e12]">
        <TabsTrigger value="summary" className="h-7 font-mono text-[10px]">Сводка</TabsTrigger>
        <TabsTrigger value="forecast" className="h-7 font-mono text-[10px]">Прогноз</TabsTrigger>
        <TabsTrigger value="stations" className="h-7 font-mono text-[10px]">Станции</TabsTrigger>
        <TabsTrigger value="ensemble" className="h-7 font-mono text-[10px]">Ансамбль</TabsTrigger>
        <TabsTrigger value="asf" className="h-7 font-mono text-[10px]">АЧС</TabsTrigger>
        <TabsTrigger value="surv" className="h-7 font-mono text-[10px]">Надзор</TabsTrigger>
        <TabsTrigger value="osint" className="h-7 font-mono text-[10px]">OSINT</TabsTrigger>
      </TabsList>

      {/* Сводка */}
      <TabsContent value="summary" className="mt-0 flex-1 overflow-y-auto">
        <div className="mb-2 flex items-center gap-2">
          <Select value={props.selectedId ?? ''} onValueChange={(v) => props.onSelectPoint(v)}>
            <SelectTrigger className="h-8 w-[200px] border-[#3a4030] bg-[#14170f] font-mono text-xs">
              <SelectValue placeholder="точка…" />
            </SelectTrigger>
            <SelectContent className="max-h-72 border-[#3a4030] bg-[#14170f] font-mono text-xs">
              {FIELD_POINTS.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {a && sourceBadge(a.source)}
        </div>
        {a && today ? (
          <div className="space-y-3">
            <div className="rounded border border-[#3a4030] bg-[#14170f] p-3">
              <div className="font-mono text-xs text-[#f0c674]">
                {a.point.name} · {a.point.animals} · {a.point.lat.toFixed(2)}°N {a.point.lon.toFixed(2)}°E
              </div>
              <div className="mt-1 font-mono text-[10px] leading-4 text-[#8a8f78]">
                рельеф: уклон {a.topo.slope}° эксп. {a.topo.aspectLabel} · застой {a.topo.coldPool} · ветер {a.topo.windExposure}
                <br />
                {a.topo.note}
                {cchlNear && cchlNear.d < 55 ? (
                  <> <span className="text-[#d9792b]">· рядом {cchlNear.name} р-н (КГЛ-эндемия, {cchlNear.d.toFixed(0)} км)</span></>
                ) : null}
              </div>
            </div>
            <Gauges thiMax={today.thiMax} brd={today.brd} ticks={today.ticks} fasciola={today.fasciola} cchf={today.cchf} />
            <div className="rounded border border-[#3a4030] bg-[#14170f] p-2 font-mono text-[10px] text-[#b8bca8]">
              {today.thiMax > 72
                ? `потери удоя ~${milkLoss(today.thiMax)} кг/гол/сут · THImax ${today.thiMax.toFixed(0)}`
                : 'теплового стресса нет'}
            </div>
            <div>
              <div className="mb-1.5 font-mono text-[11px] font-bold tracking-wider text-[#f0c674]">
                ТРИГГЕРЫ ({props.triggers.length})
              </div>
              <TriggerFeed triggers={props.triggers} selectedId={props.selectedId} onSelect={props.onSelectPoint} />
            </div>
          </div>
        ) : (
          <div className="p-4 font-mono text-xs text-[#8a8f78]">выберите точку на карте или в ленте триггеров</div>
        )}
      </TabsContent>

      {/* Прогноз */}
      <TabsContent value="forecast" className="mt-0 flex-1 overflow-y-auto">
        {a ? (
          <div className="space-y-2">
            <div className="rounded border border-[#3a4030] bg-[#14170f] p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-[11px] text-[#f0c674]">THI почасово</span>
                <Select value={String(chartDay)} onValueChange={(v) => setChartDay(Number(v))}>
                  <SelectTrigger className="h-6 w-[130px] border-[#3a4030] bg-[#14170f] font-mono text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 border-[#3a4030] bg-[#14170f] font-mono text-[10px]">
                    {a.outlook.map((d, i) => (
                      <SelectItem key={d.date} value={String(i)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <HourlyThiChart hourly={a.hourly} dayFilter={chartDay} hourIdx={props.hourIdx} />
            </div>
            <SpeciesStressBlock hourly={a.hourly} hourIdx={props.hourIdx} />
            <VectorBlock a={a} />
            <div className="space-y-1">
              {a.outlook.map((d) => (
                <div
                  key={d.date}
                  className={`rounded border p-2 font-mono text-[10px] leading-4 ${
                    d.triggers.length ? 'border-[#6b5a28] bg-[#1a180f]' : 'border-[#3a4030] bg-[#14170f]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-[52px] text-[#8a8f78]">{d.label}</span>
                    <span style={{ color: d.thiClass.color }}>THI {d.thiMax.toFixed(0)}/{d.thiMin.toFixed(0)}</span>
                    <span className={d.brd.level === 'high' ? 'text-[#d95f2b]' : 'text-[#8a8f78]'}>
                      BRD {d.brd.score}
                    </span>
                    <span className={d.ticks.hyalomma > 70 ? 'text-[#d9792b]' : 'text-[#8a8f78]'}>
                      клещи {d.ticks.hyalomma}
                    </span>
                    <span className={d.fasciola.level === 'high' ? 'text-[#6fa3b5]' : 'text-[#8a8f78]'}>
                      фаск {d.fasciola.moisture.toFixed(0)}
                    </span>
                  </div>
                  {d.triggers.length > 0 && (
                    <div className="mt-1 text-[#e0a636]">{d.triggers.join(' · ')}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 font-mono text-xs text-[#8a8f78]">выберите точку</div>
        )}
      </TabsContent>

      {/* Станции */}
      <TabsContent value="stations" className="mt-0 flex-1 overflow-y-auto">
        <StationTable
          assessments={props.assessments}
          metarStations={props.metarStations}
          archive={props.archive}
          hourIdx={props.hourIdx}
          selectedId={props.selectedId}
          onSelectPoint={props.onSelectPoint}
        />
      </TabsContent>

      {/* Ансамбль */}
      <TabsContent value="ensemble" className="mt-0 flex-1 overflow-y-auto">
        <div className="space-y-2">
          <div className="font-mono text-[10px] text-[#8a8f78]">
            вероятностный прогноз для: <b className="text-[#d8dcc8]">{a?.point.name ?? '—'}</b> (выбери точку на карте)
          </div>
          <EnsembleChart ens={props.ensemble} />
          <div className="rounded border border-[#3a4030] bg-[#14170f] p-2 font-mono text-[9px] leading-4 text-[#8a8f78]">
            p10/p50/p90 — перцентили THImax по 51 члену ансамбля ECMWF (ensemble-api.open-meteo,
            без ключа). В песочнице без интернета — локальная пертурбация (честно помечена).
            P(THI&gt;80)&gt;30% — закладывай водяное охлаждение/ночные кормления в план дня.
          </div>
        </div>
      </TabsContent>

      {/* Надзор */}
      <TabsContent value="surv" className="mt-0 flex-1 overflow-y-auto">
        <SurveillancePanel />
      </TabsContent>

      {/* АЧС */}
      <TabsContent value="asf" className="mt-0 flex-1 overflow-y-auto">
        <div className="space-y-2">
          <Select value={String(props.outbreakIdx)} onValueChange={(v) => props.onSelectOutbreak(Number(v))}>
            <SelectTrigger className="h-8 w-full border-[#3a4030] bg-[#14170f] font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[#3a4030] bg-[#14170f] font-mono text-xs">
              {ASF_DEMO_OUTBREAKS.map((o, i) => (
                <SelectItem key={o.name} value={String(i)}>{o.name} · {o.date}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="rounded border border-[#6b3a28] bg-[#1f1410] p-3 font-mono text-[10px] leading-4">
            <div className="text-[#ff8a7e]">{outbreak.name}</div>
            <div className="text-[#b8bca8]">
              дата: {outbreak.date} · свиней: {outbreak.pigs} (ДЕМО-ДАННЫЕ)
            </div>
            <div className="mt-1 text-[#8a8f78]">
              коридор волны: {corridor.length} клеток 0.1° · горизонт 20 ночей × 12 км/ночь
              <br />
              быстрая зона ≤2 ночей: {corridor.filter((c) => c.days <= 2).length} клеток ·
              ≤5 ночей: {corridor.filter((c) => c.days <= 5).length} клеток
            </div>
            <div className="mt-1 text-[#8a8f78]">
              официальные кольца: I 5 км карантин · II 20 км наблюдение · III 100 км контроль
            </div>
          </div>
          <div className="rounded border border-[#3a4030] bg-[#14170f] p-2 font-mono text-[10px] leading-4 text-[#8a8f78]">
            Рекомендации прототипа: в радиусе 5 км — бескровный убой/изоляция (по регламенту),
            20 км — мониторинг падежа кабана, 100 км — запрет перемещений свинины,
            кормов и инвентаря. Коридор — вероятный путь волны по лесам/воде ( suitability-модель ).
          </div>
        </div>
      </TabsContent>

      {/* OSINT */}
      <TabsContent value="osint" className="mt-0 flex-1 overflow-y-auto">
        <div className="space-y-2">
          <div className="rounded border border-[#3a4030] bg-[#14170f] p-3 space-y-2">
            <div className="font-mono text-[11px] text-[#f0c674]">Открытые MQTT-брокеры (bbox области)</div>
            <Select value={osintProvider} onValueChange={(v) => setOsintProvider(v as 'shodan' | 'censys')}>
              <SelectTrigger className="h-8 w-full border-[#3a4030] bg-[#14170f] font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-[#3a4030] bg-[#14170f] font-mono text-xs">
                <SelectItem value="shodan">Shodan (ключ API)</SelectItem>
                <SelectItem value="censys">Censys (API ID + secret)</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid gap-2">
              <div>
                <Label className="font-mono text-[10px] text-[#8a8f78]">
                  {osintProvider === 'shodan' ? 'API-ключ Shodan' : 'Censys API ID'}
                </Label>
                <Input
                  value={osintKey}
                  onChange={(e) => setOsintKey(e.target.value)}
                  type="password"
                  placeholder={osintProvider === 'shodan' ? 'ключ из account.shodan.io' : 'API ID'}
                  className="h-8 border-[#3a4030] bg-[#0e100a] font-mono text-xs"
                />
              </div>
              {osintProvider === 'censys' && (
                <div>
                  <Label className="font-mono text-[10px] text-[#8a8f78]">Censys API Secret</Label>
                  <Input
                    value={osintSecret}
                    onChange={(e) => setOsintSecret(e.target.value)}
                    type="password"
                    placeholder="API secret"
                    className="h-8 border-[#3a4030] bg-[#0e100a] font-mono text-xs"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 font-mono text-[10px]"
                disabled={osintBusy}
                onClick={async () => {
                  setOsintBusy(true);
                  setOsintMsg('сканирую…');
                  const msg = await props.onOsintScan(osintProvider, osintKey, osintSecret);
                  setOsintMsg(msg);
                  setOsintBusy(false);
                }}
              >
                сканировать
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 font-mono text-[10px]"
                onClick={props.onOsintDemo}
              >
                демо-выгрузка
              </Button>
            </div>
            {osintMsg && <div className="font-mono text-[10px] text-[#b8bca8]">{osintMsg}</div>}
          </div>
          <div className="rounded border border-[#3a4030] bg-[#14170f] p-2 font-mono text-[10px] leading-4 text-[#8a8f78]">
            найдено точек: {props.osintPoints.length}
            {props.osintPoints.length > 0 && (
              <>
                {' · '}погодоподобных: {props.osintPoints.filter((p) => p.weatherLike).length}
                <div className="mt-1 max-h-40 overflow-y-auto">
                  {props.osintPoints.slice(0, 40).map((p) => (
                    <div key={`${p.ip}:${p.port}`} className={p.weatherLike ? 'text-[#69b45f]' : 'text-[#9a8fc0]'}>
                      ◆ {p.ip}:{p.port} · {p.label} · {p.org.slice(0, 30)}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="rounded border border-[#3a4030] bg-[#14170f] p-2 font-mono text-[10px] leading-4 text-[#8a8f78]">
            Ключи вводятся разово и не сохраняются. CLI: tools/osint_cli.py — то же самое
            в файл GeoJSON (public/osint/). Демо-выгрузка — прошлогодний срез.
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
