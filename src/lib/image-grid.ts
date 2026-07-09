/**
 * Алгоритм «кладки кирпичей» для умной сетки изображений.
 * Аналог раскладки фото во ВКонтакте / Telegram.
 *
 * Размещает N фотографий в прямоугольный контейнер с сохранением порядка,
 * подбирая оптимальную базовую высоту так, чтобы итоговые пропорции сетки
 * были максимально близки к целевому соотношению сторон.
 */

export interface ImageItem {
  id: string | number;
  width: number;
  height: number;
}

export interface PlacedImage extends ImageItem {
  /** Вычисленная ширина в сетке (пиксели, целое) */
  placedWidth: number;
  /** Вычисленная высота в сетке (пиксели, целое) */
  placedHeight: number;
}

type Row = PlacedImage[];

export interface GridResult {
  rows: Row[];
  totalHeight: number;
  aspectRatio: number;
  diff: number;
}

export interface GridOptions {
  containerWidth: number;
  targetAspectRatio?: number;
  containerHeight?: number;
  hMin?: number;
  wMin?: number;
  searchStep?: number;
}

/* ──────────────── Шаг 1: поиск h ──────────────── */

function findBestH(
  images: ImageItem[],
  opts: Required<Omit<GridOptions, 'containerHeight'>> & { containerHeight?: number },
): number {
  const { containerWidth, targetAspectRatio, hMin, wMin, searchStep } = opts;
  const maxH = containerWidth;

  let bestGrid: GridResult | null = null;
  let bestH = hMin;

  for (let h = hMin; h <= maxH; h += searchStep) {
    const rows = tryLayout(images, containerWidth, h, wMin);
    if (!rows) continue;

    const evaluation = evaluateGrid(rows, containerWidth, targetAspectRatio);
    if (!evaluation) continue;

    if (!bestGrid || evaluation.diff < bestGrid.diff) {
      bestGrid = evaluation;
      bestH = h;
    }
  }

  // Если ни один h не подошёл из-за wMin/hMin — fallback на hMin без ограничений
  if (!bestGrid) {
    const rows = tryLayout(images, containerWidth, hMin, 0);
    if (rows) {
      const ev = evaluateGrid(rows, containerWidth, targetAspectRatio);
      if (ev) return hMin;
    }
  }

  return bestH;
}

/* ──────────────── Шаг 2: пробная кладка ──────────────── */

function tryLayout(
  images: ImageItem[],
  containerWidth: number,
  h: number,
  wMin: number,
): Row[] | null {
  const rows = buildRows(images, containerWidth, h);
  const scaled = scaleRows(rows, containerWidth);

  // Шаг 4: валидация
  for (const row of scaled) {
    for (const img of row) {
      if (img.placedHeight < 1 || img.placedWidth < wMin) return null;
    }
  }

  return scaled;
}

/* ──────────────── Шаг 2а: распределение по рядам ──────────────── */

function buildRows(
  images: ImageItem[],
  containerWidth: number,
  h: number,
): Row[] {
  const rows: Row[] = [];
  let currentRow: PlacedImage[] = [];
  let rowWidth = 0;

  for (const img of images) {
    // Приводим высоту к h, пропорционально ширину
    const newWidth = img.width * (h / img.height);
    const placed: PlacedImage = {
      ...img,
      placedWidth: newWidth,
      placedHeight: h,
    };

    // Если добавление превысит контейнер
    if (rowWidth + newWidth > containerWidth) {
      if (currentRow.length === 0) {
        // Первая картинка в ряду — оставляем одну
        currentRow.push(placed);
        rows.push(currentRow);
        currentRow = [];
        rowWidth = 0;
      } else {
        // Завершаем текущий ряд, картинку — в новый
        rows.push(currentRow);
        currentRow = [placed];
        rowWidth = newWidth;
      }
    } else {
      currentRow.push(placed);
      rowWidth += newWidth;
    }
  }

  // Последний ряд
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // Шаг 3: эвристика последнего ряда
  return fixLastRow(rows);
}

/* ──────── Шаг 3: эвристика последнего ряда + выравнивание ──────── */

/**
 * Если в последнем ряду 1 картинка (и рядов > 1),
 * объединяем предпоследний и последний ряды.
 */
function fixLastRow(rows: Row[]): Row[] {
  if (rows.length < 2) return rows;

  const last = rows[rows.length - 1];
  if (last.length === 1) {
    const prev = rows[rows.length - 2];
    return [...rows.slice(0, -2), [...prev, ...last]];
  }

  return rows;
}

/** Выравнивание: растягиваем каждый ряд до ширины контейнера */
function scaleRows(rows: Row[], containerWidth: number): Row[] {
  return rows.map((row) => {
    const sumWidth = row.reduce((s, img) => s + img.placedWidth, 0);
    const k = sumWidth > 0 ? containerWidth / sumWidth : 1;

    return row.map((img) => ({
      ...img,
      placedWidth: Math.round(img.placedWidth * k),
      placedHeight: Math.round(img.placedHeight * k),
    }));
  });
}

/* ──────────────── Шаг 4: оценка сетки ──────────────── */

function evaluateGrid(
  rows: Row[],
  containerWidth: number,
  targetAspectRatio: number,
): GridResult | null {
  const totalHeight = rows.reduce((sum, row) => {
    return sum + (row.length > 0 ? row[0].placedHeight : 0);
  }, 0);

  if (totalHeight <= 0) return null;

  const currentRatio = containerWidth / totalHeight;
  const diff = Math.abs(targetAspectRatio - currentRatio);

  return { rows, totalHeight, aspectRatio: currentRatio, diff };
}

/* ──────────────── Публичная функция ──────────────── */

const DEFAULT_OPTIONS = {
  targetAspectRatio: 4 / 3,
  hMin: 80,
  wMin: 80,
  searchStep: 10,
} as const;

/**
 * Строит умную сетку изображений.
 *
 * @param images  - массив { id, width, height } в желаемом порядке
 * @param options - параметры контейнера и ограничения
 * @returns Двумерный массив рядов с вычисленными placedWidth/placedHeight
 *
 * @example
 * ```ts
 * const grid = buildImageGrid(images, { containerWidth: 360 });
 * // grid[0] — первый ряд, grid[0][0] — первая картинка с placedWidth, placedHeight
 * ```
 */
export function buildImageGrid(
  images: ImageItem[],
  options: GridOptions,
): Row[] {
  if (!images.length) return [];

  const opts = { ...DEFAULT_OPTIONS, ...options } as Required<Omit<GridOptions, 'containerHeight'>> & { containerHeight?: number };

  // Если задана containerHeight, вычисляем targetAspectRatio из неё
  if (options.containerHeight) {
    opts.targetAspectRatio = opts.containerWidth / options.containerHeight;
  }

  const h = findBestH(images, opts);

  const rows = buildRows(images, opts.containerWidth, h);
  const scaled = scaleRows(rows, opts.containerWidth);

  // Финальная проверка: если какие-то изображения нарушают hMin/wMin
  // (может случиться при fallback), всё равно возвращаем что получилось
  return scaled;
}
