import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken, getRefreshTokenCookie, setRefreshTokenCookie } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { withRateLimit } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

export const POST = withRateLimit('auth')(async (req: NextRequest) => {
  try {
    // Получаем refresh token из cookie или тела запроса
    let refreshToken = await getRefreshTokenCookie();

    if (!refreshToken) {
      const body = await req.json().catch(() => ({}));
      refreshToken = body.refreshToken;
    }

    if (!refreshToken) {
      return errorResponse('Refresh token не предоставлен', 401);
    }

    const userId = await verifyRefreshToken(refreshToken);
    if (!userId) {
      return errorResponse('Refresh token истек или недействителен', 401);
    }

    // Проверяем пользователя
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!users.length || users[0].blocked) {
      return errorResponse('Пользователь не найден или заблокирован', 401);
    }

    const user = users[0];

    // Получаем профильные данные
    let fullName: string | null = null;
    let phone: string | null = null;

    if (user.role === 'nailmaster') {
      const profile = await db
        .select()
        .from(schema.masterProfiles)
        .where(eq(schema.masterProfiles.userId, userId))
        .limit(1);
      if (profile.length > 0) { fullName = profile[0].fullName; phone = profile[0].phone; }
    } else if (user.role === 'client') {
      const profile = await db
        .select()
        .from(schema.clientProfiles)
        .where(eq(schema.clientProfiles.userId, userId))
        .limit(1);
      if (profile.length > 0) { fullName = profile[0].fullName; phone = profile[0].phone; }
    }

    // Генерируем новые токены (ротация refresh token)
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: user.role as 'admin' | 'nailmaster' | 'client',
      isGuest: user.isGuest,
      fullName,
      phone,
      avatar: user.avatarUrl,
    };

    const newAccessToken = await generateAccessToken(tokenPayload);
    const newRefreshToken = await generateRefreshToken(user.id);
    await setRefreshTokenCookie(newRefreshToken);

    return successResponse({
      token: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    logger.error(error, 'Refresh token error');
    return errorResponse('Ошибка обновления токена', 500);
  }
});
