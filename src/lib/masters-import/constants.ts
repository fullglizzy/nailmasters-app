// ============================================================
// Формат Excel-файла для импорта мастеров
// ============================================================

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
  width: number;
  note?: string;
}

// ── Ограничения ───────────────────────────────────────────

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 МБ
export const MAX_MASTER_ROWS = 500;
export const MAX_SERVICE_ROWS = 2000;
export const MAX_SCHEDULE_ROWS = 1000;
/** Защита от листов, где отформатированы десятки тысяч пустых строк. */
export const MAX_SHEET_ROWS = 5000;
export const MAX_SERVICES_PER_MASTER = 50;
export const MAX_SLOTS_PER_MASTER = 200;
export const HEADER_SEARCH_ROWS = 15;
/** Предел колонки decimal(10,2) в PostgreSQL. */
export const MAX_PRICE = 99_999_999.99;
/** Разумный предел длительности одной услуги — 24 часа. */
export const MAX_SERVICE_DURATION = 1440;

// ── Листы ─────────────────────────────────────────────────

export const SHEET_MASTERS = 'Мастера';
export const SHEET_SERVICES = 'Услуги';
export const SHEET_SCHEDULE = 'Расписание';
export const SHEET_INSTRUCTIONS = 'Инструкция';
export const SHEET_REFERENCES = 'Справочники';

export const SHEET_ALIASES = {
  masters: ['мастера', 'masters', 'master'],
  services: ['услуги', 'services', 'service'],
  schedule: ['расписание', 'schedule', 'график'],
} as const;

/** Листы, которые никогда не являются таблицей мастеров при fallback-поиске. */
export const NON_DATA_SHEET_NAMES = [
  SHEET_INSTRUCTIONS,
  SHEET_REFERENCES,
  'пример',
  'example',
  'readme',
] as const;

// ── Колонки листа «Мастера» ───────────────────────────────

export const MASTER_COLUMNS: ImportColumn[] = [
  {
    key: 'fullName',
    label: 'ФИО',
    required: true,
    aliases: ['фио', 'имя', 'полноеимя', 'fullname', 'name'],
    width: 26,
  },
  {
    key: 'phone',
    label: 'Телефон',
    required: true,
    aliases: ['телефон', 'телефонмастера', 'phone', 'phonenumber'],
    width: 20,
    note: 'Только США: +1 и 10 цифр. Примеры: (555) 123-4567, 5551234567, +1 555 123 4567.',
  },
  {
    key: 'city',
    label: 'Город',
    required: true,
    aliases: ['город', 'city'],
    width: 16,
    note: 'Значение из списка на листе «Инструкция».',
  },
  {
    key: 'address',
    label: 'Адрес',
    required: true,
    aliases: ['адрес', 'address'],
    width: 32,
  },
  {
    key: 'experience',
    label: 'Опыт',
    required: true,
    aliases: ['опыт', 'опытработы', 'experience'],
    width: 14,
    note: 'Например: 5 лет.',
  },
  {
    key: 'startingPrice',
    label: 'Цена от',
    required: true,
    aliases: ['ценаот', 'цена', 'startingprice', 'price'],
    width: 12,
    note: 'Положительное число в долларах. Например: 45 или $45.00.',
  },
  {
    key: 'specialties',
    label: 'Специализации',
    required: true,
    aliases: ['специализации', 'специальности', 'specialties'],
    width: 38,
    note: 'Несколько значений через запятую. Список — на листе «Инструкция».',
  },
  {
    key: 'workFormat',
    label: 'Формат работы',
    required: true,
    aliases: ['форматработы', 'форматработ', 'workformat'],
    width: 24,
    note: 'В салоне / На дому / В салоне и на дому.',
  },
  {
    key: 'age',
    label: 'Возраст',
    aliases: ['возраст', 'age'],
    width: 10,
    note: 'Необязательно. Целое число от 14 до 120.',
  },
  {
    key: 'username',
    label: 'Username',
    aliases: ['username', 'юзернейм', 'логин'],
    width: 18,
    note: 'Необязательно. Если пусто — будет сгенерирован автоматически.',
  },
  {
    key: 'description',
    label: 'О себе',
    aliases: ['осебе', 'описание', 'description', 'about'],
    width: 40,
  },
  {
    key: 'sterilization',
    label: 'Стерилизация',
    aliases: ['стерилизация', 'sterilization'],
    width: 16,
    note: 'Да / Нет. По умолчанию — Нет.',
  },
  {
    key: 'disposableTools',
    label: 'Одноразовые материалы',
    aliases: ['одноразовыематериалы', 'одноразовые', 'disposabletools'],
    width: 22,
    note: 'Да / Нет. По умолчанию — Нет.',
  },
  {
    key: 'isActive',
    label: 'Активен',
    aliases: ['активен', 'isactive', 'active'],
    width: 10,
    note: 'Да / Нет. По умолчанию — Да.',
  },
  {
    key: 'isModerated',
    label: 'Проверен',
    aliases: ['проверен', 'ismoderated', 'moderated'],
    width: 10,
    note: 'Да / Нет. По умолчанию — Да.',
  },
  {
    key: 'latitude',
    label: 'Широта',
    aliases: ['широта', 'latitude', 'lat'],
    width: 12,
    note: 'Необязательно. Без координат мастер не попадёт в раздел «Рядом».',
  },
  {
    key: 'longitude',
    label: 'Долгота',
    aliases: ['долгота', 'longitude', 'lng', 'lon'],
    width: 12,
    note: 'Необязательно. Указывайте вместе с широтой.',
  },
];

