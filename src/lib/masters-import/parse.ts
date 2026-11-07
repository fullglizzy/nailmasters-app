// Разбор и валидация Excel-файла импорта мастеров.
// Не ходит в БД: результат можно показать в предпросмотре и затем
// повторно проверить перед импортом.

import ExcelJS from 'exceljs';
import {
  adminCreateMasterSchema,
  adminScheduleBatchSchema,
  createServiceSchema,
} from '@/lib/validators';
import { buildScheduleSlots, type ScheduleSlotData } from '@/lib/schedule';
import type {
  MasterImportIssue,
  MasterImportMasterData,
  MasterImportPreview,
  MasterImportSchedulePattern,
} from '@/lib/types';
import {
  HEADER_SEARCH_ROWS,
  MAX_MASTER_ROWS,
  MAX_PRICE,
  MAX_SCHEDULE_ROWS,
  MAX_SERVICE_DURATION,
  MAX_SERVICE_ROWS,
  MAX_SERVICES_PER_MASTER,
  MAX_SHEET_ROWS,
  MAX_SLOTS_PER_MASTER,
  MASTER_COLUMNS,
  NON_DATA_SHEET_NAMES,
  SCHEDULE_COLUMNS,
  SERVICE_COLUMNS,
  SHEET_ALIASES,
  type ImportColumn,
} from './constants';
import {
  cellText,
  isEmptyCell,
  parseAgeCell,
  parseBooleanCell,
  parseCityCell,
  parseDateCell,
  parseDecimal,
  parseDurationCell,
  parseIntervalCell,
  parseMoney,
  parsePhoneCell,
  parseRepeatDaysCell,
  parseSpecialtiesCell,
  parseTimeCell,
  parseWeeksCell,
  parseWorkFormatCell,
  readRawCell,
  type DayKey,
  type RawCell,
} from './cells';
import { normalizeHeader, normalizeLookupValue, normalizeSheetName } from './utils';

// ── Ошибка формата файла ──────────────────────────────────

export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportFileError';
  }
}

// ── Внутренние структуры ──────────────────────────────────

export interface ParsedMaster {
  row: number;
  status: 'ready' | 'duplicate' | 'error';
  /** Нормализованный телефон, если он валиден (даже при других ошибках строки). */
  phone: string;
  data: MasterImportMasterData | null;
  display: { fullName: string; phone: string; city: string };
  errors: MasterImportIssue[];
  warnings: MasterImportIssue[];
}

export interface ParsedService {
  row: number;
  phone: string;
  masterRow: number | null;
  name: string;
  price: number | null;
  duration: number | null;
  description?: string;
  ownErrors: MasterImportIssue[];
  ownWarnings: MasterImportIssue[];
  errors: MasterImportIssue[];
  warnings: MasterImportIssue[];
  status: 'ready' | 'skipped' | 'error';
}

export interface ParsedSchedule {
  row: number;
  phone: string;
  masterRow: number | null;
  pattern: MasterImportSchedulePattern | null;
  slots: ScheduleSlotData[];
  ownErrors: MasterImportIssue[];
  ownWarnings: MasterImportIssue[];
  errors: MasterImportIssue[];
  warnings: MasterImportIssue[];
  status: 'ready' | 'skipped' | 'error';
}

export interface ParsedWorkbook {
  masters: ParsedMaster[];
  services: ParsedService[];
  schedule: ParsedSchedule[];
  masterSheetName: string;
  serviceSheetName?: string;
  scheduleSheetName?: string;
}

interface DetectedTable {
  headerRow: number;
  indexes: Map<string, number>;
}

interface DataRow {
  row: number;
  raw: Record<string, RawCell>;
}

// ── Подписи полей ─────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  phone: 'Телефон',
  username: 'Username',
  age: 'Возраст',
  isActive: 'Активен',
  isModerated: 'Проверен',
  'profile.fullName': 'ФИО',
  'profile.address': 'Адрес',
  'profile.description': 'О себе',
  'profile.experience': 'Опыт',
  'profile.city': 'Город',
  'profile.specialties': 'Специализации',
  'profile.startingPrice': 'Цена от',
  'profile.workFormat': 'Формат работы',
  'profile.sterilization': 'Стерилизация',
  'profile.disposableTools': 'Одноразовые материалы',
  'profile.latitude': 'Широта',
  'profile.longitude': 'Долгота',
  name: 'Название услуги',
  price: 'Цена',
  duration: 'Длительность',
  description: 'Описание',
  startDate: 'Дата начала',
  startTime: 'Время начала',
  endTime: 'Время окончания',
  intervalMinutes: 'Интервал',
  repeatDays: 'Дни повтора',
  weeks: 'Недель',
};

