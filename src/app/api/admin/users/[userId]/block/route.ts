import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ userId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  if (user.role !== 'admin') return errorResponse('Только для администраторов', 403);

  const { userId } = await params;
  const users = await db.select({ blocked: schema.users.blocked }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!users.length) return errorResponse('Пользователь не найден', 404);

  const newBlocked = !users[0].blocked;
  await db.update(schema.users).set({ blocked: newBlocked }).where(eq(schema.users.id, userId));

  return successResponse({ blocked: newBlocked }, newBlocked ? 'Пользователь заблокирован' : 'Пользователь разблокирован');
});
