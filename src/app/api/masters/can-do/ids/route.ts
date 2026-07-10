import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

/**
 * GET /api/masters/can-do/ids
 * Возвращает массив designId, которые мастер отметил «Я так могу».
 * Используется для отметки кнопок в TikTok-ленте без лишних запросов.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'nailmaster') return errorResponse('Только для мастеров', 403);

  const rows = await db
    .select({ designId: schema.masterDesigns.nailDesignId })
    .from(schema.masterDesigns)
    .where(and(
      eq(schema.masterDesigns.nailMasterId, user.userId),
      eq(schema.masterDesigns.isActive, true),
    ));

  return successResponse(rows.map((r) => r.designId));
});
