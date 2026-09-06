"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Search, MapPin, Bug, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Outbreak, DiseaseKey } from "@/types/domain";
import { REGION_PROPERTIES, REGION_MAP_REVERSE } from "@/data/regions";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { diseaseColor } from "@/lib/colors";

export interface SearchHit {
  kind: "region" | "disease";
  key: string;            // shapeName or disease_key
  label: string;          // RU display
  sublabel?: string;      // EN or hint
  count?: number;         // outbreak count
  color?: string;         // for disease
}

interface SearchBoxProps {
  outbreaks: Outbreak[];
  /** Focus the map on a region (shapeName). */
  onFocusRegion: (shapeName: string) => void;
  /** Open the disease profile drawer. */
  onSelectDisease: (key: DiseaseKey) => void;
  /** Apply a disease filter (toggle in filters). */
  onToggleDiseaseFilter: (key: DiseaseKey) => void;
  /** Compact mode (mobile). */
  compact?: boolean;
}

/**
 * Search box with autocomplete — finds regions + diseases as you type.
 *
 * Sources:
 *  - regions: REGIONS_PROPERTIES (85 entries) + REGION_MAP_REVERSE for RU→EN
 *  - diseases: DISEASE_LABELS (51 entries, see Приказ МСХ №62)
 *
 * Behavior:
 *  - 2+ chars triggers search
 *  - Shows region hits first (with active outbreak count), then diseases
 *  - Enter = pick first hit
 *  - Esc = close
 *  - Click outside = close
 */
export function SearchBox({
  outbreaks,
  onFocusRegion,
  onSelectDisease,
  onToggleDiseaseFilter,
  compact,
}: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Build counts: shapeName -> outbreak count, disease_key -> outbreak count
  const counts = useMemo(() => {
    const region = new Map<string, number>();
    const disease = new Map<DiseaseKey, number>();
    for (const o of outbreaks) {
      if (o.region_geo) region.set(o.region_geo, (region.get(o.region_geo) ?? 0) + 1);
      disease.set(o.disease_key, (disease.get(o.disease_key) ?? 0) + 1);
    }
    return { region, disease };
  }, [outbreaks]);

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    const out: SearchHit[] = [];

    // Regions — match against RU name, EN shapeName, and aliases in REGION_MAP_REVERSE
    for (const [shapeName, props] of Object.entries(REGION_PROPERTIES)) {
      const ru = props.name_ru.toLowerCase();
      const en = shapeName.toLowerCase();
      if (ru.includes(q) || en.includes(q)) {
        out.push({
          kind: "region",
          key: shapeName,
          label: props.name_ru,
          sublabel: shapeName,
          count: counts.region.get(shapeName) ?? 0,
        });
      }
    }
    // Region aliases (RU→EN map has many alt spellings like "г. Москва", "Чита", etc.)
    for (const [alias, shapeName] of Object.entries(REGION_MAP_REVERSE)) {
      if (counts.region.has(shapeName)) continue; // already added via main entry
      if (alias.toLowerCase().includes(q) && !out.some((h) => h.kind === "region" && h.key === shapeName)) {
        const props = REGION_PROPERTIES[shapeName];
        if (props) {
          out.push({
            kind: "region",
            key: shapeName,
            label: props.name_ru,
            sublabel: `${alias} → ${shapeName}`,
            count: counts.region.get(shapeName) ?? 0,
          });
        }
      }
    }

    // Diseases — match against RU, EN, short_ru
    for (const [key, labels] of Object.entries(DISEASE_LABELS) as [DiseaseKey, typeof DISEASE_LABELS[DiseaseKey]][]) {
      if (key === "other") continue;
      const ru = labels.ru.toLowerCase();
      const en = labels.en.toLowerCase();
      const short = labels.short_ru.toLowerCase();
      if (ru.includes(q) || en.includes(q) || short.includes(q)) {
        out.push({
          kind: "disease",
          key,
          label: labels.ru,
          sublabel: labels.en,
          count: counts.disease.get(key) ?? 0,
          color: diseaseColor(key, labels.group),
        });
      }
    }

    // Sort: regions first (by count desc), then diseases (by count desc), limit 12
    out.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "region" ? -1 : 1;
      return (b.count ?? 0) - (a.count ?? 0);
    });
    return out.slice(0, 12);
  }, [query, counts]);

  // Click-outside to close
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Expose focus method via ref-like callback (so parent / hotkey can focus)
  useEffect(() => {
    (window as unknown as { __focusVetSearch?: () => void }).__focusVetSearch = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
      setOpen(true);
    };
    return () => {
      delete (window as unknown as { __focusVetSearch?: () => void }).__focusVetSearch;
    };
  }, []);

  const pick = (hit: SearchHit) => {
    if (hit.kind === "region") {
      onFocusRegion(hit.key);
    } else {
      onSelectDisease(hit.key as DiseaseKey);
    }
    setQuery("");
    setActiveIdx(0);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hits[activeIdx]) pick(hits[activeIdx]);
    } else if (e.key === "Escape") {
      setQuery("");
      setActiveIdx(0);
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${compact ? "w-full" : "w-64 xl:w-72"}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Поиск: регион или болезнь…"
          className="h-8 pl-8 pr-7 text-xs"
          aria-label="Поиск"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setActiveIdx(0); inputRef.current?.focus(); }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Очистить"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && hits.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-lg">
          <ul className="max-h-80 overflow-y-auto thin-scroll py-1 text-xs">
            {hits.map((h, i) => (
              <li key={`${h.kind}-${h.key}`}>
                <button
                  onClick={() => pick(h)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left ${
                    i === activeIdx ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  {h.kind === "region" ? (
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: h.color }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{h.label}</div>
                    {h.sublabel && (
                      <div className="truncate text-[10px] text-muted-foreground">{h.sublabel}</div>
                    )}
                  </div>
                  {typeof h.count === "number" && h.count > 0 && (
                    <Badge variant="outline" className="shrink-0 text-[10px] h-4 px-1">
                      {h.count}
                    </Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {hits.some((h) => h.kind === "disease") && (
            <div className="border-t bg-muted/40 px-2.5 py-1 text-[10px] text-muted-foreground">
              <Bug className="mr-1 inline h-3 w-3" />
              клик по болезни откроет профиль (фильтр не меняется)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
