"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Clock, AlertCircle, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ResponseCheckItem, Outbreak } from "@/types/domain";

interface ResponseChecklistProps {
  /** Disease-specific checklist items. */
  items: ResponseCheckItem[];
  /** The outbreak this checklist is for — used to persist checkbox state
   * per outbreak (localStorage key: vet:checklist_<outbreakId>_<idx>). */
  outbreak: Outbreak;
}

const CATEGORY_LABELS: Record<string, string> = {
  notify: "Уведомление",
  quarantine: "Карантин",
  cull: "Уничтожение",
  surveillance: "Надзор",
  vaccination: "Вакцинация",
  disinfection: "Дезинфекция",
  documentation: "Документация",
  other: "Прочее",
};

const CATEGORY_COLORS: Record<string, string> = {
  notify: "#dc2626",        // red — urgent
  quarantine: "#ea580c",    // orange
  cull: "#7c2d12",          // dark red-brown
  surveillance: "#2563eb",  // blue
  vaccination: "#16a34a",   // green
  disinfection: "#7c3aed",  // purple
  documentation: "#6b7280", // grey
  other: "#9ca3af",
};

/**
 * Disease-specific response checklist with deadlines.
 *
 * Shows actionable steps for outbreak response (e.g. "Day 0: notify ГУВ",
 * "Day 3: cull all pigs in очаг"). Checkboxes persist per outbreak in
 * localStorage so the vet can track progress across sessions.
 *
 * "Copy to clipboard" button formats the checklist as plain text for
 * pasting into WhatsApp/Telegram with the regional vet service.
 */
export function ResponseChecklist({ items, outbreak }: ResponseChecklistProps) {
  const [copied, setCopied] = useState(false);

  // Load checked state from localStorage — use lazy initializer to avoid
  // setState-in-effect lint rule.
  const [checked, setChecked] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    const key = `vet:checklist_${outbreak.id}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch {
      // ignore parse errors
    }
    return new Set();
  });

  // Save checked state to localStorage
  const toggle = (idx: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      const key = `vet:checklist_${outbreak.id}`;
      try {
        localStorage.setItem(key, JSON.stringify(Array.from(next)));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  };

  // Calculate target dates based on outbreak detection date
  const detectionDate = new Date(outbreak.date);
  const formatDate = (day: number) => {
    const d = new Date(detectionDate);
    d.setDate(d.getDate() + day);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  };

  // Copy formatted checklist to clipboard
  const copyToClipboard = () => {
    const diseaseName = outbreak.disease;
    const region = outbreak.region;
    const date = detectionDate.toLocaleDateString("ru-RU");
    const lines = [
      `📋 Чек-лист реагирования: ${diseaseName}`,
      `📍 ${region} · обнаружено ${date}`,
      ``,
      ...items.map((item, idx) => {
        const done = checked.has(idx) ? "✅" : "⬜";
        const mandatory = item.mandatory ? "⚠️" : "";
        return `${done} День ${item.day} (${formatDate(item.day)}) ${mandatory} ${item.action}`;
      }),
      ``,
      `Готово: ${checked.size}/${items.length}`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Group items by category
  const byCategory = items.reduce((acc, item, idx) => {
    const cat = item.category ?? "other";
    if (!acc.has(cat)) acc.set(cat, []);
    acc.get(cat)!.push({ ...item, idx });
    return acc;
  }, new Map<string, (ResponseCheckItem & { idx: number })[]>());

  const completedCount = checked.size;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Прогресс реагирования</span>
            <span className="font-medium tabular-nums">{completedCount}/{totalCount} ({progress}%)</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={copyToClipboard}
          className="h-7 text-[10px] gap-1 shrink-0"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Скопировано" : "Копировать"}
        </Button>
      </div>

      {/* Checklist grouped by category */}
      <div className="space-y-3">
        {Array.from(byCategory.entries()).map(([cat, catItems]) => (
          <div key={cat}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[cat] }}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[cat] ?? cat}
              </span>
            </div>
            <div className="space-y-1">
              {catItems.map((item) => {
                const isChecked = checked.has(item.idx);
                const targetDate = formatDate(item.day);
                const isOverdue = !isChecked && new Date(outbreak.date) < new Date(Date.now() - item.day * 86400000);

                return (
                  <button
                    key={item.idx}
                    onClick={() => toggle(item.idx)}
                    className={`w-full flex items-start gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                      isChecked ? "bg-primary/5 opacity-60" : "hover:bg-accent/30"
                    }`}
                  >
                    {isChecked ? (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs ${isChecked ? "line-through" : ""}`}>
                        {item.action}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-muted-foreground inline-flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          День {item.day} · {targetDate}
                        </span>
                        {item.mandatory && (
                          <Badge variant="outline" className="text-[8px] h-3 px-1 border-destructive/50 text-destructive">
                            обязательно
                          </Badge>
                        )}
                        {isOverdue && !isChecked && (
                          <Badge variant="destructive" className="text-[8px] h-3 px-1">
                            <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                            просрочено
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
