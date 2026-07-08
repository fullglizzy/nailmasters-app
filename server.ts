// Кастомный Next.js сервер с WebSocket поддержкой
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import { redis } from '@/lib/redis';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url!, true);
    await handle(req, res, parsedUrl);
  });

  // WebSocket сервер
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Хранение соединений: userId -> Set<WebSocket>
  const connections = new Map<string, Set<WebSocket>>();

  wss.on('connection', (ws: WebSocket) => {
    let userId: string | null = null;

    ws.on('message', async (raw: Buffer) => {
      try {
        const message = JSON.parse(raw.toString());

        switch (message.type) {
          case 'auth': {
            // Аутентификация WebSocket соединения
            const token = message.token;
            if (token) {
              const { verifyAccessToken } = await import('@/lib/auth');
              const payload = await verifyAccessToken(token);
              if (payload) {
                userId = payload.userId;
                if (!connections.has(userId)) {
                  connections.set(userId, new Set());
                }
                connections.get(userId)!.add(ws);
                ws.send(JSON.stringify({ type: 'auth_success', userId }));
                console.log(`WS: User ${userId} connected`);
              }
            }
            break;
          }

          case 'subscribe': {
            // Подписка на канал уведомлений
            if (userId && message.channel) {
              ws.send(JSON.stringify({ type: 'subscribed', channel: message.channel }));
            }
            break;
          }

          case 'ping': {
            ws.send(JSON.stringify({ type: 'pong' }));
            break;
          }
        }
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      if (userId && connections.has(userId)) {
        connections.get(userId)!.delete(ws);
        if (connections.get(userId)!.size === 0) {
          connections.delete(userId);
        }
        console.log(`WS: User ${userId} disconnected`);
      }
    });

    ws.on('error', (err) => {
      console.error('WS error:', err.message);
    });
  });

  // Redis Pub/Sub для масштабирования WebSocket
  const subscriber = redis.duplicate();
  subscriber.subscribe('notifications', 'orders', 'messages').catch(() => {
    console.warn('Redis pub/sub unavailable — WebSocket will work standalone');
  });

  subscriber.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);
      const targetUserId = data.userId;

      if (targetUserId && connections.has(targetUserId)) {
        const payload = JSON.stringify({ type: channel, data });
        connections.get(targetUserId)!.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        });
      }
    } catch {
      // ignore malformed messages
    }
  });

  // Функция отправки уведомления (экспортируется для API routes)
  globalThis.sendNotification = async (userId: string, notification: unknown) => {
    // Отправка через WebSocket (мгновенная)
    if (connections.has(userId)) {
      const payload = JSON.stringify({ type: 'notification', data: notification });
      connections.get(userId)!.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      });
    }
    // Публикация в Redis для других инстансов
    try {
      await redis.publish('notifications', JSON.stringify({ userId, ...(notification as object) }));
    } catch {
      // Redis может быть недоступен
    }
  };

  server.listen(port, () => {
    console.log(`> NailMasters ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server on ws://${hostname}:${port}/ws`);
    console.log(`> Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});

// Глобальный тип для sendNotification
declare global {
  var sendNotification: ((userId: string, notification: unknown) => Promise<void>) | undefined;
}
