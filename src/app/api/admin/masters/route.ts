import { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { eq, ilike, or } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import { successResponse, errorResponse } from '@/lib/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api-middleware';
import { adminCreateMasterSchema } from '@/lib/validators';
import { geocodeAddress } from '@/lib/geo';
import { buildScheduleSlots, type ScheduleSlotData } from '@/lib/schedule';
import { logger } from '@/lib/logger';

async function generateUsername(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = `user_${uuid().slice(0, 8)}`;
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, candidate))
      .limit(1);
    if (!existing.length) return candidate;
  }
  throw new Error('Не удалось сгенерировать уникальный username');
}

// GET /api/admin/masters — все мастера, включая скрытых и непроверенных
export const GET = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (user.role !== 'admin') return errorResponse('Только для администраторов', 403);

    const search = req.nextUrl.searchParams.get('search')?.trim();
    const where = search
      ? or(
          ilike(schema.masterProfiles.fullName, `%${search}%`),
          ilike(schema.masterProfiles.phone, `%${search}%`),
          ilike(schema.masterProfiles.city, `%${search}%`),
          ilike(schema.users.username, `%${search}%`),
        )
      : undefined;

    const rows = await db
      .select({
        userId: schema.masterProfiles.userId,
        fullName: schema.masterProfiles.fullName,
        phone: schema.masterProfiles.phone,
        city: schema.masterProfiles.city,
        rating: schema.masterProfiles.rating,
        totalOrders: schema.masterProfiles.totalOrders,
        isActive: schema.masterProfiles.isActive,
        isModerated: schema.masterProfiles.isModerated,
        username: schema.users.username,
        email: schema.users.email,
        avatarUrl: schema.users.avatarUrl,
        blocked: schema.users.blocked,
      })
      .from(schema.masterProfiles)
      .innerJoin(schema.users, eq(schema.users.id, schema.masterProfiles.userId))
      .where(where)
      .orderBy(schema.masterProfiles.fullName);

    return successResponse(rows);
  } catch (error) {
    logger.error(error, 'GET /api/admin/masters error');
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});

// POST /api/admin/masters — создать полноценного мастера
export const POST = withAuth(async (req: NextRequest) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (user.role !== 'admin') return errorResponse('Только для администраторов', 403);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Некорректный JSON в теле запроса', 400);
    }

    const parsed = adminCreateMasterSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.errors.map((e) => e.message).join('; '), 422);
    }

    const { phone, username: rawUsername, age, avatarUrl, isActive, isModerated, profile, services, schedule } = parsed.data;

    // Телефон уникален и в users, и в master_profiles
    const phoneOwner = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.phone, phone))
      .limit(1);
    if (phoneOwner.length) return errorResponse('Пользователь с таким телефоном уже существует', 409);

    const masterPhoneOwner = await db
      .select({ userId: schema.masterProfiles.userId })
      .from(schema.masterProfiles)
      .where(eq(schema.masterProfiles.phone, phone))
      .limit(1);
    if (masterPhoneOwner.length) return errorResponse('Мастер с таким телефоном уже существует', 409);

    // Username: заданный админом или сгенерированный
    let username: string;
    if (rawUsername?.trim()) {
      username = rawUsername.trim();
      const usernameOwner = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, username))
        .limit(1);
      if (usernameOwner.length) return errorResponse('Пользователь с таким username уже существует', 409);
    } else {
      username = await generateUsername();
    }

    // Координаты: из формы или геокодинг адреса
    let latitude = profile.latitude;
    let longitude = profile.longitude;
    if ((latitude === undefined || longitude === undefined) && profile.address) {
      try {
        const geo = await geocodeAddress(`${profile.city}, ${profile.address}`);
        if (geo) {
          latitude = geo.latitude;
          longitude = geo.longitude;
        }
      } catch (err) {
        logger.warn({ err, address: profile.address }, 'Master geocode failed');
      }
    }

    // Начальное расписание
    let scheduleSlots: ScheduleSlotData[] = [];
    if (schedule) {
      const today = new Date().toISOString().split('T')[0];
      if (schedule.workDate < today) {
        return errorResponse('Нельзя создать расписание на прошедшую дату', 422);
      }
      const built = buildScheduleSlots({
        startDate: schedule.workDate,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        intervalMinutes: schedule.intervalMinutes,
        repeatDays: schedule.repeatDays,
        weeks: schedule.weeks,
      });
      if (built.error) return errorResponse(built.error, 422);
      scheduleSlots = built.slots;
    }

    const userId = await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(schema.users)
        .values({
          phone,
          username,
          role: 'nailmaster',
          isGuest: false,
          age: age ?? null,
          avatarUrl: avatarUrl ?? null,
        })
        .returning({ id: schema.users.id });

      await tx.insert(schema.masterProfiles).values({
        userId: newUser.id,
        fullName: profile.fullName,
        phone,
        address: profile.address,
        description: profile.description ?? null,
        experience: profile.experience,
        city: profile.city,
        specialties: profile.specialties,
        startingPrice: String(profile.startingPrice),
        workFormat: profile.workFormat,
        sterilization: profile.sterilization,
        disposableTools: profile.disposableTools,
        latitude: latitude !== undefined ? String(latitude) : null,
        longitude: longitude !== undefined ? String(longitude) : null,
        isActive,
        isModerated,
      });

      if (services.length) {
        await tx.insert(schema.masterServices).values(
          services.map((s) => ({
            name: s.name,
            description: s.description ?? null,
            price: String(s.price),
            duration: s.duration,
            masterId: newUser.id,
          })),
        );
      }

      if (scheduleSlots.length) {
        await tx.insert(schema.schedules).values(
          scheduleSlots.map((slot) => ({
            workDate: slot.workDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
            status: 'available',
            masterId: newUser.id,
          })),
        );
      }

      return newUser.id;
    });

    logger.info({ adminId: user.userId, masterId: userId, services: services.length, slots: scheduleSlots.length }, 'Master created by admin');
    return successResponse({ userId }, 'Мастер создан', 201);
  } catch (error) {
    logger.error(error, 'POST /api/admin/masters error');
    if ((error as { code?: string }).code === '23505') {
      return errorResponse('Пользователь с таким телефоном или username уже существует', 409);
    }
    return errorResponse('Внутренняя ошибка сервера', 500);
  }
});