const FIELD_COLUMNS: Record<string, string> = {
  phone: 'Телефон',
  username: 'Username',
  age: 'Возраст',
  isActive: 'Активен',
  isModerated: 'Проверен',
  'profile.fullName': 'ФИО',
  'profile.address': 'Адрес',
  'profile.description': 'О себе',
  'profile.experience': 'Опыт',
  'profile.city': 'Город',
  'profile.specialties': 'Специализации',
  'profile.startingPrice': 'Цена от',
  'profile.workFormat': 'Формат работы',
  'profile.sterilization': 'Стерилизация',
  'profile.disposableTools': 'Одноразовые материалы',
  'profile.latitude': 'Широта',
  'profile.longitude': 'Долгота',
  name: 'Название услуги',
  price: 'Цена',
  duration: 'Длительность (мин)',
  description: 'Описание',
  startDate: 'Дата начала',
  startTime: 'Время начала',
  endTime: 'Время окончания',
  intervalMinutes: 'Интервал (мин)',
  repeatDays: 'Дни повтора',
  weeks: 'Недель',
};

function issue(field: string, message: string): MasterImportIssue {
  return {
    field,
    column: FIELD_COLUMNS[field] ?? FIELD_LABELS[field] ?? field,
    message,
  };
}

// ── Поиск листов и таблиц ─────────────────────────────────

function findNamedSheet(
  workbook: ExcelJS.Workbook,
  aliases: readonly string[],
): ExcelJS.Worksheet | undefined {
  const wanted = new Set(aliases.map(normalizeSheetName));
  return workbook.worksheets.find((sheet) => wanted.has(normalizeSheetName(sheet.name)));
}

const NON_DATA_SHEETS = new Set(NON_DATA_SHEET_NAMES.map(normalizeSheetName));

function isNonDataSheet(name: string): boolean {
  return NON_DATA_SHEETS.has(normalizeSheetName(name));
}

function analyzeHeaderRow(
  row: ExcelJS.Row,
  columns: ImportColumn[],
): { indexes: Map<string, number>; duplicate?: string } {
  const keyByAlias = new Map<string, string>();
  for (const column of columns) {
    keyByAlias.set(normalizeHeader(column.label), column.key);
    for (const alias of column.aliases) keyByAlias.set(normalizeHeader(alias), column.key);
  }

  const indexes = new Map<string, number>();
  let duplicate: string | undefined;

  row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
    const header = normalizeHeader(cellText(readRawCell(cell.value)));
    if (!header) return;

    const key = keyByAlias.get(header);
    if (!key) return;

    if (indexes.has(key)) {
      duplicate = key;
      return;
    }
    indexes.set(key, columnNumber);
  });

  return { indexes, duplicate };
}

function detectTable(
  sheet: ExcelJS.Worksheet,
  columns: ImportColumn[],
): DetectedTable | null {
  const requiredCount = columns.filter((column) => column.required).length;
  let duplicateKey: string | undefined;
  let found: DetectedTable | null = null;

  const lastRow = Math.min(sheet.rowCount, HEADER_SEARCH_ROWS);
  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber++) {
    const analysis = analyzeHeaderRow(sheet.getRow(rowNumber), columns);
    if (analysis.indexes.size < requiredCount) continue;

    const hasAllRequired = columns.every(
      (column) => !column.required || analysis.indexes.has(column.key),
    );
    if (!hasAllRequired) continue;

    if (analysis.duplicate) {
      duplicateKey = analysis.duplicate;
      continue;
    }

    if (!found) found = { headerRow: rowNumber, indexes: analysis.indexes };
  }

  if (!found && duplicateKey) {
    const column = columns.find((item) => item.key === duplicateKey);
    throw new ImportFileError(
      `Лист «${sheet.name}»: колонка «${column?.label ?? duplicateKey}» указана дважды. Оставьте одну колонку.`,
    );
  }

  return found;
}

function missingHeaderMessage(sheetName: string, columns: ImportColumn[]): string {
  const required = columns.filter((column) => column.required).map((column) => column.label);
  return `Лист «${sheetName}»: не найдены обязательные колонки (${required.join(', ')}). Не переименовывайте колонки — скачайте шаблон заново.`;
}

