import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const proposeTimeSchema = z.object({
  proposedDateTime: z.string().refine((s) => !isNaN(Date.parse(s)), 'Некорректная дата/время'),
});

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (user.role !== 'nailmaster') return errorResponse('Только мастера могут предлагать время', 403);

    const { id } = await params;
    const body = await req.json();
    const parsed = proposeTimeSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.errors.map(e => e.message).join('; '), 422);

    const orders = await db.select().from(schema.orders).where(eq(schema.orders.id, id)).limit(1);
    if (!orders.length) return errorResponse('Заказ не найден', 404);
    if (orders[0].nailMasterId !== user.userId) return errorResponse('Это не ваш заказ', 403);

    await db.update(schema.orders).set({
      status: 'alternative_proposed',
      proposedDateTime: new Date(parsed.data.proposedDateTime),
      masterNotes: body.masterNotes || null,
      masterResponseTime: new Date(),
    }).where(eq(schema.orders.id, id));

    return successResponse(null, 'Предложено альтернативное время');
  } catch (error) {
    logger.error(error, 'PUT /api/orders/[id]/propose-time error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
