import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { recalculateMasterRating, recalculateMasterReviewsCount } from '@/lib/rating';

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { reviewId } = await params;
  const existing = await db.select().from(schema.masterRatings).where(eq(schema.masterRatings.id, reviewId)).limit(1);
  if (!existing.length) return errorResponse('Отзыв не найден', 404);
  if (existing[0].clientId !== user.userId) return errorResponse('Нет прав', 403);

  const body = await req.json();
  await db.update(schema.masterRatings).set({ ratingNumber: body.ratingNumber, description: body.description }).where(eq(schema.masterRatings.id, reviewId));
  await recalculateMasterRating(existing[0].nailMasterId);
  return successResponse(null, 'Отзыв обновлен');
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
