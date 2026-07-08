import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { hashPassword, generateAccessToken, generateRefreshToken, setRefreshTokenCookie } from '@/lib/auth';
import { registerAdminSchema } from '@/lib/validators';
import { successResponse, errorResponse } from '@/lib/response';
import { withRateLimit } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

export const POST = withRateLimit('auth')(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = registerAdminSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Невалидные данные', 422);
    }

    const { email, username, password, fullName, phone, secret } = parsed.data;

    // Проверка секретного ключа
    const adminSecret = process.env.ADMIN_REGISTRATION_SECRET || 'admin_secret_key_2026';
    if (secret !== adminSecret) {
      return errorResponse('Неверный секретный ключ администратора', 403);
    }

    // Проверка уникальности
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return errorResponse('Пользователь с таким email уже существует', 409);
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(schema.users)
      .values({
        email,
        username,
        password: passwordHash,
        role: 'admin',
      })
      .returning();

    // Создаем профиль администратора
    await db.insert(schema.adminProfiles).values({
      userId: user.id,
      fullName,
      phone,
      permissions: ['all'],
    });

    logger.info({ userId: user.id }, 'Admin registered');

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: 'admin' as const,
      isGuest: false,
      fullName,
      phone,
      avatar: null,
    };

    const token = await generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken(user.id);
    await setRefreshTokenCookie(refreshToken);

    return successResponse(
      { user: { id: user.id, email, username, role: 'admin', fullName, phone }, token, refreshToken },
      'Администратор зарегистрирован',
      201,
    );
  } catch (error) {
    logger.error(error, 'Admin register error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
