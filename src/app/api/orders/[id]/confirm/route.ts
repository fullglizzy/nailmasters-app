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

  // Мастер подтверждает pending → confirmed
  const isMasterConfirm = user.role === 'nailmaster' && order.nailMasterId === user.userId && order.status === 'pending';
  // Клиент принимает alternative_proposed → confirmed
  const isClientAccept = user.role === 'client' && order.clientId === user.userId && order.status === 'alternative_proposed';

  if (!isMasterConfirm && !isClientAccept) {
    return errorResponse('Заказ нельзя подтвердить в текущем статусе', 400);
  }

  // Confirm order
  await db.update(schema.orders).set({
    status: 'confirmed',
    confirmedDateTime: new Date(),
    masterResponseTime: new Date(),
  }).where(eq(schema.orders.id, id));

  // Форматируем дату/время для уведомления и блокировки слота
  const reqDate = new Date(order.requestedDateTime);
  const orderDate = reqDate.toLocaleDateString('ru', { day: 'numeric', month: 'long' });
  const orderTime = reqDate.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  const dateStr = `${reqDate.getFullYear()}-${String(reqDate.getMonth() + 1).padStart(2, '0')}-${String(reqDate.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(reqDate.getHours()).padStart(2, '0')}:${String(reqDate.getMinutes()).padStart(2, '0')}:00`;

  // Auto-block schedule slot for the confirmed time
  try {

    // Get all available slots for this master on this date, ordered by start time
    const daySlots = await db.select().from(schema.schedules).where(and(
      eq(schema.schedules.masterId, order.nailMasterId),
      eq(schema.schedules.workDate, dateStr),
      eq(schema.schedules.status, 'available'),
    )).orderBy(schema.schedules.startTime);

    // Find slot that contains the order time
    const slot = daySlots.find(s => (s.startTime || '') <= timeStr && (s.endTime || '') > timeStr);
    if (slot) {
      await db.update(schema.schedules).set({ status: 'booked' }).where(eq(schema.schedules.id, slot.id));
      logger.info({ slotId: slot.id, dateStr, timeStr }, 'Schedule slot blocked');
    } else {
      logger.warn({ dateStr, timeStr, slotsFound: daySlots.length }, 'No matching slot found for order');
    }
  } catch (err) {
    logger.error(err, 'Failed to block schedule slot');
  }

  // Send notification to client
  if (order.clientId) {
    const [notif] = await db.insert(schema.notifications).values({
      type: 'order_confirmed', title: 'Заказ подтверждён',
      message: `Запись на ${orderDate} в ${orderTime} подтверждена`,
      recipientId: order.clientId, relatedOrderId: id,
    }).returning();

    if (globalThis.sendNotification) {
      globalThis.sendNotification(order.clientId, { id: notif.id, type: 'order_confirmed', title: 'Заказ подтверждён', message: notif.message, createdAt: notif.createdAt }).catch(() => {});
    }
  }

  logger.info({ orderId: id }, 'Order confirmed');
  return successResponse(null, 'Заказ подтвержден');
});
