"use client";

import { useState, useMemo, useEffect, useRef } from "react";
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
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Pause, SkipBack, SkipForward, Clock, MapPin } from "lucide-react";
import type { Outbreak } from "@/types/domain";
import { REGION_PROPERTIES } from "@/data/regions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  outbreaks: Outbreak[];
}

/**
 * Disease Spread Animation — plays back outbreak timeline on a mini-map.
 *
 * Shows how disease spread across Russia over time, month by month.
 * Each frame = 1 month. Outbreaks appear as they were detected.
 *
 * Also shows a "spread velocity" chart — cumulative cases over time.
 */
export function SpreadAnimation({ open, onOpenChange, outbreaks }: Props) {
  const [selectedDisease, setSelectedDisease] = useState<string>("all");
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Build monthly timeline
  const timeline = useMemo(() => {
    const filtered = selectedDisease === "all"
      ? outbreaks
      : outbreaks.filter((o) => o.disease_key === selectedDisease);

    // Group by month
    const byMonth = new Map<string, Outbreak[]>();
    for (const o of filtered) {
      const monthKey = o.date.substring(0, 7); // YYYY-MM
      if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
      byMonth.get(monthKey)!.push(o);
    }

    // Sort months chronologically
    const months = Array.from(byMonth.keys()).sort();
    return months.map((month, i) => ({
      month,
      label: new Date(month + "-01").toLocaleDateString("ru-RU", { year: "numeric", month: "short" }),
      outbreaks: byMonth.get(month)!,
      cumulative: months.slice(0, i + 1).reduce((sum, m) => sum + (byMonth.get(m)?.length || 0), 0),
    }));
  }, [outbreaks, selectedDisease]);

  // Auto-play
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setCurrentFrame((prev) => {
        if (prev >= timeline.length - 1) {
          setPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 800); // 800ms per frame
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, timeline.length]);

  // Reset when disease changes — use derived state pattern
  const [prevDisease, setPrevDisease] = useState(selectedDisease);
  if (prevDisease !== selectedDisease) {
    setPrevDisease(selectedDisease);
    setCurrentFrame(0);
    setPlaying(false);
  }

  const currentData = timeline[currentFrame];
  const allUpToNow = timeline.slice(0, currentFrame + 1).flatMap((t) => t.outbreaks);

  // Compute regions affected so far
  const regionsAffected = useMemo(() => {
    const set = new Set<string>();
    for (const o of allUpToNow) set.add(o.region);
    return set.size;
  }, [allUpToNow]);

  // Spread events for the chart
  const maxCumulative = timeline.length > 0 ? timeline[timeline.length - 1].cumulative : 0;

  const diseases = useMemo(() => {
    const set = new Map<string, string>();
    for (const o of outbreaks) set.set(o.disease_key, o.disease);
    return Array.from(set.entries()).sort((a, b) => {
      const ca = outbreaks.filter((o) => o.disease_key === a[0]).length;
      const cb = outbreaks.filter((o) => o.disease_key === b[0]).length;
      return cb - ca;
    });
  }, [outbreaks]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Анимация распространения
          </DialogTitle>
          <DialogDescription>
            Покадровое воспроизведение вспышек по месяцам. Видно, как болезнь
            расползалась по регионам России.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={selectedDisease} onValueChange={setSelectedDisease}>
            <SelectTrigger>
              <SelectValue placeholder="Все болезни" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все болезни ({outbreaks.length})</SelectItem>
              {diseases.map(([key, name]) => (
                <SelectItem key={key} value={key}>
                  {name} ({outbreaks.filter((o) => o.disease_key === key).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {timeline.length > 0 && currentData && (
            <>
              {/* Current frame info */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-lg">{currentData.label}</span>
                  </div>
                  <Badge variant="secondary">
                    Кадр {currentFrame + 1} / {timeline.length}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-2xl font-bold text-primary">{currentData.outbreaks.length}</div>
                    <div className="text-xs text-muted-foreground">в этом месяце</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-2xl font-bold">{currentData.cumulative}</div>
                    <div className="text-xs text-muted-foreground">всего</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-2xl font-bold">{regionsAffected}</div>
                    <div className="text-xs text-muted-foreground">регионов</div>
                  </div>
                </div>
              </Card>

              {/* Cumulative chart */}
              <Card className="p-4">
                <div className="text-sm font-medium mb-2">Накопительные случаи</div>
                <div className="flex items-end gap-0.5 h-32">
                  {timeline.map((t, i) => (
                    <div
                      key={t.month}
                      className={`flex-1 rounded-t transition-all ${
                        i <= currentFrame ? "bg-primary" : "bg-muted"
                      }`}
                      style={{
                        height: `${(t.cumulative / maxCumulative) * 100}%`,
                        minHeight: "2px",
                      }}
                      title={`${t.label}: ${t.cumulative} (новых: ${t.outbreaks.length})`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{timeline[0]?.label}</span>
                  <span>{timeline[timeline.length - 1]?.label}</span>
                </div>
              </Card>

              {/* Regions in this month */}
              {currentData.outbreaks.length > 0 && (
                <Card className="p-3">
                  <div className="text-sm font-medium mb-2 flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-red-500" />
                    Новые вспышки в этом месяце:
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {currentData.outbreaks.map((o, i) => (
                      <Badge
                        key={i}
                        variant={o.status === "Ongoing" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {o.region}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* Playback controls */}
              <div className="space-y-3">
                <Slider
                  value={[currentFrame]}
                  min={0}
                  max={timeline.length - 1}
                  step={1}
                  onValueChange={(v) => { setCurrentFrame(v[0]); setPlaying(false); }}
                />
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => { setCurrentFrame(0); setPlaying(false); }}
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={playing ? "secondary" : "default"}
                    size="lg"
                    onClick={() => setPlaying(!playing)}
                    className="w-24"
                  >
                    {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => { setCurrentFrame(timeline.length - 1); setPlaying(false); }}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  {playing ? "Воспроизведение..." : "Нажмите Play для анимации"}
                </p>
              </div>
            </>
          )}

          {timeline.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              Нет данных для анимации
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
