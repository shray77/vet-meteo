"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { Outbreak, DiseaseKey } from "@/types/domain";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { diseaseColor } from "@/lib/colors";

interface EpiCurveProps {
  outbreaks: Outbreak[];
}

const MONTH_RU = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];

function buildWeeklyData(outbreaks: Outbreak[]) {
  const weekMap = new Map<string, Map<DiseaseKey, number>>();
  for (const o of outbreaks) {
    const d = new Date(o.date);
    if (Number.isNaN(d.getTime())) continue;
    const year = d.getFullYear();
    const onejan = new Date(year, 0, 1);
    const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
    const weekKey = `${year}-W${String(week).padStart(2, "0")}`;
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Map());
    const m = weekMap.get(weekKey)!;
    m.set(o.disease_key, (m.get(o.disease_key) ?? 0) + 1);
  }
  const weeks = Array.from(weekMap.keys()).sort();
  return weeks.map((wk) => {
    const m = weekMap.get(wk)!;
    return { week: wk, ...Object.fromEntries(m) };
  });
}

export function EpiCurve({ outbreaks }: EpiCurveProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => { cancelAnimationFrame(id); setMounted(false); };
  }, []);

  const data = buildWeeklyData(outbreaks);
  const diseases = new Set<DiseaseKey>();
  for (const o of outbreaks) diseases.add(o.disease_key);
  const diseaseList = Array.from(diseases);

  // Find the most recent week for the "today" reference line
  const currentWeek = data.length > 0 ? data[data.length - 1].week : null;

  return (
    <Card className="overflow-hidden p-3 md:p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <h3 className="text-sm font-semibold">Эпидкривая</h3>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {data.length} нед.
        </span>
      </div>

      <div ref={containerRef} className="h-[220px] w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Нет данных для выбранного фильтра
          </div>
        ) : mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
              <defs>
                {diseaseList.map((k) => {
                  const c = diseaseColor(k, DISEASE_LABELS[k].group);
                  return (
                    <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c} stopOpacity={0.85} />
                      <stop offset="100%" stopColor={c} stopOpacity={0.12} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke="currentColor" opacity={0.1} vertical={false} />
              <XAxis
                dataKey="week"
                tickFormatter={(wk) => {
                  const m = wk.match(/W(\d{2})$/);
                  if (!m) return wk;
                  const weekNum = parseInt(m[1], 10);
                  const month = Math.min(11, Math.floor((weekNum - 1) / 4.33));
                  return MONTH_RU[month];
                }}
                tick={{ fontSize: 10, fill: "currentColor" }}
                stroke="currentColor"
                strokeOpacity={0.2}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "currentColor" }}
                stroke="currentColor"
                strokeOpacity={0.2}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-xl border border-white/15 bg-card/80 p-2.5 text-xs shadow-2xl backdrop-blur-xl">
                      <div className="mb-1 font-semibold tabular-nums">{label}</div>
                      {payload.map((p: any) => (
                        <div key={p.dataKey} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                          <span className="text-muted-foreground">
                            {DISEASE_LABELS[p.dataKey as DiseaseKey]?.short_ru ?? p.dataKey}
                          </span>
                          <span className="ml-auto font-bold tabular-nums">{p.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
                cursor={{ stroke: "var(--primary)", strokeOpacity: 0.3, strokeDasharray: "3 3" }}
              />
              {diseaseList.map((k) => {
                const c = diseaseColor(k, DISEASE_LABELS[k].group);
                return (
                  <Area
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stackId="a"
                    stroke={c}
                    strokeWidth={1.5}
                    fill={`url(#grad-${k})`}
                    name={k}
                  />
                );
              })}
              {currentWeek && (
                <ReferenceLine
                  x={currentWeek}
                  stroke="var(--destructive)"
                  strokeDasharray="2 4"
                  strokeOpacity={0.4}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : null}
      </div>
    </Card>
  );
}
