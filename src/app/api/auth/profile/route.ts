import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { updateProfileSchema } from '@/lib/validators';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';

// GET /api/auth/profile — получение профиля
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;

    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, user.userId))
      .limit(1);

    if (!users.length) {
      return errorResponse('Пользователь не найден', 404);
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

    return successResponse({
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
    });
  } catch (error) {
    logger.error(error, 'Get profile error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});

// PUT /api/auth/profile — обновление профиля
export const PUT = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.errors.map((e) => e.message).join('; '), 422);
    }

    const { username, fullName, phone, age, avatarUrl, role } = parsed.data;

    // Обновление базовых полей пользователя
    const userUpdates: Record<string, unknown> = {};
    if (username) userUpdates.username = username;
    if (age !== undefined) userUpdates.age = age;
    if (avatarUrl) userUpdates.avatarUrl = avatarUrl;
    if (role) userUpdates.role = role;

    if (Object.keys(userUpdates).length > 0) {
      await db.update(schema.users).set(userUpdates).where(eq(schema.users.id, user.userId));
    }

    // Если роль изменилась или пришла — создаём профиль если нет
    const effectiveRole = role || user.role;
    if (effectiveRole === 'nailmaster') {
      const existingProfile = await db.select().from(schema.masterProfiles).where(eq(schema.masterProfiles.userId, user.userId)).limit(1);
      if (existingProfile.length > 0) {
        const profileUpdates: Record<string, unknown> = {};
        if (fullName) profileUpdates.fullName = fullName;
        if (phone) profileUpdates.phone = phone;
        if (Object.keys(profileUpdates).length > 0) {
          await db.update(schema.masterProfiles).set(profileUpdates).where(eq(schema.masterProfiles.userId, user.userId));
        }
      } else {
        // Конвертация клиента в мастера — берём данные из существующего профиля
        const clientProfile = await db.select().from(schema.clientProfiles).where(eq(schema.clientProfiles.userId, user.userId)).limit(1);
        const carryName = fullName || clientProfile[0]?.fullName || user.username || 'Мастер';
        const carryPhone = phone || clientProfile[0]?.phone || user.phone || '';
        await db.insert(schema.masterProfiles).values({ userId: user.userId, fullName: carryName, phone: carryPhone });
        // Удаляем клиентский профиль
        if (clientProfile.length > 0) {
          await db.delete(schema.clientProfiles).where(eq(schema.clientProfiles.userId, user.userId));
        }
      }
    } else if (effectiveRole === 'client') {
      const existingProfile = await db.select().from(schema.clientProfiles).where(eq(schema.clientProfiles.userId, user.userId)).limit(1);
      if (existingProfile.length > 0) {
        const profileUpdates: Record<string, unknown> = {};
        if (fullName) profileUpdates.fullName = fullName;
        if (phone) profileUpdates.phone = phone;
        if (Object.keys(profileUpdates).length > 0) {
          await db.update(schema.clientProfiles).set(profileUpdates).where(eq(schema.clientProfiles.userId, user.userId));
        }
      } else {
        await db.insert(schema.clientProfiles).values({ userId: user.userId, fullName: fullName || null, phone: phone || '' });
      }
    }

    // Если гость обновляет профиль — снимаем гостевой статус
    if (user.isGuest && (username || phone)) {
      await db.update(schema.users).set({ isGuest: false }).where(eq(schema.users.id, user.userId));
    }

    logger.info({ userId: user.userId }, 'Profile updated');
    return successResponse(null, 'Профиль обновлен');
  } catch (error) {
    logger.error(error, 'Update profile error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
