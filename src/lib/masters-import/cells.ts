// Разбор значений ячеек Excel: телефоны, деньги, даты, время, дни недели.

import { CITIES, MASTER_SPECIALTIES } from '@/data/specialties';
import { normalizePhone } from '@/lib/phone';
import { CITY_ALIASES, asText, normalizeLookupValue } from './utils';

export type RawCell = string | number | boolean | Date | null;
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type WorkFormat = 'salon' | 'home';

/**
 * ExcelJS отдаёт формулы, ссылки и rich-text объектами.
 * Достаём из них простое значение; формулы без кэшированного результата
 * считаем пустыми — вычислять их на сервере небезопасно.
 */
export function readRawCell(value: unknown, depth = 0): RawCell {
  if (value == null) return null;
  if (depth > 4) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'object') return null;

  const obj = value as Record<string, unknown>;

  // Формула/общая формула: берём только закэшированный результат.
  if ('result' in obj) return readRawCell(obj.result, depth + 1);
  if ('error' in obj) return null;

  // Rich text.
  if (Array.isArray(obj.richText)) {
    return obj.richText
      .map((part) => (part && typeof part === 'object' ? String((part as { text?: unknown }).text ?? '') : ''))
      .join('');
  }

  // Гиперссылка.
  if ('text' in obj) return readRawCell(obj.text, depth + 1);

  return null;
}

