import { NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SSE поток новых сообщений для текущего пользователя.
 * Проверяет БД каждые 3 секунды.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return new Response('Unauthorized', { status: 401 });

  const payload = await verifyAccessToken(token);
  if (!payload) return new Response('Unauthorized', { status: 401 });

  const userId = payload.userId;
  const lastIds = new Set<string>();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const ping = () => {
        try { controller.enqueue(encoder.encode(':ping\n\n')); } catch {}
      };

      const check = async () => {
        try {
          const { db, schema } = await import('@/lib/db');
          const { eq, and, desc } = await import('drizzle-orm');

          const msgs = await db
            .select()
            .from(schema.messages)
            .where(eq(schema.messages.receiverId, userId))
            .orderBy(desc(schema.messages.createdAt))
            .limit(5);

          for (const m of msgs.reverse()) {
            if (!lastIds.has(m.id)) {
              lastIds.add(m.id);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'new_message', data: m })}\n\n`));
            }
          }
        } catch { /* ignore */ }
      };

      await check();
      const pingTimer = setInterval(ping, 15000);
      const checkTimer = setInterval(check, 3000);

      req.signal.addEventListener('abort', () => {
        clearInterval(pingTimer);
        clearInterval(checkTimer);
      });
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
