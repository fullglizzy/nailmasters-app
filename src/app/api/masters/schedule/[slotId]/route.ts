import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, ne } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ slotId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { slotId } = await params;
  const body = await req.json();

  const slots = await db.select().from(schema.schedules).where(eq(schema.schedules.id, slotId)).limit(1);
  if (!slots.length) return errorResponse('Слот не найден', 404);
  if (slots[0].masterId !== user.userId) return errorResponse('Нет прав', 403);

  const slot = slots[0];
  const updates: Record<string, unknown> = {};
  if (body.workDate) updates.workDate = body.workDate;
  if (body.startTime) updates.startTime = body.startTime;
  if (body.endTime) updates.endTime = body.endTime;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.status) updates.status = body.status;

  // Проверка пересечений при изменении даты/времени
  const newWorkDate = (body.workDate || slot.workDate) as string;
  const newStartTime = (body.startTime || slot.startTime) as string;
  const newEndTime = (body.endTime || slot.endTime) as string;

  if (body.workDate || body.startTime || body.endTime) {
    const otherSlots = await db
      .select({ startTime: schema.schedules.startTime, endTime: schema.schedules.endTime })
      .from(schema.schedules)
      .where(and(
        eq(schema.schedules.masterId, user.userId),
        eq(schema.schedules.workDate, newWorkDate),
        ne(schema.schedules.id, slotId), // исключаем сам себя
      ));

    const sStart = toMinutes(newStartTime.slice(0, 5));
    const sEnd = toMinutes(newEndTime.slice(0, 5));

    for (const ex of otherSlots) {
      const exStart = toMinutes((ex.startTime as string).slice(0, 5));
      const exEnd = toMinutes((ex.endTime as string).slice(0, 5));

      if (exStart === sStart && exEnd === sEnd) {
        return errorResponse('Слот с таким временем уже существует', 409);
      }
      if (sStart < exEnd && sEnd > exStart) {
        return errorResponse('Слот пересекается с существующим', 409);
      }
    }
  }

  await db.update(schema.schedules).set(updates).where(eq(schema.schedules.id, slotId));
  return successResponse(null, 'Слот обновлен');
});

export const DELETE = withAuth(async (req: NextRequest, { params }: { params: Promise<{ slotId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { slotId } = await params;

  const slots = await db.select().from(schema.schedules).where(eq(schema.schedules.id, slotId)).limit(1);
  if (!slots.length) return errorResponse('Слот не найден', 404);
  if (slots[0].masterId !== user.userId) return errorResponse('Нет прав', 403);

  await db.delete(schema.schedules).where(eq(schema.schedules.id, slotId));
  return successResponse(null, 'Слот удален');
});
