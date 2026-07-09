import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Объединение tailwind классов (shadcn/ui стандарт)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Форматирование цены
export function formatPrice(price: number | string): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

// Форматирование даты
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// Форматирование времени
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Форматирование даты и времени
export function formatDateTime(date: Date | string): string {
  return `${formatDate(date)}, ${formatTime(date)}`;
}

// Генерация slug из строки
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

// Транслитерация (кириллица → латиница)
export function transliterate(text: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh',
    з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o',
    п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return text
    .toLowerCase()
    .split('')
    .map((char) => map[char] || char)
    .join('');
}

// Парсинг ID из строки
export function parseId(id: string): string | null {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id) ? id : null;
}

// Проверка, является ли строка email
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Проверка, является ли строка телефоном (российский формат)
export function isPhone(value: string): boolean {
  return /^\+?7?\d{10,11}$/.test(value.replace(/[\s()-]/g, ''));
}

// Слова-признаки для классификации частей адреса
const STREET_RE = /улиц[аы]|проспект|переулок|проезд|бульвар|шоссе|набережн|площадь|аллея|тупик|тракт/i;
const DISTRICT_RE = /район|микрорайон|поселение|округ|слобода/i;
const ADMIN_RE = /федеральный округ|область|край|республика|автономн/i;

/**
 * Обрезает полный адрес Nominatim до «улица, дом».
 * Отбрасывает: район, город, регион, федеральный округ, индекс, страну.
 * Переставляет улицу перед номером дома (Nominatim отдаёт дом первым).
 *
 * Пример:
 *   "16 к3, улица Фомичёвой, район Северное Тушино, Москва,
 *    Центральный федеральный округ, 125481, Россия"
 *   → "улица Фомичёвой, 16 к3"
 */
export function shortenAddress(fullAddress: string): string {
  const parts = fullAddress.split(',').map((p) => p.trim()).filter(Boolean);

  const streets: string[] = [];
  const houses: string[] = [];

  for (const p of parts) {
    if (/^\d{5,6}$/.test(p)) continue;               // почтовый индекс
    if (/^(россия|russia|беларусь|belarus|украина|ukraine|казахстан|kazakhstan)$/i.test(p)) continue; // страна
    if (ADMIN_RE.test(p)) continue;                   // регион, федеральный округ
    if (DISTRICT_RE.test(p)) continue;                // район, микрорайон
    if (STREET_RE.test(p)) {
      streets.push(p);
    } else if (/^\d/.test(p)) {
      houses.push(p);
    }
    // остальное (город и т.д.) пропускаем — город хранится отдельно
  }

  // Порядок: улица → дом (город хранится отдельно, не дублируем)
  return [...streets, ...houses].slice(0, 3).join(', ');
}

/**
 * Форматирует адрес для отображения: город → улица → дом.
 */
export function formatDisplayAddress(
  address: string | null | undefined,
  city: string | null | undefined,
): string {
  const short = address ? shortenAddress(address) : '';
  const c = city?.trim() || '';
  if (!short && !c) return '';
  if (!short) return c;
  if (!c) return short;
  // Не дублируем город если он уже есть в сокращённом адресе
  if (short.toLowerCase().includes(c.toLowerCase())) return short;
  return `${c}, ${short}`;
}
