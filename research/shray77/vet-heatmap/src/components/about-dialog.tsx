"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExternalLink, Github, Heart, Database, Shield } from "lucide-react";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto thin-scroll">
        <DialogHeader>
          <DialogTitle className="text-xl">О проекте ВетКарта</DialogTitle>
          <DialogDescription>
            Профессиональный инструмент для ветеринарных специалистов
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="leading-relaxed">
            <strong>ВетКарта</strong> — это открытый PWA-инструмент для мониторинга
            эпизоотической обстановки по вспышкам болезней животных в России.
            Проект создан для практикующих ветеринаров, эпизоотологов,
            инспекторов Россельхознадзора и студентов ветеринарных вузов.
          </p>

          <Separator />

          {/* Sources */}
          <section className="space-y-2">
            <h3 className="font-semibold flex items-center gap-1.5">
              <Database className="h-4 w-4" />
              Источники данных
            </h3>
            <ul className="space-y-1.5 text-xs">
              <li className="flex gap-2">
                <Badge variant="default" className="text-[10px] h-5 shrink-0">REAL</Badge>
                <a
                  href="https://fsvps.gov.ru/jepizooticheskaja-situacija/rossija/"
                  target="_blank"
                  rel="noopener"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  Россельхознадзор (fsvps.gov.ru)
                  <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-muted-foreground">
                  — ежедневные PDF-сводки ВНИИЗЖ, парсятся автоматически (cron Mon/Thu 09:00 МСК)
                </span>
              </li>
              <li className="flex gap-2">
                <Badge variant="secondary" className="text-[10px] h-5 shrink-0">STUB</Badge>
                <a
                  href="https://wahis.woah.org"
                  target="_blank"
                  rel="noopener"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  WOAH WAHIS
                  <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-muted-foreground">
                  — интеграция в разработке (требуется Playwright для Angular SPA)
                </span>
              </li>
              <li className="flex gap-2">
                <Badge variant="secondary" className="text-[10px] h-5 shrink-0">STUB</Badge>
                <a
                  href="https://www.efsa.europa.eu/en/data/animal-disease-information-system-adis"
                  target="_blank"
                  rel="noopener"
                  className="text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  EFSA ADIS
                  <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-muted-foreground">
                  — Европа, для оценки трансграничного риска
                </span>
              </li>
              <li className="flex gap-2">
                <Badge variant="outline" className="text-[10px] h-5 shrink-0">SEED</Badge>
                <span className="text-muted-foreground">
                  Кураторский датасет — 68 вспышек за 2024-2025 (исторический fallback)
                </span>
              </li>
            </ul>
          </section>

          <Separator />

          {/* Features */}
          <section className="space-y-2">
            <h3 className="font-semibold">Возможности</h3>
            <ul className="text-xs space-y-1 leading-relaxed">
              <li>🗺️ Интерактивная карта: хороплет + маркеры + зоны риска 3/10/30 км по WOAH</li>
              <li>🦠 Справочник 21 болезни с R₀, инкубационным, мерами борьбы, ссылками на НПА РФ и WOAH</li>
              <li>📅 Калькулятор карантина с таймлайном ключевых дат + экспорт</li>
              <li>📊 Эпидкривая по ISO-неделям + таблица вспышек с сортировкой и CSV-экспортом</li>
              <li>🔬 SEIR-симулятор с инкубационным периодом, летальностью, карантином и вакцинацией</li>
              <li>📍 «Рядом со мной» — геолокация + расчёт расстояния до активных вспышек</li>
              <li>🔥 Топ регионов по вспышкам с мини-барами</li>
              <li>🔍 Фильтры по болезни / виду / статусу / периоду + URL-shareable state</li>
              <li>⌨️ Горячие клавиши: ? f c n s r t /</li>
              <li>📱 PWA: офлайн-режим, установка на домашний экран</li>
              <li>🌙 Тёмная и светлая темы</li>
            </ul>
          </section>

          <Separator />

          {/* Keyboard shortcuts */}
          <section className="space-y-2">
            <h3 className="font-semibold flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted border rounded">⌨</kbd>
              Горячие клавиши
            </h3>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {[
                { k: "?", d: "Это окно" },
                { k: "f", d: "Фильтры" },
                { k: "c", d: "Калькулятор" },
                { k: "n", d: "Рядом со мной" },
                { k: "s", d: "SIR-симулятор" },
                { k: "r", d: "Сбросить фильтры" },
                { k: "t", d: "Сменить тему" },
                { k: "/", d: "Поиск" },
              ].map(({ k, d }) => (
                <div key={k} className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted border rounded min-w-[20px] text-center">
                    {k}
                  </kbd>
                  <span className="text-muted-foreground">{d}</span>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* Tech */}
          <section className="space-y-2">
            <h3 className="font-semibold">Технологии</h3>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Next.js 16", "TypeScript", "Tailwind CSS 4", "shadcn/ui",
                "MapLibre GL", "Recharts", "pdfjs-dist", "Bun", "GitHub Actions", "GitHub Pages",
              ].map((t) => (
                <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Полностью статичный сайт — zero backend, zero cost. Деплой через
              GitHub Actions при пуше в main.
            </p>
          </section>

          <Separator />

          {/* Privacy */}
          <section className="space-y-2">
            <h3 className="font-semibold flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              Приватность
            </h3>
            <p className="text-xs leading-relaxed">
              Приложение не собирает персональные данные, не использует аналитику,
              не отправляет ничего на сервер. Все вычисления происходят в браузере.
              Кэш PWA хранится только локально на вашем устройстве.
            </p>
          </section>

          <Separator />

          {/* Disclaimer */}
          <section className="space-y-2">
            <h3 className="font-semibold text-amber-600 dark:text-amber-400">
              ⚠️ Дисклеймер
            </h3>
            <p className="text-xs leading-relaxed">
              Информация носит справочный характер. Точные сроки карантина,
              перечень мероприятий и зоны ограничения определяются
              ветеринарным законодательством РФ и предписаниями территориального
              управления Россельхознадзора. При подозрении на заболевание
              животных немедленно обратитесь в государственную ветеринарную службу.
            </p>
          </section>

          <Separator />

          {/* Footer */}
          <section className="space-y-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://github.com/shray77/vet-heatmap"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Github className="h-3.5 w-3.5" />
                GitHub
              </a>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                MIT License
              </span>
              <span>·</span>
              <span>v6.0.0</span>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
