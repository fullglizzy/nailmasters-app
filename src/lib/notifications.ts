import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis';

export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string | Date;
}

/**
 * Отправка уведомления пользователю.
 *
 * Уведомление уже записано в БД вызывающим роутом — здесь мы только публикуем
 * его в Redis pub/sub на будущее (масштабирование между инстансами).
 * Real-time доставку сейчас обеспечивает SSE-полинг через /api/notifications,
 * поэтому отсутствие Redis не является ошибкой.
 */
export async function sendNotification(
  userId: string,
  notification: NotificationPayload
): Promise<void> {
  try {
    await redis.publish(
      'notifications',
      JSON.stringify({ userId, ...notification })
    );
  } catch (error) {
    // Redis может быть недоступен — SSE-полинг всё равно доставит уведомление
    logger.error(error, 'sendNotification: redis publish failed');
  }
}
