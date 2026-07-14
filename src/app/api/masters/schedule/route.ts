import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { createTimeSlotSchema, idParamSchema } from '@/lib/validators';
import { validateTimeSlot } from '@/lib/schedule';

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// GET — мое расписание
export const GET = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;
  const url = new URL(req.url);
  const date = url.searchParams.get('date');

  const conditions = [eq(schema.schedules.masterId, user.userId)];
  if (date) conditions.push(eq(schema.schedules.workDate, date));

  const slots = await db.select().from(schema.schedules).where(and(...conditions));
  return successResponse(slots);
});

// POST — добавить слот
export const POST = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'nailmaster') return errorResponse('Только для мастеров', 403);

  const body = await req.json();
  const parsed = createTimeSlotSchema.safeParse(body);
  if (!parsed.success) return errorResponse(parsed.error.errors.map(e => e.message).join('; '), 422);

  const { workDate, startTime, endTime, notes } = parsed.data;
  const validationError = validateTimeSlot(workDate, startTime, endTime);
  if (validationError) return errorResponse(validationError, 422);

  // Проверка дубликата и пересечений
  const sameDateSlots = await db
    .select({ startTime: schema.schedules.startTime, endTime: schema.schedules.endTime })
    .from(schema.schedules)
    .where(and(
      eq(schema.schedules.masterId, user.userId),
      eq(schema.schedules.workDate, workDate),
    ));

  const sStart = toMinutes(startTime);
  const sEnd = toMinutes(endTime);

  for (const ex of sameDateSlots) {
    const exStart = toMinutes((ex.startTime as string).slice(0, 5));
    const exEnd = toMinutes((ex.endTime as string).slice(0, 5));

    // Точный дубликат
    if (exStart === sStart && exEnd === sEnd) {
      return errorResponse('Такой слот уже существует', 409);
    }
    // Пересечение по времени
    if (sStart < exEnd && sEnd > exStart) {
      return errorResponse('Слот пересекается с существующим', 409);
    }
  }

  const [slot] = await db.insert(schema.schedules).values({
    workDate,
    startTime,
    endTime,
    notes: notes || null,
    masterId: user.userId,
    status: 'available',
  }).returning();

  return successResponse(slot, 'Слот добавлен', 201);
});
