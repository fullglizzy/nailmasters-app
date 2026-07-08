import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'admin') return errorResponse('Только для администраторов', 403);

  const { id } = await params;
  const body = await req.json();

  await db.update(schema.nailDesigns).set({
    isModerated: body.isModerated ?? true,
    isActive: body.isActive ?? true,
  }).where(eq(schema.nailDesigns.id, id));

  return successResponse(null, 'Дизайн обновлен');
});
