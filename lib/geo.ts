/**
 * Free/open geocoding + routing helpers.
 *
 * - Geocoding: OpenStreetMap Nominatim (https://nominatim.org/release-docs/latest/api/Search/)
 * - Routing:   OSRM public demo server (https://project-osrm.org/)
 *
 * Usage policy notes:
 * - Nominatim's public server requires a descriptive User-Agent and asks
 *   clients not to exceed ~1 request/second. We enforce this with a simple
 *   in-process throttle (serialized requests + minimum interval) and cache
 *   repeat queries in memory. For heavy production traffic, self-host
 *   Nominatim/OSRM or use a paid provider — swap the two fetch helpers.
 * - All requests have timeouts so a slow upstream never hangs a page.
 */

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const OSRM_BASE = "https://router.project-osrm.org";
const USER_AGENT = "kalumalu/1.0 (transportation tracking app)";

/** Minimum interval between upstream Nominatim calls (ms). */
const NOMINATIM_MIN_INTERVAL_MS = 1100;
/** Upstream request timeout (ms). */
const FETCH_TIMEOUT_MS = 8000;

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PlaceResult extends GeoPoint {
  /** Formatted display name, e.g. "Accra Mall, Spintex Road, Accra, Ghana". */
  label: string;
}

export interface RouteResult {
  /** Road distance in km. */
  distanceKm: number;
  /** Route duration in minutes. */
  durationMin: number;
}

// ---------------------------------------------------------------------------
// Shared in-process throttle + cache
// ---------------------------------------------------------------------------

let geocodeQueue: Promise<void> = Promise.resolve();
let lastGeocodeAt = 0;

function scheduleGeocode<T>(task: () => Promise<T>): Promise<T> {
  const run = geocodeQueue.then(async () => {
    const wait = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastGeocodeAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastGeocodeAt = Date.now();
  });
  geocodeQueue = run.catch(() => {}); // queue never rejects
  return run.then(task);
}

const SEARCH_CACHE_MAX = 200;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;

type CacheEntry<T> = { value: T; expiresAt: number };
const searchCacheStore = new Map<string, CacheEntry<PlaceResult[]>>();

function cacheGet(key: string): PlaceResult[] | null {
  const hit = searchCacheStore.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    searchCacheStore.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: PlaceResult[]) {
  if (searchCacheStore.size >= SEARCH_CACHE_MAX) {
    // Evict the oldest entry.
    const oldest = searchCacheStore.keys().next().value;
    if (oldest !== undefined) searchCacheStore.delete(oldest);
  }
  searchCacheStore.set(key, { value, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
}

const routeCacheStore = new Map<string, CacheEntry<RouteResult>>();
const ROUTE_CACHE_TTL_MS = 30 * 60 * 1000;

function routeCacheGet(key: string): RouteResult | null {
  const hit = routeCacheStore.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    routeCacheStore.delete(key);
    return null;
  }
  return hit.value;
}

function routeCacheSet(key: string, value: RouteResult) {
  if (routeCacheStore.size >= SEARCH_CACHE_MAX) {
    const oldest = routeCacheStore.keys().next().value;
    if (oldest !== undefined) routeCacheStore.delete(oldest);
  }
  routeCacheStore.set(key, { value, expiresAt: Date.now() + ROUTE_CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// Fetch with timeout
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Nominatim search
// ---------------------------------------------------------------------------

interface NominatimPlace {
  display_name: string;
  lat: string;
  lon: string;
}

/**
 * Search for places by free-text query. Returns up to `limit` results.
 * Debounce on the client before calling — this function is throttled
 * server-side too (see scheduleGeocode) to respect Nominatim's policy.
 */
export async function searchPlaces(query: string, limit = 5): Promise<PlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const cacheKey = `q:${trimmed.toLowerCase()}:${limit}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url =
    `${NOMINATIM_BASE}/search?q=${encodeURIComponent(trimmed)}` +
    `&format=jsonv2&addressdetails=0&limit=${limit}` +
    `&countrycodes=gh`; // App is Ghana-focused; bias results to Ghana.

  const data = await scheduleGeocode(async () => {
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
    return (await res.json()) as NominatimPlace[];
  });

  const results: PlaceResult[] = data
    .map((p) => ({
      label: p.display_name,
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lon),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  cacheSet(cacheKey, results);
  return results;
}

// ---------------------------------------------------------------------------
// OSRM routing
// ---------------------------------------------------------------------------

interface OsrmResponse {
  code: string;
  routes?: { distance: number; duration: number }[];
}

/**
 * Road distance/duration between two points via OSRM. Falls back to
 * straight-line (Haversine × 1.3 congestion factor) when OSRM is
 * unreachable — the estimate remains usable instead of breaking the form.
 */
export async function calculateRouteDistance(
  from: GeoPoint,
  to: GeoPoint
): Promise<{ route: RouteResult; fallback: boolean }> {
  const key = `r:${from.lat.toFixed(4)},${from.lng.toFixed(4)}->${to.lat.toFixed(4)},${to.lng.toFixed(4)}`;
  const cached = routeCacheGet(key);
  if (cached) return { route: cached, fallback: false };

  const url =
    `${OSRM_BASE}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
    `?overview=false&alternatives=false&steps=false`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      cache: "no-store",
    }).finally(() => clearTimeout(timer));

    if (res.ok) {
      const data = (await res.json()) as OsrmResponse;
      const first = data.routes?.[0];
      if (data.code === "Ok" && first) {
        const route: RouteResult = {
          distanceKm: Math.round((first.distance / 1000) * 100) / 100,
          durationMin: Math.round(first.duration / 60),
        };
        routeCacheSet(key, route);
        return { route, fallback: false };
      }
    }
  } catch {
    // Fall through to the Haversine fallback below.
  }

  return { route: haversineFallback(from, to), fallback: true };
}

/** Straight-line estimate used when OSRM is unavailable. */
function haversineFallback(from: GeoPoint, to: GeoPoint): RouteResult {
  const R = 6371; // km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  // ×1.3 approximates real road distance vs. straight line.
  const distanceKm = Math.round(R * c * 1.3 * 100) / 100;
  return { distanceKm, durationMin: Math.round((distanceKm / 45) * 60) }; // ~45 km/h average
}