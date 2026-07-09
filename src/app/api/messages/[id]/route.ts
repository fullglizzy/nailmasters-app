import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';

// PUT /api/messages/[id] — редактировать текст
export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { id } = await params;

  const msgs = await db.select().from(schema.messages).where(eq(schema.messages.id, id)).limit(1);
  if (!msgs.length) return errorResponse('Сообщение не найдено', 404);
  if (msgs[0].senderId !== user.userId) return errorResponse('Нельзя редактировать чужое сообщение', 403);
  if (msgs[0].isDeleted) return errorResponse('Сообщение удалено', 400);

  const body = await req.json();
  if (!body.text?.trim()) return errorResponse('Текст обязателен', 422);

  await db
    .update(schema.messages)
    .set({ text: body.text.trim().slice(0, 5000), isEdited: true, editedAt: new Date() })
    .where(eq(schema.messages.id, id));

  return successResponse(null, 'Изменено');
});

// DELETE /api/messages/[id] — удалить (soft delete)
export const DELETE = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = (req as AuthenticatedRequest).user!;
  const { id } = await params;

  const msgs = await db.select().from(schema.messages).where(eq(schema.messages.id, id)).limit(1);
  if (!msgs.length) return errorResponse('Сообщение не найдено', 404);
  if (msgs[0].senderId !== user.userId) return errorResponse('Нельзя удалить чужое сообщение', 403);

  await db
    .update(schema.messages)
    .set({ isDeleted: true, text: '', attachments: null })
    .where(eq(schema.messages.id, id));

  return successResponse(null, 'Удалено');
});
