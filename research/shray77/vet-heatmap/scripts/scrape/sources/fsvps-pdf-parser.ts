/**
 * fsvps PDF parser.
 *
 * Extracts outbreak records from daily fsvps situation reports (PDF).
 *
 * The PDF structure (verified against 19.06.2026 report):
 *
 *   ИНФОРМАЦИОННО-АНАЛИТИЧЕСКИЙ ЦЕНТР УПРАВЛЕНИЯ ВЕТНАДЗОРА
 *   ЭПИЗООТИЧЕСКАЯ СИТУАЦИЯ В РОССИЙСКОЙ ФЕДЕРАЦИИ
 *   19 июня 2026 год
 *   ...
 *   Информация по сообщениям региональных ветеринарных служб и СМИ
 *
 *   Бешенство животных
 *    Белгородская область 1, 2: Борисовский м.о., с. Березовка – кот, с. Зыбино – собака.
 *    Воронежская область 3: Верхнемамонский район, с. Нижний Мамон – кошка.
 *   ...
 *   Оценка значимости новостного события: ...
 *   ИТОГ (СУММАРНАЯ ОЦЕНКА СОБЫТИЯ) согласно балльным оценкам по 6 составляющим: 2,6
 *
 *   Бешенство животных, снятие карантина
 *    Владимирская область 9: Суздальский м.о., с. Богослово.
 *   ...
 *
 *   Бруцеллёз МРС
 *    Московская область 12: Распоряжением ... установлены ограничительные мероприятия (карантин)...
 *
 *   Лабораторное подтверждение заболеваний животных на территории России в 2026 году
 *   по данным ФГИС "СИРАНО" (система раннего оповещения)
 *   o Бешенство: Алтайский край (собака), Новосибирская область (кошка), ...
 *   o Варроатоз пчёл: Иркутская область, Оренбургская область, Челябинская область.
 *
 * Approach:
 *   1. Extract text from PDF (pdfjs-dist)
 *   2. Walk through text, identifying disease section headers (BEE / TAG_LINE)
 *   3. For each section, parse list items starting with marker "" or "o"
 *   4. For each item: extract region (first match of <Name> область|край|Республика <Name>),
 *      status (Ongoing if "установлены ограничительные" / "карантин", Resolved if "снятие" / "отменены"),
 *      species (from known list or from "(вид)" pattern)
 *   5. Return list of RawArticle records
 *
 * Limitations (acceptable for v2):
 *   - cases/deaths are usually not in these PDFs (only quarantine orders); we set cases=0, deaths=0
 *   - some entries are about lifting quarantine (we mark as Resolved)
 *   - "Профилактические мероприятия" and "Научные публикации" sections are skipped
 */

import type { RawArticle, Outbreak, SourceKey } from "../../../src/types/domain";
import { normalizeDisease, getDiseaseLabels } from "../../../src/data/diseases-normalize";
import { normalizeRegion } from "../../../src/data/regions";
import type { DiseaseKey, DiseaseGroup, OutbreakStatus } from "../../../src/types/domain";

// Marker character used by fsvps to prefix list items in disease sections.
// In the PDF text extraction it appears as the unicode char \u0007 (BELL) or as
// a bullet "•" or "o". We accept any of them.
const LIST_MARKER = /[\u0007•\u25CF]|\bo\b|^o\b/;
const LIST_ITEM_START = /[\u0007•\u25CF]\s*|\bo\.\s+/g;