export function isEmptyCell(value: RawCell): boolean {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

/** Текст без учёта формул-ошибок; числа сохраняем полностью (телефоны). */
export function cellText(value: RawCell): string {
  return asText(value);
}

// ── Телефон ───────────────────────────────────────────────

export type PhoneParseResult =
  | { phone: string; raw: string }
  | { phone: ''; raw: string; error: string };

export function parsePhoneCell(value: RawCell): PhoneParseResult {
  const raw = cellText(value);
  if (!raw) return { phone: '', raw: '', error: 'Укажите телефон' };

  const normalized = normalizePhone(raw);
  if (!/^\+1\d{10}$/.test(normalized)) {
    return {
      phone: '',
      raw,
      error: 'Телефон должен быть в формате США: +1 и 10 цифр (например, +1 555 123 4567)',
    };
  }

  return { phone: normalized, raw };
}

// ── Город / специализации / формат работы ─────────────────

const CITY_BY_KEY = (() => {
  const map = new Map<string, string>();
  for (const city of CITIES) map.set(normalizeLookupValue(city), city);
  for (const [alias, city] of Object.entries(CITY_ALIASES)) map.set(alias, city);
  return map;
})();

export function parseCityCell(value: RawCell): { city: string; error?: string } {
  const text = cellText(value);
  if (!text) return { city: '' };

  const canonical = CITY_BY_KEY.get(normalizeLookupValue(text));
  if (!canonical) {
    return {
      city: text,
      error: `Город «${text}» не найден. Допустимые города: ${CITIES.join(', ')}`,
    };
  }
  return { city: canonical };
}

const SPECIALTY_BY_KEY = new Map(
  MASTER_SPECIALTIES.map((specialty) => [normalizeLookupValue(specialty), specialty]),
);

export function parseSpecialtiesCell(value: RawCell): {
  values: string[];
  error?: string;
} {
  const text = cellText(value);
  if (!text) return { values: [] };

  const tokens = text
    .split(/[,;\n]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const values: string[] = [];
  const unknown: string[] = [];

  for (const token of tokens) {
    const canonical = SPECIALTY_BY_KEY.get(normalizeLookupValue(token));
    if (!canonical) {
      unknown.push(token);
      continue;
    }
    if (!values.includes(canonical)) values.push(canonical);
  }

  if (unknown.length) {
    return {
      values,
      error: `Неизвестные специализации: ${unknown.join(', ')}. Допустимые значения: ${MASTER_SPECIALTIES.join(', ')}`,
    };
  }

  return { values };
}

const WORK_FORMAT_ALIASES: Record<string, WorkFormat> = {
  salon: 'salon',
  салон: 'salon',
  всалоне: 'salon',
  салоне: 'salon',
  home: 'home',
  дом: 'home',
  надому: 'home',
  дому: 'home',
  надоме: 'home',
};

const BOTH_FORMAT_KEYS = new Set([
  'всалонеинадому',
  'салонидом',
  'салонинадому',
  'both',
  'оба',
]);

export function parseWorkFormatCell(value: RawCell): {
  values: WorkFormat[];
  error?: string;
} {
  const text = cellText(value);
  if (!text) return { values: [] };

  if (BOTH_FORMAT_KEYS.has(normalizeLookupValue(text))) {
    return { values: ['salon', 'home'] };
  }

  const tokens = text
    .split(/[,;/]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const values: WorkFormat[] = [];
  const unknown: string[] = [];

  for (const token of tokens) {
    const key = normalizeLookupValue(token);
    if (key === 'и' || key === 'and') continue;
    const format = WORK_FORMAT_ALIASES[key];
    if (!format) {
      unknown.push(token);
      continue;
    }
    if (!values.includes(format)) values.push(format);
  }

  if (unknown.length) {
    return {
      values,
      error: `Неизвестный формат работы: ${unknown.join(', ')}. Допустимые значения: В салоне, На дому, В салоне и на дому`,
    };
  }

  return { values };
}

// ── Числа ─────────────────────────────────────────────────

export function parseMoney(value: RawCell): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  let text = value
    .trim()
    .toLowerCase()
    .replace(/[\s\u00A0]/g, '')
    .replace(/[$€₽]/g, '')
    .replace(/usd|rub|руб\.?|р\./g, '');

  if (!text) return null;

  if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replace(/,/g, '');
  } else if (/^[+-]?\d+,\d{1,2}$/.test(text)) {
    text = text.replace(',', '.');
  } else if (!/^[+-]?\d+(\.\d+)?$/.test(text)) {
    return null;
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDecimal(value: RawCell): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;

  const text = value.trim().replace(/[\s\u00A0]/g, '').replace(',', '.');
  if (!/^[+-]?\d+(\.\d+)?$/.test(text)) return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseInteger(value: RawCell): number | null {
  const parsed = parseDecimal(value);
  if (parsed == null || !Number.isInteger(parsed)) return null;
  return parsed;
}

export function parseAgeCell(value: RawCell): { value?: number; error?: string } {
  if (isEmptyCell(value)) return {};
  const age = parseInteger(value);
  if (age == null || age < 14 || age > 120) {
    return { error: 'Возраст должен быть целым числом от 14 до 120' };
  }
  return { value: age };
}

export function parseDurationCell(value: RawCell): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== 'string') return null;

  const text = value.trim().toLowerCase().replace(/[\s\u00A0]/g, '');
  const match = text.match(/^(\d+)(мин|min|m|минут[аы]?)?\.?$/);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseBooleanCell(
  value: RawCell,
  defaultValue: boolean,
): boolean | null {
  if (isEmptyCell(value)) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== 'string') return null;

  const key = normalizeLookupValue(value);
  if (['да', 'yes', 'y', 'true', '1', 'истина', 'вкл', 'включено'].includes(key)) return true;
  if (['нет', 'no', 'n', 'false', '0', 'ложь', 'выкл', 'выключено'].includes(key)) return false;
  return null;
}

// ── Даты и время ──────────────────────────────────────────

const pad = (value: number) => String(value).padStart(2, '0');

export function formatDateUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function buildDateISO(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return formatDateUTC(date);
}

export function parseDateCell(value: RawCell): string | null {
  if (value instanceof Date) return formatDateUTC(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1) return null;
    // Excel-сериал: 1 = 1900-01-01, поправка на «нулевой» день 1899-12-30.
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    if (isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    return year >= 1900 && year <= 2100 ? formatDateUTC(date) : null;
  }
  if (typeof value !== 'string') return null;

  // Отрезаем возможное время: дата и время в расписании задаются отдельно.
  const datePart = value.trim().split(/[T\s]/)[0];
  if (!datePart) return null;

  let match = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return buildDateISO(Number(match[1]), Number(match[2]), Number(match[3]));

  match = datePart.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (match) return buildDateISO(Number(match[3]), Number(match[2]), Number(match[1]));

  match = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return buildDateISO(Number(match[3]), Number(match[1]), Number(match[2]));

  return null;
}

export function parseTimeCell(value: RawCell): string | null {
  if (value instanceof Date) {
    return formatMinutes(value.getUTCHours() * 60 + value.getUTCMinutes());
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    // Голое число 9 — это 09:00; 0.375 — доля суток; 46000.375 — сериал даты.
    if (Number.isInteger(value) && value >= 0 && value <= 23) {
      return formatMinutes(value * 60);
    }
    const fraction = value >= 1 ? value - Math.floor(value) : value;
    return formatMinutes(Math.round(fraction * 24 * 60));
  }

  if (typeof value !== 'string') return null;

  const text = value.trim().toLowerCase().replace(/[\s\u00A0]+/g, '');

  const ampm = text.match(/^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?(am|pm)$/);
  if (ampm) {
    let hours = Number(ampm[1]);
    const minutes = Number(ampm[2] ?? 0);
    if (hours < 1 || hours > 12) return null;
    if (ampm[3] === 'am') hours = hours === 12 ? 0 : hours;
    else hours = hours === 12 ? 12 : hours + 12;
    return formatMinutes(hours * 60 + minutes);
  }

  let match = text.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/);
  if (match) {
    return formatMinutes(Number(match[1]) * 60 + Number(match[2]));
  }

  match = text.match(/^(\d{1,2})$/);
  if (match) {
    const hours = Number(match[1]);
    return hours >= 0 && hours <= 23 ? formatMinutes(hours * 60) : null;
  }

  return null;
}

