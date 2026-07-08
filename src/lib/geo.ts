// Геолокационные вычисления

// Формула гаверсинуса для расчета расстояния между двумя точками (в км)
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // радиус Земли в км
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Сортировка массива объектов с координатами по расстоянию от точки
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

// Проверка, находится ли точка в заданном радиусе
export function isWithinRadius(
  centerLat: number,
  centerLon: number,
  pointLat: number,
  pointLon: number,
  radiusKm: number,
): boolean {
  return haversineDistance(centerLat, centerLon, pointLat, pointLon) <= radiusKm;
}

// SQL-фрагмент для вычисления расстояния (для использования в Drizzle raw query)
export const HAVERSINE_SQL = `
  6371 * acos(
    cos(radians($1)) * cos(radians(latitude)) *
    cos(radians(longitude) - radians($2)) +
    sin(radians($1)) * sin(radians(latitude))
  ) AS distance
`;
