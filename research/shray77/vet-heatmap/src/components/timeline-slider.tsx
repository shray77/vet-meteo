"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Outbreak } from "@/types/domain";

interface TimelineSliderProps {
  outbreaks: Outbreak[];
  onDateRangeChange: (from: string | null, to: string | null) => void;
}

/**
 * Timeline slider — drag to filter outbreaks by date range.
 * Shows a mini histogram of outbreak counts per month.
 * Play button animates through time.
 */
export function TimelineSlider({ outbreaks, onDateRangeChange }: TimelineSliderProps) {
  const allDates = useMemo(() => outbreaks.map((o) => o.date).sort(), [outbreaks]);
  const minDate = allDates[0] ?? "2024-01-01";
  const maxDate = allDates[allDates.length - 1] ?? "2026-12-31";

  // Convert dates to numeric range (months since minDate)
  const minMonth = monthIndex(minDate);
  const maxMonth = monthIndex(maxDate);
  const totalMonths = maxMonth - minMonth + 1;

  const [range, setRange] = useState<[number, number]>([0, totalMonths - 1]);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Build histogram: outbreaks per month
  const histogram = useMemo(() => {
    const bins = new Array(totalMonths).fill(0);
    for (const o of outbreaks) {
      const idx = monthIndex(o.date) - minMonth;
      if (idx >= 0 && idx < totalMonths) bins[idx]++;
    }
    return bins;
  }, [outbreaks, minMonth, totalMonths]);

  const maxBin = Math.max(1, ...histogram);

  // Convert slider range back to dates
  const fromDate = range[0] === 0 ? null : monthString(minMonth + range[0]);
  const toDate = range[1] === totalMonths - 1 ? null : monthString(minMonth + range[1] + 1);

  // Notify parent of changes
  const handleChange = useCallback((newRange: [number, number]) => {
    setRange(newRange);
    const from = newRange[0] === 0 ? null : monthString(minMonth + newRange[0]);
    const to = newRange[1] === totalMonths - 1 ? null : monthString(minMonth + newRange[1] + 1);
    onDateRangeChange(from, to);
  }, [minMonth, totalMonths, onDateRangeChange]);

  // Play/pause animation
  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setPlaying(true);
    let current = range[0];
    const interval = setInterval(() => {
      current += 1;
      if (current >= totalMonths - 1) {
        current = 0;
      }
      handleChange([current, totalMonths - 1]);
    }, 500);
    // Store interval ref for cleanup
    intervalRef.current = interval;
    // Auto-stop after full cycle
    timeoutRef.current = setTimeout(() => {
      setPlaying(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }, totalMonths * 500);
  };

  // Reset
  const reset = () => {
    handleChange([0, totalMonths - 1]);
  };

  // Skip to start/end
  const skipToStart = () => handleChange([0, range[1]]);
  const skipToEnd = () => handleChange([range[0], totalMonths - 1]);

  // Visible outbreaks count in current range
  const visibleCount = useMemo(() => {
    return outbreaks.filter((o) => {
      const m = monthIndex(o.date) - minMonth;
      return m >= range[0] && m <= range[1];
    }).length;
  }, [outbreaks, range, minMonth]);

  const monthLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < totalMonths; i++) {
      const absMonth = minMonth + i;
      const year = Math.floor(absMonth / 12);
      const month = (absMonth % 12);
      const d = new Date(year, month, 1);
      labels.push(d.toLocaleDateString("ru-RU", { month: "short", year: "2-digit" }));
    }
    return labels;
  }, [minMonth, totalMonths]);

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Хронология</span>
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {visibleCount} / {outbreaks.length}
          </Badge>
        </div>
        <div className="flex items-center gap-0.5">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={skipToStart} aria-label="В начало">
            <SkipBack className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={togglePlay} aria-label={playing ? "Пауза" : "Воспроизвести"}>
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={skipToEnd} aria-label="В конец">
            <SkipForward className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={reset}>
            Сброс
          </Button>
        </div>
      </div>

      {/* Histogram + slider overlay */}
      <div className="relative">
        {/* Histogram bars */}
        <div className="flex items-end h-10 gap-px mb-1">
          {histogram.map((count, i) => {
            const inRange = i >= range[0] && i <= range[1];
            const height = (count / maxBin) * 100;
            return (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all min-w-[2px]"
                style={{
                  height: `${Math.max(height, count > 0 ? 8 : 0)}%`,
                  backgroundColor: inRange
                    ? count > 5
                      ? "var(--destructive)"
                      : count > 0
                        ? "var(--chart-3)"
                        : "var(--muted)"
                    : "var(--muted)",
                  opacity: inRange ? 1 : 0.3,
                }}
                title={`${monthLabels[i]}: ${count} вспышек`}
              />
            );
          })}
        </div>

        {/* Dual-range slider */}
        <Slider
          value={range}
          onValueChange={(v) => handleChange([v[0], v[1]] as [number, number])}
          min={0}
          max={totalMonths - 1}
          step={1}
          className="relative"
        />
      </div>

      {/* Date labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{monthLabels[range[0]]}</span>
        <span>{monthLabels[range[1]]}</span>
      </div>
    </Card>
  );
}

/** Convert "YYYY-MM-DD" to absolute month number (year*12 + month). */
function monthIndex(dateStr: string): number {
  const [y, m] = dateStr.split("-").map(Number);
  return y * 12 + (m - 1);
}

/** Convert absolute month number to "YYYY-MM" string. */
function monthString(absMonth: number): string {
  const year = Math.floor(absMonth / 12);
  const month = (absMonth % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}
