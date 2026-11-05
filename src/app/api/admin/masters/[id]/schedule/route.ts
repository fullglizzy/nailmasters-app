import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq, gte, lte } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { adminScheduleBatchSchema } from '@/lib/validators';
import { buildScheduleSlots, filterNewScheduleSlots } from '@/lib/schedule';
import { logger } from '@/lib/logger';

async function ensureMaster(id: string): Promise<boolean> {
  const rows = await db
    .select({ userId: schema.masterProfiles.userId })
    .from(schema.masterProfiles)
    .where(eq(schema.masterProfiles.userId, id))
    .limit(1);
  return rows.length > 0;
}

// GET /api/admin/masters/[id]/schedule — слоты мастера
export const GET = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const admin = (req as AuthenticatedRequest).user!;
    if (admin.role !== 'admin') return errorResponse('Только для администраторов', 403);

    const { id } = await params;
    if (!(await ensureMaster(id))) return errorResponse('Мастер не найден', 404);

    const slots = await db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.masterId, id))
      .orderBy(schema.schedules.workDate, schema.schedules.startTime);

    return successResponse(slots);
  } catch (error) {
    logger.error(error, 'GET /api/admin/masters/[id]/schedule error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});

// POST /api/admin/masters/[id]/schedule — batch-добавление слотов
export const POST = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const admin = (req as AuthenticatedRequest).user!;
    if (admin.role !== 'admin') return errorResponse('Только для администраторов', 403);

    const { id } = await params;
    if (!(await ensureMaster(id))) return errorResponse('Мастер не найден', 404);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Некорректный JSON в теле запроса', 400);
    }

    const parsed = adminScheduleBatchSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors.map((e) => e.message).join('; '), 422);
    }

    const today = new Date().toISOString().split('T')[0];
    if (parsed.data.workDate < today) {
      return errorResponse('Нельзя создать расписание на прошедшую дату', 422);
    }

    const built = buildScheduleSlots({
      startDate: parsed.data.workDate,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      intervalMinutes: parsed.data.intervalMinutes,
      repeatDays: parsed.data.repeatDays,
      weeks: parsed.data.weeks,
    });
    if (built.error) return errorResponse(built.error, 422);

    const firstDate = built.dates[0];
    const lastDate = built.dates[built.dates.length - 1];
    const existing = await db
      .select({
        workDate: schema.schedules.workDate,
        startTime: schema.schedules.startTime,
        endTime: schema.schedules.endTime,
      })
      .from(schema.schedules)
      .where(and(
        eq(schema.schedules.masterId, id),
        gte(schema.schedules.workDate, firstDate),
        lte(schema.schedules.workDate, lastDate),
      ));

    const { newSlots, skipped } = filterNewScheduleSlots(existing, built.slots);
    if (newSlots.length === 0) {
      return errorResponse(`Все ${built.slots.length} слотов уже существуют или пересекаются с существующими`, 409);
    }

    await db.insert(schema.schedules).values(
      newSlots.map((slot) => ({
        workDate: slot.workDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: 'available',
        masterId: id,
      })),
    );

    const message = skipped > 0
      ? `Создано ${newSlots.length} слотов (${skipped} уже существовали)`
      : `Создано ${newSlots.length} слотов`;

    logger.info({ adminId: admin.userId, masterId: id, created: newSlots.length, skipped }, 'Master schedule created by admin');
    return successResponse({ created: newSlots.length, skipped, total: built.slots.length }, message, 201);
  } catch (error) {
    logger.error(error, 'POST /api/admin/masters/[id]/schedule error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
