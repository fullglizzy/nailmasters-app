import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { updateDesignSchema } from '@/lib/validators';
import { successResponse, errorResponse, noContentResponse } from '@/lib/response';
import { withAuth, withOptionalAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { createDesignSnapshot } from '@/lib/design-snapshot';
import { logger } from '@/lib/logger';

// GET /api/designs/:id — детальный просмотр дизайна
export const GET = withOptionalAuth(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const designs = await db
      .select()
      .from(schema.nailDesigns)
      .where(eq(schema.nailDesigns.id, id))
      .limit(1);

    if (!designs.length) {
      return errorResponse('Дизайн не найден', 404);
    }

    const design = designs[0];
    if (!design.isActive && !design.isModerated) {
      return errorResponse('Дизайн недоступен', 404);
    }

    // Получаем автора
    let author = null;
    if (design.uploadedByMasterId) {
      const masters = await db.select().from(schema.masterProfiles).where(eq(schema.masterProfiles.userId, design.uploadedByMasterId)).limit(1);
      if (masters.length) author = { id: masters[0].userId, name: masters[0].fullName, type: 'master' };
    } else if (design.uploadedByClientId) {
      const clients = await db.select().from(schema.clientProfiles).where(eq(schema.clientProfiles.userId, design.uploadedByClientId)).limit(1);
      if (clients.length) author = { id: clients[0].userId, name: clients[0].fullName, type: 'client' };
    }

    return successResponse({ ...design, author });
  } catch (error) {
    logger.error(error, 'Get design error');
    return errorResponse('Ошибка получения дизайна', 500);
  }
});

// PUT /api/designs/:id — обновление дизайна (автор или админ)
export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { id } = await params;

    const designs = await db.select().from(schema.nailDesigns).where(eq(schema.nailDesigns.id, id)).limit(1);
    if (!designs.length) return errorResponse('Дизайн не найден', 404);

    const design = designs[0];

    // Проверка прав: автор или админ
    const isAuthor =
      (user.role === 'client' && design.uploadedByClientId === user.userId) ||
      (user.role === 'nailmaster' && design.uploadedByMasterId === user.userId);
    if (!isAuthor && user.role !== 'admin') {
      return errorResponse('Нет прав на редактирование', 403);
    }

    const body = await req.json();
    const parsed = updateDesignSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors.map((e) => e.message).join('; '), 422);
    }

    const updates = { ...parsed.data };
    await db.update(schema.nailDesigns).set(updates).where(eq(schema.nailDesigns.id, id));

    logger.info({ designId: id, userId: user.userId }, 'Design updated');
    return successResponse(null, 'Дизайн обновлен');
  } catch (error) {
    logger.error(error, 'Update design error');
    return errorResponse('Ошибка обновления дизайна', 500);
  }
});

// DELETE /api/designs/:id — удаление дизайна (автор или админ, транзакционное)
export const DELETE = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { id } = await params;

    const designs = await db.select().from(schema.nailDesigns).where(eq(schema.nailDesigns.id, id)).limit(1);
    if (!designs.length) return errorResponse('Дизайн не найден', 404);

    const design = designs[0];

    const isAuthor =
      (user.role === 'client' && design.uploadedByClientId === user.userId) ||
      (user.role === 'nailmaster' && design.uploadedByMasterId === user.userId);
    if (!isAuthor && user.role !== 'admin') {
      return errorResponse('Нет прав на удаление', 403);
    }

    // Транзакционное удаление (как в оригинале):
    // 1. Создаем снепшоты для связанных заказов
    // 2. Переключаем заказы на снепшоты
    // 3. Удаляем связи с услугами
    // 4. Удаляем лайки
    // 5. Удаляем дизайн

    await db.transaction(async (tx) => {
      // Создаем снепшот для каждого заказа с этим дизайном
      const relatedOrders = await tx
        .select()
        .from(schema.orders)
        .where(eq(schema.orders.nailDesignId, id));

      if (relatedOrders.length > 0) {
        const snapshot = await createDesignSnapshot(id);
        if (snapshot) {
          await tx
            .update(schema.orders)
            .set({ nailDesignId: null, designSnapshotId: snapshot.id })
            .where(eq(schema.orders.nailDesignId, id));
        }
      }

      // Удаляем связи с услугами
      await tx.delete(schema.masterServiceDesigns).where(eq(schema.masterServiceDesigns.nailDesignId, id));

      // Удаляем связи "Я так могу"
      await tx.delete(schema.masterDesigns).where(eq(schema.masterDesigns.nailDesignId, id));

      // Удаляем лайки
      await tx.delete(schema.clientLikedDesigns).where(eq(schema.clientLikedDesigns.nailDesignId, id));

      // Удаляем комментарии
      await tx.delete(schema.comments).where(eq(schema.comments.designId, id));

      // Деактивируем дизайн (soft delete)
      await tx.update(schema.nailDesigns).set({ isActive: false }).where(eq(schema.nailDesigns.id, id));
    });

    logger.info({ designId: id, userId: user.userId }, 'Design deleted');
    return successResponse(null, 'Дизайн удален');
  } catch (error) {
    logger.error(error, 'Delete design error');
    return errorResponse('Ошибка удаления дизайна', 500);
  }
});
