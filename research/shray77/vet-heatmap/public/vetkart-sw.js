/**
 * Service Worker for ВетКарта (VetHeatmap) PWA.
 *
 * CACHE BUSTING STRATEGY:
 *   The SW fetches /vet-heatmap/version.json on install/activate.
 *   version.json is regenerated on every build (by next.config.ts) with
 *   format "<pkg.version>+<git-sha>" — unique per deploy.
 *   The version becomes the cache name suffix → different version =
 *   different cache = old caches auto-deleted on activate.
 *   This means EVERY deploy invalidates ALL caches (HTML, JS, CSS, JSON)
 *   automatically — no need to manually bump versions or ask users to
 *   clear cookies/cache.
 *
 * STRATEGY:
 *   - Precache: app shell (HTML, manifest, icons, version.json).
 *     Data JSONs (outbreaks.json, enterprises.json) are NOT precached —
 *     they change via CI 4×/day and would go stale. Runtime SWR handles them.
 *   - Runtime: stale-while-revalidate for same-origin GET requests.
 *   - Cache-only for map tiles (with fallback to network if missing).
 *
 * Works on GitHub Pages (basePath /vet-heatmap/).
 */

const BASE = "/vet-heatmap"; // GitHub Pages subpath
const FALLBACK_VERSION = "fallback-" + Date.now(); // only used if version.json fetch fails
let CACHE_VERSION = FALLBACK_VERSION;
let CACHE_NAME = `vetkart-${CACHE_VERSION}`;

// Resources to precache on install. Data JSONs are intentionally EXCLUDED —
// they update via CI 4×/day and would go stale if precached. SW handles them
// via runtime SWR strategy (always revalidates against network).
const PRECACHE_URLS = [
  `${BASE}/`,
  `${BASE}/manifest.webmanifest`,
  `${BASE}/version.json`,  // MUST be precached so activate() can read it
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`,
];

// Map tile hosts — cache aggressively for offline field use
const TILE_HOSTS = [
  "basemaps.cartocdn.com",
  "server.arcgisonline.com",
  "tile.openstreetmap.org",
];

// ─── Helper: fetch current build version from version.json ──────────────
// Called during install. Result is stored in CACHE_VERSION and used to
// name the cache. If the version differs from any existing cache, activate()
// will delete the old caches.
async function refreshVersion() {
  try {
    const res = await fetch(`${BASE}/version.json`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (data?.version && typeof data.version === "string") {
      CACHE_VERSION = data.version;
      CACHE_NAME = `vetkart-${CACHE_VERSION}`;
      console.log(`[sw] build version: ${CACHE_VERSION}`);
    }
  } catch (e) {
    console.warn("[sw] failed to fetch version.json, using fallback:", e);
  }
}

// ─── Install: precache static assets ──────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await refreshVersion();
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.addAll(PRECACHE_URLS);
      } catch (e) {
        // Some precache URLs may 404 in dev — ignore
        console.warn("[sw] precache partial failure:", e.message);
      }
      // Force the new SW to take over immediately (no waiting for old SW
      // to be released). Combined with `clients.claim()` in activate, this
      // means new code applies on next page load.
      await self.skipWaiting();
    })(),
  );
});

// ─── Activate: clean up old caches + claim clients ────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Re-fetch version in case install missed it
      if (CACHE_VERSION === FALLBACK_VERSION) await refreshVersion();

      // Delete ALL caches that don't match the current version.
      // This is the core of auto-cache-busting: every deploy produces a
      // new version.json → new CACHE_NAME → all old caches deleted.
      const keys = await caches.keys();
      const oldKeys = keys.filter((k) => k !== CACHE_NAME);
      await Promise.all(oldKeys.map((k) => {
        console.log(`[sw] deleting old cache: ${k}`);
        return caches.delete(k);
      }));

      // Take control of all clients immediately — new SW applies on next load
      await self.clients.claim();

      // Notify all open clients to reload — ensures they pick up new code
      // without the user needing to manually refresh.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const c of clients) {
        c.postMessage({ type: "SW_ACTIVATED", version: CACHE_VERSION });
      }
    })(),
  );
});

// ─── Fetch: stale-while-revalidate + tile caching ─────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only handle same-origin + known tile hosts
  const isSameOrigin = url.origin === self.location.origin;
  const isTileHost = TILE_HOSTS.some((h) => url.hostname.includes(h));

  if (!isSameOrigin && !isTileHost) return;

  // Skip Next.js HMR / dev-only requests
  if (url.pathname.includes("/_next/webpack-hmr")) return;

  // For version.json: always network-first (no cache) — must be fresh
  // so SW can detect new deploys and invalidate caches.
  if (url.pathname === `${BASE}/version.json`) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Strategy: stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);

      // For tile hosts, prefer cache (offline-friendly)
      if (isTileHost) {
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return cached || new Response("", { status: 504 });
        }
      }

      // For same-origin: SWR
      const networkPromise = fetch(req)
        .then((fresh) => {
          if (fresh && fresh.ok && fresh.type === "basic") {
            cache.put(req, fresh.clone());
          }
          return fresh;
        })
        .catch(() => null);

      if (cached) {
        // Refresh in background, return cache immediately
        event.waitUntil(networkPromise);
        return cached;
      }

      // Not cached — must wait for network
      const fresh = await networkPromise;
      if (fresh) return fresh;

      // Offline + not cached — try to serve the cached app shell for navigation requests
      if (req.mode === "navigate") {
        const shell = await cache.match(`${BASE}/`);
        if (shell) return shell;
      }

      return new Response("Offline and not cached", { status: 504 });
    })(),
  );
});

// ─── Message handler: skipWaiting on demand ───────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  // Allow client to query current version
  if (event.data?.type === "GET_VERSION") {
    event.ports[0]?.postMessage({ version: CACHE_VERSION });
  }
});
