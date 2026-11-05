import { db, schema } from '@/lib/db';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';
import { addMinutes, parseISO, format, isBefore, startOfDay } from 'date-fns';

// Блокировка временного слота для заказа
export async function blockTimeSlot(slotId: string): Promise<boolean> {
  const result = await db
    .update(schema.schedules)
    .set({ status: 'booked' })
    .where(
      and(
        eq(schema.schedules.id, slotId),
        eq(schema.schedules.status, 'available'),
      ),
    )
    .returning({ id: schema.schedules.id });

  return result.length > 0;
}

// Разблокировка временного слота
export async function unblockTimeSlot(slotId: string): Promise<boolean> {
  const result = await db
    .update(schema.schedules)
    .set({ status: 'available' })
    .where(
      and(
        eq(schema.schedules.id, slotId),
        eq(schema.schedules.status, 'booked'),
      ),
    )
    .returning({ id: schema.schedules.id });

  return result.length > 0;
}

// Блокировка соседних слотов для длительных услуг (> 60 минут)
export async function blockAdjacentSlots(
  masterId: string,
  baseDate: Date,
  startTime: string,
  totalDurationMinutes: number,
): Promise<void> {
  if (totalDurationMinutes <= 60) return;

  // Вычисляем, сколько дополнительных часовых слотов нужно заблокировать
  const extraSlots = Math.ceil((totalDurationMinutes - 60) / 60);
  const dateStr = format(baseDate, 'yyyy-MM-dd');

  const slots = await db
    .select()
    .from(schema.schedules)
    .where(
      and(
        eq(schema.schedules.masterId, masterId),
        eq(schema.schedules.workDate, dateStr),
        eq(schema.schedules.status, 'available'),
      ),
    )
    .orderBy(schema.schedules.startTime)
    .limit(extraSlots + 1);

  // Блокируем слоты после выбранного времени
  const startSlotIndex = slots.findIndex((s) => s.startTime >= startTime);
  if (startSlotIndex >= 0) {
    const slotsToBlock = slots.slice(startSlotIndex + 1, startSlotIndex + 1 + extraSlots);
    for (const slot of slotsToBlock) {
      await blockTimeSlot(slot.id);
    }
  }
}

// Получение доступных слотов для мастера
export async function getAvailableSlots(
  masterId: string,
  date: string,
  durationMinutes: number = 60,
) {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  const conditions = [
    eq(schema.schedules.masterId, masterId),
    eq(schema.schedules.workDate, date),
    inArray(schema.schedules.status, ['available']),
  ];

  // Для сегодняшней даты отфильтровываем прошедшее время
  if (date === todayStr) {
    const currentTime = format(now, 'HH:mm');
    conditions.push(gte(schema.schedules.startTime, currentTime));
  }

  return db
    .select()
    .from(schema.schedules)
    .where(and(...conditions))
    .orderBy(schema.schedules.startTime);
}

// ── Генерация слотов (общая для ЛК и админки) ────────────────

const DAY_MAP: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };

export interface ScheduleSlotData {
  workDate: string;
  startTime: string;
  endTime: string;
}

export interface BuildScheduleSlotsInput {
  startDate: string;
  startTime: string;
  endTime: string;
  intervalMinutes?: number;
  repeatDays?: string[];
  /** Сколько недель повторять дни, начиная со следующей после startDate. По умолчанию 4. */
  weeks?: number;
}

export interface BuildScheduleSlotsResult {
  slots: ScheduleSlotData[];
  dates: string[];
  error: string | null;
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Строит сетку слотов: дата startDate + повторяющиеся дни на `weeks` недель.
 * Не ходит в БД — проверка пересечений отдельно (filterNewScheduleSlots).
 */
export function buildScheduleSlots(input: BuildScheduleSlotsInput): BuildScheduleSlotsResult {
  const { startDate, startTime, endTime, intervalMinutes, repeatDays } = input;
  const weeks = input.weeks ?? 4;

  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);
  const slotDuration = endMin - startMin;

  if (slotDuration <= 0) {
    return { slots: [], dates: [], error: 'Время окончания должно быть позже времени начала' };
  }