// Disease section headers in fsvps reports.
// Each entry: { aliases (lowercase prefixes that match), canonical_key }
const DISEASE_SECTIONS: { aliases: string[]; key: DiseaseKey }[] = [
  { aliases: ["бешенство животных", "бешенство"], key: "rabies" },
  { aliases: ["бруцеллёз мрс", "бруцеллез мрс", "бруцеллёз", "бруцеллез"], key: "brucellosis" },
  { aliases: ["лейкоз крс", "лейкоз крупного рогатого"], key: "leukosis" },
  { aliases: ["лептоспироз крс", "лептоспироз"], key: "lepto" },
  { aliases: ["трихинеллёз", "трихинеллез"], key: "trichinellosis" },
  { aliases: ["варроатоз пчёл", "варроатоз пчел", "варроатоз"], key: "varroosis" },
  { aliases: ["нозематоз пчёл", "нозематоз пчел", "нозематоз"], key: "nosemosis" },
  { aliases: ["весенняя виремия карпов", "виремия карпов"], key: "svc" },
  { aliases: ["сальмонеллёз птицы", "сальмонеллез птицы", "сальмонеллёз", "сальмонеллез"], key: "avian_salmonellosis" },
  { aliases: ["африканская чума свиней", "ачс"], key: "asf" },
  { aliases: ["классическая чума свиней", "кчс"], key: "csf" },
  { aliases: ["ящур"], key: "fmd" },
  { aliases: ["сибирская язва"], key: "anthrax" },
  { aliases: ["грипп птиц", "грипп птиц h5"], key: "hpai" },
  { aliases: ["болезнь ньюкасла", "ньюкасл"], key: "newcastle" },
  { aliases: ["блютунг"], key: "bluetongue" },
  { aliases: ["туберкулёз крс", "туберкулез крс", "туберкулёз"], key: "btb" },
  { aliases: ["чума мелких жвачных", "чмж"], key: "ppr" },
  { aliases: ["узелковый дерматит"], key: "lsd" },
  { aliases: ["лихорадка западного нила", "лзн"], key: "wnv" },
  { aliases: ["инфекционная анемия лошадей", "иал"], key: "eia" },
];

// Skip these sections — not outbreaks
const SKIP_SECTIONS = [
  "профилактические мероприятия",
  "научные публикации",
  "лабораторное подтверждение", // handled separately below
  "итог (суммарная оценка",
  "оценка значимости",
  "значимость опасности",
];

// Species extraction
const SPECIES_PATTERNS: { pattern: RegExp; species: string }[] = [
  { pattern: /\bкрупн[а-я]+\s+рогат[а-я]+\s+скот\b|\bкрс\b/i, species: "Cattle" },
  { pattern: /\bмелк[а-я]+\s+рогат[а-я]+\s+скот\b|\bмрс\b/i, species: "Sheep/Goats" },
  { pattern: /\bсвин[а-я]+\b/i, species: "Swine (domestic)" },
  { pattern: /\bдик[а-я]+\s+кабан[а-я]+\b/i, species: "Wild boar" },
  { pattern: /\bптиц[а-я]+\b|\bптиц\b/i, species: "Poultry" },
  { pattern: /\bкон[а-я]+\b|\bлошад[а-я]+\b/i, species: "Horse" },
  { pattern: /\bлис[а-я]+\b/i, species: "Fox" },
  { pattern: /\bволк[а-я]*\b/i, species: "Wolf" },
  { pattern: /\bенот[а-я]+\s+собак[а-я]+\b|\bенот[а-я]+\b/i, species: "Raccoon dog" },
  { pattern: /\bкот\b|\bкошк[а-я]+\b/i, species: "Other" },
  { pattern: /\bсобак[а-я]+\b/i, species: "Other" },
  { pattern: /\bмедвед[а-я]+\b/i, species: "Wildlife" },
];

// Region pattern: matches "X область", "X край", "Республика X", "X АО"
const REGION_PATTERN = /((?:Республика\s+)?[А-Я][а-яё]+(?:-[А-Я][а-яё]+)?\s*(?:область|край|АО|автономная область|автономный округ)|(?:г\.?\s*)?(?:Москва|Санкт-Петербург|Севастополь|Байконур))/g;

/** Extract (disease_section, status_modifier, items) from full PDF text. */
interface ParsedSection {
  disease_key: DiseaseKey;
  disease_label: string;
  status: OutbreakStatus; // "Ongoing" if "установлены", "Resolved" if "снятие"/"отменены"
  items: string[]; // raw text of each list item
}

