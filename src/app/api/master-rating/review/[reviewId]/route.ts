import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { recalculateMasterRating, recalculateMasterReviewsCount } from '@/lib/rating';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updateRatingSchema = z.object({
  ratingNumber: z.number().int().min(1, 'Оценка от 1 до 5').max(5, 'Оценка от 1 до 5'),
  description: z.string().max(500).optional(),
});

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { reviewId } = await params;
    const existing = await db.select().from(schema.masterRatings).where(eq(schema.masterRatings.id, reviewId)).limit(1);
    if (!existing.length) return errorResponse('Отзыв не найден', 404);
    if (existing[0].clientId !== user.userId) return errorResponse('Нет прав', 403);

    const body = await req.json();
    const parsed = updateRatingSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.errors.map(e => e.message).join('; '), 422);

    await db.update(schema.masterRatings).set({ ratingNumber: parsed.data.ratingNumber, description: parsed.data.description || null }).where(eq(schema.masterRatings.id, reviewId));
    await recalculateMasterRating(existing[0].nailMasterId);
    return successResponse(null, 'Отзыв обновлен');
  } catch (error) {
    logger.error(error, 'PUT /api/master-rating/review/[reviewId] error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});

export const DELETE = withAuth(async (req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { reviewId } = await params;
  const existing = await db.select().from(schema.masterRatings).where(eq(schema.masterRatings.id, reviewId)).limit(1);
  if (!existing.length) return errorResponse('Отзыв не найден', 404);
  if (existing[0].clientId !== user.userId && user.role !== 'admin') return errorResponse('Нет прав', 403);

  await db.delete(schema.masterRatings).where(eq(schema.masterRatings.id, reviewId));
  await recalculateMasterRating(existing[0].nailMasterId);
  await recalculateMasterReviewsCount(existing[0].nailMasterId);
  return successResponse(null, 'Отзыв удален');
});
