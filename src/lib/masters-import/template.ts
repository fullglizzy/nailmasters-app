// Генерация Excel-шаблона импорта мастеров.
// Шаблон и парсер используют одни и те же MASTER_COLUMNS/SERVICE_COLUMNS,
// поэтому колонки и подсказки не расходятся.

import ExcelJS from 'exceljs';
import { CITIES, MASTER_SPECIALTIES } from '@/data/specialties';
import {
  BOOLEAN_OPTIONS,
  MASTER_COLUMNS,
  MAX_MASTER_ROWS,
  MAX_SCHEDULE_ROWS,
  MAX_SERVICE_ROWS,
  REPEAT_DAY_OPTIONS,
  SCHEDULE_COLUMNS,
  SERVICE_COLUMNS,
  SHEET_INSTRUCTIONS,
  SHEET_MASTERS,
  SHEET_REFERENCES,
  SHEET_SCHEDULE,
  SHEET_SERVICES,
  WORK_FORMAT_OPTIONS,
  type ImportColumn,
} from './constants';

const REQUIRED_FILL = 'FF6D28D9'; // violet-700
const OPTIONAL_FILL = 'FF475569'; // slate-600
const SECTION_FILL = 'FFF1F5F9'; // slate-100
const TABLE_HEADER_FILL = 'FFE2E8F0'; // slate-200
const BORDER_COLOR = 'FFCBD5E1'; // slate-300
const MUTED_TEXT = 'FF64748B'; // slate-500

// ── Вспомогательные функции ───────────────────────────────

function columnLetter(columnNumber: number): string {
  let number = columnNumber;
  let result = '';
  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }
  return result;
}

function columnIndex(columns: ImportColumn[], key: string): number {
  // Excel колонки начинаются с 1.
  return columns.findIndex((column) => column.key === key) + 1;
}

function styleHeaderRow(row: ExcelJS.Row, columns: ImportColumn[]): void {
  row.height = 34;
  row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    const column = columns[columnNumber - 1];
    if (!column) return;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: column.required ? REQUIRED_FILL : OPTIONAL_FILL },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: BORDER_COLOR } } };
    if (column.note) cell.note = column.note;
  });
}

function addTableHeader(
  sheet: ExcelJS.Worksheet,
  columns: ImportColumn[],
  tabColor: string,
): void {
  sheet.properties.tabColor = { argb: tabColor };
  sheet.properties.defaultRowHeight = 18;

  const header = sheet.addRow(
    columns.map((column) => (column.required ? `${column.label} *` : column.label)),
  );
  styleHeaderRow(header, columns);

  columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width;
  });

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
}

type SheetWithDataValidations = ExcelJS.Worksheet & {
  dataValidations: {
    add(range: string, validation: ExcelJS.DataValidation): void;
  };
};

function addListValidation(
  sheet: ExcelJS.Worksheet,
  range: string,
  formula: string,
  title: string,
  message: string,
): void {
  (sheet as SheetWithDataValidations).dataValidations.add(range, {
    type: 'list',
    allowBlank: true,
    formulae: [formula],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: title,
    error: message,
  });
}

function addWholeValidation(
  sheet: ExcelJS.Worksheet,
  range: string,
  min: number,
  max: number,
  title: string,
  message: string,
): void {
  (sheet as SheetWithDataValidations).dataValidations.add(range, {
    type: 'whole',
    operator: 'between',
    allowBlank: true,
    formulae: [min, max],
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: title,
    error: message,
  });
}

function addDecimalValidation(
  sheet: ExcelJS.Worksheet,
  range: string,
  operator: 'between' | 'greaterThan',
  formulae: number[],
  title: string,
  message: string,
): void {
  (sheet as SheetWithDataValidations).dataValidations.add(range, {
    type: 'decimal',
    operator,
    allowBlank: true,
    formulae,
    showErrorMessage: true,
    errorStyle: 'stop',
    errorTitle: title,
    error: message,
  });
}

// ── Лист «Мастера» ────────────────────────────────────────

