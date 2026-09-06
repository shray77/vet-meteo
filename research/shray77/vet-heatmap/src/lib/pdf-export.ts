/**
 * PDF report generator — exports a summary of outbreaks as PDF.
 *
 * Uses jsPDF to create a structured report with:
 *   - Header (title, date, region)
 *   - Statistics summary
 *   - Outbreak table
 *   - Disease breakdown
 *   - Footer (source, disclaimer)
 */

// jsPDF is dynamically imported inside generateOutbreakReport() to avoid SSR issues
import type { Outbreak } from "@/types/domain";
import { DISEASE_LABELS } from "@/data/diseases-normalize";
import { speciesRu } from "@/lib/i18n-species";
import { REGION_PROPERTIES } from "@/data/regions";
import { diseaseColor } from "@/lib/colors";

export async function generateOutbreakReport(
  outbreaks: Outbreak[],
  opts: { regionName?: string; totalRegions: number },
) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // ─── Header ───
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("ВетКарта — Отчёт по эпизоотической обстановке", margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Дата: ${new Date().toLocaleDateString("ru-RU")}`, margin, y);
  y += 5;
  if (opts.regionName) {
    const props = REGION_PROPERTIES[opts.regionName];
    doc.text(
      `Регион: ${props?.name_ru ?? opts.regionName}${props?.federal_district ? ` (${props.federal_district})` : ""}`,
      margin,
      y,
    );
    y += 5;
  }
  y += 3;

  // ─── Stats ───
  const total = outbreaks.length;
  const ongoing = outbreaks.filter((o) => o.status === "Ongoing").length;
  const diseases = new Set(outbreaks.map((o) => o.disease_key)).size;
  const totalCases = outbreaks.reduce((s, o) => s + o.cases, 0);
  const totalDeaths = outbreaks.reduce((s, o) => s + o.deaths, 0);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Сводка:", margin, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const statsLines = [
    `Всего вспышек: ${total}`,
    `Активных: ${ongoing}`,
    `Типов болезней: ${diseases}`,
    `Всего случаев: ${totalCases}`,
    `Пало: ${totalDeaths}`,
  ];
  for (const line of statsLines) {
    doc.text(line, margin + 5, y);
    y += 4.5;
  }
  y += 3;

  // ─── Disease breakdown ───
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("По болезням:", margin, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const byDisease = new Map<string, number>();
  for (const o of outbreaks) {
    byDisease.set(o.disease_key, (byDisease.get(o.disease_key) ?? 0) + 1);
  }
  for (const [key, count] of Array.from(byDisease.entries()).sort((a, b) => b[1] - a[1])) {
    const labels = DISEASE_LABELS[key as keyof typeof DISEASE_LABELS];
    doc.text(`  ${labels?.short_ru ?? key}: ${count}`, margin + 5, y);
    y += 4.5;
  }
  y += 5;

  // ─── Outbreak table ───
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Вспышки (последние 30):", margin, y);
  y += 5;

  // Table header
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const colX = [margin, margin + 22, margin + 70, margin + 115, margin + 140, margin + 160];
  const headers = ["Дата", "Болезнь", "Регион", "Вид", "Случаи", "Статус"];
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], colX[i], y);
  }
  y += 4;
  doc.setDrawColor(200);
  doc.line(margin, y - 1, pageWidth - margin, y - 1);

  // Table rows
  doc.setFont("helvetica", "normal");
  const sorted = [...outbreaks].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  for (const o of sorted) {
    if (y > pageHeight - 25) {
      doc.addPage();
      y = 20;
    }
    const labels = DISEASE_LABELS[o.disease_key as keyof typeof DISEASE_LABELS];
    const date = new Date(o.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit" });
    const disease = labels?.short_ru ?? o.disease;
    const region = o.region.length > 30 ? o.region.substring(0, 28) + "…" : o.region;
    const species = speciesRu(o.species).substring(0, 15);
    const cases = o.cases > 0 ? String(o.cases) : "—";
    const status = o.status === "Ongoing" ? "Активна" : "Заверш.";

    doc.text(date, colX[0], y);
    doc.text(disease, colX[1], y);
    doc.text(region, colX[2], y);
    doc.text(species, colX[3], y);
    doc.text(cases, colX[4], y);
    doc.text(status, colX[5], y);
    y += 4;
  }

  // ─── Footer ───
  y = pageHeight - 20;
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(128);
  doc.text(
    "Источник: fsvps.gov.ru (Россельхознадзор) · Сгенерировано ВетКарта · https://shray77.github.io/vet-heatmap/",
    margin,
    y,
  );
  y += 4;
  doc.text(
    "Информация носит справочный характер. Для точных данных обратитесь в территориальное управление ветеринарии.",
    margin,
    y,
  );

  doc.setTextColor(0);

  // Save
  const filename = `vetkart-otchet-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