// ── Колонки листа «Услуги» ────────────────────────────────

export const SERVICE_COLUMNS: ImportColumn[] = [
  {
    key: 'phone',
    label: 'Телефон мастера',
    required: true,
    aliases: ['телефонмастера', 'телефон', 'phone'],
    width: 20,
    note: 'Должен совпадать с телефоном на листе «Мастера».',
  },
  {
    key: 'name',
    label: 'Название услуги',
    required: true,
    aliases: ['названиеуслуги', 'название', 'услуга', 'name', 'servicename'],
    width: 32,
  },
  {
    key: 'price',
    label: 'Цена',
    required: true,
    aliases: ['цена', 'price'],
    width: 12,
  },
  {
    key: 'duration',
    label: 'Длительность (мин)',
    required: true,
    aliases: ['длительностьмин', 'длительность', 'duration', 'минуты'],
    width: 18,
    note: 'Целое число минут. Например: 90.',
  },
  {
    key: 'description',
    label: 'Описание',
    aliases: ['описание', 'description'],
    width: 40,
  },
];

// ── Колонки листа «Расписание» ────────────────────────────

export const SCHEDULE_COLUMNS: ImportColumn[] = [
  {
    key: 'phone',
    label: 'Телефон мастера',
    required: true,
    aliases: ['телефонмастера', 'телефон', 'phone'],
    width: 20,
    note: 'Должен совпадать с телефоном на листе «Мастера».',
  },
  {
    key: 'startDate',
    label: 'Дата начала',
    required: true,
    aliases: ['датаначала', 'дата', 'startdate'],
    width: 14,
    note: 'Формат ГГГГ-ММ-ДД или дата Excel. Не раньше сегодняшнего дня.',
  },
  {
    key: 'startTime',
    label: 'Время начала',
    required: true,
    aliases: ['времяначала', 'начало', 'starttime'],
    width: 14,
    note: 'Например: 09:00.',
  },
  {
    key: 'endTime',
    label: 'Время окончания',
    required: true,
    aliases: ['времяокончания', 'конец', 'endtime'],
    width: 16,
    note: 'Должно быть позже времени начала.',
  },
  {
    key: 'intervalMinutes',
    label: 'Интервал (мин)',
    aliases: ['интервалмин', 'интервал', 'interval', 'intervalminutes'],
    width: 16,
    note: 'Необязательно. По умолчанию равен длительности окна (мин. 15).',
  },
  {
    key: 'repeatDays',
    label: 'Дни повтора',
    aliases: ['дниповтора', 'дни', 'днинедели', 'repeatdays'],
    width: 28,
    note: 'Например: пн, ср, пт. Также «будни» или «выходные».',
  },
  {
    key: 'weeks',
    label: 'Недель',
    aliases: ['недель', 'weeks', 'количествонедель'],
    width: 10,
    note: 'Необязательно. От 1 до 4, по умолчанию 4.',
  },
];

// ── Значения для выпадающих списков ───────────────────────

export const WORK_FORMAT_OPTIONS = ['В салоне', 'На дому', 'В салоне и на дому'];
export const BOOLEAN_OPTIONS = ['Да', 'Нет'];
export const REPEAT_DAY_OPTIONS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
