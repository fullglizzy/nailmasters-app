import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { id } = await params;

  const orders = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
  if (!orders.length) return errorResponse('Заказ не найден', 404);

  const order = orders[0];
  if (user.role !== 'admin' && order.clientId !== user.userId && order.nailMasterId !== user.userId) {
    return errorResponse('Нет прав на отмену заказа', 403);
  }
  if (!['pending', 'confirmed', 'alternative_proposed'].includes(order.status)) {
    return errorResponse('Заказ нельзя отменить в текущем статусе', 400);
  }

  await db.update(schema.orders).set({ status: 'cancelled' }).where(eq(schema.orders.id, id));

  const reqDate = new Date(order.requestedDateTime);
  const dateStr = `${reqDate.getFullYear()}-${String(reqDate.getMonth() + 1).padStart(2, '0')}-${String(reqDate.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(reqDate.getHours()).padStart(2, '0')}:${String(reqDate.getMinutes()).padStart(2, '0')}:00`;

  // Unblock schedule slot
  try {
    const daySlots = await db.select().from(schema.schedules).where(and(
      eq(schema.schedules.masterId, order.nailMasterId),
      eq(schema.schedules.workDate, dateStr),
      eq(schema.schedules.status, 'booked'),
    )).orderBy(schema.schedules.startTime);

    const slot = daySlots.find(s => (s.startTime || '') <= timeStr && (s.endTime || '') > timeStr);
    if (slot) {
      await db.update(schema.schedules).set({ status: 'available' }).where(eq(schema.schedules.id, slot.id));
    }
  } catch (err) {
    logger.error(err, 'Failed to unblock schedule slot');
  }

  // Notify master
  await db.insert(schema.notifications).values({
    type: 'order_cancelled', title: 'Заказ отменён',
    message: `Запись на ${dateStr} в ${timeStr.slice(0, 5)} отменена`,
    recipientId: order.nailMasterId, relatedOrderId: id,
  });

  return successResponse(null, 'Заказ отменен');
});
