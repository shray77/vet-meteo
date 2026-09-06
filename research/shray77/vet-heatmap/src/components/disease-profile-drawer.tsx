"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  HeartPulse,
  Clock,
  Ruler,
  Syringe,
  ShieldAlert,
  Microscope,
  Bug,
  BookOpen,
  FileText,
  Route,
} from "lucide-react";
import type { DiseaseKey } from "@/types/domain";
import { DISEASE_PROFILES_BY_KEY } from "@/data/disease-profiles";
import { diseaseColor } from "@/lib/colors";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { speciesRu, groupRu } from "@/lib/i18n-species";

interface DiseaseProfileDrawerProps {
  disease: DiseaseKey | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DiseaseProfileDrawer({
  disease,
  open,
  onOpenChange,
}: DiseaseProfileDrawerProps) {
  if (!disease) return null;
  const profile = DISEASE_PROFILES_BY_KEY[disease];
  const labels = DISEASE_LABELS[disease];
  if (!labels) return null;
  const color = diseaseColor(disease, labels.group);

  // Fallback for diseases without a full profile (aliases exist, but no
  // clinical data filled in yet). Show a minimal card instead of closing
  // the drawer silently.
  if (!profile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md md:max-w-lg overflow-y-auto thin-scroll pb-safe"
        >
          <SheetHeader className="space-y-2 pb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <SheetTitle className="text-lg">{labels.ru}</SheetTitle>
            </div>
            <SheetDescription className="text-xs">
              {labels.short_ru} · {groupRu(labels.group)}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[10px]">
                {groupRu(labels.group)}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                <BookOpen className="h-3 w-3 mr-1" />
                EN: {labels.en}
              </Badge>
            </div>

            <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-4 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <div className="font-medium text-foreground">
                    Полный профиль не заполнен
                  </div>
                  <div>
                    Болезнь распознаётся скрепером и отображается в фильтрах
                    и на карте, но детальные данные (инкубационный период,
                    R₀, зоны карантина, клинические признаки) пока не
                    внесены.
                  </div>
                  <div className="mt-2">
                    Источник перечня: Приказ Минсельхоза РФ №62 от
                    09.03.2011 «Об утверждении Перечня заразных и иных
                    болезней животных».
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg overflow-y-auto thin-scroll pb-safe"
      >
        <SheetHeader className="space-y-2 pb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <SheetTitle className="text-lg">{profile.name_ru}</SheetTitle>
          </div>
          <SheetDescription className="text-xs">
            {profile.short_ru} · {groupRu(profile.group)}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            {profile.zoonotic && (
              <Badge variant="destructive" className="text-[10px]">
                <ShieldAlert className="h-3 w-3 mr-1" />
                Зооноз
              </Badge>
            )}
            <Badge variant={profile.vaccine_available ? "default" : "secondary"} className="text-[10px]">
              <Syringe className="h-3 w-3 mr-1" />
              {profile.vaccine_available ? "Вакцина есть" : "Без вакцины"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {groupRu(profile.group)}
            </Badge>
          </div>

          {/* Key parameters */}
          <div className="grid grid-cols-2 gap-2">
            <Metric
              icon={Clock}
              label="Инкубационный"
              value={`${profile.incubation_min}-${profile.incubation_max} дн`}
            />
            <Metric
              icon={Bug}
              label="R₀"
              value={`${profile.r0_min}-${profile.r0_max}`}
            />
            <Metric
              icon={Ruler}
              label="Зона защиты"
              value={`${profile.protection_zone_km} км`}
            />
            <Metric
              icon={Ruler}
              label="Зона наблюдения"
              value={`${profile.surveillance_zone_km} км`}
            />
            <Metric
              icon={Clock}
              label="Наблюдение"
              value={`${profile.observation_days} дн`}
            />
            <Metric
              icon={Clock}
              label="Ограничения"
              value={`${profile.restriction_days} дн`}
            />
          </div>

          <Separator />

          {/* Transmission */}
          <Section icon={Route} title="Пути передачи">
            <ul className="space-y-1">
              {profile.transmission_routes.map((r, i) => (
                <li key={i} className="text-xs flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </Section>

          {/* Susceptible species */}
          <Section icon={HeartPulse} title="Восприимчивые виды">
            <div className="flex flex-wrap gap-1.5">
              {profile.susceptible_species.map((s) => (
                <Badge key={s} variant="outline" className="text-[11px]">
                  {speciesRu(s)}
                </Badge>
              ))}
            </div>
          </Section>

          {/* Clinical signs */}
          <Section icon={Microscope} title="Клинические признаки">
            <ul className="space-y-1">
              {profile.clinical_signs.map((s, i) => (
                <li key={i} className="text-xs flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </Section>

          {/* Measures */}
          <Section icon={ShieldAlert} title="Меры борьбы">
            <p className="text-xs leading-relaxed">{profile.measures_summary}</p>
          </Section>

          {/* References */}
          <Section icon={BookOpen} title="Нормативная база">
            <div className="space-y-1">
              <Badge variant="secondary" className="text-[10px]">
                {profile.woah_reference}
              </Badge>
              <ul className="space-y-1 mt-2">
                {profile.rf_regulatory.map((r, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                    <FileText className="h-3 w-3 shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-muted/40 rounded-md p-2 flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground truncate">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {title}
      </h4>
      <div className="pl-5">{children}</div>
    </div>
  );
}
