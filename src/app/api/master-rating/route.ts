import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, inArray } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { createRatingSchema } from '@/lib/validators';
import { recalculateMasterRating, recalculateMasterReviewsCount } from '@/lib/rating';

// GET — получить рейтинги по clientId
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const clientId = url.searchParams.get('clientId');
  if (!clientId) return errorResponse('clientId обязателен', 422);

  const ratings = await db.select().from(schema.masterRatings)
    .where(eq(schema.masterRatings.clientId, clientId));

  // Enrich with master names
  const masterIds = [...new Set(ratings.map(r => r.nailMasterId))];
  const masters = masterIds.length > 0
    ? await db.select({ userId: schema.masterProfiles.userId, fullName: schema.masterProfiles.fullName })
        .from(schema.masterProfiles).where(inArray(schema.masterProfiles.userId, masterIds))
    : [];
  const masterMap = new Map(masters.map(m => [m.userId, m.fullName]));

  const enriched = ratings.map(r => ({ ...r, masterName: masterMap.get(r.nailMasterId) || 'Мастер' }));
  return successResponse(enriched);
}

// POST — оставить рейтинг мастеру
export const POST = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'client') return errorResponse('Только клиенты могут оценивать', 403);
  if (user.isGuest) return errorResponse('Гости не могут оставлять отзывы.', 403);

  const body = await req.json();
  const parsed = createRatingSchema.safeParse(body);
  if (!parsed.success) return errorResponse('Оценка от 1 до 5 обязательна', 422);

  const { ratingNumber, description } = parsed.data;
  const masterId = body.nailMasterId;
  if (!masterId) return errorResponse('ID мастера обязателен', 422);

  const existing = await db.select().from(schema.masterRatings).where(and(
    eq(schema.masterRatings.clientId, user.userId),
    eq(schema.masterRatings.nailMasterId, masterId),
  )).limit(1);

  if (existing.length) return errorResponse('Вы уже оценили этого мастера', 409);

  const [rating] = await db.insert(schema.masterRatings).values({
    ratingNumber, description: description || null,
    nailMasterId: masterId, clientId: user.userId,
    createdAt: new Date().toISOString().split('T')[0],
  }).returning();

  await recalculateMasterRating(masterId);
  await recalculateMasterReviewsCount(masterId);

  return successResponse(rating, 'Оценка сохранена', 201);
});
