"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Download, AlertTriangle } from "lucide-react";
import type { DiseaseKey } from "@/types/domain";
import { DISEASE_PROFILES } from "@/data/disease-profiles";

interface QuarantineCalculatorProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preselectDisease?: DiseaseKey | null;
}

interface Milestone {
  dayOffset: number;
  date: string;
  label: string;
  description: string;
  severity: "info" | "warning" | "critical";
}

export function QuarantineCalculator({
  open,
  onOpenChange,
  preselectDisease,
}: QuarantineCalculatorProps) {
  const [disease, setDisease] = useState<DiseaseKey | null>(preselectDisease ?? null);
  const [dateStr, setDateStr] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  // Use the preselected disease if provided, otherwise the user-selected one.
  // Derived value (not state) to avoid setState-in-effect lint.
  const effectiveDisease = preselectDisease ?? disease;
  const profile = effectiveDisease ? DISEASE_PROFILES.find((p) => p.disease_key === effectiveDisease) : null;

  const milestones: Milestone[] = useMemo(() => {
    if (!profile || !dateStr) return [];
    const base = new Date(dateStr);
    if (Number.isNaN(base.getTime())) return [];

    const addDays = (d: Date, days: number) => {
      const r = new Date(d);
      r.setDate(r.getDate() + days);
      return r;
    };

    const fmt = (d: Date) =>
      d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

    const ms: Milestone[] = [
      {
        dayOffset: 0,
        date: fmt(base),
        label: "День 0 — Обнаружение",
        description: "Сообщить в территориальное управление Россельхознадзора. Изоляция очага. Запрет перемещения.",
        severity: "critical",
      },
      {
        dayOffset: profile.incubation_min,
        date: fmt(addDays(base, profile.incubation_min)),
        label: `День ${profile.incubation_min} — Начало окна инкубации`,
        description: `Минимальный инкубационный период (${profile.incubation_min} дн). Начать клинический осмотр восприимчивых животных в зоне защиты (${profile.protection_zone_km} км).`,
        severity: "warning",
      },
      {
        dayOffset: profile.incubation_max,
        date: fmt(addDays(base, profile.incubation_max)),
        label: `День ${profile.incubation_max} — Конец окна инкубации`,
        description: `Максимальный инкубационный период (${profile.incubation_max} дн). Если новых случаев нет — эпизоотия пошла на спад.`,
        severity: "info",
      },
      {
        dayOffset: 7,
        date: fmt(addDays(base, 7)),
        label: "День 7 — Эпизоотологическое расследование",
        description: "Завершить первичное эпизоотологическое расследование. Установить источник и пути заноса.",
        severity: "warning",
      },
      {
        dayOffset: profile.restriction_days,
        date: fmt(addDays(base, profile.restriction_days)),
        label: `День ${profile.restriction_days} — Минимальный срок ограничений`,
        description: `Минимальный срок действия ограничений (${profile.restriction_days} дн). Если новых случаев нет — снимается карантин (по результатам заключительной дезинфекции).`,
        severity: "info",
      },
      {
        dayOffset: profile.observation_days,
        date: fmt(addDays(base, profile.observation_days)),
        label: `День ${profile.observation_days} — Конец наблюдения`,
        description: `Период наблюдения (${profile.observation_days} дн) завершён. Можно восстановить благополучие территории.`,
        severity: "info",
      },
    ];

    // Sort by day ascending
    return ms.sort((a, b) => a.dayOffset - b.dayOffset);
  }, [profile, dateStr]);

  const exportText = () => {
    if (!profile) return;
    const lines = [
      `Карантинный протокол: ${profile.name_ru}`,
      `Дата обнаружения: ${dateStr}`,
      ``,
      `WOAH: ${profile.woah_reference}`,
      ...profile.rf_regulatory.map((r) => `НПА: ${r}`),
      ``,
      `Ключевые даты:`,
      ...milestones.map((m) => `${m.label}: ${m.date}\n  ${m.description}`),
      ``,
      `Сгенерировано: ${new Date().toLocaleString("ru-RU")}`,
      `ВетКарта — https://shray77.github.io/vet-heatmap/`,
    ].join("\n");

    const blob = new Blob([lines], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `karantin-${profile.short_ru}-${dateStr}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto thin-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Калькулятор карантина
          </DialogTitle>
          <DialogDescription>
            Расчёт ключевых дат и протоколов по WOAH и НПА РФ
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qc-disease" className="text-xs">Болезнь</Label>
            <Select
              value={effectiveDisease ?? ""}
              onValueChange={(v) => setDisease(v as DiseaseKey)}
            >
              <SelectTrigger id="qc-disease" className="h-9">
                <SelectValue placeholder="Выберите болезнь" />
              </SelectTrigger>
              <SelectContent>
                {DISEASE_PROFILES.map((p) => (
                  <SelectItem key={p.disease_key} value={p.disease_key}>
                    {p.short_ru} — {p.name_ru}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-date" className="text-xs">Дата обнаружения</Label>
            <Input
              id="qc-date"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        {profile && (
          <>
            <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-xs">
                Расчёт ориентировочный. Точные сроки определяются ветеринарным
                законодательством РФ и предписанием территориального управления
                Россельхознадзора.
              </p>
            </div>

            <Card className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  Протокол для: {profile.name_ru}
                </h4>
                <Button size="sm" variant="outline" onClick={exportText} className="h-7 text-xs">
                  <Download className="h-3 w-3 mr-1" />
                  Экспорт
                </Button>
              </div>
              <div className="space-y-2 mt-2">
                {milestones.map((m, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 p-2 rounded-md border-l-2 ${
                      m.severity === "critical"
                        ? "bg-destructive/10 border-destructive"
                        : m.severity === "warning"
                          ? "bg-amber-500/10 border-amber-500"
                          : "bg-primary/5 border-primary"
                    }`}
                  >
                    <div className="text-xs font-mono font-bold w-20 shrink-0 pt-0.5">
                      {m.date}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold">{m.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        {m.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1">
              <div>
                Зона защиты: {profile.protection_zone_km} км · Зона наблюдения: {profile.surveillance_zone_km} км ·
                Зона ограничения: {profile.restriction_zone_km} км
              </div>
              <div>WOAH: {profile.woah_reference}</div>
              <div>НПА РФ: {profile.rf_regulatory.length} документа</div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