function buildMasterSheet(sheet: ExcelJS.Worksheet): void {
  addTableHeader(sheet, MASTER_COLUMNS, 'FF6D28D9');

  const lastRow = MAX_MASTER_ROWS + 1;
  const city = columnLetter(columnIndex(MASTER_COLUMNS, 'city'));
  const workFormat = columnLetter(columnIndex(MASTER_COLUMNS, 'workFormat'));
  const age = columnLetter(columnIndex(MASTER_COLUMNS, 'age'));
  const price = columnLetter(columnIndex(MASTER_COLUMNS, 'startingPrice'));
  const sterilization = columnLetter(columnIndex(MASTER_COLUMNS, 'sterilization'));
  const isModerated = columnLetter(columnIndex(MASTER_COLUMNS, 'isModerated'));
  const latitude = columnLetter(columnIndex(MASTER_COLUMNS, 'latitude'));
  const longitude = columnLetter(columnIndex(MASTER_COLUMNS, 'longitude'));

  addListValidation(
    sheet,
    `${city}2:${city}${lastRow}`,
    'NM_Cities',
    'Некорректный город',
    'Выберите город из списка на листе «Инструкция».',
  );

  addListValidation(
    sheet,
    `${workFormat}2:${workFormat}${lastRow}`,
    'NM_WorkFormats',
    'Некорректный формат работы',
    'Допустимо: В салоне, На дому или В салоне и на дому.',
  );

  addListValidation(
    sheet,
    `${sterilization}2:${isModerated}${lastRow}`,
    'NM_Booleans',
    'Некорректное значение',
    'Используйте «Да» или «Нет».',
  );

  addWholeValidation(
    sheet,
    `${age}2:${age}${lastRow}`,
    14,
    120,
    'Некорректный возраст',
    'Возраст должен быть целым числом от 14 до 120.',
  );

  addDecimalValidation(
    sheet,
    `${price}2:${price}${lastRow}`,
    'greaterThan',
    [0],
    'Некорректная цена',
    'Цена должна быть положительным числом.',
  );

  addDecimalValidation(
    sheet,
    `${latitude}2:${latitude}${lastRow}`,
    'between',
    [-90, 90],
    'Некорректная широта',
    'Широта должна быть от -90 до 90.',
  );

  addDecimalValidation(
    sheet,
    `${longitude}2:${longitude}${lastRow}`,
    'between',
    [-180, 180],
    'Некорректная долгота',
    'Долгота должна быть от -180 до 180.',
  );

  // Телефон — текстом, чтобы Excel не превращал его в число/экспоненту.
  sheet.getColumn(columnIndex(MASTER_COLUMNS, 'phone')).numFmt = '@';
  sheet.getColumn(columnIndex(MASTER_COLUMNS, 'startingPrice')).numFmt = '$#,##0.00';
  sheet.getColumn(columnIndex(MASTER_COLUMNS, 'age')).numFmt = '0';
  sheet.getColumn(columnIndex(MASTER_COLUMNS, 'latitude')).numFmt = '0.000000';
  sheet.getColumn(columnIndex(MASTER_COLUMNS, 'longitude')).numFmt = '0.000000';

}

// ── Лист «Услуги» ─────────────────────────────────────────

function buildServiceSheet(sheet: ExcelJS.Worksheet): void {
  addTableHeader(sheet, SERVICE_COLUMNS, 'FF2563EB');

  const lastRow = MAX_SERVICE_ROWS + 1;
  const price = columnLetter(columnIndex(SERVICE_COLUMNS, 'price'));
  const duration = columnLetter(columnIndex(SERVICE_COLUMNS, 'duration'));

  addListValidation(
    sheet,
    `A2:A${lastRow}`,
    'NM_MasterPhones',
    'Мастер не найден',
    'Телефон должен совпадать с телефоном на листе «Мастера».',
  );

  addDecimalValidation(
    sheet,
    `${price}2:${price}${lastRow}`,
    'greaterThan',
    [0],
    'Некорректная цена',
    'Цена должна быть положительным числом.',
  );

  addWholeValidation(
    sheet,
    `${duration}2:${duration}${lastRow}`,
    1,
    1440,
    'Некорректная длительность',
    'Длительность — целое число минут (например, 90).',
  );

  sheet.getColumn(columnIndex(SERVICE_COLUMNS, 'phone')).numFmt = '@';
  sheet.getColumn(columnIndex(SERVICE_COLUMNS, 'price')).numFmt = '$#,##0.00';
  sheet.getColumn(columnIndex(SERVICE_COLUMNS, 'duration')).numFmt = '0';
}

