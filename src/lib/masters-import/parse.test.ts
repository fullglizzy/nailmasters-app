import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  MASTER_COLUMNS,
  SCHEDULE_COLUMNS,
  SERVICE_COLUMNS,
  type ImportColumn,
} from './constants';
import {
  buildPreview,
  ImportFileError,
  parseImportWorkbook,
} from './parse';
import { buildTemplateWorkbook } from './template';

type CellValue = string | number | boolean | null;

function headers(columns: ImportColumn[]): string[] {
  return columns.map((column) => (column.required ? `${column.label} *` : column.label));
}

async function workbookBuffer(options: {
  masterRows?: CellValue[][];
  serviceRows?: CellValue[][];
  scheduleRows?: CellValue[][];
  masterHeaders?: string[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  const masters = workbook.addWorksheet('Мастера');
  masters.addRow(options.masterHeaders ?? headers(MASTER_COLUMNS));
  for (const row of options.masterRows ?? []) masters.addRow(row);

  if (options.serviceRows) {
    const services = workbook.addWorksheet('Услуги');
    services.addRow(headers(SERVICE_COLUMNS));
    for (const row of options.serviceRows) services.addRow(row);
  }

  if (options.scheduleRows) {
    const schedule = workbook.addWorksheet('Расписание');
    schedule.addRow(headers(SCHEDULE_COLUMNS));
    for (const row of options.scheduleRows) schedule.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as unknown as ArrayBuffer);
}

function masterRow(overrides: Record<string, CellValue> = {}): CellValue[] {
  const values: Record<string, CellValue> = {
    fullName: 'Анна Иванова',
    phone: '(555) 123-4567',
    city: 'New York',
    address: '123 Broadway, Apt 4',
    experience: '5 лет',
    startingPrice: 45,
    specialties: 'Аппаратный маникюр, Гель-лак',
    workFormat: 'В салоне',
    age: 27,
    username: 'anna_nails',
    description: 'Работаю с 2019 года',
    sterilization: 'Да',
    disposableTools: 'Нет',
    isActive: 'Да',
    isModerated: 'Да',
    latitude: 40.7128,
    longitude: -74.006,
    ...overrides,
  };

  return MASTER_COLUMNS.map((column) => values[column.key] ?? '');
}

describe('parseImportWorkbook', () => {
  it('parses a valid master, service and schedule', async () => {
    const buffer = await workbookBuffer({
      masterRows: [masterRow()],
      serviceRows: [['(555) 123-4567', 'Маникюр с покрытием', 45, 90, 'Тест']],
      scheduleRows: [['+1 555 123 4567', '2099-01-05', '09:00', '18:00', 60, 'пн, ср', 1]],
    });

    const parsed = await parseImportWorkbook(buffer);
    const preview = buildPreview(parsed);

    expect(parsed.masters).toHaveLength(1);
    expect(parsed.masters[0].status).toBe('ready');
    expect(parsed.masters[0].data?.phone).toBe('+15551234567');
    expect(parsed.masters[0].data?.profile.city).toBe('New York');
    expect(parsed.masters[0].data?.profile.specialties).toEqual([
      'Аппаратный маникюр',
      'Гель-лак',
    ]);
    expect(parsed.masters[0].data?.profile.workFormat).toEqual(['salon']);
    expect(parsed.masters[0].data?.profile.startingPrice).toBe(45);
    expect(parsed.masters[0].data?.profile.latitude).toBe(40.7128);

    expect(preview.summary.readyMasters).toBe(1);
    expect(preview.summary.readyServices).toBe(1);
    expect(preview.summary.readySchedules).toBe(1);
    expect(preview.summary.scheduleSlots).toBe(27);
  });

  it('finds headers in any order and accepts English aliases', async () => {
    const buffer = await workbookBuffer({
      masterHeaders: [
        'Phone',
        'Full Name',
        'City',
        'Address',
        'Experience',
        'Price',
        'Specialties',
        'Work Format',
      ],
      masterRows: [
        [
          '5559998888',
          'Иван Петров',
          'Chicago',
          '5 Main St',
          '3 года',
          '60',
          'Гель-лак',
          'На дому',
        ],
      ],
    });

    const parsed = await parseImportWorkbook(buffer);
    expect(parsed.masters[0].status).toBe('ready');
    expect(parsed.masters[0].data?.phone).toBe('+15559998888');
    expect(parsed.masters[0].data?.isActive).toBe(true);
    expect(parsed.masters[0].data?.isModerated).toBe(true);
    expect(parsed.masters[0].data?.profile.sterilization).toBe(false);
  });

  it('collects field-level errors for an invalid row', async () => {
    const buffer = await workbookBuffer({
      masterRows: [
        masterRow({
          fullName: '',
          phone: '123',
          city: 'Atlantis',
          address: '',
          experience: '',
          startingPrice: -5,
          specialties: 'Неизвестно',
          workFormat: 'на Луне',
          age: 13,
          latitude: 1,
          longitude: '',
          sterilization: 'может',
        }),
      ],
    });

    const parsed = await parseImportWorkbook(buffer);
    const master = parsed.masters[0];

    expect(master.status).toBe('error');
    const fields = master.errors.map((issue) => issue.field);
    expect(fields).toContain('phone');
    expect(fields).toContain('profile.fullName');
    expect(fields).toContain('profile.city');
    expect(fields).toContain('profile.specialties');
    expect(fields).toContain('profile.startingPrice');
    expect(fields).toContain('profile.workFormat');
    expect(fields).toContain('age');
    expect(fields).toContain('profile.latitude');
    expect(fields).toContain('profile.sterilization');
  });

  it('rejects duplicate phones inside the file', async () => {
    const buffer = await workbookBuffer({
      masterRows: [
        masterRow({ fullName: 'Первая', username: '' }),
        masterRow({ fullName: 'Вторая', phone: '+1 555 123 4567', username: '' }),
      ],
    });

    const parsed = await parseImportWorkbook(buffer);
    expect(parsed.masters[0].status).toBe('ready');
    expect(parsed.masters[1].status).toBe('error');
    expect(parsed.masters[1].errors[0].message).toContain('Дубликат телефона');
  });

  it('links services to masters and skips duplicates and orphans', async () => {
    const buffer = await workbookBuffer({
      masterRows: [masterRow()],
      serviceRows: [
        ['(555) 123-4567', 'Маникюр', 45, 90, ''],
        ['(555) 123-4567', 'Маникюр', 45, 90, ''],
        ['(555) 000-0000', 'Педикюр', 60, 60, ''],
      ],
    });

    const parsed = await parseImportWorkbook(buffer);
    expect(parsed.services[0].status).toBe('ready');
    expect(parsed.services[1].status).toBe('skipped');
    expect(parsed.services[1].warnings[0].message).toContain('дубликат');
    expect(parsed.services[2].status).toBe('error');
    expect(parsed.services[2].errors[0].message).toContain('не найден');
  });

  it('rejects services of an invalid master', async () => {
    const buffer = await workbookBuffer({
      masterRows: [masterRow({ city: 'Atlantis' })],
      serviceRows: [['(555) 123-4567', 'Маникюр', 45, 90, '']],
    });

    const parsed = await parseImportWorkbook(buffer);
    expect(parsed.masters[0].status).toBe('error');
    expect(parsed.services[0].status).toBe('error');
    expect(parsed.services[0].errors[0].message).toContain('содержит ошибки');
  });

  it('validates schedule dates and times', async () => {
    const buffer = await workbookBuffer({
      masterRows: [masterRow()],
      scheduleRows: [
        ['(555) 123-4567', '2000-01-01', '09:00', '18:00', 60, '', 1],
        ['(555) 123-4567', '2099-01-05', '25:00', '18:00', 60, '', 1],
        ['(555) 123-4567', '2099-01-05', '09:00', '18:00', 5, '', 1],
      ],
    });

    const parsed = await parseImportWorkbook(buffer);
    expect(parsed.schedule.every((item) => item.status === 'error')).toBe(true);
    expect(parsed.schedule[0].errors[0].message).toContain('прошедшую');
    expect(parsed.schedule[1].errors[0].field).toBe('startTime');
    expect(parsed.schedule[2].errors[0].message).toContain('Интервал');
  });

  it('rejects prices and durations that do not fit the database', async () => {
    const buffer = await workbookBuffer({
      masterRows: [masterRow({ startingPrice: 100_000_000 })],
      serviceRows: [['(555) 123-4567', 'Слишком долго', 45, 2000]],
    });

    const parsed = await parseImportWorkbook(buffer);
    expect(parsed.masters[0].status).toBe('error');
    expect(parsed.masters[0].errors[0].message).toContain('Цена слишком большая');
    expect(parsed.services[0].errors[0].message).toContain('1440');
  });

  it('rounds money to two decimals like decimal(10,2)', async () => {
    const buffer = await workbookBuffer({
      masterRows: [masterRow({ startingPrice: 45.999 })],
      serviceRows: [['(555) 123-4567', 'Услуга', 70.555, 60]],
    });

    const parsed = await parseImportWorkbook(buffer);
    expect(parsed.masters[0].data?.profile.startingPrice).toBe(46);
    expect(parsed.services[0].price).toBe(70.56);
  });

  it('uses the generated template without header drift', async () => {
    const template = await buildTemplateWorkbook();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(template as never);

    expect(workbook.getWorksheet('Мастера')).toBeTruthy();
    expect(workbook.getWorksheet('Услуги')).toBeTruthy();
    expect(workbook.getWorksheet('Расписание')).toBeTruthy();
    expect(workbook.getWorksheet('Инструкция')).toBeTruthy();
    expect(workbook.getWorksheet('Справочники')?.state).toBe('veryHidden');

    const masters = workbook.getWorksheet('Мастера')!;
    masters.addRow(masterRow());

    const buffer = await workbook.xlsx.writeBuffer();
    const parsed = await parseImportWorkbook(Buffer.from(buffer as unknown as ArrayBuffer));

    expect(parsed.masters[0].status).toBe('ready');
    expect(parsed.masters[0].data?.phone).toBe('+15551234567');
  });

  it('rejects an empty template with a clear error', async () => {
    const template = await buildTemplateWorkbook();
    await expect(parseImportWorkbook(template)).rejects.toBeInstanceOf(ImportFileError);
  });
});
