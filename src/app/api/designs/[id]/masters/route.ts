import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, or } from 'drizzle-orm';
import { successResponse } from '@/lib/response';

// GET /api/designs/:id/masters — мастера, которые могут выполнить этот дизайн
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // 1. Мастера через "Я так могу" (master_designs)
  const canDoLinks = await db
    .select()
    .from(schema.masterDesigns)
    .where(and(
      eq(schema.masterDesigns.nailDesignId, id),
      eq(schema.masterDesigns.isActive, true),
    ));
  console.log(`[MastersList] designId=${id}, canDoLinks=${canDoLinks.length}, ids=[${canDoLinks.map(l => l.nailMasterId).join(',')}]`);

  // 2. Автор дизайна (uploadedByMasterId)
  const design = await db
    .select({ uploadedByMasterId: schema.nailDesigns.uploadedByMasterId })
    .from(schema.nailDesigns)
    .where(eq(schema.nailDesigns.id, id))
    .limit(1);

  const authorId = design[0]?.uploadedByMasterId;

  // Собираем уникальные ID + их цены/время
  const priceMap = new Map<string, { price: string | null; duration: number | null }>();
  for (const link of canDoLinks) {
    priceMap.set(link.nailMasterId, { price: link.customPrice, duration: link.estimatedDuration });
  }

  const masterIds = [...new Set([
    ...canDoLinks.map(l => l.nailMasterId),
    ...(authorId ? [authorId] : []),
  ])];

  if (!masterIds.length) return successResponse([]);

  const masters = await db
    .select({
      userId: schema.masterProfiles.userId,
      fullName: schema.masterProfiles.fullName,
      rating: schema.masterProfiles.rating,
      city: schema.masterProfiles.city,
      latitude: schema.masterProfiles.latitude,
      longitude: schema.masterProfiles.longitude,
    })
    .from(schema.masterProfiles)
    .where(eq(schema.masterProfiles.isActive, true));

  const filtered = masters
    .filter(m => masterIds.includes(m.userId))
    .map(m => ({
      ...m,
      _price: priceMap.get(m.userId)?.price || null,
      _duration: priceMap.get(m.userId)?.duration || null,
    }));

  return successResponse(filtered);
}
