import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { recalculateDesignLikes } from '@/lib/rating';

// POST /api/designs/:id/like — лайк (авторизованный, toggle)
export const POST = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { id } = await params;

    // Проверяем существование дизайна
    const designs = await db.select({ id: schema.nailDesigns.id }).from(schema.nailDesigns).where(eq(schema.nailDesigns.id, id)).limit(1);
    if (!designs.length) return errorResponse('Дизайн не найден', 404);

    // Проверяем, есть ли уже лайк
    const existing = await db
      .select()
      .from(schema.clientLikedDesigns)
      .where(and(eq(schema.clientLikedDesigns.clientId, user.userId), eq(schema.clientLikedDesigns.nailDesignId, id)))
      .limit(1);

    if (existing.length > 0) {
      await db.delete(schema.clientLikedDesigns)
        .where(and(eq(schema.clientLikedDesigns.clientId, user.userId), eq(schema.clientLikedDesigns.nailDesignId, id)));
      await recalculateDesignLikes(id);
      const result = await db.select({ likesCount: schema.nailDesigns.likesCount }).from(schema.nailDesigns).where(eq(schema.nailDesigns.id, id)).limit(1);
      return successResponse({ liked: false, likesCount: result[0]?.likesCount ?? 0 }, 'Лайк убран');
    }

    await db.insert(schema.clientLikedDesigns).values({ clientId: user.userId, nailDesignId: id });
    await recalculateDesignLikes(id);
    const result = await db.select({ likesCount: schema.nailDesigns.likesCount }).from(schema.nailDesigns).where(eq(schema.nailDesigns.id, id)).limit(1);
    return successResponse({ liked: true, likesCount: result[0]?.likesCount ?? 0 }, 'Лайк добавлен');
  } catch (error) {
    return errorResponse('Ошибка обработки лайка', 500);
  }
});

// DELETE /api/designs/:id/like — анлайк (синоним POST toggle)
export const DELETE = POST;
