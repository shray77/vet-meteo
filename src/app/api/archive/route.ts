/**
 * /api/archive — серверный прокси к архиву GitHub Actions
 * (raw.githubusercontent), кэш 10 минут. Фолбэк-путь, если браузеру
 * напрямую raw недоступен.
 */
import { NextResponse } from 'next/server';

export const revalidate = 600;

const BASE =
  process.env.NEXT_PUBLIC_ARCHIVE_BASE ?? 'https://raw.githubusercontent.com/shray77/vet-meteo/main';

export async function GET() {
  try {
    const r = await fetch(`${BASE}/data/latest.json`, { next: { revalidate: 600 } });
    if (!r.ok) {
      return NextResponse.json({ error: `raw ${r.status}` }, { status: 502 });
    }
    const j = await r.json();
    return NextResponse.json(j);
  } catch {
    return NextResponse.json({ error: 'архив недоступен' }, { status: 502 });
  }
}
