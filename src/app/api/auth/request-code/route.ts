import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, gt } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';

// POST /api/auth/request-code — запросить SMS-код
export const POST = async (req: NextRequest) => {
  const body = await req.json();
  const phone = (body.phone || '').replace(/[\s()\-]/g, '');

  if (phone.length < 10) return errorResponse('Введите корректный телефон', 422);

  // Проверяем, не запрашивали ли код недавно (1 минута)
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
    const remaining = Math.ceil((recent[0].createdAt.getTime() + 60000 - Date.now()) / 1000);
    if (remaining > 0) {
      return errorResponse(`Код уже отправлен. Повторите через ${remaining} сек`, 429);
    }
  }

  // Генерируем код (всегда 000000 в dev-режиме)
  const code = process.env.NODE_ENV === 'production' && process.env.SMS_ENABLED === 'true'
    ? String(Math.floor(100000 + Math.random() * 900000))
    : '000000';

  // Сохраняем код (действителен 5 минут)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const [saved] = await db.insert(schema.smsCodes).values({ phone, code, expiresAt }).returning();
  console.log(`[SMS] Code ${code} for ${phone}, saved id=${saved?.id}, expires=${expiresAt.toISOString()}`);

  return successResponse({ phone, expiresIn: 300 }, 'Код отправлен');
};