function locateMasterTable(workbook: ExcelJS.Workbook): {
  sheet: ExcelJS.Worksheet;
  table: DetectedTable;
} {
  const named = findNamedSheet(workbook, SHEET_ALIASES.masters);
  if (named) {
    const table = detectTable(named, MASTER_COLUMNS);
    if (!table) throw new ImportFileError(missingHeaderMessage(named.name, MASTER_COLUMNS));
    return { sheet: named, table };
  }

  // Fallback: админ мог переименовать лист, но оставить заголовки.
  for (const sheet of workbook.worksheets) {
    if (isNonDataSheet(sheet.name)) continue;
    try {
      const table = detectTable(sheet, MASTER_COLUMNS);
      if (table) return { sheet, table };
    } catch {
      // Дубликат колонок на чужом листе — просто пробуем следующий.
    }
  }

  throw new ImportFileError(
    'Лист «Мастера» не найден. Скачайте шаблон и заполните лист «Мастера», не переименовывая его.',
  );
}

function readDataRows(
  sheet: ExcelJS.Worksheet,
  table: DetectedTable,
  maxRows: number,
  sheetLabel: string,
): DataRow[] {
  const start = table.headerRow + 1;
  const last = sheet.rowCount;

  if (last - start + 1 > MAX_SHEET_ROWS) {
    throw new ImportFileError(
      `Лист «${sheetLabel}» содержит слишком много строк (${last - start + 1}). Максимум — ${MAX_SHEET_ROWS}.`,
    );
  }

  const rows: DataRow[] = [];
  for (let rowNumber = start; rowNumber <= last; rowNumber++) {
    const sheetRow = sheet.getRow(rowNumber);
    const raw: Record<string, RawCell> = {};
    let hasValue = false;

    for (const [key, columnNumber] of table.indexes) {
      const value = readRawCell(sheetRow.getCell(columnNumber).value);
      raw[key] = value;
      if (!isEmptyCell(value)) hasValue = true;
    }

    if (!hasValue) continue;
    rows.push({ row: rowNumber, raw });

    if (rows.length > maxRows) {
      throw new ImportFileError(
        `Лист «${sheetLabel}»: максимум ${maxRows} строк. Разделите файл на части.`,
      );
    }
  }

  return rows;
}

// ── Мастера ───────────────────────────────────────────────

