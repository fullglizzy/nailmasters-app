import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq, gte, lte } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { buildScheduleSlots, filterNewScheduleSlots } from '@/lib/schedule';
import { z } from 'zod';

const batchSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат даты: YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Формат времени: HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Формат времени: HH:MM'),
  intervalMinutes: z.number().int().min(15, 'Минимум 15 мин').max(480, 'Максимум 480 мин').optional(),
  repeatDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
});

/**
 * POST /api/masters/schedule/batch
 * Массовое создание слотов с проверкой на конфликты.
 */
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (user.role !== 'nailmaster') {
      return errorResponse('Только мастера могут управлять расписанием', 403);
    }

    // Парсим и валидируем тело
    let body: unknown;
    try { body = await req.json(); } catch {
      return errorResponse('Некорректный JSON в теле запроса', 400);
    }

    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      const messages = parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      logger.warn({ errors: messages, body }, 'Batch schedule validation failed');
      return errorResponse(messages.join('; '), 422);
    }

    const { workDate, startTime, endTime, intervalMinutes, repeatDays } = parsed.data;

    const built = buildScheduleSlots({
      startDate: workDate,
      startTime,
      endTime,
      intervalMinutes,
      repeatDays,
      weeks: 4,
    });
    if (built.error) return errorResponse(built.error, 422);
    const { slots, dates } = built;

    // Проверяем пересечения с существующими слотами
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const existingSlots = await db
      .select({
        workDate: schema.schedules.workDate,
        startTime: schema.schedules.startTime,
        endTime: schema.schedules.endTime,
      })
      .from(schema.schedules)
      .where(and(
        eq(schema.schedules.masterId, user.userId),
        gte(schema.schedules.workDate, firstDate),
        lte(schema.schedules.workDate, lastDate),
      ));

    const { newSlots, skipped } = filterNewScheduleSlots(existingSlots, slots);

    if (newSlots.length === 0) {
      return errorResponse(`Все ${slots.length} слотов уже существуют или пересекаются с существующими`, 409);
    }

    // Вставляем
    const values = newSlots.map(s => ({
      workDate: s.workDate,
      startTime: s.startTime,
      endTime: s.endTime,
      status: 'available' as const,
      masterId: user.userId,
    }));

    await db.insert(schema.schedules).values(values);

    const msg = skipped > 0
      ? `Создано ${newSlots.length} слотов (${skipped} уже существовали)`
      : `Создано ${newSlots.length} слотов`;

    logger.info({ userId: user.userId, created: newSlots.length, skipped, dates: dates.length }, 'Batch schedule created');
    return successResponse({ created: newSlots.length, skipped, total: slots.length }, msg, 201);
  } catch (error) {
    logger.error(error, 'Batch schedule error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
