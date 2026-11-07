import { describe, expect, it } from 'vitest';
import {
  parseAgeCell,
  parseBooleanCell,
  parseDateCell,
  parseDurationCell,
  parseMoney,
  parsePhoneCell,
  parseRepeatDaysCell,
  parseSpecialtiesCell,
  parseTimeCell,
  parseWorkFormatCell,
} from './cells';

describe('cell parsers', () => {
  it('normalizes US phones and rejects other countries', () => {
    expect(parsePhoneCell('+1 (555) 123-4567')).toEqual({
      phone: '+15551234567',
      raw: '+1 (555) 123-4567',
    });
    expect(parsePhoneCell(5551234567)).toEqual({
      phone: '+15551234567',
      raw: '5551234567',
    });
    expect(parsePhoneCell('+44 20 7946 0958')).toMatchObject({ phone: '' });
    expect(parsePhoneCell('')).toMatchObject({ phone: '', error: 'Укажите телефон' });
  });

  it('parses money with currency symbols, spaces and both decimal separators', () => {
    expect(parseMoney('$1,200.50')).toBe(1200.5);
    expect(parseMoney('45,50')).toBe(45.5);
    expect(parseMoney('  USD 45 ')).toBe(45);
    expect(parseMoney('45.00')).toBe(45);
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });

  it('parses dates from Excel, ISO and local formats', () => {
    expect(parseDateCell('2026-11-10')).toBe('2026-11-10');
    expect(parseDateCell('10.11.2026')).toBe('2026-11-10');
    expect(parseDateCell('11/10/2026')).toBe('2026-11-10');
    expect(parseDateCell('2026-02-30')).toBeNull();
    expect(parseDateCell(new Date(Date.UTC(2026, 10, 10)))).toBe('2026-11-10');
  });

  it('parses times in 24h, 12h, Excel fraction and bare-hour forms', () => {
    expect(parseTimeCell('9:30 pm')).toBe('21:30');
    expect(parseTimeCell('9:30')).toBe('09:30');
    expect(parseTimeCell(0.375)).toBe('09:00');
    expect(parseTimeCell('9')).toBe('09:00');
    expect(parseTimeCell('24:00')).toBeNull();
  });

  it('parses repeat days, including aliases and ranges', () => {
    expect(parseRepeatDaysCell('Пн, ср и пт').days).toEqual(['mon', 'wed', 'fri']);
    expect(parseRepeatDaysCell('будни').days).toEqual(['mon', 'tue', 'wed', 'thu', 'fri']);
    expect(parseRepeatDaysCell('выходные').days).toEqual(['sat', 'sun']);
    expect(parseRepeatDaysCell('mon,wed').days).toEqual(['mon', 'wed']);
    expect(parseRepeatDaysCell('среда, праздник').error).toContain('праздник');
  });

  it('parses booleans and durations', () => {
    expect(parseBooleanCell('да', false)).toBe(true);
    expect(parseBooleanCell('Нет', true)).toBe(false);
    expect(parseBooleanCell('maybe', true)).toBeNull();
    expect(parseBooleanCell('', true)).toBe(true);
    expect(parseDurationCell('90 мин')).toBe(90);
    expect(parseDurationCell(60)).toBe(60);
    expect(parseDurationCell('1.5')).toBeNull();
  });

  it('canonicalizes specialties and work formats', () => {
    expect(parseSpecialtiesCell('гель лак; аппаратный маникюр').values).toEqual([
      'Гель-лак',
      'Аппаратный маникюр',
    ]);
    expect(parseSpecialtiesCell('Гель-лак, Неизвестное').error).toContain('Неизвестное');

    expect(parseWorkFormatCell('В салоне и на дому').values).toEqual(['salon', 'home']);
    expect(parseWorkFormatCell('салон; home').values).toEqual(['salon', 'home']);
    expect(parseWorkFormatCell('на Луне').error).toContain('на Луне');
  });

  it('validates age range', () => {
    expect(parseAgeCell('27')).toEqual({ value: 27 });
    expect(parseAgeCell('')).toEqual({});
    expect(parseAgeCell('13').error).toContain('14');
  });
});
