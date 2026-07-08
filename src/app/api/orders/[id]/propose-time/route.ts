import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'nailmaster') return errorResponse('Только мастера могут предлагать время', 403);

  const { id } = await params;
  const body = await req.json();

  if (!body.proposedDateTime) return errorResponse('Дата/время обязательны', 422);

  const orders = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
  if (!orders.length) return errorResponse('Заказ не найден', 404);
  if (orders[0].nailMasterId !== user.userId) return errorResponse('Это не ваш заказ', 403);

  await db.update(schema.orders).set({
    status: 'alternative_proposed',
    proposedDateTime: new Date(body.proposedDateTime),
    masterNotes: body.masterNotes || null,
    masterResponseTime: new Date(),
  }).where(eq(schema.orders.id, id));

  return successResponse(null, 'Предложено альтернативное время');
});