function parseSections(text: string): ParsedSection[] {
  const sections: ParsedSection[] = [];

  // Normalize text: collapse multiple spaces
  const normalized = text.replace(/\s+/g, " ").trim();

  // Find all disease section headers and their positions.
  // A header appears as standalone text: after a period+space or at start.
  const headerPositions: { start: number; end: number; disease_key: DiseaseKey; disease_label: string; status: OutbreakStatus }[] = [];

  for (const { aliases, key } of DISEASE_SECTIONS) {
    for (const alias of aliases) {
      // Look for the alias followed by either:
      //   - ", снятие карантина" (Resolved)
      //   - end of sentence/section (period, space, then list marker or capital letter)
      //   - space + list marker
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Match alias, optional ", снятие..." suffix, until we hit list marker or end
      const re = new RegExp(
        `(${escapedAlias})` +
        `(,?\\s*(?:снятие\\s+карантина|отмена\\s+карантина|снятие\\s+ограничений|снятие\\s+карантина))?`,
        "gi",
      );
      let m: RegExpExecArray | null;
      while ((m = re.exec(normalized)) !== null) {
        const start = m.index;
        const end = m.index + m[0].length;
        const status: OutbreakStatus =
          m[2] && /(снятие|отмен)/i.test(m[2]) ? "Resolved" : "Ongoing";
        headerPositions.push({
          start,
          end,
          disease_key: key,
          disease_label: m[1],
          status,
        });
      }
    }
  }

  // Sort headers by position
  headerPositions.sort((a, b) => a.start - b.start);

  // Deduplicate overlapping headers — keep the longest match at each position
  const deduped: typeof headerPositions = [];
  for (const h of headerPositions) {
    const last = deduped[deduped.length - 1];
    if (last && h.start < last.end) {
      // Overlap — keep the one with longer label (more specific match)
      if (h.disease_label.length > last.disease_label.length) {
        deduped[deduped.length - 1] = h;
      }
    } else {
      deduped.push(h);
    }
  }
  headerPositions.length = 0;
  headerPositions.push(...deduped);

  // For each header, extract items until the next header or a SKIP_SECTION marker
  for (let i = 0; i < headerPositions.length; i++) {
    const h = headerPositions[i];
    const nextHeader = headerPositions[i + 1];
    const sectionEnd = nextHeader ? nextHeader.start : normalized.length;
    let sectionText = normalized.substring(h.end, sectionEnd);

    // Cut at first SKIP_SECTION
    for (const skip of SKIP_SECTIONS) {
      const idx = sectionText.toLowerCase().indexOf(skip);
      if (idx >= 0) {
        sectionText = sectionText.substring(0, idx);
      }
    }

    // Split by list markers (•, o, \u0007, \uf0d8 Wingdings bullet) AND by region-start patterns.
    // The actual fsvps PDF uses \uf0d8 (Wingdings bullet, Unicode 61656) as the list marker.
    const items = sectionText
      .replace(/[\u0007•\u25CF\uf0d8]\s*/g, "\nITEM:")
      .replace(/\bo\.\s+/g, "\nITEM:")
      // Also split when a new region appears after a period (e.g., ". Калужская область")
      .replace(/\.\s+(?=((?:Республика\s+)?[А-Я][а-яё]+(?:-[А-Я][а-яё]+)?\s*(?:область|край|АО)))/g, "\nITEM:")
      .split("\nITEM:")
      .map((s) => {
        // Cut each item at first ". " that ends a sentence (heuristic: period + space + capital)
        const cutAt = s.search(/\.\s+[А-Я]/);
        return (cutAt > 0 ? s.substring(0, cutAt + 1) : s).trim();
      })
      .filter((s) => s.length > 5 && /[а-яА-Я]/.test(s) && extractRegion(s));

    if (items.length === 0) continue;

    sections.push({
      disease_key: h.disease_key,
      disease_label: h.disease_label,
      status: h.status,
      items,
    });
  }

  return sections;
}

/** Extract region from an item text. */
function extractRegion(text: string): string | null {
  REGION_PATTERN.lastIndex = 0;
  const m = REGION_PATTERN.exec(text);
  if (m) {
    let r = m[0].trim();
    // Fix common parser issues:
    // "Мансийский автономный округ" → "Ханты-Мансийский автономный округ"
    // (the "Ханты-" prefix is on a previous line in the PDF)
    r = r.replace(/^Мансийский автономный округ$/i, "Ханты-Мансийский автономный округ");
    return r;
  }
  return null;
}

