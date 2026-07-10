import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';
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

// POST /api/comments/:commentId — toggle like (with tracking)
export const POST = withAuth(async (_req: NextRequest, { params }: { params: Promise<{ commentId: string }> }) => {
  const user = (_req as AuthenticatedRequest).user!;
  const { commentId } = await params;

  // Check if already liked
  const existing = await db.select().from(schema.commentLikes).where(
    and(eq(schema.commentLikes.userId, user.userId), eq(schema.commentLikes.commentId, commentId)),
  ).limit(1);

  if (existing.length > 0) {
    // Unlike
    await db.delete(schema.commentLikes).where(
      and(eq(schema.commentLikes.userId, user.userId), eq(schema.commentLikes.commentId, commentId)),
    );
    await db.update(schema.comments)
      .set({ likesCount: sql`GREATEST(${schema.comments.likesCount} - 1, 0)` })
      .where(eq(schema.comments.id, commentId));
    return successResponse({ liked: false }, 'Лайк убран');
  }

  // Like
  await db.insert(schema.commentLikes).values({ userId: user.userId, commentId });
  await db.update(schema.comments)
    .set({ likesCount: sql`${schema.comments.likesCount} + 1` })
    .where(eq(schema.comments.id, commentId));
  return successResponse({ liked: true }, 'Лайк добавлен');
});
