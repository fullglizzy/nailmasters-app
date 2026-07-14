import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const updateMessageSchema = z.object({
  text: z.string().min(1, 'Текст обязателен').max(5000),
});

// PUT /api/messages/[id] — редактировать текст
export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { id } = await params;

    const msgs = await db.select().from(schema.messages).where(eq(schema.messages.id, id)).limit(1);
    if (!msgs.length) return errorResponse('Сообщение не найдено', 404);
    if (msgs[0].senderId !== user.userId) return errorResponse('Нельзя редактировать чужое сообщение', 403);
    if (msgs[0].isDeleted) return errorResponse('Сообщение удалено', 400);

    const body = await req.json();
    const parsed = updateMessageSchema.safeParse(body);
    if (!parsed.success) return errorResponse(parsed.error.errors.map(e => e.message).join('; '), 422);

    await db
      .update(schema.messages)
      .set({ text: parsed.data.text.trim().slice(0, 5000), isEdited: true, editedAt: new Date() })
      .where(eq(schema.messages.id, id));

    return successResponse(null, 'Изменено');
  } catch (error) {
    logger.error(error, 'PUT /api/messages/[id] error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});

// DELETE /api/messages/[id] — удалить (soft delete)
export const DELETE = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
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
  } catch (error) {
    logger.error(error, 'DELETE /api/messages/[id] error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
