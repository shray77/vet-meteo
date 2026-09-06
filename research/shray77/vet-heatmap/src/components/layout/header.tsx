import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Filter, Calculator, Github, Stethoscope, LocateFixed, Beaker, Radio,
  Truck, FileText, Upload, Factory, Play, MapPin, Zap, Bell, ChevronDown, ArrowLeftRight, Info
} from "lucide-react";
import { SearchBox } from "@/components/search-box";
import { UserRegionBadgeContainer } from "@/components/user-region";
import { ThemeToggle } from "@/components/theme-toggle";
import { FilterPanel } from "@/components/filter-panel";
import { StatsBar } from "@/components/stats-bar";
import { useTheme } from "next-themes";
import { DISEASE_PROFILES } from "@/data/disease-profiles";
import { diseaseColor } from "@/lib/colors";
import type { Outbreak, DiseaseKey } from "@/types/domain";
import type { FilterState } from "@/lib/filters";
import { useUIStore } from "@/lib/ui-store";

interface HeaderProps {
  outbreaks: Outbreak[];
  filtered: Outbreak[];
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  totalRegions: number;
  focusRegion: (r: string) => void;
  toggleDiseaseFilter: (k: DiseaseKey) => void;
  resetFilters: () => void;
  nightMode: boolean;
  setNightMode: (v: boolean) => void;
  showRiskZones: boolean;
  setShowRiskZones: (v: boolean) => void;
  showChoropleth: boolean;
  setShowChoropleth: (v: boolean) => void;
  showHeatmap: boolean;
  setShowHeatmap: (v: boolean) => void;
  densityLayer: "none" | "pigs" | "cattle" | "poultry";
}

