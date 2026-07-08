import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, or } from 'drizzle-orm';
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
      return errorResponse('Введите email/телефон и пароль', 422);
    }

    const { login, password } = parsed.data;

    // Поиск пользователя по email, username или phone
    const isEmail = login.includes('@');
    const users_result = await db
      .select()
      .from(schema.users)
      .where(
        isEmail
          ? eq(schema.users.email, login)
          : eq(schema.users.username, login),
      )
      .limit(1);

    let user = users_result[0];

    // Если не нашли по email/username, пробуем найти по телефону
    if (!user && !isEmail) {
      // Ищем в профилях мастеров
      const masterByPhone = await db
        .select()
        .from(schema.masterProfiles)
        .where(eq(schema.masterProfiles.phone, login))
        .limit(1);

      if (masterByPhone.length > 0) {
        const u = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, masterByPhone[0].userId))
          .limit(1);
        user = u[0];
      }

      if (!user) {
        // Ищем в профилях клиентов
        const clientByPhone = await db
          .select()
          .from(schema.clientProfiles)
          .where(eq(schema.clientProfiles.phone, login))
          .limit(1);
        if (clientByPhone.length > 0) {
          const u = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, clientByPhone[0].userId))
            .limit(1);
          user = u[0];
        }
      }
    }

    if (!user) {
      return errorResponse('Неверный логин или пароль', 401);
    }

    if (user.blocked) {
      return errorResponse('Аккаунт заблокирован', 403);
    }

    // Проверка пароля
    const validPassword = await verifyPassword(password, user.password);
    if (!validPassword) {
      return errorResponse('Неверный логин или пароль', 401);
    }

    // Получаем профильные данные
    let fullName: string | null = null;
    let phone: string | null = null;

    if (user.role === 'nailmaster') {
      const profile = await db
        .select()
        .from(schema.masterProfiles)
        .where(eq(schema.masterProfiles.userId, user.id))
        .limit(1);
      if (profile.length > 0) {
        fullName = profile[0].fullName;
        phone = profile[0].phone;
      }
    } else if (user.role === 'client') {
      const profile = await db
        .select()
        .from(schema.clientProfiles)
        .where(eq(schema.clientProfiles.userId, user.id))
        .limit(1);
      if (profile.length > 0) {
        fullName = profile[0].fullName;
        phone = profile[0].phone;
      }
    } else if (user.role === 'admin') {
      const profile = await db
        .select()
        .from(schema.adminProfiles)
        .where(eq(schema.adminProfiles.userId, user.id))
        .limit(1);
      if (profile.length > 0) {
        fullName = profile[0].fullName;
        phone = profile[0].phone;
      }
    }

    logger.info({ userId: user.id, role: user.role }, 'User logged in');

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

    const token = await generateAccessToken(tokenPayload);
    const refreshToken = await generateRefreshToken(user.id);
    await setRefreshTokenCookie(refreshToken);

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isGuest: user.isGuest,
        fullName,
        phone,
        avatar: user.avatarUrl,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    logger.error(error, 'Login error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