function parseMasters(sheet: ExcelJS.Worksheet, table: DetectedTable): ParsedMaster[] {
  const rows = readDataRows(sheet, table, MAX_MASTER_ROWS, sheet.name);
  const result: ParsedMaster[] = [];
  const firstPhoneRow = new Map<string, number>();
  const firstUsernameRow = new Map<string, number>();

  for (const { row, raw } of rows) {
    const errors: MasterImportIssue[] = [];
    const warnings: MasterImportIssue[] = [];

    const rawFullName = cellText(raw.fullName);
    const rawPhone = cellText(raw.phone);
    const rawCity = cellText(raw.city);
    const address = cellText(raw.address);
    const experience = cellText(raw.experience);
    const description = cellText(raw.description);
    const username = cellText(raw.username) || undefined;

    // Телефон.
    const phoneResult = parsePhoneCell(raw.phone);
    const phone = phoneResult.phone;
    if ('error' in phoneResult) {
      errors.push(issue('phone', phoneResult.error));
    } else {
      const owner = firstPhoneRow.get(phone);
      if (owner) {
        errors.push(issue('phone', `Дубликат телефона: он уже указан в строке ${owner}`));
      } else {
        firstPhoneRow.set(phone, row);
      }
    }

    // ФИО / адрес / опыт / описание / username.
    if (!rawFullName) errors.push(issue('profile.fullName', 'Укажите ФИО'));
    else if (rawFullName.length < 2) errors.push(issue('profile.fullName', 'ФИО должно содержать минимум 2 символа'));
    else if (rawFullName.length > 255) errors.push(issue('profile.fullName', 'ФИО слишком длинное (максимум 255 символов)'));

    if (!address) errors.push(issue('profile.address', 'Укажите адрес'));
    else if (address.length > 500) errors.push(issue('profile.address', 'Адрес слишком длинный (максимум 500 символов)'));

    if (!experience) errors.push(issue('profile.experience', 'Укажите опыт работы'));
    else if (experience.length > 100) errors.push(issue('profile.experience', 'Опыт слишком длинный (максимум 100 символов)'));

    if (description.length > 5000) {
      errors.push(issue('profile.description', 'Описание слишком длинное (максимум 5000 символов)'));
    }

    if (username) {
      if (username.length < 3) {
        errors.push(issue('username', 'Username должен быть не короче 3 символов'));
      } else if (username.length > 255) {
        errors.push(issue('username', 'Username слишком длинный (максимум 255 символов)'));
      } else {
        const key = username.toLowerCase();
        const owner = firstUsernameRow.get(key);
        if (owner) {
          errors.push(issue('username', `Дубликат username: он уже указан в строке ${owner}`));
        } else {
          firstUsernameRow.set(key, row);
        }
      }
    }

    // Город / специализации / формат работы.
    const cityResult = parseCityCell(raw.city);
    if (cityResult.error) errors.push(issue('profile.city', cityResult.error));

    const specialtiesResult = parseSpecialtiesCell(raw.specialties);
    if (specialtiesResult.error) errors.push(issue('profile.specialties', specialtiesResult.error));

    const workFormatResult = parseWorkFormatCell(raw.workFormat);
    if (workFormatResult.error) errors.push(issue('profile.workFormat', workFormatResult.error));

    // Цена: округляем до копеек, как decimal(10,2) в БД.
    const startingPriceRaw = parseMoney(raw.startingPrice);
    const startingPrice =
      startingPriceRaw != null ? Math.round((startingPriceRaw + Number.EPSILON) * 100) / 100 : null;
    if (startingPrice == null || startingPrice <= 0) {
      errors.push(issue('profile.startingPrice', 'Укажите цену от — положительное число (например, 45)'));
    } else if (startingPrice > MAX_PRICE) {
      errors.push(issue('profile.startingPrice', `Цена слишком большая (максимум ${MAX_PRICE})`));
    }

    // Возраст.
    const ageResult = parseAgeCell(raw.age);
    if (ageResult.error) errors.push(issue('age', ageResult.error));

    // Координаты: либо обе, либо ни одной.
    const hasLatitude = !isEmptyCell(raw.latitude);
    const hasLongitude = !isEmptyCell(raw.longitude);
    const latitude = parseDecimal(raw.latitude);
    const longitude = parseDecimal(raw.longitude);
    let coordinatesValid = false;

    if (hasLatitude !== hasLongitude) {
      errors.push(issue('profile.latitude', 'Укажите обе координаты — широту и долготу — или оставьте обе пустыми'));
    } else if (hasLatitude) {
      if (latitude == null || longitude == null) {
        errors.push(issue('profile.latitude', 'Координаты должны быть числами'));
      } else if (latitude < -90 || latitude > 90) {
        errors.push(issue('profile.latitude', 'Широта должна быть от -90 до 90'));
      } else if (longitude < -180 || longitude > 180) {
        errors.push(issue('profile.longitude', 'Долгота должна быть от -180 до 180'));
      } else {
        coordinatesValid = true;
      }
    }

    // Да/Нет.
    const sterilization = parseBooleanCell(raw.sterilization, false);
    if (sterilization == null) {
      errors.push(issue('profile.sterilization', 'Укажите «Да» или «Нет»'));
    }

    const disposableTools = parseBooleanCell(raw.disposableTools, false);
    if (disposableTools == null) {
      errors.push(issue('profile.disposableTools', 'Укажите «Да» или «Нет»'));
    }

    const isActive = parseBooleanCell(raw.isActive, true);
    if (isActive == null) errors.push(issue('isActive', 'Укажите «Да» или «Нет»'));

    const isModerated = parseBooleanCell(raw.isModerated, true);
    if (isModerated == null) errors.push(issue('isModerated', 'Укажите «Да» или «Нет»'));

    // Финальная проверка общей схемой создания мастера.
    const candidate = {
      phone,
      username,
      age: ageResult.value,
      isActive: isActive ?? true,
      isModerated: isModerated ?? true,
      profile: {
        fullName: rawFullName,
        address,
        description: description || undefined,
        experience,
        city: cityResult.city,
        specialties: specialtiesResult.values,
        startingPrice: startingPrice ?? 0,
        workFormat: workFormatResult.values,
        sterilization: sterilization ?? false,
        disposableTools: disposableTools ?? false,
        ...(coordinatesValid && latitude != null && longitude != null
          ? { latitude, longitude }
          : {}),
      },
    };

    const parsed = adminCreateMasterSchema.safeParse(candidate);
    if (!parsed.success) {
      const customFields = new Set(errors.map((item) => item.field).filter(Boolean));
      for (const zodIssue of parsed.error.issues) {
        const field = zodIssue.path.join('.');
        if (customFields.has(field)) continue;
        errors.push({
          field,
          column: FIELD_COLUMNS[field] ?? FIELD_LABELS[field] ?? field,
          message: zodIssue.message,
        });
      }
    }

    let data: MasterImportMasterData | null = null;
    if (parsed.success && errors.length === 0) {
      data = {
        phone: parsed.data.phone,
        username: parsed.data.username,
        age: parsed.data.age,
        isActive: parsed.data.isActive,
        isModerated: parsed.data.isModerated,
        profile: {
          fullName: parsed.data.profile.fullName,
          address: parsed.data.profile.address,
          description: parsed.data.profile.description,
          experience: parsed.data.profile.experience,
          city: parsed.data.profile.city,
          specialties: parsed.data.profile.specialties,
          startingPrice: parsed.data.profile.startingPrice,
          workFormat: parsed.data.profile.workFormat,
          sterilization: parsed.data.profile.sterilization,
          disposableTools: parsed.data.profile.disposableTools,
          latitude: parsed.data.profile.latitude,
          longitude: parsed.data.profile.longitude,
        },
      };
    }

    result.push({
      row,
      status: errors.length || !data ? 'error' : 'ready',
      phone,
      data,
      display: {
        fullName: rawFullName,
        phone: phone || rawPhone,
        city: cityResult.city || rawCity,
      },
      errors,
      warnings,
    });
  }

  return result;
}

