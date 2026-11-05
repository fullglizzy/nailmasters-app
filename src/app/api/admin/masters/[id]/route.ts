import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { and, eq, ne } from 'drizzle-orm';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { adminUpdateMasterSchema } from '@/lib/validators';
import { geocodeAddress } from '@/lib/geo';
import { logger } from '@/lib/logger';

// GET /api/admin/masters/[id] — полные данные мастера для редактора
export const GET = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const admin = (req as AuthenticatedRequest).user!;
    if (admin.role !== 'admin') return errorResponse('Только для администраторов', 403);

    const { id } = await params;

    const userRows = await db
      .select({
        id: schema.users.id,
        phone: schema.users.phone,
        email: schema.users.email,
        username: schema.users.username,
        avatarUrl: schema.users.avatarUrl,
        age: schema.users.age,
        blocked: schema.users.blocked,
        createdAt: schema.users.createdAt,
        role: schema.users.role,
      })
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (!userRows.length || userRows[0].role !== 'nailmaster') {
      return errorResponse('Мастер не найден', 404);
    }

    const profiles = await db
      .select()
      .from(schema.masterProfiles)
      .where(eq(schema.masterProfiles.userId, id))
      .limit(1);
    if (!profiles.length) return errorResponse('Профиль мастера не найден', 404);

    const services = await db
      .select()
      .from(schema.masterServices)
      .where(eq(schema.masterServices.masterId, id))
      .orderBy(schema.masterServices.createdAt);

    const schedule = await db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.masterId, id))
      .orderBy(schema.schedules.workDate, schema.schedules.startTime);

    return successResponse({
      user: userRows[0],
      profile: profiles[0],
      services,
      schedule,
    });
  } catch (error) {
    logger.error(error, 'GET /api/admin/masters/[id] error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});

// PUT /api/admin/masters/[id] — обновить аккаунт и профиль
export const PUT = withAuth(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const admin = (req as AuthenticatedRequest).user!;
    if (admin.role !== 'admin') return errorResponse('Только для администраторов', 403);

    const { id } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Некорректный JSON в теле запроса', 400);
    }

    const parsed = adminUpdateMasterSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors.map((e) => e.message).join('; '), 422);
    }
    const data = parsed.data;

    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);
    if (!users.length || users[0].role !== 'nailmaster') {
      return errorResponse('Мастер не найден', 404);
    }

    const profiles = await db
      .select()
      .from(schema.masterProfiles)
      .where(eq(schema.masterProfiles.userId, id))
      .limit(1);
    if (!profiles.length) return errorResponse('Профиль мастера не найден', 404);
    const existingProfile = profiles[0];

    // Уникальность телефона: users.phone и master_profiles.phone
    if (data.phone && data.phone !== users[0].phone) {
      const phoneOwner = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(and(eq(schema.users.phone, data.phone), ne(schema.users.id, id)))
        .limit(1);
      if (phoneOwner.length) return errorResponse('Пользователь с таким телефоном уже существует', 409);

      const masterPhoneOwner = await db
        .select({ userId: schema.masterProfiles.userId })
        .from(schema.masterProfiles)
        .where(and(eq(schema.masterProfiles.phone, data.phone), ne(schema.masterProfiles.userId, id)))
        .limit(1);
      if (masterPhoneOwner.length) return errorResponse('Мастер с таким телефоном уже существует', 409);
    }

    if (data.username && data.username !== users[0].username) {
      const usernameOwner = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(and(eq(schema.users.username, data.username), ne(schema.users.id, id)))
        .limit(1);
      if (usernameOwner.length) return errorResponse('Пользователь с таким username уже существует', 409);
    }

    const userUpdates: Record<string, unknown> = {};
    if (data.phone !== undefined) userUpdates.phone = data.phone;
    if (data.username !== undefined) userUpdates.username = data.username;
    if (data.age !== undefined) userUpdates.age = data.age;
    if (data.avatarUrl !== undefined) userUpdates.avatarUrl = data.avatarUrl;

    const profileInput = data.profile ?? {};
    const profileUpdates: Record<string, unknown> = {};
    if (profileInput.fullName !== undefined) profileUpdates.fullName = profileInput.fullName;
    if (profileInput.address !== undefined) profileUpdates.address = profileInput.address;
    if (profileInput.description !== undefined) profileUpdates.description = profileInput.description;
    if (profileInput.experience !== undefined) profileUpdates.experience = profileInput.experience;
    if (profileInput.city !== undefined) profileUpdates.city = profileInput.city;
    if (profileInput.specialties !== undefined) profileUpdates.specialties = profileInput.specialties;
    if (profileInput.startingPrice !== undefined) profileUpdates.startingPrice = String(profileInput.startingPrice);
    if (profileInput.workFormat !== undefined) profileUpdates.workFormat = profileInput.workFormat;
    if (profileInput.sterilization !== undefined) profileUpdates.sterilization = profileInput.sterilization;
    if (profileInput.disposableTools !== undefined) profileUpdates.disposableTools = profileInput.disposableTools;
    if (data.isActive !== undefined) profileUpdates.isActive = data.isActive;
    if (data.isModerated !== undefined) profileUpdates.isModerated = data.isModerated;

    // Координаты: явные из формы, иначе геокод при изменении адреса
    if (profileInput.latitude !== undefined) profileUpdates.latitude = String(profileInput.latitude);
    if (profileInput.longitude !== undefined) profileUpdates.longitude = String(profileInput.longitude);
    if (profileInput.address !== undefined && profileInput.latitude === undefined) {
      try {
        const city = profileInput.city ?? existingProfile.city ?? '';
        const geo = await geocodeAddress(city ? `${city}, ${profileInput.address}` : profileInput.address);
        if (geo) {
          profileUpdates.latitude = String(geo.latitude);
          profileUpdates.longitude = String(geo.longitude);
        }
      } catch (err) {
        logger.warn({ err, address: profileInput.address }, 'Master geocode failed');
      }
    }

    if (data.phone !== undefined) profileUpdates.phone = data.phone;

    if (Object.keys(userUpdates).length || Object.keys(profileUpdates).length) {
      await db.transaction(async (tx) => {
        if (Object.keys(userUpdates).length) {
          await tx.update(schema.users).set(userUpdates).where(eq(schema.users.id, id));
        }
        if (Object.keys(profileUpdates).length) {
          await tx.update(schema.masterProfiles).set(profileUpdates).where(eq(schema.masterProfiles.userId, id));
        }
      });
    }

    logger.info({ adminId: admin.userId, masterId: id }, 'Master updated by admin');
    return successResponse(null, 'Мастер обновлен');
  } catch (error) {
    logger.error(error, 'PUT /api/admin/masters/[id] error');
    if ((error as { code?: string }).code === '23505') {
      return errorResponse('Телефон или username уже заняты', 409);
    }
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
