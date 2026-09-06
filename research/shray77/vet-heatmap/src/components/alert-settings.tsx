"use client";

import { useState, useCallback, useMemo } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, BellOff, BellRing, MapPin, Activity, CheckCircle2 } from "lucide-react";
import type { Outbreak } from "@/types/domain";
import { REGION_PROPERTIES } from "@/data/regions";
import { DISEASE_PROFILES } from "@/data/disease-profiles";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  outbreaks: Outbreak[];
}

interface AlertConfig {
  enabled: boolean;
  regions: string[];
  diseases: string[];
  maxDistanceKm: number;
  lastCheckedCount: number;
  lastCheckedDate: string;
}

const STORAGE_KEY = "vet_alert_config";

/**
 * Alert Settings — zero-cost notification system.
 *
 * Since this is a static PWA (no backend), we use:
 * 1. Browser Notifications API (local notifications, no push server)
 * 2. localStorage to store alert preferences
 * 3. On each app open: compare current outbreaks vs last visit
 *    → if new outbreaks match user's alert criteria → show notification
 *
 * This is "pull" notification (checks on open), not "push" (real-time).
 * For real-time push, a server + VAPID + push service is needed.
 */
export function AlertSettings({ open, onOpenChange, outbreaks }: Props) {
  // Load config from localStorage synchronously (lazy initializer — no effect needed)
  const [config, setConfig] = useState<AlertConfig>(() => {
    if (typeof window === "undefined") {
      return { enabled: false, regions: [], diseases: [], maxDistanceKm: 100, lastCheckedCount: 0, lastCheckedDate: "" };
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
    return { enabled: false, regions: [], diseases: [], maxDistanceKm: 100, lastCheckedCount: 0, lastCheckedDate: "" };
  });
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );
  const [testSent, setTestSent] = useState(false);

  const saveConfig = useCallback((cfg: AlertConfig) => {
    setConfig(cfg);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }, []);

  const handleEnable = async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm === "granted") {
      const newCfg = { ...config, enabled: true, lastCheckedCount: outbreaks.length, lastCheckedDate: new Date().toISOString() };
      saveConfig(newCfg);
    }
  };

  const handleDisable = () => {
    saveConfig({ ...config, enabled: false });
  };

  const handleTest = () => {
    if (permission !== "granted") return;
    const reg = navigator.serviceWorker?.controller;
    if (reg) {
      navigator.serviceWorker.getRegistration().then((r) => {
        r?.showNotification("🚨 Тестовое уведомление VetKarta", {
          body: "Если вы видите это — уведомления работают!",
          icon: "/vet-heatmap/icons/icon-192.png",
          tag: "test",
        });
      });
    } else {
      new Notification("🚨 Тестовое уведомление VetKarta", {
        body: "Если вы видите это — уведомления работают!",
        icon: "/vet-heatmap/icons/icon-192.png",
      });
    }
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  // Compute alerts: outbreaks that match user's criteria AND are new since last check
  const newMatches = useMemo(() => {
    if (!config.enabled || config.lastCheckedCount === 0) return [];
    return outbreaks.filter((o) => {
      // Must be newer than last check
      if (o.date < config.lastCheckedDate.split("T")[0]) return false;
      // Check disease filter
      if (config.diseases.length > 0 && !config.diseases.includes(o.disease_key)) return false;
      // Check region filter
      if (config.regions.length > 0 && !config.regions.includes(o.region)) return false;
      return true;
    });
  }, [outbreaks, config]);

  // Available regions and diseases for filter
  const allRegions = useMemo(() => {
    const set = new Set(outbreaks.map((o) => o.region));
    return Array.from(set).sort();
  }, [outbreaks]);

  const allDiseases = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of outbreaks) map.set(o.disease_key, o.disease);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [outbreaks]);

  const toggleRegion = (region: string) => {
    const regions = config.regions.includes(region)
      ? config.regions.filter((r) => r !== region)
      : [...config.regions, region];
    saveConfig({ ...config, regions });
  };

  const toggleDisease = (key: string) => {
    const diseases = config.diseases.includes(key)
      ? config.diseases.filter((d) => d !== key)
      : [...config.diseases, key];
    saveConfig({ ...config, diseases });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            Уведомления о вспышках
          </DialogTitle>
          <DialogDescription>
            Получайте уведомления о новых вспышках. Проверка выполняется при
            открытии приложения (без сервера, zero-cost).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Permission status */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {permission === "granted" && config.enabled ? (
                  <Bell className="h-5 w-5 text-green-500" />
                ) : permission === "denied" ? (
                  <BellOff className="h-5 w-5 text-red-500" />
                ) : (
                  <BellRing className="h-5 w-5 text-yellow-500" />
                )}
                <div>
                  <div className="font-medium text-sm">
                    {permission === "granted" && config.enabled
                      ? "Уведомления включены"
                      : permission === "denied"
                        ? "Уведомления заблокированы браузером"
                        : "Уведомления не включены"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {permission === "granted" && config.enabled
                      ? `Проверено: ${config.lastCheckedDate.split("T")[0] ?? "—"}`
                      : "Нажмите чтобы разрешить"}
                  </div>
                </div>
              </div>
              {permission === "granted" && config.enabled ? (
                <Button size="sm" variant="outline" onClick={handleDisable}>
                  Выключить
                </Button>
              ) : permission !== "denied" ? (
                <Button size="sm" onClick={handleEnable}>
                  Включить
                </Button>
              ) : null}
            </div>
          </Card>

          {config.enabled && (
            <>
              {/* Test button */}
              <Button variant="outline" className="w-full" onClick={handleTest}>
                {testSent ? (
                  <><CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> Отправлено!</>
                ) : (
                  <><Bell className="h-4 w-4 mr-2" /> Тестовое уведомление</>
                )}
              </Button>

              <Separator />

              {/* Disease filter */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Болезни для отслеживания
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Пусто = все болезни
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {allDiseases.map(([key, name]) => {
                    const active = config.diseases.includes(key);
                    return (
                      <Badge
                        key={key}
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleDisease(key)}
                      >
                        {active ? "✓ " : ""}{name}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Region filter */}
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Регионы для отслеживания
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Пусто = все регионы
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {allRegions.map((region) => {
                    const active = config.regions.includes(region);
                    return (
                      <Badge
                        key={region}
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleRegion(region)}
                      >
                        {active ? "✓ " : ""}{region}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* New matches since last visit */}
              {newMatches.length > 0 && (
                <Card className="p-3 border-orange-300 dark:border-orange-900">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">
                      Новых вспышек по вашим фильтрам: {newMatches.length}
                    </span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {newMatches.slice(0, 10).map((o, i) => (
                      <div key={i} className="text-xs flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{o.disease}</span>
                        <span className="text-muted-foreground">— {o.region}</span>
                        <span className="text-muted-foreground">({o.date})</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <p className="text-xs text-muted-foreground">
                ⚠️ Проверка выполняется только при открытии приложения.
                Для push-уведомлений в реальном времени нужен сервер.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