// ── Услуги ────────────────────────────────────────────────

function buildMasterRowByPhone(masters: ParsedMaster[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const master of masters) {
    if (master.phone && !map.has(master.phone)) map.set(master.phone, master.row);
  }
  return map;
}

function parseServices(
  sheet: ExcelJS.Worksheet,
  table: DetectedTable,
  masters: ParsedMaster[],
): ParsedService[] {
  const rows = readDataRows(sheet, table, MAX_SERVICE_ROWS, sheet.name);
  const masterByPhone = buildMasterRowByPhone(masters);
  const result: ParsedService[] = [];

  for (const { row, raw } of rows) {
    const ownErrors: MasterImportIssue[] = [];
    const ownWarnings: MasterImportIssue[] = [];

    const phoneResult = parsePhoneCell(raw.phone);
    const phone = phoneResult.phone;
    if ('error' in phoneResult) ownErrors.push(issue('phone', phoneResult.error));

    const name = cellText(raw.name);
    if (!name) ownErrors.push(issue('name', 'Укажите название услуги'));
    else if (name.length > 255) ownErrors.push(issue('name', 'Название слишком длинное (максимум 255 символов)'));

    const description = cellText(raw.description) || undefined;
    if (description && description.length > 2000) {
      ownErrors.push(issue('description', 'Описание слишком длинное (максимум 2000 символов)'));
    }

    const priceRaw = parseMoney(raw.price);
    const price = priceRaw != null ? Math.round((priceRaw + Number.EPSILON) * 100) / 100 : null;
    if (price == null || price <= 0) {
      ownErrors.push(issue('price', 'Укажите цену — положительное число (например, 45)'));
    } else if (price > MAX_PRICE) {
      ownErrors.push(issue('price', `Цена слишком большая (максимум ${MAX_PRICE})`));
    }

    const duration = parseDurationCell(raw.duration);
    if (duration == null) {
      ownErrors.push(issue('duration', 'Укажите длительность в минутах (целое число, например, 90)'));
    } else if (duration > MAX_SERVICE_DURATION) {
      ownErrors.push(issue('duration', `Длительность не может превышать ${MAX_SERVICE_DURATION} минут`));
    }

    const parsed = createServiceSchema.safeParse({
      name,
      description,
      price: price ?? 0,
      duration: duration ?? 0,
    });
    if (!parsed.success) {
      const customFields = new Set(ownErrors.map((item) => item.field).filter(Boolean));
      for (const zodIssue of parsed.error.issues) {
        const field = zodIssue.path.join('.');
        if (customFields.has(field)) continue;
        ownErrors.push({
          field,
          column: FIELD_COLUMNS[field] ?? field,
          message: zodIssue.message,
        });
      }
    }

    let masterRow: number | null = null;
    if (phone) {
      masterRow = masterByPhone.get(phone) ?? null;
      if (masterRow == null) {
        ownErrors.push(issue('phone', 'Мастер с таким телефоном не найден на листе «Мастера»'));
      }
    }

    result.push({
      row,
      phone,
      masterRow,
      name,
      price,
      duration,
      description,
      ownErrors,
      ownWarnings,
      errors: [...ownErrors],
      warnings: [...ownWarnings],
      status: ownErrors.length ? 'error' : 'ready',
    });
  }

  return result;
}

