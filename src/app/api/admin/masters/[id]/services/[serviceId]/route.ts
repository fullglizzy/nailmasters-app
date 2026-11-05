import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { updateServiceSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';

// PUT /api/admin/masters/[id]/services/[serviceId]
export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string; serviceId: string }> }) => {
  try {
    const admin = (req as AuthenticatedRequest).user!;
    if (admin.role !== 'admin') return errorResponse('Только для администраторов', 403);

    const { id, serviceId } = await params;

    const services = await db
      .select()
      .from(schema.masterServices)
      .where(and(eq(schema.masterServices.id, serviceId), eq(schema.masterServices.masterId, id)))
      .limit(1);
    if (!services.length) return errorResponse('Услуга не найдена', 404);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Некорректный JSON в теле запроса', 400);
    }

    const parsed = updateServiceSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.errors.map((e) => e.message).join('; '), 422);

    const updates: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.price !== undefined) updates.price = String(parsed.data.price);
    if (parsed.data.description !== undefined) updates.description = parsed.data.description ?? null;

    await db.update(schema.masterServices).set(updates).where(eq(schema.masterServices.id, serviceId));

    logger.info({ adminId: admin.userId, masterId: id, serviceId }, 'Master service updated by admin');
    return successResponse(null, 'Услуга обновлена');
  } catch (error) {
    logger.error(error, 'PUT /api/admin/masters/[id]/services/[serviceId] error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});

// DELETE /api/admin/masters/[id]/services/[serviceId]
export const DELETE = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string; serviceId: string }> }) => {
  try {
    const admin = (req as AuthenticatedRequest).user!;
    if (admin.role !== 'admin') return errorResponse('Только для администраторов', 403);

    const { id, serviceId } = await params;

    const services = await db
      .select()
      .from(schema.masterServices)
      .where(and(eq(schema.masterServices.id, serviceId), eq(schema.masterServices.masterId, id)))
      .limit(1);
    if (!services.length) return errorResponse('Услуга не найдена', 404);

    // Если услуга уже использовалась в заказе — не удаляем, а скрываем,
    // иначе FK orders.master_service_id сломает историю заказов.
    const usedInOrders = await db
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .where(eq(schema.orders.masterServiceId, serviceId))
      .limit(1);

    if (usedInOrders.length) {
      await db
        .update(schema.masterServices)
        .set({ isActive: false })
        .where(eq(schema.masterServices.id, serviceId));
      return successResponse({ deactivated: true }, 'Услуга скрыта: она используется в заказах');
    }

    await db.delete(schema.masterServices).where(eq(schema.masterServices.id, serviceId));

    logger.info({ adminId: admin.userId, masterId: id, serviceId }, 'Master service deleted by admin');
    return successResponse(null, 'Услуга удалена');
  } catch (error) {
    logger.error(error, 'DELETE /api/admin/masters/[id]/services/[serviceId] error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
