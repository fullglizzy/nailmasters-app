import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { verifyPassword, generateAccessToken, generateRefreshToken, setRefreshTokenCookie } from '@/lib/auth';
import { loginSchema } from '@/lib/validators';
import { successResponse, errorResponse } from '@/lib/response';
import { withRateLimit } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

export const POST = withRateLimit('auth')(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse('Введите телефон и пароль', 422);
    }

    const { phone, password } = parsed.data;
    const normalizedPhone = phone.replace(/[\s()\-]/g, '');

    // Поиск по телефону
    const users_result = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.phone, normalizedPhone))
      .limit(1);

    const user = users_result[0];
    if (!user) return errorResponse('Неверный телефон или пароль', 401);
    if (user.blocked) return errorResponse('Аккаунт заблокирован', 403);

    const validPassword = await verifyPassword(password, user.password ?? '');
    if (!validPassword) return errorResponse('Неверный телефон или пароль', 401);

    // Получаем профильные данные
    let fullName: string | null = null;
    let profilePhone: string | null = null;

    if (user.role === 'nailmaster') {
      const profile = await db.select().from(schema.masterProfiles).where(eq(schema.masterProfiles.userId, user.id)).limit(1);
      if (profile.length > 0) { fullName = profile[0].fullName; profilePhone = profile[0].phone; }
    } else if (user.role === 'client') {
      const profile = await db.select().from(schema.clientProfiles).where(eq(schema.clientProfiles.userId, user.id)).limit(1);
      if (profile.length > 0) { fullName = profile[0].fullName; profilePhone = profile[0].phone; }
    }

    logger.info({ userId: user.id, role: user.role }, 'User logged in');

    const tokenPayload = {
      userId: user.id,
      email: user.email || '',
      username: user.username || '',
      role: user.role as 'admin' | 'nailmaster' | 'client',
      isGuest: user.isGuest,
      fullName,
      phone: profilePhone || user.phone || '',
      avatar: user.avatarUrl,
    };

    const token = await generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken(user.id);
    await setRefreshTokenCookie(refreshToken);

    return successResponse({
      user: {
        id: user.id, phone: user.phone, email: user.email, username: user.username,
        role: user.role, isGuest: user.isGuest, fullName, avatar: user.avatarUrl,
      },
      token, refreshToken,
    });
  } catch (error) {
    logger.error(error, 'Login error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
