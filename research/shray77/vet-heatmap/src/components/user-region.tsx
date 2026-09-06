"use client";

import { useState } from "react";
import { MapPin, X, AlertTriangle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REGION_PROPERTIES, ALL_REGION_NAMES } from "@/data/regions";
import type { Outbreak } from "@/types/domain";

const STORAGE_KEY = "vet:user_region";

/**
 * "My Region" persistent mode.
 *
 * On first visit: shows a setup prompt. Once the user selects their region:
 *   - Persists to localStorage
 *   - Shows a badge in the header with their region + count of active outbreaks
 *   - Clicking the badge filters the dashboard to that region
 *
 * Russian field vets are regionally assigned (областная СББЖ) — they only
 * care about outbreaks in their region. This turns ВетКарта from "interesting
 * map" into the app they open every morning.
 */

export function getUserRegion(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setUserRegion(region: string | null) {
  if (typeof window === "undefined") return;
  if (region) {
    localStorage.setItem(STORAGE_KEY, region);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

interface UserRegionBadgeProps {
  outbreaks: Outbreak[];
  onFilterByRegion: (region: string) => void;
  onOpenSettings: () => void;
}

// Proper component with state
export function UserRegionBadgeContainer(props: UserRegionBadgeProps) {
  // Lazy initializer — reads localStorage once on mount, avoids
  // setState-in-effect lint rule.
  const [region, setRegion] = useState<string | null>(() => getUserRegion());
  const [showSetup, setShowSetup] = useState(false);

  return (
    <UserRegionBadgeInner
      {...props}
      region={region}
      showSetup={showSetup}
      setShowSetup={setShowSetup}
      onRegionChange={setRegion}
    />
  );
}

function UserRegionBadgeInner({
  outbreaks,
  onFilterByRegion,
  onOpenSettings: _onOpenSettings,
  region,
  showSetup,
  setShowSetup,
  onRegionChange,
}: UserRegionBadgeProps & {
  region: string | null;
  showSetup: boolean;
  setShowSetup: (v: boolean) => void;
  onRegionChange: (r: string | null) => void;
}) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentActive = outbreaks.filter(
    (o) =>
      o.region_geo === region &&
      o.status === "Ongoing" &&
      new Date(o.date) >= sevenDaysAgo,
  ).length;

  const totalActive = outbreaks.filter(
    (o) => o.region_geo === region && o.status === "Ongoing",
  ).length;

  if (!region) {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSetup(true)}
          className="h-8 gap-1 text-xs text-muted-foreground"
          title="Выберите ваш регион работы"
        >
          <MapPin className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Мой регион</span>
        </Button>
        {showSetup && (
          <RegionSetupDialog
            onSelect={(r) => {
              setUserRegion(r);
              onRegionChange(r);
              setShowSetup(false);
            }}
            onClose={() => setShowSetup(false)}
          />
        )}
      </>
    );
  }

  const regionName = REGION_PROPERTIES[region]?.name_ru ?? region;

  return (
    <>
      <button
        onClick={() => onFilterByRegion(region)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors text-xs shrink-0"
        title={`Фильтр по региону: ${regionName}. Активных: ${totalActive}, новых за 7 дней: ${recentActive}`}
      >
        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="font-medium text-foreground max-w-[120px] truncate">
          {regionName}
        </span>
        {recentActive > 0 ? (
          <Badge variant="destructive" className="text-[9px] h-4 px-1 animate-pulse shrink-0">
            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
            {recentActive}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">
            {totalActive}
          </Badge>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowSetup(true);
          }}
          className="ml-0.5 opacity-50 hover:opacity-100 shrink-0"
          title="Изменить регион"
        >
          <Settings2 className="h-3 w-3" />
        </button>
      </button>
      {showSetup && (
        <RegionSetupDialog
          currentRegion={region}
          onSelect={(r) => {
            setUserRegion(r);
            onRegionChange(r);
            setShowSetup(false);
          }}
          onClear={() => {
            setUserRegion(null);
            onRegionChange(null);
            setShowSetup(false);
          }}
          onClose={() => setShowSetup(false)}
        />
      )}
    </>
  );
}

/** Modal dialog for region selection. */
function RegionSetupDialog({
  currentRegion,
  onSelect,
  onClear,
  onClose,
}: {
  currentRegion?: string;
  onSelect: (region: string) => void;
  onClear?: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  // Sort regions by name_ru
  const sortedRegions = ALL_REGION_NAMES
    .map((name) => ({ name, props: REGION_PROPERTIES[name] }))
    .filter((r) => r.props)
    .sort((a, b) => (a.props.name_ru ?? a.name).localeCompare(b.props.name_ru ?? b.name));

  // Filter by search
  const filtered = sortedRegions.filter((r) => {
    const name = (r.props.name_ru ?? r.name).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-background border rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold">
              {currentRegion ? "Изменить регион" : "Выберите ваш регион работы"}
            </h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3 border-b">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск региона…"
            className="w-full px-3 py-2 text-sm border rounded-md bg-background"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto thin-scroll p-2">
          {filtered.map((r) => (
            <button
              key={r.name}
              onClick={() => onSelect(r.name)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors ${
                r.name === currentRegion ? "bg-primary/10 font-medium" : ""
              }`}
            >
              <div>{r.props.name_ru ?? r.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {r.props.federal_district} · {r.props.iso_code}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Регион не найден
            </div>
          )}
        </div>

        {currentRegion && onClear && (
          <div className="p-3 border-t">
            <Button variant="ghost" size="sm" onClick={onClear} className="w-full text-xs">
              Сбросить регион
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
