import { NextRequest } from 'next/server';
import { verifyAccessToken, extractToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE (Server-Sent Events) поток уведомлений.
 * Клиент подключается и получает новые уведомления в реальном времени.
 * Каждые 15 секунд сервер проверяет наличие новых уведомлений.
 */
export async function GET(req: NextRequest) {
  // EventSource не поддерживает заголовки — токен из query или из Authorization
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || extractToken(req.headers.get('authorization'));
  if (!token) return new Response('Unauthorized', { status: 401 });

  const payload = await verifyAccessToken(token);
  if (!payload) return new Response('Unauthorized', { status: 401 });

  const userId = payload.userId;
  let lastId = '';

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendPing = () => {
        try { controller.enqueue(encoder.encode(':ping\n\n')); } catch {}
      };

      // Keepalive пинг каждые 15 секунд
      const pingTimer = setInterval(sendPing, 15000);

      // Проверка новых уведомлений
      const check = async () => {
        try {
          const { db, schema } = await import('@/lib/db');
          const { eq, and, desc } = await import('drizzle-orm');

          const notifs = await db
            .select()
            .from(schema.notifications)
            .where(and(
              eq(schema.notifications.recipientId, userId),
              eq(schema.notifications.isRead, false),
            ))
            .orderBy(desc(schema.notifications.createdAt))
            .limit(1);

          if (notifs.length > 0 && notifs[0].id !== lastId) {
            lastId = notifs[0].id;
            const data = JSON.stringify({
              type: 'notification',
              data: {
                id: notifs[0].id,
                type: notifs[0].type,
                title: notifs[0].title,
                message: notifs[0].message,
                createdAt: notifs[0].createdAt,
              },
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        } catch { /* ignore */ }
      };

      await check();
      const checkTimer = setInterval(check, 30000); // проверка каждые 30 секунд

      const cleanup = () => {
        clearInterval(pingTimer);
        clearInterval(checkTimer);
      };

      // Закрытие соединения от клиента
      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
