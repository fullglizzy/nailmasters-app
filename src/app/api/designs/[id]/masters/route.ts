import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { successResponse } from '@/lib/response';

// GET /api/designs/:id/masters — мастера, которые могут выполнить этот дизайн
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Находим мастеров через master_service_designs (новая система)
  const serviceDesigns = await db
    .select({
      masterId: schema.masterServices.masterId,
    })
    .from(schema.masterServiceDesigns)
    .innerJoin(schema.masterServices, eq(schema.masterServiceDesigns.masterServiceId, schema.masterServices.id))
    .where(and(
      eq(schema.masterServiceDesigns.nailDesignId, id),
      eq(schema.masterServiceDesigns.isActive, true),
      eq(schema.masterServices.isActive, true),
    ));

  // Также через MasterDesign (старая система "Я так могу")
  const masterDesigns = await db
    .select({ masterId: schema.masterDesigns.nailMasterId })
    .from(schema.masterDesigns)
    .where(and(
      eq(schema.masterDesigns.nailDesignId, id),
      eq(schema.masterDesigns.isActive, true),
    ));

  // Собираем уникальные ID мастеров
  const masterIds = [...new Set([
    ...serviceDesigns.map(d => d.masterId),
    ...masterDesigns.map(d => d.masterId),
  ])];

  if (!masterIds.length) return successResponse([]);

  // Получаем профили мастеров
  const masters = await db
    .select({
      userId: schema.masterProfiles.userId,
      fullName: schema.masterProfiles.fullName,
      rating: schema.masterProfiles.rating,
      city: schema.masterProfiles.city,
    })
    .from(schema.masterProfiles)
    .where(and(
      eq(schema.masterProfiles.isActive, true),
      eq(schema.masterProfiles.isModerated, true),
    ));

  // Фильтруем только тех, кто в masterIds
  const filtered = masters.filter(m => masterIds.includes(m.userId));

  return successResponse(filtered);
}
