"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Printer, FileBarChart, Calendar, MapPin } from "lucide-react";
import type { Outbreak, DiseaseKey } from "@/types/domain";
import { DISEASE_PROFILES } from "@/data/disease-profiles";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { diseaseColor } from "@/lib/colors";
import type { FilterState } from "@/lib/filters";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  outbreaks: Outbreak[];
  /** Current filter state — for multi-outbreak report context. */
  filters?: FilterState;
}

/**
 * PDF report export — two modes:
 *
 * 1. Single outbreak: ГОСТ-style "Экстренное извещение" (existing)
 * 2. Multi-outbreak: Monthly/regional summary with table, charts,
 *    totals — printable via browser's print-to-PDF.
 *
 * The multi-outbreak report is what regional vets write for their
 * monthly сводка (форма 4-вет). It includes:
 *   - Summary stats (total/active/resolved, cases, deaths)
 *   - Disease breakdown table
 *   - Regional breakdown table
 *   - Timeline of outbreaks (chronological)
 *   - Filter context (what was selected)
 */
export function PdfReportExport({ open, onOpenChange, outbreaks, filters }: Props) {
  const [mode, setMode] = useState<"single" | "multi">("single");
  const [selectedOutbreakId, setSelectedOutbreakId] = useState<string>("");
  const [reportDisease, setReportDisease] = useState<string>("all");

  // ─── Single outbreak report (existing logic) ────────────────────────
  const report = useMemo(() => {
    if (!selectedOutbreakId) return null;
    const o = outbreaks.find((x) => x.id === parseInt(selectedOutbreakId));
    if (!o) return null;
    const profile = DISEASE_PROFILES.find((p) => p.disease_key === o.disease_key);
    const detectionDate = new Date(o.date);
    const quarantineEnd = new Date(detectionDate);
    quarantineEnd.setDate(detectionDate.getDate() + (profile?.observation_days || 40));
    return { outbreak: o, profile, detectionDate, quarantineEnd };
  }, [selectedOutbreakId, outbreaks]);

  // ─── Multi-outbreak report data ─────────────────────────────────────
  const multiData = useMemo(() => {
    const filtered = reportDisease === "all"
      ? outbreaks
      : outbreaks.filter((o) => o.disease_key === reportDisease);

    const total = filtered.length;
    const ongoing = filtered.filter((o) => o.status === "Ongoing").length;
    const resolved = filtered.filter((o) => o.status === "Resolved").length;
    const totalCases = filtered.reduce((s, o) => s + (o.cases || 0), 0);
    const totalDeaths = filtered.reduce((s, o) => s + (o.deaths || 0), 0);

    // By disease
    const byDisease = new Map<string, { count: number; cases: number; deaths: number }>();
    for (const o of filtered) {
      const e = byDisease.get(o.disease_key) ?? { count: 0, cases: 0, deaths: 0 };
      e.count++;
      e.cases += o.cases || 0;
      e.deaths += o.deaths || 0;
      byDisease.set(o.disease_key, e);
    }

    // By region
    const byRegion = new Map<string, { count: number; cases: number; deaths: number; ongoing: number }>();
    for (const o of filtered) {
      const r = o.region_geo || o.region;
      const e = byRegion.get(r) ?? { count: 0, cases: 0, deaths: 0, ongoing: 0 };
      e.count++;
      e.cases += o.cases || 0;
      e.deaths += o.deaths || 0;
      if (o.status === "Ongoing") e.ongoing++;
      byRegion.set(r, e);
    }

    // Chronological (latest first)
    const chronological = [...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);

    return { filtered, total, ongoing, resolved, totalCases, totalDeaths, byDisease, byRegion, chronological };
  }, [outbreaks, reportDisease]);

  // ─── Single outbreak print handler (existing) ───────────────────────
  const handlePrintSingle = () => {
    if (!report) return;
    const o = report.outbreak;
    const p = report.profile;
    const w = window.open("", "_blank");
    if (!w) return;

    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>Экстренное извещение №${o.id} — ${o.disease}</title>
<style>@page{size:A4;margin:2cm}body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5;color:#000}h1{font-size:13pt;text-align:center;text-transform:uppercase;margin:10px 0 5px 0;letter-spacing:0.5px}h2{font-size:11pt;border-bottom:1.5px solid #000;padding-bottom:2px;margin-top:18px;text-transform:uppercase}.agency-header{text-align:center;font-size:10pt;font-weight:bold;text-transform:uppercase;border-bottom:3px double #000;padding-bottom:8px;margin-bottom:15px}.stamp{border:2px solid #000;padding:12px;text-align:center;margin:15px 0;background:#fafafa}.stamp h1{margin:0}table{width:100%;border-collapse:collapse;margin:10px 0}td{padding:5px 8px;border:1px solid #777;vertical-align:top}td:first-child{background:#f0f0f0;font-weight:bold;width:38%}ul{margin:5px 0;padding-left:20px}.footer{margin-top:35px;border-top:1px solid #000;padding-top:8px;font-size:9pt;color:#444}.sign{margin-top:30px;display:flex;justify-content:space-between;align-items:flex-end}.sign-line{border-bottom:1px solid #000;width:180px;height:25px;display:inline-block}</style>
</head><body>
<div class="agency-header">МИНИСТЕРСТВО СЕЛЬСКОГО ХОЗЯЙСТВА РОССИЙСКОЙ ФЕДЕРАЦИИ<br>ФЕДЕРАЛЬНАЯ СЛУЖБА ПО ВЕТЕРИНАРНОМУ И ФИТОСАНИТАРНОМУ НАДЗОРУ</div>
<div class="stamp"><h1>ЭКСТРЕННОЕ ИЗВЕЩЕНИЕ № ${o.id}</h1><p style="margin:4px 0 0 0;font-size:11pt">о выявлении чрезвычайной эпизоотической ситуации</p><p style="margin:2px 0 0 0;font-size:10pt;color:#555">Дата составления: ${new Date().toLocaleDateString("ru-RU")}</p></div>
<h2>I. Общие сведения об очаге</h2><table>
<tr><td>Наименование болезни</td><td><strong>${o.disease}</strong></td></tr>
<tr><td>Субъект РФ / Регион</td><td>${o.region}</td></tr>
<tr><td>Дата выявления</td><td>${o.date}</td></tr>
<tr><td>Эпизоотический статус</td><td><strong>${o.status === "Ongoing" ? "🔴 ОЧАГ АКТИВЕН (Карантин)" : "🟢 ЛИКВИДИРОВАН"}</strong></td></tr>
<tr><td>Восприимчивое поголовье</td><td>${o.species}</td></tr>
<tr><td>Количество заболевших голов</td><td><strong>${o.cases || "—"}</strong></td></tr>
<tr><td>Количество павших голов</td><td><strong style="color:#c62828">${o.deaths || "—"}</strong></td></tr>
<tr><td>Первичный источник информации</td><td>${o.source.toUpperCase()}</td></tr>
</table>
${p ? `<h2>II. Противоэпизоотический профиль</h2><table>
<tr><td>Инкубационный период</td><td>${p.incubation_min}–${p.incubation_max} сут.</td></tr>
<tr><td>Индекс репродукции (R₀)</td><td>${p.r0_min}–${p.r0_max}</td></tr>
<tr><td>Опасность для человека (зооноз)</td><td><strong>${p.zoonotic ? "⚠️ ДА (Опасное заболевание)" : "Нет"}</strong></td></tr>
<tr><td>Установленная зона защиты</td><td>${p.protection_zone_km} км</td></tr>
<tr><td>Установленная зона наблюдения</td><td>${p.surveillance_zone_km} км</td></tr>
</table>
<h2>III. Предписанные мерам ликвидации</h2><p style="text-align:justify;background:#f9f9f9;padding:8px;border:1px solid #ddd;">${p.measures_summary}</p>
<h2>IV. Нормативно-правовая база</h2><ul>${p.rf_regulatory.map(r => `<li>${r}</li>`).join("")}</ul>
<p style="font-size:9pt;color:#666">Международный стандарт WOAH: ${p.woah_reference}</p>` : ""}
<div class="footer"><p>Документ сгенерирован автоматически государственной ветеринарной информационной системой «ВетКарта» (${new Date().toLocaleString("ru-RU")}).</p></div>
<div class="sign"><div><p>Главный ветврач района: ____________________ / <span className="sign-line"></span> /</p></div><div><p style="border:2px dashed #999;padding:10px 15px;text-align:center;font-size:9pt">М.П.<br>ЭПИЗООТИЧЕСКАЯ<br>СЛУЖБА</p></div></div>
</body></html>`;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  // ─── Multi-outbreak print handler ───────────────────────────────────
  const handlePrintMulti = () => {
    const d = multiData;
    const w = window.open("", "_blank");
    if (!w) return;

    const diseaseRows = Array.from(d.byDisease.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([key, v]) => {
        const labels = DISEASE_LABELS[key as DiseaseKey];
        return `<tr><td>${labels?.ru ?? key}</td><td style="text-align:center">${v.count}</td><td style="text-align:center">${v.cases}</td><td style="text-align:center">${v.deaths}</td></tr>`;
      }).join("");

    const regionRows = Array.from(d.byRegion.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([region, v]) => {
        return `<tr><td>${region}</td><td style="text-align:center">${v.count}</td><td style="text-align:center">${v.ongoing}</td><td style="text-align:center">${v.cases}</td><td style="text-align:center">${v.deaths}</td></tr>`;
      }).join("");

    const timelineRows = d.chronological.map(o => {
      const labels = DISEASE_LABELS[o.disease_key as DiseaseKey];
      return `<tr><td>${o.date}</td><td>${labels?.short_ru ?? o.disease_key}</td><td>${o.region}</td><td style="text-align:center">${o.cases || "—"}</td><td style="text-align:center">${o.deaths || "—"}</td><td>${o.status === "Ongoing" ? "Активна" : "Заверш."}</td></tr>`;
    }).join("");

    const dateRange = filters?.dateFrom && filters?.dateTo
      ? `${filters.dateFrom} — ${filters.dateTo}`
      : filters?.dateFrom
        ? `с ${filters.dateFrom}`
        : "за весь период";

    const diseaseFilter = reportDisease !== "all"
      ? DISEASE_LABELS[reportDisease as DiseaseKey]?.ru ?? reportDisease
      : "все болезни";

    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>Сводка эпизоотической обстановки — ${new Date().toLocaleDateString("ru-RU")}</title>
<style>@page{size:A4;margin:1.5cm}body{font-family:'Times New Roman',serif;font-size:11pt;line-height:1.4;color:#000}h1{font-size:14pt;text-align:center;margin-bottom:5px}h2{font-size:12pt;border-bottom:2px solid #000;padding-bottom:3px;margin-top:25px}.subtitle{text-align:center;font-size:10pt;color:#555;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin:10px 0;font-size:10pt}th{background:#e0e0e0;padding:5px 8px;border:1px solid #999;text-align:left;font-weight:bold}td{padding:4px 8px;border:1px solid #ccc}.summary{display:flex;justify-content:space-around;margin:15px 0;padding:15px;background:#f8f8f8;border:1px solid #ddd}.summary-item{text-align:center}.summary-value{font-size:20pt;font-weight:bold;color:#1a472a}.summary-label{font-size:9pt;color:#555}.footer{margin-top:30px;border-top:1px solid #000;padding-top:10px;font-size:9pt;color:#666;text-align:center}</style>
</head><body>
<h1>СВОДКА ЭПИЗООТИЧЕСКОЙ ОБСТАНОВКИ</h1>
<p class="subtitle">Период: ${dateRange} · Фильтр: ${diseaseFilter}<br>Сформировано: ${new Date().toLocaleString("ru-RU")} · Источники: ФСВП, WAHIS</p>

<div class="summary">
<div class="summary-item"><div class="summary-value">${d.total}</div><div class="summary-label">всего вспышек</div></div>
<div class="summary-item"><div class="summary-value" style="color:#c62828">${d.ongoing}</div><div class="summary-label">активных</div></div>
<div class="summary-item"><div class="summary-value">${d.resolved}</div><div class="summary-label">ликвидировано</div></div>
<div class="summary-item"><div class="summary-value">${d.totalCases}</div><div class="summary-label">случаев</div></div>
<div class="summary-item"><div class="summary-value">${d.totalDeaths}</div><div class="summary-label">пало</div></div>
</div>

<h2>1. Распределение по болезням</h2>
<table>
<tr><th>Болезнь</th><th style="text-align:center">Вспышек</th><th style="text-align:center">Случаев</th><th style="text-align:center">Пало</th></tr>
${diseaseRows}
</table>

<h2>2. Распределение по регионам (топ-20)</h2>
<table>
<tr><th>Регион</th><th style="text-align:center">Всего</th><th style="text-align:center">Активных</th><th style="text-align:center">Случаев</th><th style="text-align:center">Пало</th></tr>
${regionRows}
</table>

<h2>3. Хронология вспышек (последние ${d.chronological.length})</h2>
<table>
<tr><th>Дата</th><th>Болезнь</th><th>Регион</th><th style="text-align:center">Случ.</th><th style="text-align:center">Пало</th><th>Статус</th></tr>
${timelineRows}
</table>

<div class="footer">
<p>Документ сформирован системой ВетКарта (https://shray77.github.io/vet-heatmap)</p>
<p>Источники данных: ФСВП России (fsvps.gov.ru), WOAH WAHIS (wahis.woah.org)</p>
</div>
</body></html>`;

    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Отчёты для печати
          </DialogTitle>
          <DialogDescription>
            Выберите тип отчёта — экстренное извещение по одной вспышке
            или сводную справку по всем вспышкам.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "multi")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="text-xs gap-1">
              <FileText className="h-3.5 w-3.5" /> Извещение
            </TabsTrigger>
            <TabsTrigger value="multi" className="text-xs gap-1">
              <FileBarChart className="h-3.5 w-3.5" /> Сводка
            </TabsTrigger>
          </TabsList>

          {/* ─── Single outbreak tab ─────────────────────────────────── */}
          <TabsContent value="single" className="space-y-4 mt-2">
            <Select value={selectedOutbreakId} onValueChange={setSelectedOutbreakId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите вспышку" />
              </SelectTrigger>
              <SelectContent>
                {outbreaks.slice(0, 100).map((o) => (
                  <SelectItem key={o.id} value={o.id.toString()}>
                    {o.disease} — {o.region} ({o.date})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {report && (
              <Card className="p-4 space-y-3">
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Болезнь:</span>
                    <span className="font-medium">{report.outbreak.disease}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Регион:</span>
                    <span className="font-medium">{report.outbreak.region}</span>
                  </div>
                  {report.profile && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Карантин до:</span>
                        <span className="font-medium">
                          {report.quarantineEnd.toLocaleDateString("ru-RU")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Зона:</span>
                        <span className="font-medium">{report.profile.restriction_zone_km} км</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">Разделы I–IV</Badge>
                  {report.profile?.zoonotic && <Badge variant="destructive">Зооноз</Badge>}
                </div>
              </Card>
            )}

            <Button className="w-full" disabled={!report} onClick={handlePrintSingle}>
              <Printer className="h-4 w-4 mr-2" />
              Сгенерировать извещение
            </Button>
          </TabsContent>

          {/* ─── Multi-outbreak tab ──────────────────────────────────── */}
          <TabsContent value="multi" className="space-y-4 mt-2">
            {/* Disease filter for report */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <FileBarChart className="h-3 w-3" /> Болезнь для сводки:
              </label>
              <Select value={reportDisease} onValueChange={setReportDisease}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все болезни</SelectItem>
                  {Array.from(multiData.byDisease.keys()).map((dk) => {
                    const labels = DISEASE_LABELS[dk as DiseaseKey];
                    return (
                      <SelectItem key={dk} value={dk}>
                        {labels?.short_ru ?? dk} ({multiData.byDisease.get(dk)?.count})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Summary preview */}
            <Card className="p-4 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xl font-bold tabular-nums">{multiData.total}</div>
                  <div className="text-[9px] text-muted-foreground">вспышек</div>
                </div>
                <div>
                  <div className="text-xl font-bold tabular-nums text-destructive">{multiData.ongoing}</div>
                  <div className="text-[9px] text-muted-foreground">активных</div>
                </div>
                <div>
                  <div className="text-xl font-bold tabular-nums">{multiData.totalCases}</div>
                  <div className="text-[9px] text-muted-foreground">случаев</div>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-2 pt-1 border-t">
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" />
                  {multiData.byRegion.size} регионов
                </span>
                <span className="flex items-center gap-0.5">
                  <Calendar className="h-2.5 w-2.5" />
                  {filters?.dateFrom ?? "всё время"}
                </span>
              </div>
            </Card>

            {/* Disease breakdown preview */}
            <div className="text-xs">
              <div className="text-muted-foreground mb-1">По болезням:</div>
              <div className="flex flex-wrap gap-1">
                {Array.from(multiData.byDisease.entries())
                  .sort((a, b) => b[1].count - a[1].count)
                  .slice(0, 6)
                  .map(([dk, v]) => {
                    const labels = DISEASE_LABELS[dk as DiseaseKey];
                    const color = diseaseColor(dk as DiseaseKey, labels?.group ?? "Multi-species");
                    return (
                      <Badge key={dk} variant="outline" className="text-[9px]" style={{ borderColor: color + "55" }}>
                        <span className="w-1.5 h-1.5 rounded-full mr-1" style={{ backgroundColor: color }} />
                        {labels?.short_ru ?? dk}: {v.count}
                      </Badge>
                    );
                  })}
              </div>
            </div>

            <Button className="w-full" disabled={multiData.total === 0} onClick={handlePrintMulti}>
              <Printer className="h-4 w-4 mr-2" />
              Сгенерировать сводку ({multiData.total} вспышек)
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
