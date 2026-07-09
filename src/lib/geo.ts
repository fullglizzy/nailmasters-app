// Геолокационные вычисления и геокодинг

// ============================================================
// Формула гаверсинуса
// ============================================================

// Радиус Земли в км
const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Расстояние между двумя точками в км
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// ============================================================
// Форматирование расстояния
// ============================================================

// Возвращает читаемое расстояние: "1.2 км", "850 м", "менее 100 м"
export function formatDistance(km: number): string {
  if (!isFinite(km)) return '—';
  if (km < 0.1) return 'менее 100 м';
  if (km < 1) return `${Math.round(km * 1000)} м`;
  return `${km.toFixed(1)} км`;
}

// ============================================================
// Сортировка по расстоянию
// ============================================================

export function sortByDistance<T>(
  items: T[],
  originLat: number,
  originLon: number,
  getLat: (item: T) => number | null | undefined,
  getLon: (item: T) => number | null | undefined,
): (T & { distance: number })[] {
  return items
    .map((item) => {
      const lat = getLat(item);
      const lon = getLon(item);
      if (lat == null || lon == null) return { ...item, distance: Infinity };
      return { ...item, distance: haversineDistance(originLat, originLon, lat, lon) };
    })
    .sort((a, b) => a.distance - b.distance);
}

// ============================================================
// Проверка радиуса
// ============================================================

export function isWithinRadius(
  centerLat: number,
  centerLon: number,
  pointLat: number,
  pointLon: number,
  radiusKm: number,
): boolean {
  return haversineDistance(centerLat, centerLon, pointLat, pointLon) <= radiusKm;
}

// ============================================================
// Геокодинг: адрес → координаты (Nominatim / OpenStreetMap)
// ============================================================

export interface GeoPoint {
  latitude: number;
  longitude: number;
  displayName: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const GEOCODE_CACHE = new Map<string, GeoPoint>();

// Геокодинг с кешированием и rate-limit вежливостью (1 запрос/сек)
let lastGeocodeCall = 0;

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const cacheKey = address.toLowerCase().trim();
  const cached = GEOCODE_CACHE.get(cacheKey);
  if (cached) return cached;

  // Rate-limit: 1 запрос в секунду (требование Nominatim)
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - lastGeocodeCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocodeCall = Date.now();

  try {
    const url = `${NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=ru`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'NailMasters/2.0 (catalog app)',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const point: GeoPoint = {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
      displayName: data[0].display_name,
    };

    // Кешируем навсегда (адреса не меняются)
    if (GEOCODE_CACHE.size > 500) {
      // Очищаем старые записи при переполнении
      const firstKey = GEOCODE_CACHE.keys().next().value;
      if (firstKey) GEOCODE_CACHE.delete(firstKey);
    }
    GEOCODE_CACHE.set(cacheKey, point);

    return point;
  } catch {
    return null;
  }
}

// Геокодинг с fallback: если адрес не найден целиком, пробуем только город
export async function geocodeAddressWithFallback(
  address: string,
  city?: string | null,
): Promise<GeoPoint | null> {
  // Пробуем полный адрес
  const full = await geocodeAddress(address);
  if (full) return full;

  // Пробуем адрес + город
  if (city) {
    const withCity = await geocodeAddress(`${city}, ${address}`);
    if (withCity) return withCity;
  }

  // Пробуем только город
  if (city) {
    const cityOnly = await geocodeAddress(city);
    if (cityOnly) return { ...cityOnly, displayName: city };
  }

  return null;
}

// ============================================================
// Статическая карта (OpenStreetMap tile + маркер)
// ============================================================

// Генерирует URL статической карты для использования в <img>
// Использует tile.openstreetmap.org — бесплатно, требует attribution
export function getStaticMapUrl(
  lat: number,
  lng: number,
  zoom: number = 14,
  width: number = 600,
  height: number = 300,
): string {
  // Конвертируем lat/lng → tile coordinates для центрирования
  const n = Math.PI - (2 * Math.PI * (lat + 90)) / 360;
  // Используем простой подход: статичный тайл с координатами
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&markers=${lat},${lng},red-pushpin`;
}

// Альтернатива: формируем URL тайла для использования как CSS background
export function getMapTileUrl(lat: number, lng: number, zoom: number = 14): string {
  const xtile = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  const ytile = Math.floor(
    ((1 -
      Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) /
        Math.PI) /
      2) *
      Math.pow(2, zoom),
  );
  return `https://tile.openstreetmap.org/${zoom}/${xtile}/${ytile}.png`;
}

// ============================================================
// SQL-фрагменты
// ============================================================

// Haversine в SQL для Drizzle raw query
export const HAVERSINE_SQL = `
  6371 * acos(
    cos(radians($1)) * cos(radians(latitude)) *
    cos(radians(longitude) - radians($2)) +
    sin(radians($1)) * sin(radians(latitude))
  ) AS distance
`;
