import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, desc, and } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

// GET — unread notifications for current user
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const notifications = await db.select().from(schema.notifications)
      .where(and(eq(schema.notifications.recipientId, user.userId), eq(schema.notifications.isRead, false)))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(20);
    return successResponse(notifications);
  } catch (error) {
    logger.error(error, 'GET /api/notifications error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});

// PUT — mark as read
export const PUT = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const body = await req.json();
    if (body.id) {
      await db.update(schema.notifications).set({ isRead: true }).where(eq(schema.notifications.id, body.id));
    } else {
      await db.update(schema.notifications).set({ isRead: true }).where(eq(schema.notifications.recipientId, user.userId));
    }
    return successResponse(null, 'OK');
  } catch (error) {
    logger.error(error, 'PUT /api/notifications error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
