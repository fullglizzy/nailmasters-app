import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

export const POST = withAuth(async (req: NextRequest, { params }: { params: Promise<{ designId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'nailmaster') return errorResponse('Только для мастеров', 403);
  const { designId } = await params;

  const body = await req.json().catch(() => ({}));
  const customPrice = body.customPrice || null;
  const estimatedDuration = body.estimatedDuration || null;

  // Upsert: если уже есть — обновляем цену/время, если нет — создаём
  const existing = await db.select().from(schema.masterDesigns).where(and(
    eq(schema.masterDesigns.nailMasterId, user.userId),
    eq(schema.masterDesigns.nailDesignId, designId),
  )).limit(1);

  let md;
  if (existing.length) {
    [md] = await db.update(schema.masterDesigns).set({
      customPrice, estimatedDuration, isActive: true,
    }).where(and(
      eq(schema.masterDesigns.nailMasterId, user.userId),
      eq(schema.masterDesigns.nailDesignId, designId),
    )).returning();
  } else {
    [md] = await db.insert(schema.masterDesigns).values({
      nailMasterId: user.userId, nailDesignId: designId, customPrice, estimatedDuration,
    }).returning();
  }

  console.log(`[CanDo] SAVED masterId=${user.userId} designId=${designId} price=${customPrice} duration=${estimatedDuration} rowId=${md?.id}`);
  return successResponse(md, 'Добавлено', 201);
});

export const DELETE = withAuth(async (req: NextRequest, { params }: { params: Promise<{ designId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { designId } = await params;

  await db.delete(schema.masterDesigns).where(and(
    eq(schema.masterDesigns.nailMasterId, user.userId),
    eq(schema.masterDesigns.nailDesignId, designId),
  ));
  return successResponse(null, 'Удалено из "Я так могу"');
});

export const GET = withAuth(async (req: NextRequest, { params }: { params: Promise<{ designId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { designId } = await params;

  const existing = await db.select().from(schema.masterDesigns).where(and(
    eq(schema.masterDesigns.nailMasterId, user.userId),
    eq(schema.masterDesigns.nailDesignId, designId),
  )).limit(1);

  return successResponse({ canDo: existing.length > 0 });
});
