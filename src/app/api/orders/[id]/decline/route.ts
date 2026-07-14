import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const user = (req as AuthenticatedRequest).user!;

    const { id } = await params;
    const orders = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
    if (!orders.length) return errorResponse('Заказ не найден', 404);
    const order = orders[0];

    // Мастер отклоняет pending → declined
    const isMasterDecline = user.role === 'nailmaster' && order.nailMasterId === user.userId && order.status === 'pending';
    // Клиент отклоняет alternative_proposed → declined
    const isClientDecline = user.role === 'client' && order.clientId === user.userId && order.status === 'alternative_proposed';

    if (!isMasterDecline && !isClientDecline) {
      return errorResponse('Заказ нельзя отклонить в текущем статусе', 400);
    }

    await db.update(schema.orders).set({
      status: 'declined',
      masterResponseTime: new Date(),
    }).where(eq(schema.orders.id, id));

    return successResponse(null, 'Заказ отклонен');
  } catch (error) {
    logger.error(error, 'PUT /api/orders/[id]/decline error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
