import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, gt } from 'drizzle-orm';
import { generateAccessToken, generateRefreshToken, setRefreshTokenCookie } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { logger } from '@/lib/logger';
import { v4 as uuid } from 'uuid';

// POST /api/auth/verify-code — подтвердить код (и запросить новый если нужно)
export const POST = async (req: NextRequest) => {
  const body = await req.json();
  const phone = (body.phone || '').replace(/[\s()\-]/g, '');
  const code = (body.code || '').trim();
  const action = body.action || 'verify'; // 'send' | 'verify'

  if (phone.length < 7) return errorResponse('Введите телефон', 422);

  // ── Действие: отправить код ──
  if (action === 'send') {
    // Проверяем, не запрашивали ли код недавно
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
      if (remaining > 0) return errorResponse(`Код уже отправлен. Повторите через ${remaining} сек`, 429);
    }

    const smsCode = '000000';
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const [saved] = await db.insert(schema.smsCodes).values({ phone, code: smsCode, expiresAt }).returning();
    console.log(`[SMS] SENT code=${smsCode} to ${phone}, id=${saved?.id}`);
    return successResponse({ phone, expiresIn: 300 }, 'Код отправлен');
  }

  // ── Действие: проверить код ──
  if (code.length < 4) return errorResponse('Введите код', 422);

  // Проверяем код (включая немного просроченные — запас 30 сек)
  const validCode = await db
    .select()
    .from(schema.smsCodes)
    .where(and(
      eq(schema.smsCodes.phone, phone),
      eq(schema.smsCodes.code, code),
      eq(schema.smsCodes.used, false),
      gt(schema.smsCodes.expiresAt, new Date(Date.now() - 30_000)), // запас 30 сек
    ))
    .orderBy(schema.smsCodes.createdAt)
    .limit(1);

  if (!validCode.length) {
    console.log(`[SMS] VERIFY FAIL: phone=${phone}, code=${code} — not found or expired`);
    return errorResponse('Неверный или истекший код', 401);
  }

  console.log(`[SMS] VERIFY OK: phone=${phone}`);

  // Ищем пользователя
  const existing = await db.select().from(schema.users).where(eq(schema.users.phone, phone)).limit(1);
  const isNew = !existing.length || existing[0].isGuest;
  const hasName = !!body.fullName?.trim();
  let user: typeof schema.users.$inferSelect;

  if (!existing.length) {
    // Новый пользователь
    const role = body.role || 'client';
    const username = `user_${uuid().slice(0, 8)}`;
    const [newUser] = await db.insert(schema.users).values({ phone, username, role, isGuest: false }).returning();
    user = newUser;

    // Всегда создаём профиль (имя можно добавить позже)
    const profileName = body.fullName?.trim() || null;
    if (role === 'nailmaster') {
      await db.insert(schema.masterProfiles).values({ userId: user.id, fullName: profileName || 'Мастер', phone }).onConflictDoNothing();
    } else {
      await db.insert(schema.clientProfiles).values({ userId: user.id, fullName: profileName, phone }).onConflictDoNothing();
    }
  } else if (existing[0].isGuest) {
    // Конвертация гостя
    const role = body.role || 'client';
    const username = `user_${uuid().slice(0, 8)}`;
    const [updated] = await db.update(schema.users).set({ phone, username, role, isGuest: false })
      .where(eq(schema.users.id, existing[0].id)).returning();
    user = updated;

    const profileName = body.fullName?.trim() || null;
    if (role === 'nailmaster') {
      await db.insert(schema.masterProfiles).values({ userId: user.id, fullName: profileName || 'Мастер', phone }).onConflictDoNothing();
    } else {
      await db.insert(schema.clientProfiles).values({ userId: user.id, fullName: profileName, phone }).onConflictDoNothing();
    }
  } else {
    user = existing[0];
    if (user.blocked) return errorResponse('Аккаунт заблокирован', 403);

    // Существующий пользователь — возможно, обновляет профиль (шаг 3)
    if (hasName) {
      if (user.role === 'nailmaster') {
        await db.update(schema.masterProfiles).set({ fullName: body.fullName!.trim() })
          .where(eq(schema.masterProfiles.userId, user.id));
      } else {
        await db.update(schema.clientProfiles).set({ fullName: body.fullName!.trim() })
          .where(eq(schema.clientProfiles.userId, user.id));
      }
    }
  }

  // Получаем профиль
  let fullName: string | null = null;
  if (user.role === 'nailmaster') {
    const p = await db.select().from(schema.masterProfiles).where(eq(schema.masterProfiles.userId, user.id)).limit(1);
    if (p.length > 0) fullName = p[0].fullName;
  } else if (user.role === 'client') {
    const p = await db.select().from(schema.clientProfiles).where(eq(schema.clientProfiles.userId, user.id)).limit(1);
    if (p.length > 0) fullName = p[0].fullName;
  }

  const tokenPayload = {
    userId: user.id, email: user.email || '', username: user.username || '',
    role: user.role as 'admin' | 'nailmaster' | 'client', isGuest: user.isGuest,
    fullName, phone: user.phone || phone, avatar: user.avatarUrl,
  };

  // Помечаем код использованным
  await db.update(schema.smsCodes).set({ used: true }).where(eq(schema.smsCodes.id, validCode[0].id));

  const token = await generateAccessToken(tokenPayload);
  const refreshToken = await generateRefreshToken(user.id);
  await setRefreshTokenCookie(refreshToken);

  return successResponse({
    user: { id: user.id, phone: user.phone, username: user.username, role: user.role, isGuest: user.isGuest, fullName, avatar: user.avatarUrl },
    token, refreshToken, isNew,
  }, isNew ? 'Регистрация успешна' : 'Вход выполнен', isNew ? 201 : 200);
};