// ── Расписание ────────────────────────────────────────────

function parseSchedule(
  sheet: ExcelJS.Worksheet,
  table: DetectedTable,
  masters: ParsedMaster[],
): ParsedSchedule[] {
  const rows = readDataRows(sheet, table, MAX_SCHEDULE_ROWS, sheet.name);
  const masterByPhone = buildMasterRowByPhone(masters);
  const today = new Date().toISOString().split('T')[0];
  const result: ParsedSchedule[] = [];

  for (const { row, raw } of rows) {
    const ownErrors: MasterImportIssue[] = [];
    const ownWarnings: MasterImportIssue[] = [];

    const phoneResult = parsePhoneCell(raw.phone);
    const phone = phoneResult.phone;
    if ('error' in phoneResult) ownErrors.push(issue('phone', phoneResult.error));

    const startDate = parseDateCell(raw.startDate);
    if (!startDate) ownErrors.push(issue('startDate', 'Укажите дату в формате ГГГГ-ММ-ДД'));

    const startTime = parseTimeCell(raw.startTime);
    if (!startTime) ownErrors.push(issue('startTime', 'Укажите время, например 09:00'));

    const endTime = parseTimeCell(raw.endTime);
    if (!endTime) ownErrors.push(issue('endTime', 'Укажите время, например 18:00'));

    const intervalResult = parseIntervalCell(raw.intervalMinutes);
    if (intervalResult.error) ownErrors.push(issue('intervalMinutes', intervalResult.error));

    const repeatDaysResult = parseRepeatDaysCell(raw.repeatDays);
    if (repeatDaysResult.error) ownErrors.push(issue('repeatDays', repeatDaysResult.error));

    const weeksResult = parseWeeksCell(raw.weeks);
    if (weeksResult.error) ownErrors.push(issue('weeks', weeksResult.error));

    let pattern: MasterImportSchedulePattern | null = null;
    let slots: ScheduleSlotData[] = [];

    if (startDate && startTime && endTime && ownErrors.length === 0) {
      if (startDate < today) {
        ownErrors.push(issue('startDate', 'Нельзя создать расписание на прошедшую дату'));
      } else {
        const parsed = adminScheduleBatchSchema.safeParse({
          workDate: startDate,
          startTime,
          endTime,
          intervalMinutes: intervalResult.value,
          repeatDays: repeatDaysResult.days,
          weeks: weeksResult.value,
        });

        if (!parsed.success) {
          for (const zodIssue of parsed.error.issues) {
            const field = zodIssue.path.join('.');
            ownErrors.push({
              field,
              column: FIELD_COLUMNS[field] ?? field,
              message: zodIssue.message,
            });
          }
        } else {
          const built = buildScheduleSlots({
            startDate: parsed.data.workDate,
            startTime: parsed.data.startTime,
            endTime: parsed.data.endTime,
            intervalMinutes: parsed.data.intervalMinutes,
            repeatDays: parsed.data.repeatDays as DayKey[],
            weeks: parsed.data.weeks,
          });

          if (built.error) {
            ownErrors.push(issue('startTime', built.error));
          } else if (!built.slots.length) {
            ownErrors.push(issue('startTime', 'Не удалось построить слоты — проверьте время и интервал'));
          } else {
            slots = built.slots;
            pattern = {
              startDate: parsed.data.workDate,
              startTime: parsed.data.startTime,
              endTime: parsed.data.endTime,
              intervalMinutes: parsed.data.intervalMinutes,
              repeatDays: parsed.data.repeatDays ?? [],
              weeks: parsed.data.weeks,
            };
          }
        }
      }
    }

    let masterRow: number | null = null;
    if (phone) {
      masterRow = masterByPhone.get(phone) ?? null;
      if (masterRow == null) {
        ownErrors.push(issue('phone', 'Мастер с таким телефоном не найден на листе «Мастера»'));
      }
    }

    result.push({
      row,
      phone,
      masterRow,
      pattern,
      slots,
      ownErrors,
      ownWarnings,
      errors: [...ownErrors],
      warnings: [...ownWarnings],
      status: ownErrors.length ? 'error' : 'ready',
    });
  }

  return result;
}