export function Header({
  outbreaks, filtered, filters, setFilters, totalRegions, focusRegion, toggleDiseaseFilter, resetFilters,
  nightMode, setNightMode, showRiskZones, setShowRiskZones, showChoropleth, setShowChoropleth,
  showHeatmap, setShowHeatmap, densityLayer
}: HeaderProps) {
  const { theme } = useTheme();
  const {
    setDrawerDisease, setDrawerOpen, setNearbyOpen, setSirOpen, setSpatialOpen, setSourceTrackerOpen,
    setTransportOpen, setSpreadAnimOpen, setRegionCardOpen, setComparisonOpen, setEnterpriseRiskOpen,
    setPdfReportOpen, setCustomImportOpen, setAlertOpen, setAboutOpen, setCalcOpen, setCalcPreselect,
    mobileFiltersOpen, setMobileFiltersOpen
  } = useUIStore();

  const openCalculator = () => setCalcOpen(true);

  return (
    <header className="z-50 shrink-0 border-b bg-background/80 backdrop-blur-xl pt-safe">
      <div className="relative flex items-center gap-2 px-4 py-2 md:py-3">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background:conic-gradient(from_0deg,transparent,var(--primary),transparent)] [animation:spin_18s_linear_infinite] blur-2xl" />

        <div className="relative flex items-center gap-2 flex-1 min-w-0">
          <Stethoscope className="h-5 w-5 md:h-6 md:w-6 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm md:text-lg font-bold leading-tight tracking-tight truncate">
              <span className="text-primary">Вет</span>Карта
            </h1>
          </div>
          <div className="hidden md:block ml-3">
            <SearchBox
              outbreaks={outbreaks}
              onFocusRegion={focusRegion}
              onSelectDisease={(k) => { setDrawerDisease(k); setDrawerOpen(true); }}
              onToggleDiseaseFilter={toggleDiseaseFilter}
            />
          </div>
          <div className="hidden md:block ml-2">
            <UserRegionBadgeContainer
              outbreaks={outbreaks}
              onFilterByRegion={(r) => {
                setFilters((f) => ({ ...f, federalDistricts: [], query: "" }));
                focusRegion(r);
              }}
              onOpenSettings={() => {}}
            />
          </div>
        </div>

        <div className="relative hidden md:flex items-center gap-1 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setNearbyOpen(true)}>
            <LocateFixed className="h-4 w-4 mr-1" />Рядом
          </Button>
          <Button variant="outline" size="sm" onClick={() => openCalculator()}>
            <Calculator className="h-4 w-4 mr-1" />Карантин
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSirOpen(true)}>
            <Beaker className="h-4 w-4 mr-1" />SIR
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1">
                <Beaker className="h-4 w-4" />
                <span className="text-xs">Инструменты</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Аналитика</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSpatialOpen(true)}><Zap className="h-4 w-4 mr-2" /> Распространение</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSourceTrackerOpen(true)}><Radio className="h-4 w-4 mr-2" /> Источник вспышки</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTransportOpen(true)}><Truck className="h-4 w-4 mr-2" /> Транспорт</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSpreadAnimOpen(true)}><Play className="h-4 w-4 mr-2" /> Анимация</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Данные</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setRegionCardOpen(true)}><MapPin className="h-4 w-4 mr-2" /> Карточка региона</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setComparisonOpen(true)}><ArrowLeftRight className="h-4 w-4 mr-2" /> Сравнение регионов</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEnterpriseRiskOpen(true)}><Factory className="h-4 w-4 mr-2" /> Предприятия</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPdfReportOpen(true)}><FileText className="h-4 w-4 mr-2" /> Отчёт PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCustomImportOpen(true)}><Upload className="h-4 w-4 mr-2" /> Импорт данных</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAlertOpen(true)}><Bell className="h-4 w-4 mr-2" /> Уведомления</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setAboutOpen(true)}><Info className="h-4 w-4 mr-2" /> О проекте</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" asChild aria-label="GitHub">
            <a href="https://github.com/shray77/vet-heatmap" target="_blank" rel="noopener">
              <Github className="h-4 w-4" />
            </a>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setNightMode(!nightMode)} title="Ночной режим">
            {nightMode ? "☀️" : "🌙"}
          </Button>
          <ThemeToggle />
        </div>

        <div className="relative flex md:hidden items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1">
                <Beaker className="h-4 w-4" />
                <span className="text-xs">Инстр.</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setSirOpen(true)}>SIR модель</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPdfReportOpen(true)}>Отчёт PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAboutOpen(true)}>О проекте</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle />
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto thin-scroll pb-safe">
              <div className="p-4">
                <h2 className="text-base font-semibold mb-3">Фильтры</h2>
                <FilterPanel
                  outbreaks={outbreaks} filters={filters} onChange={setFilters} onReset={resetFilters}
                  showRiskZones={showRiskZones} onShowRiskZonesChange={setShowRiskZones}
                  showChoropleth={showChoropleth} onShowChoroplethChange={setShowChoropleth}
                  densityLayer={densityLayer} showHeatmap={showHeatmap} onShowHeatmapChange={setShowHeatmap}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="relative hidden md:flex items-center gap-3 overflow-hidden px-4 pb-2">
        <StatsBar outbreaks={filtered} totalRegions={totalRegions} />
        <div className="flex gap-1 overflow-x-auto thin-scroll ml-auto">
          <Button
            variant={filters.diseases.length === 0 ? "default" : "outline"}
            size="sm" className="h-7 text-[11px] shrink-0 px-2"
            onClick={resetFilters}
          >Все</Button>
          {DISEASE_PROFILES.slice(0, 10).map((p) => {
            const isActive = filters.diseases.includes(p.disease_key);
            const isSolo = filters.diseases.length === 1 && isActive;
            const color = diseaseColor(p.disease_key, p.group);
            return (
              <button
                key={p.disease_key}
                onClick={() => setFilters({
                  ...filters,
                  diseases: isActive ? filters.diseases.filter((x) => x !== p.disease_key) : [...filters.diseases, p.disease_key],
                })}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  setFilters({ ...filters, diseases: isSolo ? [] : [p.disease_key] });
                }}
                title={p.name_ru}
                className="h-7 px-2 rounded-md text-[11px] shrink-0 border transition-all flex items-center gap-1"
                style={{
                  backgroundColor: isActive ? color : "transparent", borderColor: isActive ? color : "var(--border)",
                  color: isActive ? "#fff" : "var(--foreground)", outline: isSolo ? `2px solid ${color}` : "none", outlineOffset: -1,
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color, opacity: isActive ? 0.7 : 1 }} />
                {p.short_ru}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
