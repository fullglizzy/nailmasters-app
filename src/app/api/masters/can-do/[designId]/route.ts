import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

export const POST = withAuth(async (req: NextRequest, { params }: { params: Promise<{ designId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'nailmaster') return errorResponse('Только для мастеров', 403);
  const { designId } = await params;

  const existing = await db.select().from(schema.masterDesigns).where(and(
    eq(schema.masterDesigns.nailMasterId, user.userId),
    eq(schema.masterDesigns.nailDesignId, designId),
  )).limit(1);
  if (existing.length) return errorResponse('Дизайн уже добавлен', 409);

  const [md] = await db.insert(schema.masterDesigns).values({
    nailMasterId: user.userId,
    nailDesignId: designId,
  }).returning();

  return successResponse(md, 'Дизайн добавлен в "Я так могу"', 201);
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