/** Extract species from an item text. */
function extractSpecies(text: string): string {
  // First try "(вид)" pattern: e.g., "(собака)" — most reliable for short items
  // But skip non-species parentheticals like "(карантин)", "(снятие)", "(по состоянию на...)"
  const parenMatches = text.matchAll(/\(([а-яА-Яё\s/\-]{3,30})\)/g);
  for (const pm of parenMatches) {
    const sp = pm[1].trim().toLowerCase();
    // Skip non-species parentheticals
    if (/карантин|снятие|отмена|по состоян|согласно|тыс\.|млн|голов|особ|индекс|сист/i.test(sp)) {
      continue;
    }
    // Map common RU species names to our canonical species
    if (/кот|кошк/.test(sp)) return "Other";
    if (/собак/.test(sp)) return "Other";
    if (/лис/.test(sp)) return "Fox";
    if (/волк/.test(sp)) return "Wolf";
    if (/енот/.test(sp)) return "Raccoon dog";
    if (/медвед/.test(sp)) return "Wildlife";
    if (/крс|крупн/.test(sp)) return "Cattle";
    if (/мрс|мелк/.test(sp)) return "Sheep/Goats";
    if (/свин/.test(sp)) return "Swine (domestic)";
    if (/птиц/.test(sp)) return "Poultry";
    if (/лошад|кон/.test(sp)) return "Horse";
    return pm[1].trim();
  }

  // Otherwise, look for species keywords in the text — but EXCLUDE the word "карантин"
  // (which appears as "(карантин)" in legal text)
  for (const { pattern, species } of SPECIES_PATTERNS) {
    if (pattern.test(text)) return species;
  }

  return "Other";
}

/** Extract number from text by keyword (пало, заражено, выявлено, etc.). */
function extractNumber(text: string, keywords: string[]): number | undefined {
  for (const kw of keywords) {
    const re = new RegExp(`${kw}\\s+(\\d+)`, "i");
    const m = text.match(re);
    if (m) return parseInt(m[1], 10);
  }
  return undefined;
}

/** Extract municipality/district from an item text.
 *  Patterns: "Борисовский м.о.", "Верхнемамонский район", "Суздальский м.о.",
 *            "с. Березовка", "с. Зыбино", "д. Ивановка", "пос. Лесной"
 */
function extractMunicipality(text: string): string | null {
  // Try "X район" or "X м.о." (муниципальный округ)
  const districtMatch = text.match(/([А-Я][а-яё\-]+(?:ский|ая|ое|ий)\s+(?:район|м\.о\.|муниципальный округ|городской округ))/);
  if (districtMatch) return districtMatch[1].trim();

  // Try "с. Name" / "д. Name" / "пос. Name" / "г. Name" / "ст. Name"
  const settlementMatch = text.match(/(?:^|[,;:.\s])((?:с|д|пос|г|ст|х|аул)\.\s+[А-Я][а-яё\-]+)/);
  if (settlementMatch) return settlementMatch[1].trim();

  // Try "в населенном пункте Name" or "н.п. Name"
  const npMatch = text.match(/(?:населенн\w*\s+пункт\w*|н\.п\.)\s+([А-Я][а-яё\-]+)/);
  if (npMatch) return npMatch[1].trim();

  return null;
}

