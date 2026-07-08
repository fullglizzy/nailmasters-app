import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { getOrderDesignInfo } from '@/lib/design-snapshot';

export const GET = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { id } = await params;

  const orders = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
  if (!orders.length) return errorResponse('Заказ не найден', 404);

  const order = orders[0];

  // Проверка доступа
  if (user.role !== 'admin' && order.clientId !== user.userId && order.nailMasterId !== user.userId) {
    return errorResponse('Нет доступа к заказу', 403);
  }

  // Получаем информацию о дизайне
  const designInfo = await getOrderDesignInfo(order.nailDesignId, order.designSnapshotId);

  return successResponse({ ...order, designInfo });
});
