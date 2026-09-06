#!/usr/bin/env node
/**
 * tools/alerts.mjs — Telegram-алерты по срезу станций (внутри stations.yml).
 * Гейты: THI ≥ 80, THIadj ≥ 80 (Mader), BRD ≥ 75.
 * Дедупликация по фронту: сообщение уходит только при ВОЗНИКНОВЕНИИ/
 * эскалации условия; при снятии — «✅ снято». Состояние — data/alerts-state.json
 * (коммитится вместе со срезом тем же воркфлоу — гонок нет).
 * Секреты: TG_BOT_TOKEN, TG_CHAT_ID. Если их нет — тихий успех (exit 0),
 * чтобы бейдж воркфлоу оставался зелёным.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const TOKEN = process.env.TG_BOT_TOKEN || '';
const CHAT = process.env.TG_CHAT_ID || '';
const MSK = { timeZone: 'Europe/Moscow', hour12: false };
const now = new Date();
const stamp = now.toLocaleString('ru-RU', MSK) + ' МСК';

const L = JSON.parse(readFileSync(join(ROOT, 'data', 'latest.json'), 'utf8'));
const stateFile = join(ROOT, 'data', 'alerts-state.json');
let state = { sent: {}, updatedAt: null };
if (existsSync(stateFile)) {
  try { state = JSON.parse(readFileSync(stateFile, 'utf8')); } catch { /* перепишем */ }
}

const st = Array.isArray(L.stations) ? L.stations : [];
const active = new Map(); // id -> {level, line}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

for (const s of st) {
  if (s.thi != null && s.thi >= 80) {
    const lvl = s.thi >= 90 ? 3 : s.thi >= 84 ? 2 : 1;
    active.set(`thi:${s.id}`, { level: lvl, line: `<b>${esc(s.name)}</b>: THI ${s.thi} (${s.thi >= 90 ? 'критический' : 'тяжёлый'} стресс), adj ${s.thiAdj ?? '—'} · T ${s.t}°, RH ${s.rh}%, ветер ${s.wind} м/с` });
  } else if (s.thiAdj != null && s.thiAdj >= 80) {
    active.set(`adj:${s.id}`, { level: 1, line: `<b>${esc(s.name)}</b>: THIadj ${s.thiAdj} (Mader: жара+солнце−ветер) при THI ${s.thi} · T ${s.t}°, RH ${s.rh}%, ветер ${s.wind} м/с` });
  }
  if (s.brd != null && s.brd >= 75) {
    active.set(`brd:${s.id}`, { level: 1, line: `<b>${esc(s.name)}</b>: BRD-риск ${s.brd}% — бронхопневмония телят (сырость/амплитуда T)` });
  }
}
if (st.length === 0) {
  active.set('nodata', { level: 2, line: '<b>Срез пуст</b> — Open-Meteo недоступен, живые данные не обновились' });
}

const sent = state.sent ?? {};
const fresh = [...active.entries()].filter(([id]) => !sent[id]);
const escalated = [...active.entries()].filter(([id, v]) => sent[id] && v.level > sent[id].level);
const cleared = Object.keys(sent).filter((id) => !active.has(id));

let sentOk = 0, sentTotal = 0;
async function send(text) {
  sentTotal++;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      });
      if (r.ok) { sentOk++; return true; }
      console.error('TG HTTP', r.status, await r.text());
    } catch (e) { console.error('TG try', i + 1, e.message); }
    await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
  }
  return false;
}

const summary = [];
if (!TOKEN || !CHAT) {
  summary.push('алерты Telegram отключены: не заданы секреты TG_BOT_TOKEN / TG_CHAT_ID');
} else {
  if (fresh.length || escalated.length || cleared.length) {
    const parts = [`🌡 <b>ВЕТРАДАР-61</b> · ${stamp}`];
    if (fresh.length) {
      parts.push(fresh.length > 1 ? `\n🔴 <b>Новые алерты (${fresh.length}):</b>` : '\n🔴 <b>Новый алерт:</b>');
      for (const [, v] of fresh) parts.push('• ' + v.line);
    }
    if (escalated.length) {
      parts.push('\n⬆️ <b>Эскалация:</b>');
      for (const [, v] of escalated) parts.push('• ' + v.line);
    }
    if (cleared.length) {
      parts.push(`\n✅ <b>Снято (${cleared.length}):</b> ${cleared.map((id) => id.split(':')[1]).join(', ')}`);
    }
    const ok = await send(parts.join('\n'));
    summary.push(ok ? `алерт отправлен (${fresh.length} новых, ${escalated.length} эскалаций, ${cleared.length} снято)` : 'НЕ удалось отправить алерт');
  } else {
    summary.push('активных алертов нет — тихий час');
  }
}
console.log('alerts:', ...summary);

// пишем state только при изменении — не создаём пустых коммитов
const newSent = Object.fromEntries([...active.entries()].map(([id, v]) => [id, v.level]));
if (JSON.stringify(newSent) !== JSON.stringify(state.sent ?? {})) {
  writeFileSync(stateFile, JSON.stringify({ sent: newSent, updatedAt: now.toISOString() }) + '\n');
}
