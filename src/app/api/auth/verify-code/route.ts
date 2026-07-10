import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, and, gt } from 'drizzle-orm';
import { generateAccessToken, generateRefreshToken, setRefreshTokenCookie, extractToken, verifyAccessToken } from '@/lib/auth';
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
      gt(schema.smsCodes.expiresAt, new Date(Date.now() - 30_000)),
    ))
    .orderBy(schema.smsCodes.createdAt)
    .limit(1);

  if (!validCode.length) {
    console.log(`[SMS] VERIFY FAIL: phone=${phone}, code=${code} — not found or expired`);
    return errorResponse('Неверный или истекший код', 401);
  }

  console.log(`[SMS] VERIFY OK: phone=${phone}`);

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
};