// ── Связывание услуг/расписания со статусами мастеров ─────

export function recomputeLinkedStatuses(parsed: ParsedWorkbook): void {
  const masterByRow = new Map(parsed.masters.map((master) => [master.row, master]));

  const seenServices = new Set<string>();
  const serviceCountByPhone = new Map<string, number>();

  for (const service of parsed.services) {
    service.errors = [...service.ownErrors];
    service.warnings = [...service.ownWarnings];
    service.status = 'ready';

    if (service.errors.length) {
      service.status = 'error';
      continue;
    }

    const master = service.masterRow != null ? masterByRow.get(service.masterRow) : undefined;
    if (!master) {
      service.errors.push(issue('phone', 'Мастер не найден на листе «Мастера»'));
      service.status = 'error';
      continue;
    }
    if (master.status === 'duplicate') {
      service.status = 'skipped';
      service.warnings.push(issue('phone', `Мастер уже существует (строка ${master.row}) — услуга не будет импортирована`));
      continue;
    }
    if (master.status === 'error') {
      service.errors.push(issue('phone', `Мастер в строке ${master.row} содержит ошибки — услуга не будет импортирована`));
      service.status = 'error';
      continue;
    }

    const key = `${service.phone}|${normalizeLookupValue(service.name)}|${service.price}|${service.duration}`;
    if (seenServices.has(key)) {
      service.status = 'skipped';
      service.warnings.push(issue('name', 'Такая услуга уже указана выше — дубликат пропущен'));
      continue;
    }
    seenServices.add(key);

    const count = (serviceCountByPhone.get(service.phone) ?? 0) + 1;
    serviceCountByPhone.set(service.phone, count);
    if (count > MAX_SERVICES_PER_MASTER) {
      service.errors.push(issue('name', `У мастера больше ${MAX_SERVICES_PER_MASTER} услуг — услуга не будет импортирована`));
      service.status = 'error';
    }
  }

  const slotBudgetByMaster = new Map<number, number>();

  for (const schedule of parsed.schedule) {
    schedule.errors = [...schedule.ownErrors];
    schedule.warnings = [...schedule.ownWarnings];
    schedule.status = 'ready';

    if (schedule.errors.length) {
      schedule.status = 'error';
      continue;
    }

    const master = schedule.masterRow != null ? masterByRow.get(schedule.masterRow) : undefined;
    if (!master) {
      schedule.errors.push(issue('phone', 'Мастер не найден на листе «Мастера»'));
      schedule.status = 'error';
      continue;
    }
    if (master.status === 'duplicate') {
      schedule.status = 'skipped';
      schedule.warnings.push(issue('phone', `Мастер уже существует (строка ${master.row}) — расписание не будет импортировано`));
      continue;
    }
    if (master.status === 'error') {
      schedule.errors.push(issue('phone', `Мастер в строке ${master.row} содержит ошибки — расписание не будет импортировано`));
      schedule.status = 'error';
      continue;
    }

    const used = slotBudgetByMaster.get(master.row) ?? 0;
    if (used + schedule.slots.length > MAX_SLOTS_PER_MASTER) {
      schedule.errors.push(issue('startDate', `У мастера больше ${MAX_SLOTS_PER_MASTER} слотов — сократите период или увеличьте интервал`));
      schedule.status = 'error';
      continue;
    }
    slotBudgetByMaster.set(master.row, used + schedule.slots.length);
  }
}

// ── Проверка телефонов/username по базе ───────────────────

export interface ExistingMasterRecords {
  userByPhone: Map<string, { id: string; role: string; username: string | null }>;
  profilePhones: Set<string>;
  usernameOwners: Map<string, string>;
}

/**
 * Помечает готовые строки как duplicate/error с учётом уже существующих
 * пользователей. Вызывается и в предпросмотре, и перед импортом.
 */
