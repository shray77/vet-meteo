#!/usr/bin/env node
/**
 * tools/weekly.mjs — недельный дайджест (воскресенье, weekly-digest.yml).
 * Агрегирует снапшоты последних 7 дней → data/weekly.json:
 * по станциям: часы наблюдений, средний/макс THI, часы THI>72/80,
 * плюс BRD-часы. Дайджест-строки — топ станций по тепловой нагрузке.
 * Опционально шлёт итог в Telegram (TG_BOT_TOKEN/TG_CHAT_ID).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const STATIONS = JSON.parse(readFileSync(join(ROOT, 'data', 'stations.json'), 'utf8'));
const snapDir = join(ROOT, 'data', 'snapshots');

const names = Object.fromEntries(STATIONS.stations.map((s) => [s.id, s.name]));
const days = [];
for (let i = 0; i < 7; i++) {
  const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
  const f = join(snapDir, `${d}.json`);
  if (existsSync(f)) {
    try { days.push({ date: d, snap: JSON.parse(readFileSync(f, 'utf8')) }); } catch { /* битый — пропускаем */ }
  }
}
days.reverse(); // хронология

const acc = {};
for (const { snap } of days) {
  for (const h of snap.hours ?? []) {
    for (const [id, a] of Object.entries(h.s ?? {})) {
      if (!a || a[3] == null) continue;
      const o = (acc[id] ??= { hours: 0, thiSum: 0, thiMax: -999, hot72: 0, hot80: 0, brd75: 0 });
      o.hours++;
      o.thiSum += a[3];
      o.thiMax = Math.max(o.thiMax, a[3]);
      if (a[3] > 72) o.hot72++;
      if (a[3] > 80) o.hot80++;
    }
  }
}

const stations = Object.entries(acc).map(([id, o]) => ({
  id,
  name: names[id] ?? id,
  hours: o.hours,
  thiMean: +(o.thiSum / Math.max(1, o.hours)).toFixed(1),
  thiMax: +o.thiMax.toFixed(1),
  hot72: o.hot72,
  hot80: o.hot80,
})).sort((a, b) => b.hot72 - a.hot72 || b.thiMax - a.thiMax);

const totalHot = stations.reduce((s, x) => s + x.hot72, 0);
const digest = [];
for (const s of stations.slice(0, 6)) {
  if (s.hot72 > 0) digest.push(`${s.name}: ${s.hot72} ч THI>72 (макс ${String(s.thiMax).replace('.', ',')}) за ${s.hours} ч наблюдений`);
}
if (!digest.length) digest.push('превышений THI 72 за неделю не зафиксировано');
digest.push(`покрытие архива: ${days.length} дн из 7 (${days.map((d) => d.date).join(', ')})`);

const weekly = { generatedAt: new Date().toISOString(), from: days[0]?.date ?? null, to: days.at(-1)?.date ?? null, stations, digest };
writeFileSync(join(ROOT, 'data', 'weekly.json'), JSON.stringify(weekly, null, 1) + '\n');
console.log(`OK: недельный дайджест, ${stations.length} станций, часов THI>72: ${totalHot}`);

/* Telegram (не обязателен) */
const TOKEN = process.env.TG_BOT_TOKEN || '';
const CHAT = process.env.TG_CHAT_ID || '';
if (TOKEN && CHAT) {
  const stamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour12: false });
  const lines = [`📅 <b>ВЕТРАДАР-61 · итоги недели</b> · ${stamp}`, ''];
  for (const s of stations.slice(0, 6)) {
    lines.push(`• <b>${s.name}</b>: THI ср ${s.thiMean}, макс ${s.thiMax}, ${s.hot72} ч &gt;72${s.hot80 ? `, ${s.hot80} ч &gt;80` : ''}`);
  }
  lines.push('', `архив: ${days.length}/7 дн`);
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    console.log('TG:', r.ok ? 'отправлено' : `HTTP ${r.status}`);
  } catch (e) {
    console.error('TG недоступен:', e.message);
  }
} else {
  console.log('Telegram отключён (нет секретов)');
}