// ── Лист «Расписание» ─────────────────────────────────────

function buildScheduleSheet(sheet: ExcelJS.Worksheet): void {
  addTableHeader(sheet, SCHEDULE_COLUMNS, 'FF059669');

  const lastRow = MAX_SCHEDULE_ROWS + 1;
  const interval = columnLetter(columnIndex(SCHEDULE_COLUMNS, 'intervalMinutes'));
  const weeks = columnLetter(columnIndex(SCHEDULE_COLUMNS, 'weeks'));

  addListValidation(
    sheet,
    `A2:A${lastRow}`,
    'NM_MasterPhones',
    'Мастер не найден',
    'Телефон должен совпадать с телефоном на листе «Мастера».',
  );

  addWholeValidation(
    sheet,
    `${interval}2:${interval}${lastRow}`,
    15,
    480,
    'Некорректный интервал',
    'Интервал должен быть от 15 до 480 минут.',
  );

  addWholeValidation(
    sheet,
    `${weeks}2:${weeks}${lastRow}`,
    1,
    4,
    'Некорректное число недель',
    'Количество недель — от 1 до 4.',
  );

  sheet.getColumn(columnIndex(SCHEDULE_COLUMNS, 'phone')).numFmt = '@';
  sheet.getColumn(columnIndex(SCHEDULE_COLUMNS, 'startDate')).numFmt = 'yyyy-mm-dd';
  sheet.getColumn(columnIndex(SCHEDULE_COLUMNS, 'startTime')).numFmt = 'hh:mm';
  sheet.getColumn(columnIndex(SCHEDULE_COLUMNS, 'endTime')).numFmt = 'hh:mm';
  sheet.getColumn(columnIndex(SCHEDULE_COLUMNS, 'intervalMinutes')).numFmt = '0';
  sheet.getColumn(columnIndex(SCHEDULE_COLUMNS, 'weeks')).numFmt = '0';
}

// ── Лист «Справочники» ────────────────────────────────────

function buildReferencesSheet(sheet: ExcelJS.Worksheet): void {
  const headers = ['Города', 'Специализации', 'Формат работы', 'Да/Нет', 'Дни недели'];
  const header = sheet.addRow(headers);
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: OPTIONAL_FILL } };
  });

  const columns = [
    CITIES as readonly string[],
    MASTER_SPECIALTIES as readonly string[],
    WORK_FORMAT_OPTIONS,
    BOOLEAN_OPTIONS,
    REPEAT_DAY_OPTIONS,
  ];

  const maxRows = Math.max(...columns.map((values) => values.length));
  for (let index = 0; index < maxRows; index++) {
    sheet.addRow(columns.map((values) => values[index] ?? ''));
  }

  columns.forEach((_, index) => {
    sheet.getColumn(index + 1).width = index === 1 ? 32 : 18;
  });

  sheet.state = 'veryHidden';
}

// ── Лист «Инструкция» ─────────────────────────────────────

const MASTER_DESCRIPTIONS: Record<string, string> = {
  fullName: 'Полное имя мастера — его увидят клиенты в каталоге.',
  phone: 'Телефон для входа по OTP. Только США: +1 и 10 цифр. Excel может убрать ведущий «+» — это нормально.',
  city: 'Город из списка. Используется в фильтрах каталога.',
  address: 'Улица, дом, квартира или салон.',
  experience: 'Стаж текстом, например «5 лет».',
  startingPrice: 'Минимальная цена услуги в долларах.',
  specialties: 'Одна или несколько специализаций из списка, через запятую.',
  workFormat: 'В салоне, на дому или оба варианта.',
  age: 'Необязательно. Целое число от 14 до 120.',
  username: 'Необязательно. Если пусто — сгенерируется автоматически.',
  description: 'Свободный текст «О себе».',
  sterilization: 'Да/Нет. По умолчанию — Нет.',
  disposableTools: 'Да/Нет. По умолчанию — Нет.',
  isActive: 'Да/Нет. По умолчанию — Да. «Нет» — мастер скрыт из каталога.',
  isModerated: 'Да/Нет. По умолчанию — Да. «Нет» — не попадает в «Популярное» и «Рядом».',
  latitude: 'Необязательно. Без координат мастер не попадёт в раздел «Рядом».',
  longitude: 'Необязательно. Указывайте вместе с широтой.',
};

