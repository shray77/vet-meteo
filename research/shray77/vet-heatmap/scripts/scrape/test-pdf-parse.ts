/**
 * Quick test — extract text from a fsvps daily PDF report.
 * Used to validate the PDF parsing approach before wiring into the scraper.
 */

import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";

async function main() {
  const pdfPath = process.argv[2] || "/tmp/fsvps-test.pdf";
  const buf = readFileSync(pdfPath);
  // pdfjs requires Uint8Array, not Buffer
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  console.log(`PDF: ${pdfPath} (${buf.length} bytes)`);

  const doc = await pdfjs.getDocument({ data }).promise;
  console.log(`Pages: ${doc.numPages}`);

  let allText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => (item as { str?: string }).str || "")
      .join(" ");
    console.log(`\n=== Page ${i} (first 500 chars) ===`);
    console.log(pageText.substring(0, 500));
    allText += pageText + "\n";
  }

  console.log(`\n=== Total text length: ${allText.length} ===`);
  console.log("\n=== Looking for disease keywords ===");
  const diseases = [
    "АЧС", "африканская чума", "КЧС", "классическая чума",
    "ящур", "бешенство", "сибирская язва", "грипп птиц",
    "блютунг", "бруцеллёз", "бруцеллез", "узелковый дерматит",
    "Ньюкасл", "Пеллагра", "чума мелких",
  ];
  for (const d of diseases) {
    const count = (allText.match(new RegExp(d, "gi")) || []).length;
    if (count > 0) {
      console.log(`  "${d}": ${count} mentions`);
    }
  }

  console.log("\n=== Looking for region keywords ===");
  const regions = [
    "область", "край", "Республика", "АО",
  ];
  for (const r of regions) {
    const count = (allText.match(new RegExp(r, "gi")) || []).length;
    console.log(`  "${r}": ${count} mentions`);
  }

  console.log("\n=== Looking for casualty patterns ===");
  const patterns = [
    /пало\s+(\d+)/gi,
    /заражено\s+(\d+)/gi,
    /выявлено\s+(\d+)/gi,
    /заболело\s+(\d+)/gi,
    /голов/gi,
    /особей/gi,
  ];
  for (const p of patterns) {
    const matches = allText.match(p);
    if (matches && matches.length > 0) {
      console.log(`  ${p}: ${matches.length} matches — first 5:`, matches.slice(0, 5));
    }
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
