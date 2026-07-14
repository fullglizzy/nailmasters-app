import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import {
  extractToken,
  verifyAccessToken,
  verifyRefreshToken,
  getRefreshTokenCookie,
  generateAccessToken,
} from '@/lib/auth';
import { logger } from '@/lib/logger';

// GET /api/auth/session
// Возвращает профиль текущего пользователя или { user: null }.
// НЕ создаёт гостя — только читает существующую сессию.
// Источник идентификации: Authorization header (access-токен) ИЛИ
// refreshToken httpOnly cookie. При входе по refresh-куке выпускает
// свежий access-токен и отдаёт его клиенту (тихое обновление на загрузке).
export const GET = async (req: NextRequest) => {
  try {
    let userId: string | null = null;
    let freshToken: string | null = null;

    // 1. Пробуем access-токен из заголовка
    const headerToken = extractToken(req.headers.get('authorization'));
    if (headerToken) {
      const payload = await verifyAccessToken(headerToken);
      if (payload) {
        userId = payload.userId;
        freshToken = headerToken;
      }
    }

    // 2. Иначе — refreshToken cookie
    if (!userId) {
      const refreshToken = await getRefreshTokenCookie();
      if (refreshToken) {
        userId = await verifyRefreshToken(refreshToken);
      }
    }

    if (!userId) {
      return successResponse({ user: null });
    }

    // Загружаем пользователя
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!users.length || users[0].blocked) {
      return successResponse({ user: null });
    }

    const u = users[0];
    let profile: Record<string, unknown> = {};

    if (u.role === 'nailmaster') {
      const p = await db.select().from(schema.masterProfiles).where(eq(schema.masterProfiles.userId, u.id)).limit(1);
      if (p.length) {
        profile = {
          fullName: p[0].fullName,
          phone: p[0].phone,
          address: p[0].address,
          description: p[0].description,
          experience: p[0].experience,
          city: p[0].city,
          rating: p[0].rating,
          totalOrders: p[0].totalOrders,
          isModerated: p[0].isModerated,
          reviewsCount: p[0].reviewsCount,
          specialties: p[0].specialties,
          startingPrice: p[0].startingPrice,
          workFormat: p[0].workFormat,
          sterilization: p[0].sterilization,
          disposableTools: p[0].disposableTools,
          latitude: p[0].latitude,
          longitude: p[0].longitude,
        };
      }
    } else if (u.role === 'client') {
      const p = await db.select().from(schema.clientProfiles).where(eq(schema.clientProfiles.userId, u.id)).limit(1);
      if (p.length) {
        profile = { fullName: p[0].fullName, phone: p[0].phone, latitude: p[0].latitude, longitude: p[0].longitude };
      }
    } else if (u.role === 'admin') {
      const p = await db.select().from(schema.adminProfiles).where(eq(schema.adminProfiles.userId, u.id)).limit(1);
      if (p.length) {
        profile = { fullName: p[0].fullName, phone: p[0].phone, permissions: p[0].permissions };
      }
    }

    const user = {
      id: u.id,
      email: u.email,
      username: u.username,
      role: u.role,
      isGuest: u.isGuest,
      blocked: u.blocked,
      avatarUrl: u.avatarUrl,
      age: u.age,
      createdAt: u.createdAt,
      ...profile,
    };

    // Если сессия установлена по refresh-куке — выпускаем свежий access-токен
    if (!freshToken) {
      freshToken = await generateAccessToken({
        userId: u.id,
        email: u.email,
        username: u.username,
        role: u.role as 'admin' | 'nailmaster' | 'client',
        isGuest: u.isGuest,
        fullName: (profile.fullName as string | null) ?? null,
        phone: (profile.phone as string | null) ?? null,
        avatar: u.avatarUrl,
      });
    }

    return successResponse({ user, token: freshToken });
  } catch (error) {
    logger.error(error, 'Get session error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
};
