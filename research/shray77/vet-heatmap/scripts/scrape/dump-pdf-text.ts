/**
 * Dump full text of fsvps PDF for analysis.
 */
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync, writeFileSync } from "node:fs";

async function main() {
  const pdfPath = process.argv[2] || "/tmp/fsvps-test.pdf";
  const buf = readFileSync(pdfPath);
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);

  const doc = await pdfjs.getDocument({ data }).promise;
  let allText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: unknown) => (item as { str?: string }).str || "")
      .join(" ");
    allText += `\n\n=== PAGE ${i} ===\n${pageText}`;
  }
  writeFileSync("/tmp/fsvps-text.txt", allText);
  console.log(`Full text saved to /tmp/fsvps-text.txt (${allText.length} chars)`);
}
main().catch(console.error);
