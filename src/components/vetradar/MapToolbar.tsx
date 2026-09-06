'use client';

/** Тулбар карты: подложка + слои. */
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { LayerToggles } from './GisMap';

const LAYER_LABELS: Record<keyof LayerToggles, string> = {
  rivers: 'реки',
  asf: 'АЧС-коридор',
  metar: 'METAR',
  osint: 'OSINT',
  cchl: 'КГЛ-районы',
  plume: 'плюм',
};

export default function MapToolbar({
  tile,
  onTile,
  layers,
  onLayers,
}: {
  tile: 'topo' | 'dark';
  onTile: (t: 'topo' | 'dark') => void;
  layers: LayerToggles;
  onLayers: (l: LayerToggles) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded border border-[#3a4030] bg-[#14170f] px-3 py-2">
      <div className="flex items-center gap-2">
        <Label className="font-mono text-[10px] text-[#8a8f78]">подложка</Label>
        <ToggleGroup
          type="single"
          value={tile}
          onValueChange={(v) => v && onTile(v as 'topo' | 'dark')}
          className="gap-1"
        >
          <ToggleGroupItem value="topo" className="h-6 px-2 font-mono text-[10px]">топо</ToggleGroupItem>
          <ToggleGroupItem value="dark" className="h-6 px-2 font-mono text-[10px]">тёмн (Esri)</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {(Object.keys(LAYER_LABELS) as (keyof LayerToggles)[]).map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <Switch
              checked={layers[k]}
              onCheckedChange={(v) => onLayers({ ...layers, [k]: v })}
              className="scale-90"
            />
            <Label className="font-mono text-[10px] text-[#d8dcc8]">{LAYER_LABELS[k]}</Label>
          </div>
        ))}
      </div>
    </div>
  );
}
