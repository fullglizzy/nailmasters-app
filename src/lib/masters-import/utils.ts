// Нормализация заголовков и значений Excel-таблицы.

/** «Цена от ($)» → «ценаот»; «Full Name» → «fullname». */
export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '');
}

/** «Мастера» → «мастера»; используется для поиска листов. */
export function normalizeSheetName(value: string): string {
  return normalizeHeader(value);
}

/** Сравнение специализаций/форматов/городов без учёта регистра, пробелов и дефисов. */
export function normalizeLookupValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '');
}

/** Преобразование значения ячейки в строку без потери чисел. */
export function asText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** Русские названия городов, которые часто вводят вместо канонических. */
export const CITY_ALIASES: Record<string, string> = {
  ньюйорк: 'New York',
  лосанджелес: 'Los Angeles',
  чикаго: 'Chicago',
  санфранциско: 'San Francisco',
  майами: 'Miami',
  бостон: 'Boston',
  сиэтл: 'Seattle',
  остин: 'Austin',
  денвер: 'Denver',
  портленд: 'Portland',
};
