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
