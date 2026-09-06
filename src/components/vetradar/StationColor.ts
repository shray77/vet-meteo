/** Общий цвет THI для карты и таблиц. */
export function thiColor(v: number | undefined | null): string {
  if (v == null || !Number.isFinite(v)) return '#8a8a6a';
  if (v < 68) return '#5f9e5f';
  if (v < 72) return '#a8b845';
  if (v < 80) return '#e0a636';
  if (v < 90) return '#d95f2b';
  return '#c0392b';
}
