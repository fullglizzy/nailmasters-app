import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { incrementMasterOrderCount } from '@/lib/rating';
import { sendNotification } from '@/lib/notifications';
import { logger } from '@/lib/logger';

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'nailmaster') return errorResponse('Только мастера могут завершать заказы', 403);

  const { id } = await params;
  const orders = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
  if (!orders.length) return errorResponse('Заказ не найден', 404);

  const order = orders[0];
  if (order.nailMasterId !== user.userId) return errorResponse('Это не ваш заказ', 403);
  if (order.status !== 'confirmed') return errorResponse('Можно завершить только подтвержденный заказ', 400);

  const now = new Date();
  await db.update(schema.orders).set({ status: 'completed', completedAt: now, completedBy: 'master' }).where(eq(schema.orders.id, id));
  await incrementMasterOrderCount(order.nailMasterId);

  // Unblock schedule slot
  try {
    const reqDate = new Date(order.requestedDateTime);
    const dateStr = `${reqDate.getFullYear()}-${String(reqDate.getMonth() + 1).padStart(2, '0')}-${String(reqDate.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(reqDate.getHours()).padStart(2, '0')}:${String(reqDate.getMinutes()).padStart(2, '0')}:00`;

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

  // Notify client
  if (order.clientId) {
    const [notif] = await db.insert(schema.notifications).values({
      type: 'order_completed', title: 'Заказ завершён',
      message: 'Мастер завершил запись. Оставьте отзыв!',
      recipientId: order.clientId, relatedOrderId: id,
    }).returning();

    sendNotification(order.clientId, { id: notif.id, type: 'order_completed', title: 'Заказ завершён', message: notif.message, createdAt: notif.createdAt }).catch(() => {});
  }

  return successResponse(null, 'Заказ завершен');
});
