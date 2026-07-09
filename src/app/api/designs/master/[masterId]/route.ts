import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, inArray, or } from 'drizzle-orm';
import { successResponse } from '@/lib/response';

export async function GET(req: NextRequest, { params }: { params: Promise<{ masterId: string }> }) {
  const { masterId } = await params;
  const url = new URL(req.url);
  const source = url.searchParams.get('source');

  // Get "Я так могу" links with price/duration
  const canDoLinks = await db.select()
    .from(schema.masterDesigns)
    .where(eq(schema.masterDesigns.nailMasterId, masterId));
  const canDoMap = new Map(canDoLinks.map(l => [l.nailDesignId, l]));

  const conditions = [eq(schema.nailDesigns.isActive, true)];

  if (source === 'can-do') {
    if (canDoLinks.length === 0) return successResponse([]);
    conditions.push(inArray(schema.nailDesigns.id, [...canDoMap.keys()]));
  } else {
    if (canDoLinks.length > 0) {
      conditions.push(
        or(
          eq(schema.nailDesigns.uploadedByMasterId, masterId),
          inArray(schema.nailDesigns.id, [...canDoMap.keys()]),
        )!,
      );
    } else {
      conditions.push(eq(schema.nailDesigns.uploadedByMasterId, masterId));
    }
  }

  const designs = await db.select().from(schema.nailDesigns).where(and(...conditions));

  // Обогащаем ценой и временем из «Я так могу»
  const enriched = designs.map(d => {
    const link = canDoMap.get(d.id);
    return {
      ...d,
      _masterPrice: link?.customPrice || d.minPrice || null,
      _masterDuration: link?.estimatedDuration || d.durationMinutes || null,
    };
  });

  return successResponse(enriched);
}
