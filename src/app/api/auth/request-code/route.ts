import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, gt, sql } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withRateLimit } from '@/lib/api-middleware';
import { sendSmsCode } from '@/lib/sms';
import { logger } from '@/lib/logger';

// POST /api/auth/request-code — запросить SMS-код (rate-limited)
export const POST = withRateLimit('auth')(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const phone = (body.phone || '').replace(/[\s()\-]/g, '');

    // Базовая валидация номера
    if (phone.length < 7 || phone.length > 15) return errorResponse('Введите корректный телефон', 422);
    if (!/^\+?\d+$/.test(phone)) return errorResponse('Некорректный формат телефона', 422);

    // ── Проверка: не превышен лимит кодов на этот номер за 24 часа ──
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [dayCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.smsCodes)
      .where(and(eq(schema.smsCodes.phone, phone), gt(schema.smsCodes.createdAt, dayAgo)));
    if ((dayCount?.count ?? 0) >= 10) {
      return errorResponse('Слишком много запросов. Попробуйте завтра.', 429);
    }

    // ── Проверка: не запрашивали ли код недавно ──
    const recent = await db
      .select()
      .from(schema.smsCodes)
      .where(and(
        eq(schema.smsCodes.phone, phone),
        gt(schema.smsCodes.expiresAt, new Date()),
        eq(schema.smsCodes.used, false),
      ))
      .limit(1);

    if (recent.length > 0) {
      const remaining = Math.ceil((recent[0].createdAt.getTime() + 60_000 - Date.now()) / 1000);
      if (remaining > 0) return errorResponse(`Код уже отправлен. Повторите через ${remaining} сек`, 429);
    }

    // Отправляем код через SMS-сервис
    const result = await sendSmsCode(phone);
    if (!result.success) {
      logger.error({ phone }, 'SMS send failed');
      return errorResponse('Не удалось отправить код. Попробуйте позже.', 500);
    }

    // Сохраняем код с attempt-счётчиком
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.insert(schema.smsCodes).values({ phone, code: result.code, expiresAt });

    return successResponse({ phone, expiresIn: 300 }, 'Код отправлен');
  } catch (error) {
    logger.error(error, 'request-code error');
    return errorResponse('Внутренняя ошибка', 500);
  }
});
