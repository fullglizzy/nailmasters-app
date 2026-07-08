import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, inArray, or } from 'drizzle-orm';
import { successResponse } from '@/lib/response';

export async function GET(req: NextRequest, { params }: { params: Promise<{ masterId: string }> }) {
  const { masterId } = await params;
  const url = new URL(req.url);
  const source = url.searchParams.get('source'); // 'can-do' = only "Я так могу"

  // Get design IDs from "Я так могу" (masterDesigns table)
  const canDoLinks = await db.select({ designId: schema.masterDesigns.nailDesignId })
    .from(schema.masterDesigns)
    .where(eq(schema.masterDesigns.nailMasterId, masterId));
  const canDoIds = canDoLinks.map(l => l.designId);

  const conditions = [eq(schema.nailDesigns.isActive, true)];

  if (source === 'can-do') {
    // Only "Я так могу" designs
    if (canDoIds.length === 0) return successResponse([]);
    conditions.push(inArray(schema.nailDesigns.id, canDoIds));
  } else {
    // Both uploaded + can-do (default)
    if (canDoIds.length > 0) {
      conditions.push(or(
        eq(schema.nailDesigns.uploadedByMasterId, masterId),
        inArray(schema.nailDesigns.id, canDoIds),
      ) as any);
    } else {
      conditions.push(eq(schema.nailDesigns.uploadedByMasterId, masterId));
    }
  }

  const designs = await db.select().from(schema.nailDesigns).where(and(...conditions));
  return successResponse(designs);
}
