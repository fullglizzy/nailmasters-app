import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

// DELETE /api/comments/:commentId — удалить комментарий (автор или админ)
export const DELETE = withAuth(async (req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { commentId } = await params;

  const comments = await db.select().from(schema.comments).where(eq(schema.comments.id, commentId)).limit(1);
  if (!comments.length) return errorResponse('Комментарий не найден', 404);
  if (comments[0].authorId !== user.userId && user.role !== 'admin') return errorResponse('Нет прав', 403);

  await db.delete(schema.comments).where(eq(schema.comments.id, commentId));
  return successResponse(null, 'Комментарий удален');
});

// POST /api/comments/:commentId/like — toggle like
export const POST = withAuth(async (_req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) => {
  const { commentId } = await params;
  await db.update(schema.comments)
    .set({ likesCount: sql`CASE WHEN ${schema.comments.likesCount} > 0 THEN ${schema.comments.likesCount} - 1 ELSE ${schema.comments.likesCount} + 1 END` })
    .where(eq(schema.comments.id, commentId));
  return successResponse(null, 'Лайк обновлен');
});
