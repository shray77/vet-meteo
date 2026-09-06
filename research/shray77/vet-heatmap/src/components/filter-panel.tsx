"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, X, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { speciesRu } from "@/lib/i18n-species";
import type { Outbreak, DiseaseKey, OutbreakStatus } from "@/types/domain";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { diseaseColor } from "@/lib/colors";
import type { FilterState } from "@/lib/filters";

interface FilterPanelProps {
  outbreaks: Outbreak[];
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onReset: () => void;
  showRiskZones: boolean;
  onShowRiskZonesChange: (v: boolean) => void;
  showChoropleth: boolean;
  onShowChoroplethChange: (v: boolean) => void;
  showHeatmap?: boolean;
  onShowHeatmapChange?: (v: boolean) => void;
  /** Livestock density layer toggle (passed from page.tsx but not used in panel UI — kept for prop compatibility). */
  densityLayer?: "none" | "pigs" | "cattle" | "poultry";
}

export function FilterPanel({
  outbreaks,
  filters,
  onChange,
  onReset,
  showRiskZones,
  onShowRiskZonesChange,
  showChoropleth,
  onShowChoroplethChange,
  showHeatmap = false,
  onShowHeatmapChange,
  densityLayer: _densityLayer,
}: FilterPanelProps) {
  // Compute available filter options from the data
  const allDiseases = useMemo(() => {
    const counts = new Map<DiseaseKey, number>();
    for (const o of outbreaks) counts.set(o.disease_key, (counts.get(o.disease_key) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [outbreaks]);

  const allSpecies = useMemo(() => {
    const set = new Set<string>();
    for (const o of outbreaks) set.add(o.species);
    return Array.from(set).sort();
  }, [outbreaks]);

  const allFederalDistricts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of outbreaks) {
      const fd = o.federal_district || "";
      if (fd) counts.set(fd, (counts.get(fd) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [outbreaks]);

  const statuses: OutbreakStatus[] = ["Ongoing", "Resolved", "Unknown"];

  const toggleDisease = (k: DiseaseKey) => {
    const has = filters.diseases.includes(k);
    onChange({
      ...filters,
      diseases: has ? filters.diseases.filter((x) => x !== k) : [...filters.diseases, k],
    });
  };

  const toggleSpecies = (s: string) => {
    const has = filters.species.includes(s);
    onChange({
      ...filters,
      species: has ? filters.species.filter((x) => x !== s) : [...filters.species, s],
    });
  };

  const toggleStatus = (s: OutbreakStatus) => {
    const has = filters.statuses.includes(s);
    onChange({
      ...filters,
      statuses: has ? filters.statuses.filter((x) => x !== s) : [...filters.statuses, s],
    });
  };

  const toggleFederalDistrict = (fd: string) => {
    const has = filters.federalDistricts.includes(fd);
    onChange({
      ...filters,
      federalDistricts: has ? filters.federalDistricts.filter((x) => x !== fd) : [...filters.federalDistricts, fd],
    });
  };

  const activeCount =
    filters.diseases.length +
    filters.species.length +
    filters.statuses.length +
    filters.federalDistricts.length +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  return (
    <Card className="p-3 md:p-4 space-y-3">
      {/* Search */}
      <div className="space-y-1.5">
        <Label htmlFor="search" className="text-xs font-medium text-muted-foreground">
          Поиск
        </Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Болезнь, регион, вид…"
            className="pl-9 h-9 text-sm"
          />
          {filters.query && (
            <button
              onClick={() => onChange({ ...filters, query: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Очистить"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Disease filter */}
      <Accordion type="single" collapsible defaultValue="diseases" className="w-full">
        <AccordionItem value="diseases" className="border-0">
          <AccordionTrigger className="text-xs font-medium text-muted-foreground py-2 hover:no-underline">
            Болезнь ({filters.diseases.length})
          </AccordionTrigger>
          <AccordionContent>
            {filters.diseases.length > 0 && (
              <button onClick={() => onChange({ ...filters, diseases: [] })} className="text-[10px] text-muted-foreground hover:text-foreground">сбросить</button>
            )}
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto thin-scroll mt-1">
              {allDiseases.map(([k, n]) => {
                const active = filters.diseases.includes(k);
                const labels = DISEASE_LABELS[k];
                const color = diseaseColor(k, labels.group);
                return (
                  <button key={k} onClick={() => toggleDisease(k)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border transition-colors" style={{ backgroundColor: active ? color : "transparent", borderColor: color, color: active ? "#fff" : color }}>
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, opacity: active ? 0.5 : 1 }} />
                    {labels.short_ru}<span style={{ opacity: 0.7 }}>({n})</span>
                  </button>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="species" className="border-0">
          <AccordionTrigger className="text-xs font-medium text-muted-foreground py-2 hover:no-underline">
            Вид животных ({filters.species.length})
          </AccordionTrigger>
          <AccordionContent>
            {filters.species.length > 0 && (
              <button onClick={() => onChange({ ...filters, species: [] })} className="text-[10px] text-muted-foreground hover:text-foreground">сбросить</button>
            )}
            <div className="flex flex-wrap gap-1 mt-1">
              {allSpecies.map((s) => {
                const active = filters.species.includes(s);
                const ru = speciesRu(s) || s;
                return (
                  <button key={s} onClick={() => toggleSpecies(s)} className={'px-2 py-0.5 rounded-full text-[11px] border transition-colors '+ (active ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/50")}>
                    {ru}
                  </button>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="status" className="border-0">
          <AccordionTrigger className="text-xs font-medium text-muted-foreground py-2 hover:no-underline">
            Статус
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex gap-1">
              {statuses.map((st) => {
                const active = filters.statuses.includes(st);
                return (
                  <button key={st} onClick={() => toggleStatus(st)} className={'px-2 py-0.5 rounded-full text-[11px] border transition-colors '+ (active ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground")}>
                    {st === "Ongoing" ? "Активные" : st === "Resolved" ? "Завершён" : "Неизвестно"}
                  </button>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="districts" className="border-0">
          <AccordionTrigger className="text-xs font-medium text-muted-foreground py-2 hover:no-underline">
            Федеральный округ ({filters.federalDistricts.length})
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto thin-scroll">
              {allFederalDistricts.map(([fd, n]) => {
                const active = filters.federalDistricts.includes(fd);
                return (
                  <button key={fd} onClick={() => toggleFederalDistrict(fd)} className={'px-2 py-0.5 rounded-full text-[11px] border transition-colors '+ (active ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground")}>
                    {fd} ({n})
                  </button>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="period" className="border-0">
          <AccordionTrigger className="text-xs font-medium text-muted-foreground py-2 hover:no-underline">
            Период
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-1.5">
              <Input type="date" value={filters.dateFrom || ""} onChange={(e) => onChange({ ...filters, dateFrom: e.target.value || null })} className="h-8 text-xs" />
              <Input type="date" value={filters.dateTo || ""} onChange={(e) => onChange({ ...filters, dateTo: e.target.value || null })} className="h-8 text-xs" />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between">
          <Label htmlFor="risk-zones" className="text-xs cursor-pointer">
            Зоны риска 3/10/30 км
          </Label>
          <Switch
            id="risk-zones"
            checked={showRiskZones}
            onCheckedChange={onShowRiskZonesChange}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="choropleth" className="text-xs cursor-pointer">
            Хороплет (плотность)
          </Label>
          <Switch
            id="choropleth"
            checked={showChoropleth}
            onCheckedChange={onShowChoroplethChange}
          />
        </div>
        {onShowHeatmapChange && (
          <div className="flex items-center justify-between">
            <Label htmlFor="heatmap" className="text-xs cursor-pointer">
              Тепловая карта вспышек
            </Label>
            <Switch
              id="heatmap"
              checked={showHeatmap}
              onCheckedChange={onShowHeatmapChange}
            />
          </div>
        )}
      </div>

      {/* Reset */}
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={onReset}
        >
          Сбросить все фильтры ({activeCount})
        </Button>
      )}
    </Card>
  );
}
