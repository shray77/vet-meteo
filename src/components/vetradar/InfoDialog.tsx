'use client';

/** Диалог «Формулы»: все модели и их источники. */
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

export default function InfoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="font-mono text-xs">
          формулы
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl border-[#3a4030] bg-[#14170f] text-[#d8dcc8]">
        <DialogHeader>
          <DialogTitle className="font-mono text-[#f0c674]">Математика ВЕТРАДАР-61</DialogTitle>
          <DialogDescription className="font-mono text-[11px] text-[#8a8f78]">
            Модели прототипа; коэффициенты требуют калибровки по данным хозяйства.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-4 font-mono text-[11px] leading-5">
            <section>
              <h3 className="mb-1 text-[#f0c674]">THI — тепловой стресс КРС</h3>
              <p className="text-[#b8bca8]">THI = (1.8·T + 32) − (0.55 − 0.0055·RH)·(1.8·T − 26)</p>
              <p className="text-[#8a8f78]">Пороги: 68 лёгкий · 72 умеренный · 80 тяжёлый · 90 критический (Armstrong, 1994). Потери удоя ≈ 0.25 кг на ед. THI выше 72 (Ravagnolo & Misztal, 2000).</p>
            </section>
            <section>
              <h3 className="mb-1 text-[#f0c674]">Видовые THI, WCI, HLI/AHL</h3>
              <p className="text-[#b8bca8]">
                Птица: 0.6·Tdb + 0.4·Twb (Twb — Stull 2011). Свиноматки: NRC-THI, пороги 72/78/84.
                WCI = (10.45 + 10√v − v)·(33 − T) — холод КРС. HLI = THI + 0.35·(TG−Tdb) − 1.4·WS
                (TG = Tdb + 0.016·SWR, по мотивам Gaughan, Mader 2008); AHL копит HLI&gt;77 с
                распадом 2%/ч.
              </p>
            </section>
            <section>
              <h3 className="mb-1 text-[#f0c674]">Ансамбль ECMWF</h3>
              <p className="text-[#b8bca8]">ensemble-api.open-meteo.com (51 член, без ключа): THImax p10/p50/p90, P(THI&gt;72/80). Фолбэк — пертурбация детерминированного прогноза.</p>
            </section>
            <section>
              <h3 className="mb-1 text-[#f0c674]">Трансмиссивные</h3>
              <p className="text-[#b8bca8]">Дирофиляриоз: HDU = Σ(Tmean−14)⁺, L3 ≈ 130 HDU (Knight, Lok). ВЗН/Culex: GDD₁₀ + оптимум 25±6°С + осадки. Culicoides: midge-days Σ(Tmean−13)⁺, окно передачи ≥15°С (EFSA-подход).</p>
            </section>
            <section>
              <h3 className="mb-1 text-[#f0c674]">BRD — респираторные болезни телят</h3>
              <p className="text-[#b8bca8]">Скоринг 0–100: амплитуда T·сутки (до 35) + сырость RH/осадки (до 25) + застой/сквозняк по рельефу (до 18) + похолодание к прошлым суткам (до 20).</p>
              <p className="text-[#8a8f78]">Эвристические веса по литературе энзоотической бронхопневмонии (shipping fever). &gt;60 — высокий риск.</p>
            </section>
            <section>
              <h3 className="mb-1 text-[#f0c674]">Клещи и КГЛ</h3>
              <p className="text-[#b8bca8]">GDD₁₀ = Σ max(0, T_mean − 10). Hyalomma marginatum — активность ≈ GDD/140 (степной юг, лето), Dermacentor — ≈ GDD/90 (весна).</p>
              <p className="text-[#8a8f78]">КГЛ-риск = эндемичность района (45) + активность × 55, с поправкой на сухость по VPD. Районы эндемичности: север Ростовской обл.</p>
            </section>
            <section>
              <h3 className="mb-1 text-[#f0c674]">Фасциолёз — влагостат</h3>
              <p className="text-[#b8bca8]">Σ(P − 0.8·ET₀) за окно 7 дней; ET₀ по Hargreaves.</p>
              <p className="text-[#8a8f78]">Ollerenshaw-подход: &gt;50 мм избытка — высокий риск (биотопы Lymnaea переполнены).</p>
            </section>
            <section>
              <h3 className="mb-1 text-[#f0c674]">АЧС — коридор волны кабана</h3>
              <p className="text-[#b8bca8]">Suitability 0.1° (лес+вода−город) → Дейкстра, цена шага = км × (1.6 − 1.2·suit); волна 12 км/ночь × 20 ночей.</p>
              <p className="text-[#8a8f78]">Официальные кольца: 5/20/100 км (регламент ВетИС). Очаги — ДЕМО-данные.</p>
            </section>
            <section>
              <h3 className="mb-1 text-[#f0c674]">Надзор: EARS · Фаррингтон · Rt · Кульдорфф</h3>
              <p className="text-[#b8bca8]">EARS C1/C2/C3 (CDC/ECDC): отклонения от скользящего базлайна, alarm ≥ 3. Фаррингтон: log-линейный базлайн + 95% граница. Rt (Cori 2013): гамма-апостериор Γ(1+ΣI, 1/5+ΣΛ), SI 14±7. Скан Кульдорффа: круговой Пуассон, Монте-Карло 199 реплик. Ряды — демо (сид).</p>
            </section>
            <section>
              <h3 className="mb-1 text-[#f0c674]">Архив GitHub Actions</h3>
              <p className="text-[#b8bca8]">stations.yml опрашивает METAR + Open-Meteo каждый час и коммитит снапшоты в data/ (история 30 дней). Сайт читает с raw.githubusercontent — бейдж «АРХИВ Actions».</p>
            </section>
            <section>
              <h3 className="mb-1 text-[#f0c674]">Топо-поправки</h3>
              <p className="text-[#b8bca8]">Высота (−0.65°/100 м), застой холодного воздуха ночью (до −2.2°, +9% RH), ветровая экспозиция (×0.6–1.0).</p>
              <p className="text-[#8a8f78]">Рельеф — псевдо-DEM 0.1° (схематично). Прод: SRTM 30 м.</p>
            </section>
            <section>
              <h3 className="mb-1 text-[#f0c674]">OSINT MQTT</h3>
              <p className="text-[#b8bca8]">Shodan/Censys: открытые MQTT-брокеры, bbox-фильтр по области. Баннеры «weather/sensor/esp/dht/bme» → гиперлокальные метеостанции.</p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