const MASTER_EXAMPLES: Record<string, string> = {
  fullName: 'Анна Иванова',
  phone: '(555) 123-4567',
  city: 'New York',
  address: '123 Broadway, Apt 4',
  experience: '5 лет',
  startingPrice: '45',
  specialties: 'Аппаратный маникюр, Гель-лак',
  workFormat: 'В салоне',
  age: '27',
  username: 'anna_nails',
  description: 'Работаю с 2019 года, люблю графичные дизайны.',
  sterilization: 'Да',
  disposableTools: 'Да',
  isActive: 'Да',
  isModerated: 'Да',
  latitude: '40.7128',
  longitude: '-74.0060',
};

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  phone: 'Телефон мастера с листа «Мастера». Обязательно должен совпадать.',
  name: 'Название услуги, которое увидит клиент.',
  price: 'Цена в долларах.',
  duration: 'Длительность в минутах — целое число.',
  description: 'Необязательное описание услуги.',
};

const SERVICE_EXAMPLES: Record<string, string> = {
  phone: '(555) 123-4567',
  name: 'Маникюр с покрытием',
  price: '45',
  duration: '90',
  description: 'Аппаратный маникюр + гель-лак',
};

const SCHEDULE_DESCRIPTIONS: Record<string, string> = {
  phone: 'Телефон мастера с листа «Мастера».',
  startDate: 'Первый день расписания. Формат ГГГГ-ММ-ДД или дата Excel.',
  startTime: 'Начало рабочего окна, например 09:00.',
  endTime: 'Конец рабочего окна, например 18:00.',
  intervalMinutes: 'Длина одного слота в минутах. Необязательно; по умолчанию — всё окно.',
  repeatDays: 'Дни повтора через запятую: пн, ср, пт. Также «будни» или «выходные».',
  weeks: 'На сколько недель вперёд повторять дни. От 1 до 4, по умолчанию 4.',
};

const SCHEDULE_EXAMPLES: Record<string, string> = {
  phone: '(555) 123-4567',
  startDate: '2026-11-10',
  startTime: '09:00',
  endTime: '18:00',
  intervalMinutes: '60',
  repeatDays: 'пн, вт, ср, чт, пт',
  weeks: '4',
};

function mergeRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  text: string,
  options: {
    bold?: boolean;
    size?: number;
    color?: string;
    fill?: string;
    height?: number;
    wrap?: boolean;
  } = {},
): void {
  sheet.mergeCells(`A${rowNumber}:D${rowNumber}`);
  for (let column = 1; column <= 4; column++) {
    const cell = sheet.getCell(rowNumber, column);
    cell.font = {
      bold: options.bold ?? false,
      size: options.size ?? 10,
      color: { argb: options.color ?? 'FF111827' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: options.wrap ?? false };
    if (options.fill) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: options.fill } };
    }
  }
  sheet.getCell(rowNumber, 1).value = text;
  if (options.height) sheet.getRow(rowNumber).height = options.height;
}

function addSection(sheet: ExcelJS.Worksheet, rowNumber: number, title: string): number {
  mergeRow(sheet, rowNumber, title, {
    bold: true,
    size: 12,
    fill: SECTION_FILL,
    height: 26,
  });
  return rowNumber + 1;
}

function addParagraph(sheet: ExcelJS.Worksheet, rowNumber: number, text: string): number {
  const height = Math.max(18, Math.ceil(text.length / 105) * 15 + 6);
  mergeRow(sheet, rowNumber, text, { wrap: true, height });
  return rowNumber + 1;
}

