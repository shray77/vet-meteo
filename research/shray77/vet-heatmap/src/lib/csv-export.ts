/**
 * CSV export utility for filtered outbreaks.
 *
 * Generates a CSV string from an array of Outbreak objects and triggers
 * a browser download. Columns are chosen for compatibility with Excel
 * (Russian locale uses ';' as separator by default).
 *
 * Usage:
 *   import { exportOutbreaksCSV } from "@/lib/csv-export";
 *   exportOutbreaksCSV(filteredOutbreaks, "АЧС_ЦФО_2024");
 */

import type { Outbreak } from "@/types/domain";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { speciesRu, sourceRu } from "@/lib/i18n-species";

/** CSV column definitions: [header, getter]. */
const COLUMNS: [string, (o: Outbreak) => string][] = [
  ["ID", (o) => String(o.id)],
  ["Дата", (o) => o.date],
  ["Болезнь", (o) => DISEASE_LABELS[o.disease_key]?.ru ?? o.disease],
  ["Болезнь (сокр.)", (o) => DISEASE_LABELS[o.disease_key]?.short_ru ?? o.disease_key],
  ["Регион", (o) => o.region],
  ["Регион (EN)", (o) => o.region_geo],
  ["Федеральный округ", (o) => o.federal_district ?? ""],
  ["Муниципалитет", (o) => o.municipality ?? ""],
  ["Вид животных", (o) => speciesRu(o.species)],
  ["Статус", (o) => o.status === "Ongoing" ? "Активна" : o.status === "Resolved" ? "Завершена" : "Неизвестно"],
  ["Случаев", (o) => String(o.cases)],
  ["Пало", (o) => String(o.deaths)],
  ["Широта", (o) => o.lat?.toFixed(4) ?? ""],
  ["Долгота", (o) => o.lon?.toFixed(4) ?? ""],
  ["Источник", (o) => sourceRu(o.source)],
  ["URL источника", (o) => o.source_url ?? ""],
  ["Заметки", (o) => o.notes ?? ""],
];

/**
 * Escape a value for CSV: wrap in quotes if it contains separator, quote,
 * or newline. Double any existing quotes inside.
 */
function escapeCSV(value: string, separator: string): string {
  if (!value) return "";
  if (value.includes(separator) || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate CSV string from outbreaks.
 * @param separator — ';' for Russian Excel, ',' for international
 */
export function outbreaksToCSV(outbreaks: Outbreak[], separator = ";"): string {
  const header = COLUMNS.map(([h]) => escapeCSV(h, separator)).join(separator);
  const rows = outbreaks.map((o) =>
    COLUMNS.map(([, getter]) => escapeCSV(getter(o), separator)).join(separator),
  );
  // Prepend BOM for Excel to correctly detect UTF-8 with Cyrillic
  return "\uFEFF" + [header, ...rows].join("\r\n");
}

/**
 * Trigger browser download of the CSV file.
 */
export function exportOutbreaksCSV(outbreaks: Outbreak[], filenamePrefix = "vetkarta_outbreaks"): void {
  const csv = outbreaksToCSV(outbreaks);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `${filenamePrefix}_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
