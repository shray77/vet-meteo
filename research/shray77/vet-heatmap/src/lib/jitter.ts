/**
 * Deterministic Spatial Jittering for Outbreak Coordinates.
 *
 * When multiple outbreaks share the same region centroid (e.g. lat/lon missing),
 * this module applies a deterministic Fibonacci spiral offset (5-25 km radius)
 * based on a hash of the outbreak ID or index.
 *
 * This prevents 20+ markers from stacking on top of each other at the exact same point.
 */

/** Simple hash function for string (FNV-1a 32-bit). */
export function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export interface Coordinates {
  lat: number;
  lon: number;
}

/**
 * Apply a deterministic Fibonacci spiral offset to a base coordinate.
 *
 * @param base Base lat/lon (e.g. region centroid)
 * @param index Index or sequence number of the item in the regional cluster
 * @param outbreakId Unique identifier for deterministic hash seed
 * @param maxRadiusKm Maximum offset radius in kilometers (default: 25 km)
 */
export function applySpatialJitter(
  base: Coordinates,
  index: number,
  outbreakId: string = "",
  maxRadiusKm: number = 25
): Coordinates {
  if (index === 0 && !outbreakId) {
    return base;
  }

  // Golden ratio angle (~137.5 degrees in radians)
  const GOLDEN_ANGLE = 2.399963229728653;
  
  // Seed pseudo-random offset using outbreak ID hash if available
  const seed = outbreakId ? (hashString(outbreakId) % 100) / 100 : 0;
  
  const step = index + 1 + seed;
  const angle = step * GOLDEN_ANGLE;
  
  // Radius grows sub-linearly with step count, capped at maxRadiusKm
  const radiusKm = Math.min(maxRadiusKm, 3 + Math.sqrt(step) * 3.5);

  // 1 degree latitude ~ 111 km
  const deltaLat = (radiusKm * Math.cos(angle)) / 111.0;
  
  // 1 degree longitude ~ 111 km * cos(lat)
  const latRad = (base.lat * Math.PI) / 180.0;
  const cosLat = Math.cos(latRad) || 1.0;
  const deltaLon = (radiusKm * Math.sin(angle)) / (111.0 * cosLat);

  return {
    lat: Number((base.lat + deltaLat).toFixed(5)),
    lon: Number((base.lon + deltaLon).toFixed(5)),
  };
}