function addColumnTable(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  columns: ImportColumn[],
  descriptions: Record<string, string>,
  examples: Record<string, string>,
): number {
  const header = sheet.getRow(rowNumber);
  const headers = ['Колонка', 'Обязательно', 'Описание', 'Пример'];
  headers.forEach((label, index) => {
    const cell = header.getCell(index + 1);
    cell.value = label;
    cell.font = { bold: true, size: 10, color: { argb: 'FF111827' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TABLE_HEADER_FILL } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
      top: { style: 'thin', color: { argb: BORDER_COLOR } },
      left: { style: 'thin', color: { argb: BORDER_COLOR } },
      right: { style: 'thin', color: { argb: BORDER_COLOR } },
    };
  });
  header.height = 24;
  rowNumber++;

  for (const column of columns) {
    const row = sheet.getRow(rowNumber);
    const values = [
      column.required ? `${column.label} *` : column.label,
      column.required ? 'Да' : '—',
      descriptions[column.key] ?? column.note ?? '',
      examples[column.key] ?? '',
    ];
    values.forEach((value, index) => {
      const cell = row.getCell(index + 1);
      cell.value = value;
      cell.font = {
        bold: index === 0,
        size: 10,
        color: { argb: index === 1 && column.required ? REQUIRED_FILL : 'FF111827' },
      };
      cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      cell.border = {
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };
    });
    row.height = Math.max(22, Math.ceil(values[2].length / 75) * 14 + 8);
    rowNumber++;
  }

  return rowNumber + 1;
}

function buildInstructionsSheet(sheet: ExcelJS.Worksheet): void {
  sheet.properties.tabColor = { argb: 'FF64748B' };
  sheet.views = [{ showGridLines: false }];
  sheet.properties.defaultRowHeight = 18;
  sheet.getColumn(1).width = 28;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 78;
  sheet.getColumn(4).width = 32;

  mergeRow(sheet, 1, 'Импорт мастеров в NailMasters', {
    bold: true,
    size: 16,
    color: 'FFFFFFFF',
    fill: REQUIRED_FILL,
    height: 38,
  });
  mergeRow(
    sheet,
    2,
    'Загрузка: /admin → вкладка «Мастера» → «Импорт из Excel». Сначала откроется предпросмотр, затем импорт.',
    { color: MUTED_TEXT, wrap: true, height: 30 },
  );

  let row = 4;
  row = addSection(sheet, row, '1. Как заполнять');
  row = addParagraph(sheet, row, '• Лист «Мастера» — обязательный. Одна строка = один мастер. Обязательные колонки отмечены звёздочкой *.');
  row = addParagraph(sheet, row, '• Лист «Услуги» — необязательный. Одна строка = одна услуга. Телефон мастера должен совпадать с листом «Мастера».');
  row = addParagraph(sheet, row, '• Лист «Расписание» — необязательный. Одна строка = один шаблон слотов. Для одного мастера можно указать несколько строк.');
  row = addParagraph(sheet, row, '• Порядок колонок можно менять, лишние колонки игнорируются. Листы и названия колонок переименовывать нельзя.');
  row++;

  row = addSection(sheet, row, '2. Правила импорта');
  row = addParagraph(sheet, row, '• Формат файла — .xlsx, размер до 5 МБ. Максимум: 500 мастеров, 2000 услуг, 1000 строк расписания.');
  row = addParagraph(sheet, row, '• Строки с ошибками не импортируются. В предпросмотре видно каждую ошибку и её строку.');
  row = addParagraph(sheet, row, '• Если телефон уже есть в базе, строка пропускается — существующие данные не обновляются.');
  row = addParagraph(sheet, row, '• Если телефон повторяется внутри файла, импортируется только первая строка; остальные помечаются как дубликаты.');
  row = addParagraph(sheet, row, '• Строки, которые не будут импортированы, можно пропустить и загрузить только корректные — переключатель в окне предпросмотра.');
  row = addParagraph(sheet, row, '• Координаты необязательны. Без них мастер не появится в разделе «Рядом», но их можно указать позже в карточке мастера.');
  row = addParagraph(sheet, row, '• После импорта мастер входит на /auth по номеру телефона. Пока SMS отключены, код входа — 000000.');
  row++;

  row = addSection(sheet, row, '3. Колонки листа «Мастера»');
  row = addColumnTable(sheet, row, MASTER_COLUMNS, MASTER_DESCRIPTIONS, MASTER_EXAMPLES);

  row = addSection(sheet, row, '4. Колонки листа «Услуги»');
  row = addColumnTable(sheet, row, SERVICE_COLUMNS, SERVICE_DESCRIPTIONS, SERVICE_EXAMPLES);

  row = addSection(sheet, row, '5. Колонки листа «Расписание»');
  row = addColumnTable(sheet, row, SCHEDULE_COLUMNS, SCHEDULE_DESCRIPTIONS, SCHEDULE_EXAMPLES);

  row = addSection(sheet, row, '6. Допустимые значения');
  row = addParagraph(sheet, row, `Города: ${CITIES.join(', ')}.`);
  row = addParagraph(sheet, row, `Специализации: ${MASTER_SPECIALTIES.join(', ')}.`);
  row = addParagraph(sheet, row, `Формат работы: ${WORK_FORMAT_OPTIONS.join(' / ')}.`);
  row = addParagraph(sheet, row, 'Да/Нет: Да, Нет (также yes/no, true/false, 1/0).');
  row = addParagraph(sheet, row, `Дни повтора: ${REPEAT_DAY_OPTIONS.join(', ')} (или mon…sun), а также «будни» и «выходные».`);
  row++;

  row = addSection(sheet, row, '7. Пример заполнения');
  row = addParagraph(
    sheet,
    row,
    'Мастер: ФИО = Анна Иванова; Телефон = (555) 123-4567; Город = New York; Адрес = 123 Broadway, Apt 4; Опыт = 5 лет; Цена от = 45; Специализации = Аппаратный маникюр, Гель-лак; Формат работы = В салоне; Возраст = 27; Username = anna_nails; Стерилизация = Да; Одноразовые материалы = Да; Активен = Да; Проверен = Да.',
  );
  row = addParagraph(
    sheet,
    row,
    'Услуга: Телефон мастера = (555) 123-4567; Название = Маникюр с покрытием; Цена = 45; Длительность = 90; Описание = Аппаратный маникюр + гель-лак.',
  );
  row = addParagraph(
    sheet,
    row,
    'Расписание: Телефон мастера = (555) 123-4567; Дата начала = 2026-11-10; Время начала = 09:00; Время окончания = 18:00; Интервал = 60; Дни повтора = пн, вт, ср, чт, пт; Недель = 4.',
  );
}