  const interval = intervalMinutes || slotDuration;
  if (interval > slotDuration) {
    return { slots: [], dates: [], error: `Интервал (${interval} мин) больше длительности слота (${slotDuration} мин)` };
  }
  if (interval < 15) {
    return { slots: [], dates: [], error: 'Минимальный интервал — 15 минут' };
  }
  if (weeks < 1 || weeks > 4) {
    return { slots: [], dates: [], error: 'Количество недель должно быть от 1 до 4' };
  }

  // Даты: стартовая всегда, плюс повторяющиеся дни на weeks недель вперёд
  const dates = [startDate];
  if (repeatDays?.length) {
    const baseDate = new Date(startDate);
    const targetDays = repeatDays.map(d => DAY_MAP[d]).filter((d) => d !== undefined);
    for (let w = 1; w <= weeks; w++) {
      for (const targetDay of targetDays) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + w * 7);
        const diff = targetDay - d.getDay();
        d.setDate(d.getDate() + (diff < 0 ? diff + 7 : diff));
        const dateStr = d.toISOString().split('T')[0];
        if (!dates.includes(dateStr)) dates.push(dateStr);
      }
    }
  }

  // Сетка внутри каждого дня
  const slots: ScheduleSlotData[] = [];
  for (const date of dates) {
    let currentMin = startMin;
    while (currentMin + interval <= endMin) {
      const sH = Math.floor(currentMin / 60);
      const sM = currentMin % 60;
      const eH = Math.floor((currentMin + interval) / 60);
      const eM = (currentMin + interval) % 60;
      slots.push({
        workDate: date,
        startTime: `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`,
        endTime: `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`,
      });
      currentMin += interval;
    }
  }

  if (slots.length === 0) {
    return { slots: [], dates, error: `Не удалось создать слоты. Проверьте интервал (${interval} мин) — он может быть больше доступного времени.` };
  }
  if (slots.length > 200) {
    return { slots: [], dates, error: `Слишком много слотов (${slots.length}). Максимум 200 за раз.` };
  }

  return { slots, dates, error: null };
}

/**
 * Отбрасывает точные дубликаты и слоты, пересекающиеся с существующими.
 * Время из БД может приходить как HH:MM:SS — нормализуем до HH:MM.
 */
export function filterNewScheduleSlots(
  existing: ScheduleSlotData[],
  slots: ScheduleSlotData[],
): { newSlots: ScheduleSlotData[]; skipped: number } {
  const exactSet = new Set<string>();
  const overlapMap = new Map<string, [number, number][]>();

  for (const s of existing) {
    const st = String(s.startTime).slice(0, 5);
    const et = String(s.endTime).slice(0, 5);
    exactSet.add(`${s.workDate}|${st}|${et}`);

    const ranges = overlapMap.get(s.workDate) || [];
    ranges.push([toMinutes(st), toMinutes(et)]);
    overlapMap.set(s.workDate, ranges);
  }

  const newSlots = slots.filter((s) => {
    if (exactSet.has(`${s.workDate}|${s.startTime}|${s.endTime}`)) return false;

    const sStart = toMinutes(s.startTime);
    const sEnd = toMinutes(s.endTime);
    const ranges = overlapMap.get(s.workDate);
    if (ranges) {
      for (const [rStart, rEnd] of ranges) {
        if (sStart < rEnd && sEnd > rStart) return false;
      }
    }
    return true;
  });

  return { newSlots, skipped: slots.length - newSlots.length };
}

// Валидация временного слота (не в прошлом, корректные времена)
export function validateTimeSlot(
  workDate: string,
  startTime: string,
  endTime: string,
): string | null {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  // Дата не в прошлом
  if (workDate < todayStr) {
    return 'Нельзя создать слот на прошедшую дату';
  }

  // Время окончания после времени начала
  if (endTime <= startTime) {
    return 'Время окончания должно быть позже времени начала';
  }

  // Для сегодня — время не в прошлом
  if (workDate === todayStr) {
    const currentTime = format(now, 'HH:mm');
    if (startTime <= currentTime) {
      return 'Время начала не может быть в прошлом';
    }
  }

  return null; // OK
}
