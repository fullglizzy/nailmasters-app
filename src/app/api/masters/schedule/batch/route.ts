import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq, gte, lte } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const batchSchema = z.object({
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Формат даты: YYYY-MM-DD'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Формат времени: HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Формат времени: HH:MM'),
  intervalMinutes: z.number().int().min(15, 'Минимум 15 мин').max(480, 'Максимум 480 мин').optional(),
  repeatDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
});

const DAY_MAP: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };

function parseTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h, m };
}

function toMinutes(t: string): number {
  const { h, m } = parseTime(t);
  return h * 60 + m;
}

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

    // Валидация времени
    const startMin = toMinutes(startTime);
    const endMin = toMinutes(endTime);
    const slotDuration = endMin - startMin;

    if (slotDuration <= 0) {
      return errorResponse('Время окончания должно быть позже времени начала', 422);
    }

    const interval = intervalMinutes || slotDuration;
    if (interval > slotDuration) {
      return errorResponse(`Интервал (${interval} мин) больше длительности слота (${slotDuration} мин)`, 422);
    }

    if (interval < 15) {
      return errorResponse('Минимальный интервал — 15 минут', 422);
    }

    // Генерируем даты
    const dates = [workDate];
    if (repeatDays?.length) {
      const baseDate = new Date(workDate);
      const targetDays = repeatDays.map(d => DAY_MAP[d]);
      for (let w = 1; w <= 4; w++) {
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

    // Генерируем слоты
    const slots: { workDate: string; startTime: string; endTime: string }[] = [];
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
      return errorResponse(`Не удалось создать слоты. Проверьте интервал (${interval} мин) — он может быть больше доступного времени.`, 422);
    }

    if (slots.length > 200) {
      return errorResponse(`Слишком много слотов (${slots.length}). Максимум 200 за раз.`, 422);
    }

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

    // Нормализуем время — из БД приходит HH:MM:SS, генерируем HH:MM
    // exactSet: точные дубликаты (та же дата + начало + конец)
    const exactSet = new Set<string>();
    // overlapMap: для проверки пересечений — по дате → список [startMin, endMin]
    const overlapMap = new Map<string, [number, number][]>();
    for (const s of existingSlots) {
      const st = (s.startTime as string).slice(0, 5);
      const et = (s.endTime as string).slice(0, 5);
      exactSet.add(`${s.workDate}|${st}|${et}`);

      const ranges = overlapMap.get(s.workDate) || [];
      ranges.push([toMinutes(st), toMinutes(et)]);
      overlapMap.set(s.workDate, ranges);
    }

    const newSlots = slots.filter(s => {
      // Пропускаем точные дубликаты
      if (exactSet.has(`${s.workDate}|${s.startTime}|${s.endTime}`)) return false;

      // Проверяем пересечение по времени на ту же дату
      const sStart = toMinutes(s.startTime);
      const sEnd = toMinutes(s.endTime);
      const ranges = overlapMap.get(s.workDate);
      if (ranges) {
        for (const [rStart, rEnd] of ranges) {
          if (sStart < rEnd && sEnd > rStart) return false; // пересекается
        }
      }
      return true;
    });
    const skipped = slots.length - newSlots.length;

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
