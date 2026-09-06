/**
 * АРХИВ GitHub Actions: hourly-воркфлоу коммитит в репо
 * data/latest.json (последний срез) и data/snapshots/YYYY-MM-DD.json
 * (почасовые компактные записи). Сайт читает их с raw.githubusercontent
 * (CDN, без ключей), фолбэк — через наш /api/archive.
 *
 * Перенастройка: NEXT_PUBLIC_ARCHIVE_BASE (по умолчанию — репо vet-meteo).
 */
import type { ArchiveBundle, ArchiveLatest, ArchiveRow } from './types';

const BASE =
  process.env.NEXT_PUBLIC_ARCHIVE_BASE ?? 'https://raw.githubusercontent.com/shray77/vet-meteo/main';

async function fetchJson(url: string, ms = 7000): Promise<any | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchLatest(): Promise<ArchiveLatest | null> {
  const direct = await fetchJson(`${BASE}/data/latest.json`);
  if (direct?.stations?.length) return direct as ArchiveLatest;
  const proxy = await fetchJson('/api/archive');
  if (proxy?.stations?.length) return proxy as ArchiveLatest;
  return null;
}

/** Последние 3 дня снапшотов → почасовые серии THI по станциям. */
async function fetchHistory(): Promise<{ history: Record<string, ArchiveRow[]>; days: string[] }> {
  const history: Record<string, ArchiveRow[]> = {};
  const days: string[] = [];
  const now = new Date();
  const jobs: Promise<void>[] = [];
  for (let d = 0; d <= 3; d++) { // сегодня + 3 дня назад
    const day = new Date(now.getTime() - d * 86_400_000).toISOString().slice(0, 10);
    days.push(day);
    jobs.push(
      (async () => {
        let json: any = null;
        try {
          json = await fetchJson(`${BASE}/data/snapshots/${day}.json`);
        } catch {
          /* нет файла — ок */
        }
        if (!json?.hours) return;
        for (const entry of json.hours) {
          const s = entry.s ?? {};
          for (const [id, arr] of Object.entries<any[]>(s)) {
            if (!Array.isArray(arr) || arr.length < 4) continue; // [T, RH, wind, THI]
            if (!history[id]) history[id] = [];
            history[id].push([entry.ts, arr[0], arr[1], arr[2], arr[3]]);
          }
        }
      })(),
    );
  }
  await Promise.all(jobs);
  for (const id of Object.keys(history)) history[id].sort((a, b) => a[0].localeCompare(b[0]));
  return { history, days };
}

export async function loadArchive(): Promise<ArchiveBundle> {
  const [latest, hist] = await Promise.all([fetchLatest(), fetchHistory()]);
  return { latest, history: hist.history, days: hist.days };
}

/** Насколько свеж архив (null = архива нет). */
export function archiveAgeHours(updated: string): number | null {
  const t = Date.parse(updated);
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / 3_600_000;
}
