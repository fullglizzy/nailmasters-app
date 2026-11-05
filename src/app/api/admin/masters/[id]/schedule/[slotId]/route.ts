import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

// DELETE /api/admin/masters/[id]/schedule/[slotId]
export const DELETE = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string; slotId: string }> }) => {
  try {
    const admin = (req as AuthenticatedRequest).user!;
    if (admin.role !== 'admin') return errorResponse('Только для администраторов', 403);

    const { id, slotId } = await params;

    const slots = await db
      .select()
      .from(schema.schedules)
      .where(and(eq(schema.schedules.id, slotId), eq(schema.schedules.masterId, id)))
      .limit(1);
    if (!slots.length) return errorResponse('Слот не найден', 404);

    if (slots[0].status === 'booked') {
      return errorResponse('Нельзя удалить занятый слот', 409);
    }

    await db.delete(schema.schedules).where(eq(schema.schedules.id, slotId));

    logger.info({ adminId: admin.userId, masterId: id, slotId }, 'Master schedule slot deleted by admin');
    return successResponse(null, 'Слот удален');
  } catch (error) {
    logger.error(error, 'DELETE /api/admin/masters/[id]/schedule/[slotId] error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