// ── Именованные диапазоны для выпадающих списков ──────────

function addDefinedNames(workbook: ExcelJS.Workbook): void {
  const ref = (range: string) => `'${SHEET_REFERENCES}'!${range}`;

  workbook.definedNames.add(ref(`$A$2:$A$${CITIES.length + 1}`), 'NM_Cities');
  workbook.definedNames.add(ref(`$B$2:$B$${MASTER_SPECIALTIES.length + 1}`), 'NM_Specialties');
  workbook.definedNames.add(ref(`$C$2:$C$${WORK_FORMAT_OPTIONS.length + 1}`), 'NM_WorkFormats');
  workbook.definedNames.add(ref(`$D$2:$D$${BOOLEAN_OPTIONS.length + 1}`), 'NM_Booleans');
  workbook.definedNames.add(
    `'${SHEET_MASTERS}'!$B$2:$B$${MAX_MASTER_ROWS + 1}`,
    'NM_MasterPhones',
  );
}

// ── Точка входа ───────────────────────────────────────────

export async function buildTemplateWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NailMasters';
  workbook.lastModifiedBy = 'NailMasters';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.title = 'Импорт мастеров — шаблон';
  workbook.subject = 'NailMasters admin import';

  const mastersSheet = workbook.addWorksheet(SHEET_MASTERS);
  buildMasterSheet(mastersSheet);

  const servicesSheet = workbook.addWorksheet(SHEET_SERVICES);
  buildServiceSheet(servicesSheet);

  const scheduleSheet = workbook.addWorksheet(SHEET_SCHEDULE);
  buildScheduleSheet(scheduleSheet);

  const instructionsSheet = workbook.addWorksheet(SHEET_INSTRUCTIONS);
  buildInstructionsSheet(instructionsSheet);

  const referencesSheet = workbook.addWorksheet(SHEET_REFERENCES);
  buildReferencesSheet(referencesSheet);

  addDefinedNames(workbook);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
