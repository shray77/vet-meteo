'use client';

/**
 * Экономика теплового стресса: стадо × потери удоя × цена молока = рубли.
 * Формула потерь — та же, что в модели: milkLoss() (Ravagnolo & Misztal 2000,
 * ~0.2 кг/гол за каждую единицу THI выше 72). Оценка ориентировочная: реальные
 * потери зависят от породы, удоя, вентиляции/охлаждения и доступа к воде.
 * Ненавязчивая: по умолчанию свёрнута в одну строку под сводкой станции.
 */
import { useState } from 'react';
import { milkLoss } from '@/lib/models/thi';
import type { PointAssessment } from '@/lib/types';

export default function MilkEconomics({ outlook }: { outlook: PointAssessment['outlook'] }) {
  const [open, setOpen] = useState(false);
  const [heads, setHeads] = useState(200);
  const [price, setPrice] = useState(40);

  const days = outlook.slice(0, 7);
  const todayLoss = days.length ? milkLoss(days[0].thiMax) * heads : 0;
  const weekLoss = days.reduce((s, d) => s + milkLoss(d.thiMax) * heads, 0);
  const weekHot = days.filter((d) => d.thiMax > 72).length;
  const rub = (kg: number) => Math.round(kg * price).toLocaleString('ru-RU');
  const lit = (kg: number) => Math.round(kg).toLocaleString('ru-RU');

  return (
    <div className="rounded border border-[#3a4030] bg-[#14170f] font-mono">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-2 py-1.5 text-[10px] text-[#b8bca8] hover:text-[#f0c674]"
      >
        <span>
          экономика потерь: {todayLoss > 0 ? `~${lit(todayLoss)} л/сут · ~${rub(todayLoss)} ₽/сут` : 'сегодня без потерь'}
        </span>
        <span className="text-[#8a8f78]">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-[#3a4030] px-2 py-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-[#8a8f78]" htmlFor="milk-heads">
              голов:
            </label>
            <input
              id="milk-heads"
              type="number"
              min={1}
              max={100000}
              value={heads}
              onChange={(e) => setHeads(Math.max(0, Math.min(1000000, Number(e.target.value) || 0)))}
              className="h-6 w-[70px] rounded border border-[#3a4030] bg-[#0e100a] px-1.5 text-[11px] text-[#d8dcc8] outline-none focus:border-[#f0c674]"
            />
            <label className="ml-1 text-[10px] text-[#8a8f78]" htmlFor="milk-price">
              цена молока, ₽/л:
            </label>
            <input
              id="milk-price"
              type="number"
              min={1}
              max={1000}
              step="0.5"
              value={price}
              onChange={(e) => setPrice(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))}
              className="h-6 w-[60px] rounded border border-[#3a4030] bg-[#0e100a] px-1.5 text-[11px] text-[#d8dcc8] outline-none focus:border-[#f0c674]"
            />
          </div>
          <div className="space-y-1 text-[10px] leading-4 text-[#b8bca8]">
            <div>
              сегодня: ~<b className="text-[#f0c674]">{lit(todayLoss)} л</b> ≈{' '}
              <b className="text-[#f0c674]">{rub(todayLoss)} ₽</b> недополученной выручки
            </div>
            <div>
              по прогнозу 7 дней ({weekHot} стрессовых): ~<b className="text-[#e0a636]">{lit(weekLoss)} л</b> ≈{' '}
              <b className="text-[#e0a636]">{rub(weekLoss)} ₽</b>
            </div>
            <div className="text-[#8a8f78]">
              расчёт: 0.2 кг/гол за ед. THI&gt;72 (Ravagnolo &amp; Misztal 2000). Ориентир — не учтены
              вентиляция, душение, порода и уровень удоя. Сравни с ценой вентиляции: если она дешевле
              потерь за месяц жары — она окупается.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
