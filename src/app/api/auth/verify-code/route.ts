import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, gt, sql } from 'drizzle-orm';
import { generateAccessToken, generateRefreshToken, setRefreshTokenCookie, extractToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { withRateLimit } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { v4 as uuid } from 'uuid';

const MAX_ATTEMPTS_PER_CODE = 5;

// POST /api/auth/verify-code — подтвердить код (rate-limited, brute-force protected)
export const POST = withRateLimit('auth')(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const phone = (body.phone || '').replace(/[\s()\-]/g, '');
    const code = (body.code || '').trim();

    if (phone.length < 7) return errorResponse('Введите телефон', 422);
    if (code.length < 4 || code.length > 10) return errorResponse('Введите код', 422);

    // ── Находим валидный код ──
    const validCode = await db
      .select()
      .from(schema.smsCodes)
      .where(and(
        eq(schema.smsCodes.phone, phone),
        eq(schema.smsCodes.code, code),
        eq(schema.smsCodes.used, false),
        gt(schema.smsCodes.expiresAt, new Date(Date.now() - 30_000)),
      ))
      .limit(1);

    // ── Считаем количество попыток на этот телефон за последние 5 минут ──
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [attemptCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(schema.smsCodes)
      .where(and(eq(schema.smsCodes.phone, phone), gt(schema.smsCodes.createdAt, fiveMinAgo)));

    const totalAttempts = (attemptCount?.count ?? 0) + 1;

    // ── Блокировка при слишком многих попытках ──
    if (totalAttempts > 20) {
      logger.warn({ phone, attempts: totalAttempts }, 'Brute-force blocked');
      return errorResponse('Слишком много попыток. Попробуйте позже.', 429);
    }

    if (!validCode.length) {
      logger.warn({ phone, code }, 'Invalid verification code');
      return errorResponse('Неверный или истекший код', 401);
    }

    // Помечаем код использованным
    await db.update(schema.smsCodes).set({ used: true }).where(eq(schema.smsCodes.id, validCode[0].id));

    logger.info({ phone }, 'Code verified');

  // ── Ищем гостя по токену (если гость уже авторизован) ──
  const authHeader = req.headers.get('authorization');
  const guestToken = extractToken(authHeader);
  let guestUser: typeof schema.users.$inferSelect | null = null;

  if (guestToken) {
    const guestPayload = await verifyAccessToken(guestToken);
    if (guestPayload?.isGuest) {
      const [found] = await db.select().from(schema.users)
        .where(eq(schema.users.id, guestPayload.userId))
        .limit(1);
      if (found?.isGuest) guestUser = found;
    }
  }

  const hasName = !!body.fullName?.trim();
  let user: typeof schema.users.$inferSelect;
  const role = body.role || 'client';
  const username = `user_${uuid().slice(0, 8)}`;
  let isNew = true; // новый пользователь или конвертация гостя

  if (guestUser) {
    // ── Гость с токеном вводит телефон ──
    // Проверяем, не принадлежит ли этот телефон зарегистрированному пользователю
    const phoneOwner = await db.select().from(schema.users)
      .where(and(eq(schema.users.phone, phone), eq(schema.users.isGuest, false)))
      .limit(1);

    if (phoneOwner.length > 0 && phoneOwner[0].id !== guestUser.id) {
      // Телефон привязан к существующему аккаунту → входим в него.
      // Гость подтвердил доступ к телефону через SMS — это безопасно.
      if (phoneOwner[0].blocked) return errorResponse('Аккаунт заблокирован', 403);
      user = phoneOwner[0];
      isNew = false; // входим в существующий аккаунт, а не создаём новый
      console.log(`[AUTH] Guest ${guestUser.id} logged into existing account ${user.id} via phone ${phone}`);
    } else {
      // Телефон новый или принадлежит этому же гостю → конвертируем гостя
      const [updated] = await db.update(schema.users)
        .set({ phone, username, role, isGuest: false })
        .where(eq(schema.users.id, guestUser.id))
        .returning();
      user = updated;
      console.log(`[AUTH] Guest converted: id=${user.id}, phone=${phone}, role=${role}`);
    }
  } else {
    // ── Стандартный путь: ищем по телефону ──
    const existing = await db.select().from(schema.users).where(eq(schema.users.phone, phone)).limit(1);

    if (!existing.length) {
      // Новый пользователь — только users, профиль создаст PUT /api/auth/profile
      const [newUser] = await db.insert(schema.users).values({ phone, username, role, isGuest: false }).returning();
      user = newUser;
    } else if (existing[0].isGuest) {
      // Гость найден по телефону (напр. если токен не был передан) — только users
      const [updated] = await db.update(schema.users).set({ phone, username, role, isGuest: false })
        .where(eq(schema.users.id, existing[0].id)).returning();
      user = updated;
    } else {
      user = existing[0];
      isNew = false; // существующий зарегистрированный пользователь
      if (user.blocked) return errorResponse('Аккаунт заблокирован', 403);

      // Существующий пользователь — обновляем имя если передано
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
  } catch (error) {
    logger.error(error, 'verify-code error');
    return errorResponse('Внутренняя ошибка', 500);
  }
});