/** Extract all settlement names from text (for geocoding). */
function extractSettlements(text: string): string[] {
  const settlements: string[] = [];
  // Match "с. Name", "д. Name", "пос. Name", "г. Name", "ст. Name", "х. Name"
  const re = /(?:с|д|пос|г|ст|х|аул)\.\s+([А-Я][а-яё\-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    settlements.push(m[1]);
  }
  return settlements;
}

/** Convert a parsed section + item to a RawArticle. */
function itemToArticle(
  section: ParsedSection,
  itemText: string,
  reportDate: string,
  sourceUrl: string,
): RawArticle | null {
  const region = extractRegion(itemText);
  if (!region) return null;

  let species = extractSpecies(itemText);

  // Infer species from disease label if not detected from item text
  if (species === "Other") {
    const dl = section.disease_label.toLowerCase();
    if (/мрс|мелк.*рогат/.test(dl)) species = "Sheep/Goats";
    else if (/крс|крупн.*рогат|лейкоз|бруцеллёз/.test(dl)) species = "Cattle";
    else if (/пчёл|пчел/.test(dl)) species = "Other";
    else if (/птиц|ньюкасл|грипп/.test(dl)) species = "Poultry";
    else if (/свин|ачс|кчс/.test(dl)) species = "Swine (domestic)";
    else if (/бешенств/.test(dl)) species = "Wildlife";
  }

  const cases = extractNumber(itemText, ["заражено", "выявлено", "заболело", "инфицировано"]);
  const deaths = extractNumber(itemText, ["пало", "погибло", "усыпано"]);

  // Feature 4: Advanced metadata extraction
  const farmType = extractFarmType(itemText);
  const animalCount = extractNumber(itemText, ["голов", "особей", "животных", "птиц"]);

  // Municipality/district extraction
  const municipality = extractMunicipality(itemText);
  const settlements = extractSettlements(itemText);

  return {
    source: "fsvps",
    url: sourceUrl,
    title: `${section.disease_label} — ${region}${municipality ? ` (${municipality})` : ""}`,
    published_at: reportDate,
    body_text: itemText,
    detected_disease: section.disease_label,
    detected_region: region,
    detected_species: species,
    detected_cases: cases,
    detected_deaths: deaths,
    detected_farm_type: farmType,
    detected_animal_count: animalCount,
    detected_municipality: municipality,
    detected_settlements: settlements.length > 0 ? settlements : undefined,
  };
}

/**
 * Feature 4: Extract farm/household type from text.
 * Returns: "ЛПХ" | "КФХ" | "Свиноводческий комплекс" | "Птицефабрика" | "Ферма" | null
 */
function extractFarmType(text: string): string | null {
  const lower = text.toLowerCase();
  if (/лпх|личн\w*\s+подсобн\w*\s+хозяйств/i.test(text)) return "ЛПХ";
  if (/кфх|крестьянск\w*\s+фермерск\w*\s+хозяйств/i.test(text)) return "КФХ";
  if (/свиноводч\w*\s+комплекс|свинокомплекс/i.test(text)) return "Свиноводческий комплекс";
  if (/птицефабрик|птицеводч\w*\s+предприяти/i.test(text)) return "Птицефабрика";
  if (/фермерск\w*\s+хозяйств|сельскохозяйств\w*\s+организац/i.test(text)) return "Ферма";
  if (/зоопарк|зоосад/i.test(text)) return "Зоопарк";
  if (/приют/i.test(text)) return "Приют";
  return null;
}

/** Convert a RawArticle to an Outbreak. */
export function rawToOutbreak(raw: RawArticle, id: number): Outbreak {
  const disease_key = normalizeDisease(raw.detected_disease ?? "");
  const labels = getDiseaseLabels(disease_key);
  const region_geo = normalizeRegion(raw.detected_region ?? "") ?? "";
  const status: OutbreakStatus =
    raw.body_text && /(снятие|отмен)/i.test(raw.body_text) ? "Resolved" : "Ongoing";

  return {
    id,
    disease_key,
    disease: labels.ru,
    disease_group: labels.group as DiseaseGroup,
    region: raw.detected_region ?? "",
    region_geo,
    date: raw.published_at,
    species: raw.detected_species ?? "Other",
    cases: raw.detected_cases ?? 0,
    deaths: raw.detected_deaths ?? 0,
    status,
    source: "fsvps" as SourceKey,
    source_url: raw.url,
    notes: raw.title,
  };
}

/**
 * Main entry: parse fsvps PDF text → RawArticle[].
 *
 * @param pdfText  Full text extracted from the PDF (joined pages)
 * @param reportDate  ISO date of the report (YYYY-MM-DD)
 * @param sourceUrl  URL of the PDF
 * @param cacheDir  Optional dir for cache/debug dumps
 */
export function parseFsvpsReport(
  pdfText: string,
  reportDate: string,
  sourceUrl: string,
): RawArticle[] {
  console.log(`[fsvps-pdf] Parsing report ${reportDate} (${pdfText.length} chars)`);
  const sections = parseSections(pdfText);
  console.log(`[fsvps-pdf] Found ${sections.length} disease sections`);

  const articles: RawArticle[] = [];
  for (const s of sections) {
    console.log(`[fsvps-pdf]   ${s.disease_label} (${s.status}): ${s.items.length} items`);
    for (const item of s.items) {
      const article = itemToArticle(s, item, reportDate, sourceUrl);
      if (article) articles.push(article);
    }
  }

  console.log(`[fsvps-pdf] Total articles extracted: ${articles.length}`);
  return articles;
}

// ─── CLI for testing ─────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const pdfPath = process.argv[2] || "/tmp/fsvps-test.pdf";
  const reportDate = process.argv[3] || "2026-06-19";
  const sourceUrl = process.argv[4] || "https://fsvps.gov.ru/test.pdf";

  (async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { readFileSync } = await import("node:fs");
    const buf = readFileSync(pdfPath);
    const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    const doc = await pdfjs.getDocument({ data }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: unknown) => (it as { str?: string }).str || "").join(" ") + "\n";
    }
    const articles = parseFsvpsReport(text, reportDate, sourceUrl);
    console.log("\n=== Sample articles ===");
    for (const a of articles.slice(0, 8)) {
      console.log(JSON.stringify(a, null, 2));
    }
  })().catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
}
