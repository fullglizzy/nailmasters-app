import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { hashPassword, generateAccessToken, generateRefreshToken, setRefreshTokenCookie } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/response';
import { withRateLimit } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { nanoid } from 'nanoid';

export const POST = withRateLimit('auth')(async (_req: NextRequest) => {
  try {
    const timestamp = Date.now();
    const random = nanoid(6);
    const guestEmail = `guest_${timestamp}_${random}@temp.nailmasters.com`;
    const guestUsername = `Гость ${Math.floor(1000 + Math.random() * 9000)}`;
    const guestPassword = nanoid(16);

    const passwordHash = await hashPassword(guestPassword);

    const [user] = await db
      .insert(schema.users)
      .values({
        email: guestEmail,
        username: guestUsername,
        password: passwordHash,
        role: 'client',
        isGuest: true,
      })
      .returning();

    // Создаем профиль клиента
    await db.insert(schema.clientProfiles).values({
      userId: user.id,
    });

    logger.info({ userId: user.id }, 'Guest user registered');

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role: 'client' as const,
      isGuest: true,
      fullName: null,
      phone: null,
      avatar: null,
    };

    const token = await generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken(user.id);
    await setRefreshTokenCookie(refreshToken);

    return successResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          isGuest: true,
          fullName: null,
          phone: null,
          avatar: null,
        },
        token,
        refreshToken,
      },
      'Гостевой аккаунт создан',
      201,
    );
  } catch (error) {
    logger.error(error, 'Guest register error');
    return errorResponse('Ошибка создания гостевого аккаунта', 500);
  }
});
