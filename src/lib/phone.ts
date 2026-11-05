/**
 * Нормализация телефона к каноническому виду.
 *
 * Телефон хранится одновременно в users.phone и master_profiles.phone,
 * а вход на /auth отправляет `+<код страны><цифры>`. Поэтому номер,
 * введённый админом в свободной форме, нужно приводить к тому же виду,
 * иначе мастер не сможет войти по OTP.
 */

/** Убирает пробелы, скобки и дефисы; приводит 10-значный номер США к +1XXXXXXXXXX. */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s()\-]/g, '');
  if (cleaned.startsWith('+')) return cleaned;

  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

/** Проверка канонического номера: +, первая цифра 1–9, всего 7–15 цифр. */
export function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

// ── США: маска (XXX) XXX-XXXX ─────────────────────────────

export const US_PHONE_LENGTH = 10;
export const US_PHONE_PLACEHOLDER = '(555) 123-4567';

/** Национальные цифры США без кода страны (10 цифр). */
export function usNationalDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.slice(0, US_PHONE_LENGTH);
}

/** 5550109998 → (555) 010-9998 */
export function formatUsPhone(value: string): string {
  const d = usNationalDigits(value);
  if (!d) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** (555) 010-9998 или +1 555 010 9998 → +15550109998 */
export function toUsE164(value: string): string {
  const d = usNationalDigits(value);
  return d.length === US_PHONE_LENGTH ? `+1${d}` : normalizePhone(value);
}

/** Для отображения в ЛК: +15550109998 → (555) 010-9998; прочие номера — как есть. */
export function formatPhoneDisplay(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return formatUsPhone(digits);
  return phone;
}
