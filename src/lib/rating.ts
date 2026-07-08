import { db, schema } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';

// Пересчет рейтинга мастера на основе всех оценок
export async function recalculateMasterRating(masterId: string): Promise<void> {
  const result = await db
    .select({
      avgRating: sql<number>`ROUND(AVG(${schema.masterRatings.ratingNumber})::numeric, 1)`,
    })
    .from(schema.masterRatings)
    .where(eq(schema.masterRatings.nailMasterId, masterId));

  const newRating = result[0]?.avgRating ?? 0;

  await db
    .update(schema.masterProfiles)
    .set({ rating: String(newRating) })
    .where(eq(schema.masterProfiles.userId, masterId));
}

// Пересчет количества отзывов мастера
export async function recalculateMasterReviewsCount(masterId: string): Promise<void> {
  const result = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(schema.masterRatings)
    .where(eq(schema.masterRatings.nailMasterId, masterId));

  const count = result[0]?.count ?? 0;

  await db
    .update(schema.masterProfiles)
    .set({ reviewsCount: count })
    .where(eq(schema.masterProfiles.userId, masterId));
}

// Пересчет счетчика заказов мастера
export async function incrementMasterOrderCount(masterId: string): Promise<void> {
  await db
    .update(schema.masterProfiles)
    .set({ totalOrders: sql`${schema.masterProfiles.totalOrders} + 1` })
    .where(eq(schema.masterProfiles.userId, masterId));
}

// Пересчет лайков дизайна
export async function recalculateDesignLikes(designId: string): Promise<void> {
  const result = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(schema.clientLikedDesigns)
    .where(eq(schema.clientLikedDesigns.nailDesignId, designId));

  const count = result[0]?.count ?? 0;

  await db
    .update(schema.nailDesigns)
    .set({ likesCount: count })
    .where(eq(schema.nailDesigns.id, designId));
}
