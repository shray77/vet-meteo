/**
 * Lightweight geocoder using Nominatim (OpenStreetMap) — free, rate-limited.
 *
 * Extracts toponyms (district/village names) from fsvps outbreak text
 * and geocodes them to precise lat/lon coordinates.
 *
 * Rate limit: 1 request per second (Nominatim usage policy).
 * Results cached in localStorage to avoid repeated lookups.
 */

interface GeoResult {
  lat: number;
  lon: number;
  displayName: string;
}

const CACHE_KEY = "vetkart-geocode-cache";
const RATE_LIMIT_MS = 1100; // Nominatim requires max 1 req/sec

/** Get cached geocoding results from localStorage. */
function getCache(): Record<string, GeoResult> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

/** Save geocoding results to localStorage. */
function setCache(cache: Record<string, GeoResult>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage might be full
  }
}

/**
 * Extract a searchable toponym from an outbreak's body text.
 * Looks for patterns like:
 *   "Борисовский м.о., с. Березовка"
 *   "Верхнемамонский район, с. Нижний Мамон"
 *   "г. Ялуторовск"
 *   "Исетский муниципальный округ, село Верхнебешкиль"
 */
export function extractToponym(text: string): string | null {
  if (!text) return null;

  // Pattern 1: "Район, село/д. Название" or "м.о., с. Название"
  const m1 = text.match(/([А-Я][а-яё]+(?:ский|ий|ой)\s+(?:район|м\.о\.|муниципальный округ)),?\s*(?:с\.|село|д\.|дер\.|пос\.|г\.)\s+([А-Я][а-яё]+(?:-[А-Я][а-яё]+)?)/);
  if (m1) return `${m1[2]}, ${m1[1]}, Россия`;

  // Pattern 2: just "с. Название" or "д. Название"
  const m2 = text.match(/(?:с\.|село|д\.|дер\.|пос\.)\s+([А-Я][а-яё]+(?:-[А-Я][а-яё]+)?)/);
  if (m2) return `${m2[1]}, Россия`;

  // Pattern 3: "г. Название"
  const m3 = text.match(/г\.\s+([А-Я][а-яё]+)/);
  if (m3) return `${m3[1]}, Россия`;

  return null;
}

/**
 * Geocode a toponym using Nominatim.
 * Returns null if not found or rate-limited.
 */
export async function geocode(toponym: string): Promise<GeoResult | null> {
  const cache = getCache();
  if (cache[toponym]) return cache[toponym];

  // Rate limit
  await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(toponym)}&format=json&limit=1&countrycodes=ru`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "VetKarta/6.0 (https://shray77.github.io/vet-heatmap/)",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length === 0) return null;

    const result: GeoResult = {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };

    cache[toponym] = result;
    setCache(cache);
    return result;
  } catch {
    return null;
  }
}

/**
 * Try to get precise coordinates for an outbreak.
 * Falls back to region centroid if geocoding fails.
 */
export async function getOutbreakCoordinates(
  outbreak: { notes?: string; region: string; lat?: number; lon?: number },
  regionCentroid?: [number, number] | null,
): Promise<[number, number] | null> {
  // If outbreak already has coordinates, use them
  if (typeof outbreak.lat === "number" && typeof outbreak.lon === "number"
      && !(outbreak.lat === 0 && outbreak.lon === 0)) {
    return [outbreak.lon, outbreak.lat];
  }

  // Try geocoding from outbreak text
  const toponym = extractToponym(outbreak.notes ?? outbreak.region);
  if (toponym) {
    const result = await geocode(toponym);
    if (result) {
      return [result.lon, result.lat];
    }
  }

  // Fall back to region centroid
  if (regionCentroid && regionCentroid[0] !== 0) {
    return regionCentroid;
  }

  return null;
}
