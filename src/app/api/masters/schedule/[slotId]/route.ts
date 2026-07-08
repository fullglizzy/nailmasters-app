import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ slotId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { slotId } = await params;
  const body = await req.json();

  const slots = await db.select().from(schema.schedules).where(eq(schema.schedules.id, slotId)).limit(1);
  if (!slots.length) return errorResponse('Слот не найден', 404);
  if (slots[0].masterId !== user.userId) return errorResponse('Нет прав', 403);

  const updates: Record<string, unknown> = {};
  if (body.workDate) updates.workDate = body.workDate;
  if (body.startTime) updates.startTime = body.startTime;
  if (body.endTime) updates.endTime = body.endTime;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.status) updates.status = body.status;

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
