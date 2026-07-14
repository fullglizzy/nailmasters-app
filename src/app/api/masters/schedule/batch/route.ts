import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const batchSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  // Интервал в минутах для повторяющихся слотов (напр. 60 = каждый час)
  intervalMinutes: z.number().int().min(15).max(480).optional(),
  // Копировать этот слот на другие дни недели (mon, tue, ...)
  repeatDays: z.array(z.string()).optional(),
});

/**
 * POST /api/masters/schedule/batch
 * Массовое создание слотов: одна дата + опционально повтор на другие дни.
 */
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (user.role !== 'nailmaster') return errorResponse('Только для мастеров', 403);

    const body = await req.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.errors.map(e => e.message).join('; '), 422);

    const { workDate, startTime, endTime, intervalMinutes, repeatDays } = parsed.data;

    // Даты для создания
    const dates = [workDate];
    if (repeatDays?.length) {
      const baseDate = new Date(workDate);
      const dayMap: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
      const targetDays = repeatDays.map(d => dayMap[d]).filter(n => n !== undefined);
      // Генерируем даты на 4 недели вперёд
      for (let w = 1; w <= 4; w++) {
        for (const targetDay of targetDays) {
          const d = new Date(baseDate);
          d.setDate(d.getDate() + w * 7);
          const dayDiff = targetDay - d.getDay();
          d.setDate(d.getDate() + (dayDiff < 0 ? dayDiff + 7 : dayDiff));
          const dateStr = d.toISOString().split('T')[0];
          if (!dates.includes(dateStr)) dates.push(dateStr);
        }
      }
    }

    const slots: { workDate: string; startTime: string; endTime: string }[] = [];

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const slotDuration = (endH * 60 + endM) - (startH * 60 + startM);

    if (slotDuration <= 0) return errorResponse('Время окончания должно быть позже начала', 422);

    const interval = intervalMinutes || slotDuration;

    for (const date of dates) {
      let currentMin = startH * 60 + startM;
      while (currentMin + interval <= endH * 60 + endM) {
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

    if (slots.length === 0) return errorResponse('Нет слотов для создания', 422);

    // Проверяем пересечения с существующими слотами на те же даты
    const existingSlots = await db
      .select()
      .from(schema.schedules)
      .where(and(
        eq(schema.schedules.masterId, user.userId),
        gte(schema.schedules.workDate, dates[0]),
        lte(schema.schedules.workDate, dates[dates.length - 1]),
      ));

    const conflictSet = new Set<string>();
    for (const s of existingSlots) {
      conflictSet.add(`${s.workDate}|${s.startTime}|${s.endTime}`);
    }

    const newSlots = slots.filter(s => !conflictSet.has(`${s.workDate}|${s.startTime}|${s.endTime}`));
    if (newSlots.length === 0) return errorResponse('Все слоты уже существуют', 409);

    const values = newSlots.map(s => ({
      workDate: s.workDate,
      startTime: s.startTime,
      endTime: s.endTime,
      status: 'available' as const,
      masterId: user.userId,
    }));

    await db.insert(schema.schedules).values(values);

    logger.info({ userId: user.userId, count: newSlots.length }, 'Batch schedule created');
    return successResponse({ created: newSlots.length, total: newSlots.length }, 'Слоты созданы', 201);
  } catch (error) {
    logger.error(error, 'Batch schedule error');
    return errorResponse('Ошибка создания слотов', 500);
  }
});
