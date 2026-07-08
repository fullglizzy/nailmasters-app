import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, desc, sql } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, withOptionalAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { createCommentSchema } from '@/lib/validators';

// GET /api/designs/:id/comments — комментарии к дизайну
export const GET = withOptionalAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const url = new URL(req.url);

  // If ?count=1, return just the count
  if (url.searchParams.get('count') === '1') {
    const result = await db.select({ total: sql<number>`COUNT(*)::int` })
      .from(schema.comments)
      .where(eq(schema.comments.designId, id));
    return successResponse({ total: result[0]?.total ?? 0 });
  }

  const comments = await db.select().from(schema.comments)
    .where(eq(schema.comments.designId, id))
    .orderBy(desc(schema.comments.createdAt));
  return successResponse(comments);
});


// POST /api/designs/:id/comments — создать комментарий
export const POST = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { id } = await params;
  const body = await req.json();
  const parsed = createCommentSchema.safeParse(body);
  if (!parsed.success) return errorResponse('Текст комментария обязателен', 422);

  const [comment] = await db.insert(schema.comments).values({
    text: parsed.data.text,
    parentCommentId: parsed.data.parentCommentId || null,
    authorId: user.userId,
    designId: id,
  }).returning();

  return successResponse(comment, 'Комментарий добавлен', 201);
});