function formatMinutes(totalMinutes: number): string | null {
  if (!Number.isInteger(totalMinutes) || totalMinutes < 0 || totalMinutes >= 24 * 60) {
    return null;
  }
  return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`;
}

// ── Дни повтора ───────────────────────────────────────────

const DAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DAY_ALIASES: Record<string, DayKey> = {
  пн: 'mon',
  понедельник: 'mon',
  mon: 'mon',
  monday: 'mon',
  вт: 'tue',
  вторник: 'tue',
  tue: 'tue',
  tuesday: 'tue',
  ср: 'wed',
  среда: 'wed',
  wed: 'wed',
  wednesday: 'wed',
  чт: 'thu',
  четверг: 'thu',
  thu: 'thu',
  thursday: 'thu',
  пт: 'fri',
  пятница: 'fri',
  fri: 'fri',
  friday: 'fri',
  сб: 'sat',
  суббота: 'sat',
  sat: 'sat',
  saturday: 'sat',
  вс: 'sun',
  воскресенье: 'sun',
  sun: 'sun',
  sunday: 'sun',
};

const WEEKDAYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
const WEEKEND: DayKey[] = ['sat', 'sun'];

export function parseRepeatDaysCell(value: RawCell): { days: DayKey[]; error?: string } {
  if (isEmptyCell(value)) return { days: [] };
  if (typeof value !== 'string') {
    return { days: [], error: 'Дни повтора укажите текстом, например: пн, ср, пт' };
  }

  const text = value.trim().toLowerCase().replace(/ё/g, 'е');
  if (!text) return { days: [] };

  const fullKey = normalizeLookupValue(text);
  if (['будни', 'работедни', 'рабочиедни', 'weekdays', 'workdays', 'пнпт', 'monfri'].includes(fullKey)) {
    return { days: [...WEEKDAYS] };
  }
  if (['выходные', 'выходныедни', 'weekend', 'weekends', 'сбвс', 'satsun'].includes(fullKey)) {
    return { days: [...WEEKEND] };
  }

  const tokens = text
    .split(/[,;/\s]+/)
    .map((token) => token.trim())
    .filter((token) => token && token !== 'и' && token !== 'and');

  const days = new Set<DayKey>();
  const unknown: string[] = [];

  for (const token of tokens) {
    if (token === 'будни' || token === 'рабочиедни' || token === 'weekdays') {
      WEEKDAYS.forEach((day) => days.add(day));
      continue;
    }
    if (token === 'выходные' || token === 'weekend' || token === 'weekends') {
      WEEKEND.forEach((day) => days.add(day));
      continue;
    }
    const day = DAY_ALIASES[token];
    if (!day) {
      unknown.push(token);
      continue;
    }
    days.add(day);
  }

  if (unknown.length) {
    return {
      days: DAY_ORDER.filter((day) => days.has(day)),
      error: `Неизвестные дни недели: ${unknown.join(', ')}. Используйте пн, вт, ср, чт, пт, сб, вс`,
    };
  }

  return { days: DAY_ORDER.filter((day) => days.has(day)) };
}

// ── Интервал и недели ─────────────────────────────────────

export function parseIntervalCell(value: RawCell): { value?: number; error?: string } {
  if (isEmptyCell(value)) return {};
  const interval = parseInteger(value);
  if (interval == null || interval < 15 || interval > 480) {
    return { error: 'Интервал должен быть целым числом от 15 до 480 минут' };
  }
  return { value: interval };
}

export function parseWeeksCell(value: RawCell): { value: number; error?: string } {
  if (isEmptyCell(value)) return { value: 4 };
  const weeks = parseInteger(value);
  if (weeks == null || weeks < 1 || weeks > 4) {
    return { value: 4, error: 'Количество недель должно быть от 1 до 4' };
  }
  return { value: weeks };
}