export function applyExistingRecords(
  parsed: ParsedWorkbook,
  records: ExistingMasterRecords,
): void {
  for (const master of parsed.masters) {
    if (master.status !== 'ready' || !master.phone) continue;

    const user = records.userByPhone.get(master.phone);
    const hasProfile = records.profilePhones.has(master.phone);

    if (user || hasProfile) {
      if (user?.role === 'nailmaster' || hasProfile) {
        master.status = 'duplicate';
        master.warnings.push(
          issue('phone', 'Мастер с таким телефоном уже существует — строка будет пропущена'),
        );
      } else {
        master.status = 'error';
        master.errors.push(issue('phone', 'Телефон уже используется другим пользователем'));
      }
      continue;
    }

    if (master.data?.username) {
      const owner = records.usernameOwners.get(master.data.username);
      if (owner) {
        master.status = 'error';
        master.errors.push(issue('username', 'Этот username уже занят'));
      }
    }
  }

  recomputeLinkedStatuses(parsed);
}

// ── Предпросмотр для клиента ──────────────────────────────

export function buildPreview(parsed: ParsedWorkbook): MasterImportPreview {
  const masters = parsed.masters;
  const services = parsed.services;
  const schedule = parsed.schedule;

  const readyMasters = masters.filter((master) => master.status === 'ready');

  return {
    summary: {
      masterRows: masters.length,
      readyMasters: readyMasters.length,
      duplicateMasters: masters.filter((master) => master.status === 'duplicate').length,
      errorMasters: masters.filter((master) => master.status === 'error').length,
      serviceRows: services.length,
      readyServices: services.filter((service) => service.status === 'ready').length,
      skippedServices: services.filter((service) => service.status === 'skipped').length,
      errorServices: services.filter((service) => service.status === 'error').length,
      scheduleRows: schedule.length,
      readySchedules: schedule.filter((item) => item.status === 'ready').length,
      skippedSchedules: schedule.filter((item) => item.status === 'skipped').length,
      errorSchedules: schedule.filter((item) => item.status === 'error').length,
      scheduleSlots: schedule
        .filter((item) => item.status === 'ready')
        .reduce((sum, item) => sum + item.slots.length, 0),
      withoutCoordinates: readyMasters.filter(
        (master) =>
          master.data?.profile.latitude == null || master.data?.profile.longitude == null,
      ).length,
    },
    masters: masters.map((master) => ({
      row: master.row,
      status: master.status,
      data: master.data,
      display: master.display,
      errors: master.errors,
      warnings: master.warnings,
    })),
    services: services.map((service) => ({
      row: service.row,
      status: service.status,
      phone: service.phone,
      name: service.name,
      price: service.price,
      duration: service.duration,
      description: service.description,
      masterRow: service.masterRow,
      errors: service.errors,
      warnings: service.warnings,
    })),
    schedule: schedule.map((item) => ({
      row: item.row,
      status: item.status,
      phone: item.phone,
      pattern: item.pattern,
      slotsCount: item.slots.length,
      masterRow: item.masterRow,
      errors: item.errors,
      warnings: item.warnings,
    })),
  };
}

// ── Точка входа ───────────────────────────────────────────

export async function parseImportWorkbook(buffer: Buffer): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    throw new ImportFileError(
      'Не удалось прочитать файл. Убедитесь, что это корректный файл Excel (.xlsx), не защищённый паролем.',
    );
  }

  const { sheet: masterSheet, table: masterTable } = locateMasterTable(workbook);
  const masters = parseMasters(masterSheet, masterTable);

  if (!masters.length) {
    throw new ImportFileError(
      'Лист «Мастера» не содержит данных. Добавьте хотя бы одну строку с мастером.',
    );
  }

  let services: ParsedService[] = [];
  const serviceSheet = findNamedSheet(workbook, SHEET_ALIASES.services);
  if (serviceSheet) {
    const table = detectTable(serviceSheet, SERVICE_COLUMNS);
    if (!table) throw new ImportFileError(missingHeaderMessage(serviceSheet.name, SERVICE_COLUMNS));
    services = parseServices(serviceSheet, table, masters);
  }

  let schedule: ParsedSchedule[] = [];
  const scheduleSheet = findNamedSheet(workbook, SHEET_ALIASES.schedule);
  if (scheduleSheet) {
    const table = detectTable(scheduleSheet, SCHEDULE_COLUMNS);
    if (!table) throw new ImportFileError(missingHeaderMessage(scheduleSheet.name, SCHEDULE_COLUMNS));
    schedule = parseSchedule(scheduleSheet, table, masters);
  }

  const parsed: ParsedWorkbook = {
    masters,
    services,
    schedule,
    masterSheetName: masterSheet.name,
    serviceSheetName: serviceSheet?.name,
    scheduleSheetName: scheduleSheet?.name,
  };

  recomputeLinkedStatuses(parsed);
  return parsed;
}
